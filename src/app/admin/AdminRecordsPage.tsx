'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { showAppConfirm } from '@/lib/app-message';

type RecordRow = Record<string, unknown>;

const sections: Record<string, { resource: string; title: string; description: string }> = {
  usuarios: { resource: 'usuarios', title: 'Usuarios', description: 'Perfiles registrados y rol asignado.' },
  comercios: { resource: 'comercios', title: 'Comercios', description: 'Solicitudes y comercios registrados en la plataforma.' },
  categorias: { resource: 'categorias', title: 'Categorías', description: 'Categorías disponibles en el catálogo.' },
  departamentos: { resource: 'departamentos', title: 'Departamentos', description: 'Departamentos registrados.' },
  distritos: { resource: 'distritos', title: 'Distritos', description: 'Distritos y departamento relacionado.' },
  auditorias: { resource: 'auditorias', title: 'Logs de sistema', description: 'Acciones administrativas registradas.' },
  notificaciones: { resource: 'notificaciones', title: 'Notificaciones', description: 'Mensajes enviados, destinatarios y estado de lectura.' },
};

const columns: Record<string, Array<[string, string]>> = {
  usuarios: [['nombre_completo', 'Nombre'], ['email', 'Correo'], ['telefono_contacto', 'Teléfono'], ['rol', 'Rol'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  comercios: [['nombre_comercio', 'Comercio'], ['propietario', 'Comerciante'], ['distrito', 'Distrito'], ['estado', 'Estado'], ['whatsapp', 'Contacto'], ['creado_en', 'Registro']],
  categorias: [['nombre', 'Categoría'], ['descripcion', 'Descripción'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  departamentos: [['nombre', 'Departamento'], ['codigo', 'Código'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  distritos: [['nombre', 'Distrito'], ['departamento_id', 'Departamento'], ['activo', 'Estado'], ['creado_en', 'Registro']],
  auditorias: [['accion', 'Acción'], ['tabla_afectada', 'Tabla'], ['registro_legible', 'Registro'], ['administrador', 'Administrador'], ['fecha_hora', 'Fecha']],
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
    return field === 'fecha_hora' || field === 'created_at'
      ? date.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })
      : date.toLocaleDateString('es-PY');
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

const notificationTypeLabels: Record<string, string> = {
  promocion: 'Promoción',
  comercio_aprobado: 'Comercio aprobado',
  comercio_rechazado: 'Comercio rechazado',
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

  if (section === 'notificaciones' && key === 'tipo') {
    const rawType = String(record.tipo ?? '').toLowerCase();
    const type = rawType.replaceAll('_', ' ');
    const label = notificationTypeLabels[rawType] ?? (type ? `${type.charAt(0).toLocaleUpperCase('es-PY')}${type.slice(1)}` : 'Sin tipo');
    return <span className="inline-flex rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-xs font-semibold text-sky-200">{label}</span>;
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
      <h4 className="mb-3 text-sm font-bold text-white">Comparación de cambios</h4>
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
        {hasLocation && <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-sky-300 hover:text-sky-200 hover:underline">Abrir ubicación en el mapa</a>}
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

      try {
        const response = await fetch(`/api/admin/${config.resource}?${params}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los datos.');
        setRecords(result.records ?? []);
        setTotal(result.total ?? 0);
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
  }, [config, page, search, status, role, section, refreshKey]);

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
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Administración</p><h2 className="mt-1 text-2xl font-extrabold text-white">{config.title}</h2><p className="mt-1 text-sm text-slate-400">{config.description}</p></div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">{loading ? 'Consultando…' : `${total.toLocaleString('es-PY')} registros`}</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#111f31] p-3">
        <label className="min-w-56 flex-1"><span className="sr-only">Buscar</span><input type="search" value={search} onChange={(event) => setFilter(setSearch)(event.target.value)} placeholder={viewSection === 'auditorias' ? 'Buscar correo, tabla o acción…' : viewSection === 'notificaciones' ? 'Buscar título, mensaje o tipo…' : 'Buscar registros…'} className="w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label>
        {section === 'usuarios' && <select aria-label="Filtrar por rol" value={role} onChange={(event) => setFilter(setRole)(event.target.value)} className="rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos los roles</option><option value="cliente">Cliente</option><option value="comerciante">Comerciante</option><option value="admin">Administrador</option></select>}
        {section === 'comercios' && <select aria-label="Filtrar por estado" value={status} onChange={(event) => setFilter(setStatus)(event.target.value)} className="rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="activa">Activa</option><option value="suspendida">Suspendida</option><option value="rechazada">Rechazada</option></select>}
      </div>

      {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111f31]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.035] text-[11px] uppercase tracking-wide text-slate-400"><tr>{fields.map(([key, label]) => <th key={key} scope="col" className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>)}{hasDetailsColumn && <th scope="col" className="px-4 py-3 font-bold">Detalle</th>}{hasActionColumn && <th scope="col" className="px-4 py-3 font-bold">Acción</th>}</tr></thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading && <tr><td colSpan={fields.length + (hasDetailsColumn ? 1 : 0) + (hasActionColumn ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">Cargando registros…</td></tr>}
              {!loading && !error && records.map((record, index) => (
                <tr key={String(record.id ?? index)} className="text-slate-200 hover:bg-white/[0.025]">
                  {fields.map(([key]) => <td key={key} className="max-w-64 px-4 py-3 align-top">{renderRecordValue(viewSection, record, key)}</td>)}
                  {hasDetailsColumn && <td className="px-4 py-3"><button type="button" onClick={() => openRecordDetails(record)} className="whitespace-nowrap rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-white/5">Ver detalle</button></td>}
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
          <section role="dialog" aria-modal="true" aria-labelledby="admin-record-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-[#111f31] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">{config.title}</p>
                <h3 id="admin-record-title" className="mt-1 text-lg font-bold text-white">{viewSection === 'auditorias' ? 'Detalle del log de sistema' : viewSection === 'notificaciones' ? 'Detalle de notificación' : 'Detalle del registro'}</h3>
              </div>
              <button type="button" autoFocus onClick={() => setSelectedRecord(null)} aria-label="Cerrar detalle" className="rounded-md border border-white/10 px-3 py-1 text-lg text-slate-300 hover:bg-white/5">×</button>
            </div>
            {viewSection === 'comercios' ? <CommerceInspection record={selectedRecord} /> : viewSection === 'notificaciones' ? <NotificationInspection record={selectedRecord} /> : viewSection === 'auditorias' ? <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {columns.auditorias.map(([key, label]) => (
                <div key={key} className="min-w-0 border-b border-white/[0.06] pb-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words text-sm text-slate-200">{renderRecordValue(viewSection, selectedRecord, key)}</dd>
                </div>
              ))}
            </dl> : <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
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
                <textarea id="shop-rejection-reason" rows={3} maxLength={500} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Escribe una observación para incluirla en los logs de sistema…" className="w-full resize-y rounded-lg border border-white/10 bg-[#091321] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-rose-300/60" />
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