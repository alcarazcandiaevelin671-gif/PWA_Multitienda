import { NextResponse, type NextRequest } from 'next/server';
import { isDeniedResponse, isPermissionError, requireAdmin } from '@/lib/admin-server';

const RESOURCES = {
  usuarios: { table: 'usuarios', order: 'creado_en', search: ['nombre_completo', 'email'] },
  comercios: { table: 'tiendas', order: 'creado_en', search: ['nombre_comercio', 'email', 'whatsapp'] },
  categorias: { table: 'categorias', order: 'nombre', search: ['nombre'] },
  departamentos: { table: 'departamentos', order: 'nombre', search: ['nombre'] },
  distritos: { table: 'distritos', order: 'nombre', search: ['nombre'] },
  auditorias: { table: 'auditorias', order: 'fecha_hora', search: ['accion', 'tabla_afectada'] },
  notificaciones: { table: 'notificaciones', order: 'created_at', search: [] },
} as const;

type Resource = keyof typeof RESOURCES;
const STATUS_FIELDS = {
  usuarios: 'activo',
  categorias: 'activo',
  departamentos: 'activo',
  distritos: 'activo',
} as const;

export async function GET(request: NextRequest, { params }: { params: { resource: string } }) {
  if (!Object.hasOwn(RESOURCES, params.resource)) {
    return NextResponse.json({ error: 'Sección administrativa no válida.' }, { status: 404 });
  }

  const resource = params.resource as Resource;
  const definition = RESOURCES[resource];
  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize')) || 25));
  const search = (searchParams.get('q') || '').trim().replace(/[\\%_,()]/g, '\\$&');
  let query = access.supabase
    .from(definition.table)
    .select('*', { count: 'exact' })
    .order(definition.order, { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search && resource === 'auditorias') {
    const { data: matchingUsers, error: userSearchError } = await access.supabase
      .from('usuarios')
      .select('id')
      .or(`nombre_completo.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(1000);
    if (userSearchError) {
      return NextResponse.json(
        { error: isPermissionError(userSearchError) ? 'La política RLS no permite buscar usuarios.' : 'No se pudo buscar el administrador.' },
        { status: isPermissionError(userSearchError) ? 403 : 502 }
      );
    }
    const filters = definition.search.map((field) => `${field}.ilike.%${search}%`);
    const userIds = (matchingUsers ?? []).map((user) => user.id).filter((id): id is string => typeof id === 'string');
    if (userIds.length > 0) filters.push(`usuario_id.in.(${userIds.join(',')})`);
    query = query.or(filters.join(','));
  } else if (search && definition.search.length > 0) {
    query = query.or(definition.search.map((field) => `${field}.ilike.%${search}%`).join(','));
  }

  const status = searchParams.get('status');
  if (status && resource === 'comercios') {
    query = query.eq('estado', status);
  }
  if (resource === 'usuarios') {
    const requestedRole = searchParams.get('role');
    const role = requestedRole === 'administrador' ? 'admin' : requestedRole;
    if (role && ['cliente', 'comerciante', 'admin'].includes(role)) query = query.eq('rol', role);
  }
  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: isPermissionError(error) ? 'La política RLS no permite consultar esta sección.' : 'No se pudieron cargar los registros.' },
      { status: isPermissionError(error) ? 403 : 502 }
    );
  }

  const records = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const ids = (field: string) => Array.from(new Set(records.map((record) => record[field]).filter((id): id is string => typeof id === 'string')));
  const enrich = async (
    table: 'usuarios' | 'tiendas' | 'distritos' | 'categorias' | 'productos' | 'departamentos',
    column: string,
    values: string[],
    selection = '*'
  ) => {
    if (values.length === 0) return [] as Array<Record<string, unknown>>;
    const { data: related, error: relatedError } = await access.supabase.from(table).select(selection).in(column, values);
    if (relatedError) throw relatedError;
    return (related ?? []) as unknown as Array<Record<string, unknown>>;
  };

  try {
    if (resource === 'auditorias') {
      const targetIds = (table: string) => Array.from(new Set(records
        .filter((record) => record.tabla_afectada === table)
        .map((record) => record.registro_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)));
      const [actors, shops, users, products, categories, departments, districts] = await Promise.all([
        enrich('usuarios', 'id', ids('usuario_id'), 'id,nombre_completo,email'),
        enrich('tiendas', 'id', targetIds('tiendas'), 'id,nombre_comercio'),
        enrich('usuarios', 'id', targetIds('usuarios'), 'id,email'),
        enrich('productos', 'id', targetIds('productos'), 'id,titulo'),
        enrich('categorias', 'id', targetIds('categorias'), 'id,nombre'),
        enrich('departamentos', 'id', targetIds('departamentos'), 'id,nombre'),
        enrich('distritos', 'id', targetIds('distritos'), 'id,nombre'),
      ]);
      const makeMap = (rows: Array<Record<string, unknown>>) => new Map(rows.map((row) => [String(row.id), row]));
      const actorsById = makeMap(actors);
      const entityMaps = {
        tiendas: makeMap(shops),
        usuarios: makeMap(users),
        productos: makeMap(products),
        categorias: makeMap(categories),
        departamentos: makeMap(departments),
        distritos: makeMap(districts),
      };
      const labelFields: Record<keyof typeof entityMaps, string[]> = {
        tiendas: ['nombre_comercio'],
        usuarios: ['email'],
        productos: ['titulo'],
        categorias: ['nombre'],
        departamentos: ['nombre'],
        distritos: ['nombre'],
      };

      for (const record of records) {
        const actor = typeof record.usuario_id === 'string' ? actorsById.get(record.usuario_id) : undefined;
        const actorName = typeof actor?.nombre_completo === 'string' ? actor.nombre_completo : '';
        const actorEmail = typeof actor?.email === 'string' ? actor.email : '';
        record.administrador = actor
          ? `${actorName || actorEmail}${actorName && actorEmail ? ` (${actorEmail})` : ''}`
          : 'Sistema / Autenticación';

        const table = typeof record.tabla_afectada === 'string' ? record.tabla_afectada : '';
        const entityMap = entityMaps[table as keyof typeof entityMaps];
        const entity = entityMap && record.registro_id ? entityMap.get(String(record.registro_id)) : undefined;
        const label = entity && labelFields[table as keyof typeof entityMaps]
          .map((field) => entity[field])
          .find((value): value is string => typeof value === 'string' && value.length > 0);
        const reference = typeof record.registro_id === 'string' ? record.registro_id : '';
        record.registro_legible = label || (reference ? `Registro no disponible (${reference.slice(0, 8)}…)` : '—');
      }
    }

    if (resource === 'comercios') {
      const [owners, districts] = await Promise.all([
        enrich('usuarios', 'id', ids('usuario_id')),
        enrich('distritos', 'id', records.map((record) => record.distrito_id).filter((id): id is number => typeof id === 'number').map(String)),
      ]);
      const departmentIds = Array.from(new Set(districts
        .map((district) => district.departamento_id)
        .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
        .map(String)));
      const departments = await enrich('departamentos', 'id', departmentIds);
      const ownerMap = new Map(owners.map((owner) => [String(owner.id), owner]));
      const districtMap = new Map(districts.map((district) => [String(district.id), district]));
      const departmentMap = new Map(departments.map((department) => [String(department.id), department.nombre]));
      for (const record of records) {
        const owner = ownerMap.get(String(record.usuario_id));
        const district = districtMap.get(String(record.distrito_id));
        record.propietario = owner?.nombre_completo ?? null;
        record.propietario_email = owner?.email ?? record.email ?? null;
        record.propietario_telefono = owner?.telefono_contacto ?? record.telefono ?? record.whatsapp ?? null;
        record.distrito = district?.nombre ?? null;
        record.departamento = district ? departmentMap.get(String(district.departamento_id)) ?? null : null;
      }
    }

  } catch (relatedError) {
    if (isPermissionError(relatedError as { code?: string; message?: string })) {
      return NextResponse.json({ error: 'La política RLS no permite consultar las relaciones de esta sección.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'No se pudieron cargar las relaciones de los registros.' }, { status: 502 });
  }

  return NextResponse.json({ records, total: count ?? 0, page, pageSize });
}

export async function PATCH(request: NextRequest, { params }: { params: { resource: string } }) {
  if (!Object.hasOwn(RESOURCES, params.resource)) {
    return NextResponse.json({ error: 'Sección administrativa no válida.' }, { status: 404 });
  }

  const resource = params.resource as Resource;
  const statusField = STATUS_FIELDS[resource as keyof typeof STATUS_FIELDS];
  if (!statusField) return NextResponse.json({ error: 'Esta sección no permite cambiar estados.' }, { status: 405 });

  let body: { id?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 });
  }
  const id = body.id;
  if ((!['string', 'number'].includes(typeof id)) || id === '' || id === null || id === undefined || typeof body.value !== 'boolean') {
    return NextResponse.json({ error: 'El registro o el estado no son válidos.' }, { status: 400 });
  }

  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;

  const table = RESOURCES[resource].table;
  const { data: current, error: readError } = await access.supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { error: isPermissionError(readError) ? 'La política RLS no permite consultar este registro.' : 'No se pudo consultar el registro.' },
      { status: isPermissionError(readError) ? 403 : 502 }
    );
  }
  if (!current) return NextResponse.json({ error: 'No se encontró el registro.' }, { status: 404 });

  const currentRecord = current as unknown as Record<string, unknown>;
  if (typeof currentRecord[statusField] !== 'boolean') {
    return NextResponse.json({ error: 'El registro no tiene un estado booleano compatible.' }, { status: 409 });
  }
  if (currentRecord[statusField] === body.value) {
    return NextResponse.json({ error: 'El registro ya tiene ese estado.' }, { status: 409 });
  }

  const { data: updated, error: updateError } = await access.supabase
    .from(table)
    .update({ [statusField]: body.value } as never)
    .eq('id', id)
    .eq(statusField, currentRecord[statusField])
    .select('*')
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: isPermissionError(updateError) ? 'La política RLS no autoriza cambiar este estado.' : 'No se pudo cambiar el estado.' },
      { status: isPermissionError(updateError) ? 403 : 502 }
    );
  }
  if (!updated) return NextResponse.json({ error: 'El registro cambió; actualiza la lista e inténtalo otra vez.' }, { status: 409 });

  const { error: auditError } = await access.supabase.from('auditorias').insert({
    usuario_id: access.user.id,
    accion: 'cambio_estado_admin',
    tabla_afectada: table,
    registro_id: String(id),
    datos_anteriores: { [statusField]: currentRecord[statusField] as boolean },
    datos_nuevos: { [statusField]: body.value },
  });

  return NextResponse.json({
    record: updated,
    auditLogged: !auditError,
    auditWarning: auditError ? 'El estado se actualizó correctamente.' : null,
  });
}