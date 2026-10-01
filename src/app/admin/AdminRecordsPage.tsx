'use client';

import { useEffect, useState } from 'react';
import { showAppConfirm } from '@/lib/app-message';

type RecordRow = Record<string, unknown>;
type RelatedDetails = { details: RecordRow[]; history: RecordRow[] };
type SelectOption = { id: string | number; label: string };

const sections: Record<string, { resource: string; title: string; description: string }> = {
  usuarios: { resource: 'usuarios', title: 'Usuarios', description: 'Perfiles registrados y rol asignado.' },
  comercios: { resource: 'comercios', title: 'Comercios', description: 'Solicitudes y comercios registrados en la plataforma.' },
  productos: { resource: 'productos', title: 'Productos', description: 'Catálogo global en modo consulta.' },
  pedidos: { resource: 'pedidos', title: 'Pedidos', description: 'Pedidos y sus estados históricos.' },
  pedido_detalles: { resource: 'pedido_detalles', title: 'Detalle de pedidos', description: 'Productos y montos guardados en cada pedido.' },
  pedido_estado_historial: { resource: 'pedido_estado_historial', title: 'Historial de pedidos', description: 'Cambios de estado y observaciones de los pedidos.' },
  ventas: { resource: 'ventas', title: 'Ventas', description: 'Operaciones comerciales registradas.' },
  venta_detalles: { resource: 'venta_detalles', title: 'Detalle de ventas', description: 'Productos y montos guardados en cada venta.' },
  facturas: { resource: 'facturas', title: 'Facturas', description: 'Documentos internos emitidos.' },
  factura_detalles: { resource: 'factura_detalles', title: 'Detalle de facturas', description: 'Conceptos y montos guardados en cada factura.' },
  categorias: { resource: 'categorias', title: 'Categorías', description: 'Categorías disponibles en el catálogo.' },
  departamentos: { resource: 'departamentos', title: 'Departamentos', description: 'Departamentos registrados.' },
  distritos: { resource: 'distritos', title: 'Distritos', description: 'Distritos y departamento relacionado.' },
  auditorias: { resource: 'auditorias', title: 'Auditoría', description: 'Acciones administrativas registradas.' },
  notificaciones: { resource: 'notificaciones', title: 'Notificaciones', description: 'Notificaciones guardadas en la plataforma.' },
};

