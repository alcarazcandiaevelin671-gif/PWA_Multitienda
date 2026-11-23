'use client';

/**
 * [FRONTEND] Listado genérico de administración (usuarios, comercios, categorías, productos…) con búsqueda, filtros y acciones.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { showAppConfirm } from '@/frontend/lib/app-message';

type RecordRow = Record<string, unknown>;

const sections: Record<string, { resource: string; title: string; description: string }> = {
  usuarios: { resource: 'usuarios', title: 'Usuarios', description: 'Perfiles registrados y rol asignado.' },
  comercios: { resource: 'comercios', title: 'Comercios', description: 'Solicitudes y comercios registrados en la plataforma.' },
  categorias: { resource: 'categorias', title: 'Categorías', description: 'Categorías disponibles en el catálogo.' },
  departamentos: { resource: 'departamentos', title: 'Departamentos', description: 'Departamentos registrados.' },
  distritos: { resource: 'distritos', title: 'Distritos', description: 'Distritos y departamento relacionado.' },
  auditorias: { resource: 'auditorias', title: 'Logs de sistema', description: 'Todo lo que pasa en la base: altas (INSERT), cambios (UPDATE), borrados (DELETE), vaciados (TRUNCATE) y cambios de estructura (CREATE/ALTER/DROP), con quién, cuándo, desde qué IP y cómo estaba antes y después.' },
  notificaciones: { resource: 'notificaciones', title: 'Notificaciones', description: 'Mensajes enviados, destinatarios y estado de lectura.' },
};

const columns: Record<string, Array<[string, string]>> = {
  usuarios: [['nombre_completo', 'Nombre'], ['email', 'Correo'], ['telefono_contacto', 'Teléfono'], ['rol', 'Rol'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  comercios: [['nombre_comercio', 'Comercio'], ['propietario', 'Comerciante'], ['distrito', 'Distrito'], ['estado', 'Estado'], ['whatsapp', 'Contacto'], ['creado_en', 'Registro']],
  categorias: [['nombre', 'Categoría'], ['descripcion', 'Descripción'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  departamentos: [['nombre', 'Departamento'], ['codigo', 'Código'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  distritos: [['nombre', 'Distrito'], ['departamento_id', 'Departamento'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  auditorias: [['operacion', 'Tipo'], ['accion', 'Acción'], ['tabla_afectada', 'Tabla'], ['registro_legible', 'Registro'], ['administrador', 'Quién'], ['ip', 'IP'], ['fecha_hora', 'Fecha y hora']],
  notificaciones: [['titulo', 'Notificación'], ['destinatario', 'Destinatario'], ['tipo', 'Tipo'], ['mensaje', 'Mensaje'], ['leida', 'Estado'], ['created_at', 'Fecha y hora']],
};

const managedStatusSections = new Set(['usuarios', 'categorias', 'departamentos', 'distritos']);

function formatValue(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (['total', 'precio_gs', 'precio', 'subtotal', 'descuento', 'iva'].includes(field)) return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Number(value)) + ' Gs.';
  if (['creado_en', 'created_at', 'fecha', 'fecha_hora'].includes(field)) {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    // En los logs importan los segundos
    if (field === 'fecha_hora') return date.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'medium' });
    return field === 'created_at'
      ? date.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })
      : date.toLocaleDateString('es-PY');
  }
  return String(value).replaceAll('_', ' ');
}

const auditActionBadges: Record<string, { label: string; className: string }> = {
  INSERT: { label: 'Creación / Registro', className: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' },
  UPDATE: { label: 'Modificación', className: 'border-accent-300/30 bg-accent-300/10 text-accent-200' },
  DELETE: { label: 'Eliminación', className: 'border-rose-300/30 bg-rose-300/10 text-rose-200' },
  CAMBIO_ESTADO_ADMIN: { label: 'Cambio de estado', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
  APROBACION_COMERCIO: { label: 'Aprobación de comercio', className: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' },
  RECHAZO_COMERCIO: { label: 'Rechazo de comercio', className: 'border-rose-300/30 bg-rose-300/10 text-rose-200' },
  DESACTIVACION_CUENTA: { label: 'Desactivación de cuenta', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
};

/**
 * Tipos de operación de los logs (columna `auditorias.operacion`, la llenan los triggers de la base).
 * El orden es el de los botones de filtro.
 */