const columns: Record<string, Array<[string, string]>> = {
  usuarios: [['nombre_completo', 'Nombre'], ['email', 'Correo'], ['telefono_contacto', 'Teléfono'], ['rol', 'Rol'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  comercios: [['nombre_comercio', 'Comercio'], ['propietario', 'Vendedor'], ['distrito', 'Distrito'], ['estado', 'Estado'], ['whatsapp', 'Contacto'], ['creado_en', 'Registro']],
  productos: [['titulo', 'Producto'], ['comercio', 'Comercio'], ['vendedor', 'Vendedor'], ['categoria', 'Categoría'], ['precio_gs', 'Precio'], ['disponible', 'Disponibilidad']],
  pedidos: [['numero_pedido', 'Pedido'], ['cliente', 'Cliente'], ['comercio', 'Comercio'], ['estado', 'Estado'], ['total', 'Total'], ['created_at', 'Fecha']],
  pedido_detalles: [['pedido_id', 'Pedido'], ['nombre_producto_snapshot', 'Producto'], ['cantidad', 'Cantidad'], ['precio', 'Precio'], ['descuento', 'Descuento'], ['subtotal', 'Subtotal'], ['created_at', 'Fecha']],
  pedido_estado_historial: [['pedido_id', 'Pedido'], ['estado_anterior', 'Estado anterior'], ['estado_nuevo', 'Estado nuevo'], ['observacion', 'Observación'], ['created_at', 'Fecha']],
  ventas: [['numero_venta', 'Venta'], ['cliente', 'Cliente'], ['comercio', 'Comercio'], ['estado', 'Estado'], ['total', 'Total'], ['created_at', 'Fecha']],
  venta_detalles: [['venta_id', 'Venta'], ['nombre_producto_snapshot', 'Producto'], ['cantidad', 'Cantidad'], ['precio', 'Precio'], ['descuento', 'Descuento'], ['subtotal', 'Subtotal'], ['created_at', 'Fecha']],
  facturas: [['numero', 'Factura'], ['cliente', 'Cliente'], ['comercio', 'Comercio'], ['estado', 'Estado'], ['total', 'Total'], ['fecha', 'Fecha']],
  factura_detalles: [['factura_id', 'Factura'], ['descripcion_snapshot', 'Descripción'], ['cantidad', 'Cantidad'], ['precio', 'Precio'], ['descuento', 'Descuento'], ['subtotal', 'Subtotal'], ['created_at', 'Fecha']],
  categorias: [['nombre', 'Categoría'], ['descripcion', 'Descripción'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  departamentos: [['nombre', 'Departamento'], ['codigo', 'Código'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  distritos: [['nombre', 'Distrito'], ['departamento_id', 'Departamento'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  auditorias: [['accion', 'Acción'], ['tabla_afectada', 'Tabla'], ['registro_legible', 'Registro'], ['administrador', 'Administrador'], ['fecha_hora', 'Fecha']],
  notificaciones: [['usuario_id', 'Usuario'], ['leida', 'Leída'], ['created_at', 'Fecha']],
};

const orderStates = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'completado', 'cancelado'];
const managedStatusSections = new Set(['usuarios', 'productos', 'categorias', 'departamentos', 'distritos']);

function formatValue(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (['total', 'precio_gs', 'precio', 'subtotal', 'descuento', 'iva'].includes(field)) return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Number(value)) + ' Gs.';
  if (['creado_en', 'created_at', 'fecha', 'fecha_hora'].includes(field)) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-PY');
  }
  return String(value).replaceAll('_', ' ');
}

const auditActionBadges: Record<string, { label: string; className: string }> = {
  INSERT: { label: 'Creación / Registro', className: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' },
  UPDATE: { label: 'Modificación', className: 'border-sky-300/30 bg-sky-300/10 text-sky-200' },
  DELETE: { label: 'Eliminación', className: 'border-rose-300/30 bg-rose-300/10 text-rose-200' },
  CAMBIO_ESTADO_ADMIN: { label: 'Cambio de estado', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
  APROBACION_COMERCIO: { label: 'Aprobación de comercio', className: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' },
  RECHAZO_COMERCIO: { label: 'Rechazo de comercio', className: 'border-rose-300/30 bg-rose-300/10 text-rose-200' },
  DESACTIVACION_CUENTA: { label: 'Desactivación de cuenta', className: 'border-amber-300/30 bg-amber-300/10 text-amber-200' },
};

function renderRecordValue(section: string, record: RecordRow, key: string) {
  if (section === 'auditorias' && key === 'accion') {
    const action = String(record.accion ?? '').toUpperCase();
    const badge = auditActionBadges[action] ?? {
      label: action.replaceAll('_', ' ').toLowerCase() || 'Acción',
      className: 'border-slate-300/20 bg-slate-300/10 text-slate-300',
    };
    return <span title={action} className={`inline-flex max-w-56 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>;
  }

  const isStatus = key === 'estado' || key === 'rol' || key === 'disponible' || key === 'activo';
  return <span className={isStatus ? 'inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-xs font-semibold capitalize' : 'block truncate'} title={String(record[key] ?? '')}>{formatValue(record[key], key)}</span>;
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function AuditChanges({ record }: { record: RecordRow }) {
  const before = record.datos_anteriores && typeof record.datos_anteriores === 'object' && !Array.isArray(record.datos_anteriores)
    ? record.datos_anteriores as Record<string, unknown>
    : {};
  const after = record.datos_nuevos && typeof record.datos_nuevos === 'object' && !Array.isArray(record.datos_nuevos)
    ? record.datos_nuevos as Record<string, unknown>
    : {};
  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return (
    <section className="mt-6">
      <h4 className="mb-3 text-sm font-bold text-white">Comparación de cambios</h4>
      {fields.length ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400"><tr><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Antes</th><th className="px-3 py-2">Después</th></tr></thead>
            <tbody className="divide-y divide-white/[0.06]">
              {fields.map((field) => {
                const changed = JSON.stringify(before[field]) !== JSON.stringify(after[field]);
                return <tr key={field}><th scope="row" className="px-3 py-3 align-top font-semibold text-slate-300">{field.replaceAll('_', ' ')}</th><td className={`max-w-72 whitespace-pre-wrap break-words px-3 py-3 align-top ${changed ? 'bg-rose-400/[0.08] text-rose-200' : 'text-slate-400'}`}>{formatAuditValue(before[field])}</td><td className={`max-w-72 whitespace-pre-wrap break-words px-3 py-3 align-top ${changed ? 'bg-emerald-400/[0.08] text-emerald-200' : 'text-slate-400'}`}>{formatAuditValue(after[field])}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="mb-2 text-xs font-bold text-rose-200">Antes</p><pre className="whitespace-pre-wrap break-words text-xs text-slate-300">{formatAuditValue(record.datos_anteriores)}</pre></div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="mb-2 text-xs font-bold text-emerald-200">Después</p><pre className="whitespace-pre-wrap break-words text-xs text-slate-300">{formatAuditValue(record.datos_nuevos)}</pre></div>
        </div>
      )}
    </section>
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
  const [available, setAvailable] = useState('');
  const [category, setCategory] = useState('');
  const [shop, setShop] = useState('');
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [shops, setShops] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<RecordRow | null>(null);
  const [relatedDetails, setRelatedDetails] = useState<RelatedDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
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
      if (available) params.set('available', available);
      if (category) params.set('category', category);
      if (shop) params.set('shop', shop);

      try {
        const response = await fetch(`/api/admin/${config.resource}?${params}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los datos.');
        setRecords(result.records ?? []);
        setTotal(result.total ?? 0);
        if (section === 'productos') {
          setCategories((result.options?.categories ?? []).map((item: { id: number; nombre: string }) => ({ id: item.id, label: item.nombre })));
          setShops((result.options?.shops ?? []).map((item: { id: string; nombre_comercio: string }) => ({ id: item.id, label: item.nombre_comercio })));
        }
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
  }, [config, page, search, status, role, available, category, shop, section, refreshKey]);

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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fields = columns[viewSection] ?? [];

  const approveShop = async (record: RecordRow) => {
    const shopName = String(record.nombre_comercio || 'este comercio');
    if (!await showAppConfirm(`¿Confirmas la aprobación de ${shopName}?`, '¿Aprobar comercio?', 'Aprobar')) return;
    setNotice('');
    setError('');
    try {
      const response = await fetch(`/api/admin/comercios/${encodeURIComponent(String(record.id))}/approve`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo aprobar el comercio.');
      setNotice(result.auditWarning || 'Comercio aprobado. La acción quedó registrada en auditoría.');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aprobar el comercio.');
    }
  };

  const rejectShop = async (record: RecordRow) => {
    const shopName = String(record.nombre_comercio || 'este comercio');
    if (!await showAppConfirm(`¿Confirmas el rechazo de ${shopName}?`, '¿Rechazar comercio?', 'Rechazar')) return;
    setNotice('');
    setError('');
    try {
      const response = await fetch(`/api/admin/comercios/${encodeURIComponent(String(record.id))}/reject`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo rechazar el comercio.');
      setNotice(result.auditWarning || 'Comercio rechazado. La acción quedó registrada en auditoría.');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo rechazar el comercio.');
    }
  };

  const toggleRecordStatus = async (record: RecordRow) => {
    const statusField = section === 'productos' ? 'disponible' : 'activo';
    const currentStatus = record[statusField];
    if (typeof currentStatus !== 'boolean') return;

    const nextStatus = !currentStatus;
    const recordName = String(record.nombre_completo || record.titulo || record.nombre || 'este registro');
    const action = section === 'productos'
      ? nextStatus ? 'volver a publicar' : 'pausar'
      : nextStatus ? 'activar' : 'desactivar';
    const confirmText = section === 'productos'
      ? nextStatus ? 'Publicar' : 'Pausar'
      : nextStatus ? 'Activar' : 'Desactivar';
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
      setNotice(result.auditWarning || 'Estado actualizado. La acción quedó registrada en auditoría.');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado.');
    }
  };

  const openRecordDetails = async (record: RecordRow) => {
    setSelectedRecord(record);
    setRelatedDetails(null);
    setDetailsError('');
    if (!['pedidos', 'ventas', 'facturas'].includes(section)) return;

    setDetailsLoading(true);
    try {
      const response = await fetch(`/api/admin/${config.resource}/${encodeURIComponent(String(record.id))}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los detalles.');
      setRelatedDetails(result as RelatedDetails);
    } catch (cause) {
      setDetailsError(cause instanceof Error ? cause.message : 'No se pudieron cargar los detalles.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const hasActionColumn = section === 'comercios' || managedStatusSections.has(section);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Administración</p><h2 className="mt-1 text-2xl font-extrabold text-white">{config.title}</h2><p className="mt-1 text-sm text-slate-400">{config.description}</p></div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">{loading ? 'Consultando…' : `${total.toLocaleString('es-PY')} registros`}</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#111f31] p-3">
        <label className="min-w-56 flex-1"><span className="sr-only">Buscar</span><input type="search" value={search} onChange={(event) => setFilter(setSearch)(event.target.value)} placeholder={viewSection === 'auditorias' ? 'Buscar correo, tabla o acción…' : 'Buscar registros…'} className="w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label>
        {section === 'usuarios' && <select aria-label="Filtrar por rol" value={role} onChange={(event) => setFilter(setRole)(event.target.value)} className="rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos los roles</option><option value="cliente">Cliente</option><option value="comerciante">Vendedor</option><option value="admin">Administrador</option></select>}
        {section === 'comercios' && <select aria-label="Filtrar por estado" value={status} onChange={(event) => setFilter(setStatus)(event.target.value)} className="rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="activa">Activa</option><option value="activo">Activo</option><option value="rechazada">Rechazada</option><option value="rechazado">Rechazado</option></select>}
        {section === 'pedidos' && <select aria-label="Filtrar por estado" value={status} onChange={(event) => setFilter(setStatus)(event.target.value)} className="rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos los estados</option>{orderStates.map((state) => <option key={state} value={state}>{formatValue(state, 'estado')}</option>)}</select>}
        {section === 'productos' && <>
          <select aria-label="Filtrar por disponibilidad" value={available} onChange={(event) => setFilter(setAvailable)(event.target.value)} className="rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Toda disponibilidad</option><option value="true">Disponible</option><option value="false">No disponible</option></select>
          <select aria-label="Filtrar por categoría" value={category} onChange={(event) => setFilter(setCategory)(event.target.value)} className="max-w-48 rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          <select aria-label="Filtrar por comercio" value={shop} onChange={(event) => setFilter(setShop)(event.target.value)} className="max-w-52 rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos los comercios</option>{shops.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        </>}
      </div>

      {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111f31]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.035] text-[11px] uppercase tracking-wide text-slate-400"><tr>{fields.map(([key, label]) => <th key={key} scope="col" className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>)}<th scope="col" className="px-4 py-3 font-bold">Detalle</th>{hasActionColumn && <th scope="col" className="px-4 py-3 font-bold">Acción</th>}</tr></thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading && <tr><td colSpan={fields.length + 1 + (hasActionColumn ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">Cargando registros…</td></tr>}
              {!loading && !error && records.map((record, index) => (
                <tr key={String(record.id ?? index)} className="text-slate-200 hover:bg-white/[0.025]">
                  {fields.map(([key]) => <td key={key} className="max-w-64 px-4 py-3 align-top">{renderRecordValue(viewSection, record, key)}</td>)}
                  <td className="px-4 py-3"><button type="button" onClick={() => void openRecordDetails(record)} className="whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-white/5">Ver detalle</button></td>
                  {section === 'comercios' ? <td className="px-4 py-3">{record.estado === 'pendiente' ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void approveShop(record)} className="whitespace-nowrap rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-300/20">Aprobar</button><button type="button" onClick={() => void rejectShop(record)} className="whitespace-nowrap rounded-md border border-rose-300/25 bg-rose-300/10 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-300/20">Rechazar</button></div> : <span className="text-xs text-slate-500">—</span>}</td> : managedStatusSections.has(section) ? <td className="px-4 py-3"><button type="button" onClick={() => void toggleRecordStatus(record)} disabled={typeof record[section === 'productos' ? 'disponible' : 'activo'] !== 'boolean'} className="whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">{section === 'productos' ? record.disponible ? 'Pausar' : 'Activar' : record.activo ? 'Desactivar' : 'Activar'}</button></td> : null}
                </tr>
              ))}
              {!loading && !error && records.length === 0 && <tr><td colSpan={fields.length + 1 + (hasActionColumn ? 1 : 0)} className="px-4 py-14 text-center"><p className="font-semibold text-slate-300">No hay registros para mostrar</p><p className="mt-1 text-xs text-slate-500">Prueba cambiar la búsqueda o los filtros.</p></td></tr>}
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
          <section role="dialog" aria-modal="true" aria-labelledby="admin-record-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-[#111f31] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">{config.title}</p>
                <h3 id="admin-record-title" className="mt-1 text-lg font-bold text-white">{viewSection === 'auditorias' ? 'Detalle de auditoría' : 'Detalle del registro'}</h3>
              </div>
              <button type="button" autoFocus onClick={() => setSelectedRecord(null)} aria-label="Cerrar detalle" className="rounded-md border border-white/10 px-3 py-1 text-lg text-slate-300 hover:bg-white/5">×</button>
            </div>
            <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {Object.entries(selectedRecord)
                .filter(([key]) => viewSection !== 'auditorias' || !['usuario_id', 'registro_id'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="min-w-0 border-b border-white/[0.06] pb-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{key.replaceAll('_', ' ')}</dt>
                    <dd className="mt-1 break-words text-sm text-slate-200">{viewSection === 'auditorias' && key === 'accion' ? renderRecordValue(viewSection, selectedRecord, key) : value && typeof value === 'object' ? JSON.stringify(value) : formatValue(value, key)}</dd>
                  </div>
                ))}
            </dl>
            {viewSection === 'auditorias' && <AuditChanges record={selectedRecord} />}
            {detailsLoading && <p className="mt-5 text-sm text-slate-400">Cargando detalles y movimientos…</p>}
            {detailsError && <p role="alert" className="mt-5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{detailsError}</p>}
            {relatedDetails && <div className="mt-6 space-y-6">
              <section>
                <h4 className="font-bold text-white">Artículos y montos históricos</h4>
                {relatedDetails.details.length ? <ul className="mt-3 divide-y divide-white/[0.06]">{relatedDetails.details.map((item, index) => <li key={String(item.id ?? index)} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-semibold text-slate-200">{String(item.nombre_producto_snapshot ?? item.descripcion_snapshot ?? 'Artículo')}</p>{typeof item.descripcion_snapshot === 'string' && typeof item.nombre_producto_snapshot === 'string' && <p className="mt-1 text-xs text-slate-400">{item.descripcion_snapshot}</p>}<p className="mt-1 text-xs text-slate-400">{String(item.cantidad ?? 0)} × {formatValue(item.precio, 'precio')}{Number(item.descuento) > 0 ? ` · descuento ${formatValue(item.descuento, 'descuento')}` : ''}</p></div><strong className="shrink-0 text-sm text-emerald-200">{formatValue(item.subtotal, 'subtotal')}</strong></li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No hay artículos asociados a este registro.</p>}
              </section>
              {relatedDetails.history.length > 0 && <section>
                <h4 className="font-bold text-white">Historial de estados</h4>
                <ol className="mt-3 space-y-3">{relatedDetails.history.map((item, index) => <li key={String(item.id ?? index)} className="border-l-2 border-sky-400/40 pl-3"><p className="text-sm font-semibold text-slate-200">{String(item.estado_anterior ?? 'Inicio')} → {String(item.estado_nuevo ?? '—').replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-slate-400">{item.created_at ? new Date(String(item.created_at)).toLocaleString('es-PY') : 'Fecha no disponible'}{item.observacion ? ` · ${String(item.observacion)}` : ''}</p></li>)}</ol>
              </section>}
            </div>}
          </section>
        </div>
      )}
    </div>
  );
}