const auditOperations: Array<{ value: string; label: string; help: string; className: string }> = [
  { value: 'INSERT', label: 'INSERT', help: 'Altas: registros creados', className: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' },
  { value: 'UPDATE', label: 'UPDATE', help: 'Modificaciones de registros', className: 'border-sky-300/30 bg-sky-300/10 text-sky-200' },
  { value: 'DELETE', label: 'DELETE', help: 'Registros borrados', className: 'border-rose-300/30 bg-rose-300/10 text-rose-200' },
  { value: 'TRUNCATE', label: 'TRUNCATE', help: 'Tablas vaciadas completas', className: 'border-orange-300/30 bg-orange-300/10 text-orange-200' },
  { value: 'DDL', label: 'DDL', help: 'Estructura: CREATE, ALTER, DROP', className: 'border-violet-300/30 bg-violet-300/10 text-violet-200' },
  { value: 'APP', label: 'APP', help: 'Acciones registradas por la aplicación', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
];
const auditOperationByValue = new Map(auditOperations.map((operation) => [operation.value, operation]));

/** Tablas con trigger de auditoría (para el filtro por tabla). */
const auditTables = ['categorias', 'departamentos', 'distritos', 'factura_detalles', 'facturas', 'favoritos', 'historial_busquedas', 'interacciones_clics', 'notificaciones', 'pedido_detalles', 'pedido_estado_historial', 'pedidos', 'planes_suscripcion', 'producto_tags', 'productos', 'recomendaciones_ia', 'suscripciones', 'tags_ia', 'tiendas', 'usuario_configuracion', 'usuarios', 'venta_detalles', 'ventas'];

const auditOriginLabels: Record<string, string> = {
  app: 'Navegador (app)',
  servidor: 'Servidor de la app',
  sql: 'SQL directo / sistema',
};

/** Filtros de los logs; vacío = sin filtrar. */
const EMPTY_AUDIT_FILTERS = { operacion: '', tabla: '', usuario: '', origen: '', ip: '', desde: '', hasta: '' };
type AuditFilters = typeof EMPTY_AUDIT_FILTERS;

const notificationTypeLabels: Record<string, string> = {
  promocion: 'Promoción',
  comercio_aprobado: 'Comercio aprobado',
  stock_bajo: 'Stock bajo',
  stock_agotado: 'Sin stock',
  stock_repuesto: 'Stock repuesto',
  comercio_rechazado: 'Comercio rechazado',
};

function renderRecordValue(section: string, record: RecordRow, key: string) {
  if (section === 'auditorias' && key === 'operacion') {
    const operation = auditOperationByValue.get(String(record.operacion ?? ''));
    return operation
      ? <span title={operation.help} className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${operation.className}`}>{operation.label}</span>
      : <span className="text-slate-500">—</span>;
  }

  // Acciones de estructura (CREATE TABLE, ALTER TABLE…) y de filas se muestran tal cual
  if (section === 'auditorias' && key === 'accion' && ['DDL', 'TRUNCATE', 'INSERT', 'UPDATE', 'DELETE'].includes(String(record.operacion))) {
    return <span className="block truncate font-mono text-xs text-slate-200" title={String(record.accion ?? '')}>{String(record.accion ?? '—')}</span>;
  }

  if (section === 'auditorias' && key === 'ip') {
    const ip = String(record.ip_cliente || record.ip || '');
    return ip ? <span className="font-mono text-xs text-slate-300" title={record.ip_cliente ? `IP del visitante (vía servidor). IP de conexión: ${String(record.ip ?? '—')}` : 'IP de conexión'}>{ip}</span> : <span className="text-slate-500">—</span>;
  }

  if (section === 'auditorias' && key === 'accion') {
    const action = String(record.accion ?? '').toUpperCase();
    const badge = auditActionBadges[action] ?? {
      label: action.replaceAll('_', ' ').toLowerCase() || 'Acción',
      className: 'border-slate-300/20 bg-slate-300/10 text-slate-300',
    };
    return <span title={action} className={`inline-flex max-w-56 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>;
  }

  if (section === 'notificaciones' && key === 'tipo') {
    const rawType = String(record.tipo ?? '').toLowerCase();
    const type = rawType.replaceAll('_', ' ');
    const label = notificationTypeLabels[rawType] ?? (type ? `${type.charAt(0).toLocaleUpperCase('es-PY')}${type.slice(1)}` : 'Sin tipo');
    return <span className="inline-flex rounded-full border border-accent-300/20 bg-accent-300/10 px-2 py-1 text-xs font-semibold text-accent-200">{label}</span>;
  }

  if (section === 'notificaciones' && key === 'leida') {
    const isRead = record.leida === true;
    return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${isRead ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200'}`}>{isRead ? 'Leída' : 'Pendiente'}</span>;
  }

  const isStatus = key === 'estado' || key === 'rol' || key === 'disponible' || key === 'activo';
  return <span className={isStatus ? 'inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-xs font-semibold capitalize' : 'block truncate'} title={String(record[key] ?? '')}>{formatValue(record[key], key)}</span>;
}

function NotificationInspection({ record }: { record: RecordRow }) {
  const fields = [
    ['titulo', 'Título'],
    ['destinatario', 'Destinatario'],
    ['tipo', 'Tipo'],
    ['leida', 'Estado'],
    ['created_at', 'Fecha y hora'],
    ['link', 'Enlace de destino'],
  ];

  return (
    <div className="mt-5 space-y-4">
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {fields.map(([key, label]) => (
          <div key={key} className="min-w-0 border-b border-white/[0.06] pb-3">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 break-words text-sm text-slate-200">{key === 'tipo' || key === 'leida' ? renderRecordValue('notificaciones', record, key) : formatValue(record[key], key)}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Mensaje</h4>
        <p className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-200">{formatValue(record.mensaje, 'mensaje')}</p>
      </section>
    </div>
  );
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Detalle completo de un log: qué se hizo, quién, cuándo y desde dónde.
 * Debajo se muestra la comparación antes/después (AuditChanges).
 */
function AuditDetail({ record }: { record: RecordRow }) {
  const changed = Array.isArray(record.campos_modificados) ? (record.campos_modificados as string[]) : [];
  const Item = ({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) => (
    <div className={`min-w-0 border-b border-white/[0.06] pb-3 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-200">{children}</dd>
    </div>
  );
  const text = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value));

  return (
    <div className="mt-5 space-y-6">
      <section>
        <h4 className="mb-3 text-sm font-bold text-white">Qué se hizo</h4>
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <Item label="Tipo de operación">{renderRecordValue('auditorias', record, 'operacion')}</Item>
          <Item label="Acción">{renderRecordValue('auditorias', record, 'accion')}</Item>
          <Item label="Tabla">{text(record.tabla_afectada)}{record.esquema ? <span className="text-slate-500"> ({String(record.esquema)})</span> : null}</Item>
          <Item label="Registro">{text(record.registro_legible)}</Item>
          <Item label="ID del registro"><span className="font-mono text-xs">{text(record.registro_id)}</span></Item>
          <Item label="Objeto">{text(record.objeto)}</Item>
          {changed.length > 0 && (
            <Item label="Campos modificados" wide>
              <span className="flex flex-wrap gap-1">{changed.map((field) => <span key={field} className="rounded bg-sky-300/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-200">{field}</span>)}</span>
            </Item>
          )}
        </dl>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-bold text-white">Quién y cuándo</h4>
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <Item label="Usuario">{text(record.administrador)}</Item>
          <Item label="Correo">{text(record.usuario_email)}</Item>
          <Item label="Rol en la app">{text(record.usuario_rol)}</Item>
          <Item label="Rol en la base"><span className="font-mono text-xs">{text(record.rol_bd)}</span></Item>
          <Item label="Origen">{auditOriginLabels[String(record.origen)] ?? text(record.origen)}</Item>
          <Item label="Fecha y hora">{formatValue(record.fecha_hora, 'fecha_hora')}</Item>
        </dl>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-bold text-white">Desde dónde</h4>
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <Item label="IP del visitante"><span className="font-mono text-xs">{text(record.ip_cliente || record.ip)}</span></Item>
          <Item label="IP de conexión"><span className="font-mono text-xs">{text(record.ip)}</span></Item>
          <Item label="Método / ruta"><span className="font-mono text-xs">{text([record.metodo_http, record.ruta].filter(Boolean).join(' ') || null)}</span></Item>
          <Item label="Navegador / dispositivo" wide><span className="text-xs text-slate-300">{text(record.user_agent)}</span></Item>
        </dl>
      </section>

      {typeof record.comando_sql === 'string' && record.comando_sql && (
        <section>
          <h4 className="mb-3 text-sm font-bold text-white">Comando ejecutado</h4>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-violet-200">{record.comando_sql}</pre>
        </section>
      )}
    </div>
  );
}

function AuditChanges({ record }: { record: RecordRow }) {
  const before = record.datos_anteriores && typeof record.datos_anteriores === 'object' && !Array.isArray(record.datos_anteriores)
    ? record.datos_anteriores as Record<string, unknown>
    : {};
  const after = record.datos_nuevos && typeof record.datos_nuevos === 'object' && !Array.isArray(record.datos_nuevos)
    ? record.datos_nuevos as Record<string, unknown>
    : {};
  const technicalFields = new Set(['id', 'usuario_id', 'registro_id', 'creado_en', 'actualizado_en', 'created_at', 'updated_at', 'fecha_hora']);
  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter((field) =>
    !technicalFields.has(field) && JSON.stringify(before[field]) !== JSON.stringify(after[field])
  );

  return (
    <section className="mt-6">
      <h4 className="mb-3 text-sm font-bold text-white">
        {record.operacion === 'INSERT' ? 'Datos con los que se creó' : record.operacion === 'DELETE' ? 'Datos que tenía antes de borrarse' : 'Cómo estaba antes y cómo quedó'}
      </h4>
      {fields.length ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400"><tr><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Antes</th><th className="px-3 py-2">Después</th></tr></thead>
            <tbody className="divide-y divide-white/[0.06]">
              {fields.map((field) => <tr key={field}><th scope="row" className="px-3 py-3 align-top font-semibold capitalize text-slate-300">{field.replaceAll('_', ' ')}</th><td className="max-w-72 whitespace-pre-wrap break-words bg-rose-400/[0.08] px-3 py-3 align-top text-rose-200">{formatAuditValue(before[field])}</td><td className="max-w-72 whitespace-pre-wrap break-words bg-emerald-400/[0.08] px-3 py-3 align-top text-emerald-200">{formatAuditValue(after[field])}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">No hay campos modificados para mostrar.</p>
      )}
    </section>
  );
}

function CommerceInspection({ record }: { record: RecordRow }) {
  const imageEntries = Object.entries(record).filter(([key, value]) =>
    /(logo|portada|banner|imagen|foto)/i.test(key) && typeof value === 'string' && value.trim().length > 0
  ) as Array<[string, string]>;
  const latitude = Number(record.latitud);
  const longitude = Number(record.longitud);
  const hasLocationValues = [record.latitud, record.longitud].every((value) => value !== null && value !== undefined && value !== '');
  const hasLocation = hasLocationValues && Number.isFinite(latitude) && Number.isFinite(longitude);

  const Info = ({ label, value }: { label: string; value: unknown }) => (
    <div className="min-w-0 border-b border-white/[0.06] pb-3">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-200">{formatValue(value, label === 'Fecha de registro' ? 'creado_en' : label)}</dd>
    </div>
  );

  return (
    <div className="mt-5 space-y-6">
      <section>
        <h4 className="mb-3 text-sm font-bold text-white">Datos generales</h4>
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <Info label="Nombre comercial" value={record.nombre_comercio} />
          <Info label="Categoría" value={record.categoria_principal} />
          <Info label="Estado actual" value={record.estado} />
          <Info label="Fecha de registro" value={record.creado_en} />
          <div className="border-b border-white/[0.06] pb-3 sm:col-span-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Descripción</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-200">{formatValue(record.descripcion, 'descripcion')}</dd></div>
        </dl>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-bold text-white">Datos del comerciante</h4>
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <Info label="Propietario" value={record.propietario} />
          <Info label="Correo de contacto" value={record.propietario_email} />
          <Info label="Teléfono" value={record.propietario_telefono} />
          <Info label="WhatsApp del comercio" value={record.whatsapp} />
        </dl>
      </section>

      <section>
        <h4 className="mb-3 text-sm font-bold text-white">Ubicación</h4>
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <Info label="Departamento" value={record.departamento} />
          <Info label="Distrito" value={record.distrito} />
          <div className="border-b border-white/[0.06] pb-3 sm:col-span-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Dirección</dt><dd className="mt-1 break-words text-sm text-slate-200">{formatValue(record.direccion_texto, 'direccion_texto')}</dd></div>
          <Info label="Latitud" value={record.latitud} />
          <Info label="Longitud" value={record.longitud} />
        </dl>
        {hasLocation && <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-accent-300 hover:text-accent-200 hover:underline">Abrir ubicación en el mapa</a>}
      </section>

      <section>
        <h4 className="mb-3 text-sm font-bold text-white">Documentación e imágenes</h4>
        {imageEntries.length ? <div className="grid gap-3 sm:grid-cols-2">{imageEntries.map(([key, url]) => <figure key={key} className="overflow-hidden rounded-lg border border-white/10 bg-black/20"><div className="relative h-40"><Image src={url} alt={key.replaceAll('_', ' ')} fill unoptimized className="object-contain" sizes="(max-width: 640px) 100vw, 50vw" /></div><figcaption className="border-t border-white/10 px-3 py-2 text-xs font-semibold capitalize text-slate-300">{key.replaceAll('_', ' ')}</figcaption></figure>)}</div> : <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">No hay imágenes adjuntas a este comercio.</p>}
      </section>

    </div>
  );
}

export default function AdminRecordsPage({ section }: { section: string }) {
  const viewSection = section === 'auditoria' ? 'auditorias' : section;
  const config = sections[viewSection];
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  // Filtros propios de los logs y total por tipo de operación (para los botones)
  const [auditFilters, setAuditFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [operationCounts, setOperationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null);
  const [rejectionMode, setRejectionMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [shopStatusLoadingId, setShopStatusLoadingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const pageSize = 25;

  useEffect(() => {
    if (!config) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('q', search.trim());
      if (status) params.set('status', status);
      if (role) params.set('role', role);
      if (viewSection === 'auditorias') {
        Object.entries(auditFilters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
      }

      try {
        const response = await fetch(`/api/admin/${config.resource}?${params}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los datos.');
        setRecords(result.records ?? []);
        setTotal(result.total ?? 0);
        if (result.operationCounts) setOperationCounts(result.operationCounts);
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setRecords([]);
        setTotal(0);
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los datos.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [config, page, search, status, role, section, refreshKey, viewSection, auditFilters]);

  useEffect(() => {
    if (!selectedRecord) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRecord(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedRecord]);

  if (!config) return <p className="rounded-lg border border-white/10 p-5 text-sm text-slate-300">Sección no encontrada.</p>;

  const setFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const setAuditFilter = (key: keyof AuditFilters, value: string) => { setAuditFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const activeAuditFilters = Object.values(auditFilters).filter((value) => value.trim()).length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fields = columns[viewSection] ?? [];
  const approveShop = async (record: RecordRow, askConfirmation = true) => {
    const shopName = String(record.nombre_comercio || 'este comercio');
    if (askConfirmation && !await showAppConfirm(`¿Confirmas la aprobación de ${shopName}?`, '¿Aprobar comercio?', 'Aprobar')) return;
    setNotice('');
    setError('');
    setDecisionError('');
    setDecisionLoading(true);
    try {
      const response = await fetch(`/api/admin/comercios/${encodeURIComponent(String(record.id))}/approve`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo aprobar el comercio.');
      setNotice(result.auditWarning || 'Comercio aprobado. La acción quedó registrada en los logs de sistema.');
      setRefreshKey((value) => value + 1);
      setSelectedRecord(null);
      setRejectionMode(false);
      setRejectionReason('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo aprobar el comercio.';
      if (selectedRecord?.id === record.id) setDecisionError(message);
      else setError(message);
    } finally {
      setDecisionLoading(false);
    }
  };

  const rejectShop = async (record: RecordRow, reason = '', askConfirmation = true) => {
    const shopName = String(record.nombre_comercio || 'este comercio');
    if (askConfirmation && !await showAppConfirm(`¿Confirmas el rechazo de ${shopName}?`, '¿Rechazar comercio?', 'Rechazar')) return;
    setNotice('');
    setError('');
    setDecisionError('');
    setDecisionLoading(true);
    try {
      const response = await fetch(`/api/admin/comercios/${encodeURIComponent(String(record.id))}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacion: reason.trim() || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo rechazar el comercio.');
      setNotice(result.auditWarning || 'Comercio rechazado. La acción quedó registrada en los logs de sistema.');
      setRefreshKey((value) => value + 1);
      setSelectedRecord(null);
      setRejectionMode(false);
      setRejectionReason('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo rechazar el comercio.';
      if (selectedRecord?.id === record.id) setDecisionError(message);
      else setError(message);
    } finally {
      setDecisionLoading(false);
    }
  };

  const changeShopStatus = async (record: RecordRow) => {
    const currentStatus = String(record.estado ?? '').toLowerCase();
    if (currentStatus !== 'activa' && currentStatus !== 'suspendida') return;

    const nextStatus = currentStatus === 'activa' ? 'suspendida' : 'activa';
    const shopName = String(record.nombre_comercio || 'este comercio');
    const action = nextStatus === 'suspendida' ? 'suspender' : 'reactivar';
    const actionLabel = nextStatus === 'suspendida' ? 'Suspender' : 'Reactivar';
    if (!await showAppConfirm(`¿Confirmas que deseas ${action} ${shopName}?`, `¿${actionLabel} comercio?`, actionLabel)) return;

    setNotice('');
    setError('');
    setShopStatusLoadingId(String(record.id));
    try {
      const response = await fetch(`/api/admin/comercios/${encodeURIComponent(String(record.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el estado del comercio.');
      setNotice('Se actualizó.');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado del comercio.');
    } finally {
      setShopStatusLoadingId(null);
    }
  };

  const toggleRecordStatus = async (record: RecordRow) => {
    const currentStatus = record.activo;
    if (typeof currentStatus !== 'boolean') return;

    const nextStatus = !currentStatus;
    const recordName = String(record.nombre_completo || record.titulo || record.nombre || 'este registro');
    const action = nextStatus ? 'activar' : 'desactivar';
    const confirmText = nextStatus ? 'Activar' : 'Desactivar';
    if (!await showAppConfirm(`Se cambiará el estado de ${recordName}.`, `¿${action.charAt(0).toUpperCase()}${action.slice(1)}?`, confirmText)) return;

    setNotice('');
    setError('');
    try {
      const response = await fetch(`/api/admin/${config.resource}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, value: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cambiar el estado.');
      setNotice('El estado se actualizó correctamente.');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado.');
    }
  };

  const openRecordDetails = (record: RecordRow) => {
    setSelectedRecord(record);
    setRejectionMode(false);
    setRejectionReason('');
    setDecisionError('');
  };

  const hasActionColumn = section === 'comercios' || managedStatusSections.has(section);
  const hasDetailsColumn = !['pedidos', 'ventas', 'facturas'].includes(section);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-300">Administración</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">{config.title}</h2><p className="mt-1 text-sm text-slate-400">{config.description}</p></div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">{loading ? 'Consultando…' : `${total.toLocaleString('es-PY')} registros`}</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#1f1724] p-3">
        <label className="min-w-56 flex-1"><span className="sr-only">Buscar</span><input type="search" value={search} onChange={(event) => setFilter(setSearch)(event.target.value)} placeholder={viewSection === 'auditorias' ? 'Buscar texto: acción, tabla, correo, objeto o IP…' : viewSection === 'notificaciones' ? 'Buscar título, mensaje o tipo…' : 'Buscar registros…'} className="w-full rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent-400" /></label>
        {section === 'usuarios' && <select aria-label="Filtrar por rol" value={role} onChange={(event) => setFilter(setRole)(event.target.value)} className="rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2 text-sm text-slate-200"><option value="">Todos los roles</option><option value="cliente">Cliente</option><option value="comerciante">Comerciante</option><option value="admin">Administrador</option></select>}
        {section === 'comercios' && <select aria-label="Filtrar por estado" value={status} onChange={(event) => setFilter(setStatus)(event.target.value)} className="rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2 text-sm text-slate-200"><option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="activa">Activa</option><option value="suspendida">Suspendida</option><option value="rechazada">Rechazada</option></select>}

        {/* Filtros de logs: tipo de operación (botones con total), tabla, usuario, origen, IP y fechas */}
        {viewSection === 'auditorias' && (
          <div className="w-full space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de operación">
              <button type="button" onClick={() => setAuditFilter('operacion', '')} aria-pressed={!auditFilters.operacion} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${!auditFilters.operacion ? 'border-accent-400 bg-accent-400/15 text-white' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}>
                Todos
              </button>
              {auditOperations.map((operation) => {
                const active = auditFilters.operacion === operation.value;
                return (
                  <button key={operation.value} type="button" title={operation.help} aria-pressed={active} onClick={() => setAuditFilter('operacion', active ? '' : operation.value)} className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${active ? `${operation.className} ring-1 ring-current` : 'border-white/10 text-slate-300 hover:bg-white/5'}`}>
                    {operation.label}
                    <span className="ml-1.5 font-sans font-semibold opacity-70">{(operationCounts[operation.value] ?? 0).toLocaleString('es-PY')}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <select aria-label="Filtrar por tabla" value={auditFilters.tabla} onChange={(event) => setAuditFilter('tabla', event.target.value)} className="rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2 text-sm text-slate-200">
                <option value="">Todas las tablas</option>
                {auditTables.map((table) => <option key={table} value={table}>{table}</option>)}
              </select>
              <input type="search" aria-label="Filtrar por correo del usuario" value={auditFilters.usuario} onChange={(event) => setAuditFilter('usuario', event.target.value)} placeholder="Correo del usuario" className="rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2 text-sm text-white placeholder:text-slate-500" />
              <select aria-label="Filtrar por origen" value={auditFilters.origen} onChange={(event) => setAuditFilter('origen', event.target.value)} className="rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2 text-sm text-slate-200">
                <option value="">Todo origen</option>
                {Object.entries(auditOriginLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input type="search" aria-label="Filtrar por IP" value={auditFilters.ip} onChange={(event) => setAuditFilter('ip', event.target.value)} placeholder="IP" className="rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500" />
              <label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">Desde<input type="date" value={auditFilters.desde} onChange={(event) => setAuditFilter('desde', event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f0b12] px-2 py-2 text-sm text-slate-200 [color-scheme:dark]" /></label>
              <label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">Hasta<input type="date" value={auditFilters.hasta} onChange={(event) => setAuditFilter('hasta', event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f0b12] px-2 py-2 text-sm text-slate-200 [color-scheme:dark]" /></label>
            </div>
            {activeAuditFilters > 0 && (
              <button type="button" onClick={() => { setAuditFilters(EMPTY_AUDIT_FILTERS); setPage(1); }} className="text-xs font-semibold text-accent-300 hover:underline">
                Quitar {activeAuditFilters === 1 ? 'el filtro' : `los ${activeAuditFilters} filtros`}
              </button>
            )}
          </div>
        )}
      </div>

      {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1f1724]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.035] text-[11px] uppercase tracking-wide text-slate-400"><tr>{fields.map(([key, label]) => <th key={key} scope="col" className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>)}{hasDetailsColumn && <th scope="col" className="px-4 py-3 font-bold">Detalle</th>}{hasActionColumn && <th scope="col" className="px-4 py-3 font-bold">Acción</th>}</tr></thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading && <tr><td colSpan={fields.length + (hasDetailsColumn ? 1 : 0) + (hasActionColumn ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">Cargando registros…</td></tr>}
              {!loading && !error && records.map((record, index) => (
                <tr key={String(record.id ?? index)} className="text-slate-200 hover:bg-white/[0.025]">
                  {fields.map(([key]) => <td key={key} className="max-w-64 px-4 py-3 align-top">{renderRecordValue(viewSection, record, key)}</td>)}
                  {hasDetailsColumn && <td className="px-4 py-3"><button type="button" onClick={() => openRecordDetails(record)} className="whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-accent-200 hover:bg-white/5">Ver detalle</button></td>}
                  {section === 'comercios' ? <td className="px-4 py-3">{record.estado === 'pendiente' ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void approveShop(record)} className="whitespace-nowrap rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-300/20">Aprobar</button><button type="button" onClick={() => void rejectShop(record)} className="whitespace-nowrap rounded-md border border-rose-300/25 bg-rose-300/10 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-300/20">Rechazar</button></div> : record.estado === 'activa' || record.estado === 'suspendida' ? <button type="button" onClick={() => void changeShopStatus(record)} disabled={shopStatusLoadingId === String(record.id)} className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-bold disabled:cursor-wait disabled:opacity-50 ${record.estado === 'activa' ? 'border-rose-300/25 bg-rose-300/10 text-rose-200 hover:bg-rose-300/20' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/20'}`}>{shopStatusLoadingId === String(record.id) ? 'Actualizando…' : record.estado === 'activa' ? 'Suspender' : 'Reactivar'}</button> : <span className="text-xs text-slate-500">—</span>}</td> : managedStatusSections.has(section) ? <td className="px-4 py-3"><button type="button" onClick={() => void toggleRecordStatus(record)} disabled={typeof record.activo !== 'boolean'} className="whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">{record.activo ? 'Desactivar' : 'Activar'}</button></td> : null}
                </tr>
              ))}
              {!loading && !error && records.length === 0 && <tr><td colSpan={fields.length + (hasDetailsColumn ? 1 : 0) + (hasActionColumn ? 1 : 0)} className="px-4 py-14 text-center"><p className="font-semibold text-slate-300">No hay registros para mostrar</p><p className="mt-1 text-xs text-slate-500">Prueba cambiar la búsqueda o los filtros.</p></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3 text-xs text-slate-400">
          <span>{total ? `${((page - 1) * pageSize + 1).toLocaleString('es-PY')}–${Math.min(page * pageSize, total).toLocaleString('es-PY')} de ${total.toLocaleString('es-PY')}` : '0 registros'}</span>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="rounded-md border border-white/10 px-3 py-1.5 font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40">Anterior</button><span>Página {page} / {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="rounded-md border border-white/10 px-3 py-1.5 font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40">Siguiente</button></div>
        </div>
      </div>
      {selectedRecord && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecord(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-record-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-[#1f1724] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-300">{config.title}</p>
                <h3 id="admin-record-title" className="mt-1 text-lg font-bold text-white">{viewSection === 'auditorias' ? 'Detalle del log de sistema' : viewSection === 'notificaciones' ? 'Detalle de notificación' : 'Detalle del registro'}</h3>
              </div>
              <button type="button" autoFocus onClick={() => setSelectedRecord(null)} aria-label="Cerrar detalle" className="rounded-md border border-white/10 px-3 py-1 text-lg text-slate-300 hover:bg-white/5">×</button>
            </div>
            {viewSection === 'comercios' ? <CommerceInspection record={selectedRecord} /> : viewSection === 'notificaciones' ? <NotificationInspection record={selectedRecord} /> : viewSection === 'auditorias' ? <AuditDetail record={selectedRecord} /> : <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {Object.entries(selectedRecord)
                .map(([key, value]) => (
                  <div key={key} className="min-w-0 border-b border-white/[0.06] pb-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{key.replaceAll('_', ' ')}</dt>
                    <dd className="mt-1 break-words text-sm text-slate-200">{value && typeof value === 'object' ? JSON.stringify(value) : formatValue(value, key)}</dd>
                  </div>
                ))}
            </dl>}
            {viewSection === 'auditorias' && <AuditChanges record={selectedRecord} />}
            {viewSection === 'comercios' && selectedRecord.estado === 'pendiente' && <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-sm font-bold text-white">Decisión de solicitud</h4>
              {decisionError && <p role="alert" className="mt-3 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">{decisionError}</p>}
              {rejectionMode ? <form onSubmit={(event) => { event.preventDefault(); void rejectShop(selectedRecord, rejectionReason, false); }} className="mt-3 space-y-3">
                <label htmlFor="shop-rejection-reason" className="block text-xs font-semibold text-slate-300">Motivo u observación <span className="font-normal text-slate-500">(opcional)</span></label>
                <textarea id="shop-rejection-reason" rows={3} maxLength={500} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Escribe una observación para incluirla en los logs de sistema…" className="w-full resize-y rounded-lg border border-white/10 bg-[#0f0b12] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-rose-300/60" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{rejectionReason.length}/500 caracteres</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={decisionLoading} onClick={() => { setRejectionMode(false); setDecisionError(''); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={decisionLoading} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:cursor-wait disabled:opacity-50">{decisionLoading ? 'Rechazando…' : 'Confirmar rechazo'}</button>
                  </div>
                </div>
              </form> : <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={decisionLoading} onClick={() => { setRejectionMode(true); setDecisionError(''); }} className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-4 py-2.5 text-sm font-bold text-rose-200 hover:bg-rose-300/20 disabled:opacity-50">Rechazar Comercio</button>
                <button type="button" disabled={decisionLoading} onClick={() => void approveShop(selectedRecord, false)} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-50">{decisionLoading ? 'Procesando…' : 'Aprobar Comercio'}</button>
              </div>}
            </section>}
          </section>
        </div>
      )}
    </div>
  );
}