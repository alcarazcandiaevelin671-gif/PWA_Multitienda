'use client';

import useUserSettingsSection from '@/components/configuracion/useUserSettingsSection';
import { getDefaultNotifications } from '@/services/settings.service';

const defaultNotifications = getDefaultNotifications();

export default function NotificacionesSection({ userId }: { userId: string }) {
  const settings = useUserSettingsSection(userId, 'notificaciones_config', defaultNotifications);
  const dirty = JSON.stringify(settings.value) !== JSON.stringify(settings.savedValue);
  const updateChannel = (key: keyof typeof settings.value.channels, checked: boolean) => settings.setValue({
    ...settings.value,
    channels: { ...settings.value.channels, [key]: checked },
  });
  const updateCategory = (key: keyof typeof settings.value.categories, checked: boolean) => settings.setValue({
    ...settings.value,
    categories: { ...settings.value.categories, [key]: checked },
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-extrabold text-slate-900">Preferencias de notificaciones</h2>
      <p className="mt-1 text-sm text-slate-600">Estas preferencias se guardan por cuenta; por ahora no filtran las notificaciones ya generadas ni activan servicios de entrega.</p>
      {settings.error && <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{settings.error}</p>}
      {settings.message && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{settings.message}</p>}

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-bold text-slate-800">Canales</legend>
          <label className="flex items-center justify-between gap-4 text-sm text-slate-700"><span>Dentro de la aplicación</span><input type="checkbox" checked={settings.value.channels.inApp} onChange={(event) => updateChannel('inApp', event.target.checked)} className="h-5 w-5 accent-blue-600" /></label>
          <label className="flex items-center justify-between gap-4 text-sm text-slate-700"><span>Correo electrónico <small className="block text-xs text-slate-500">Preferencia guardada; entrega depende del servicio de correo.</small></span><input type="checkbox" checked={settings.value.channels.email} onChange={(event) => updateChannel('email', event.target.checked)} className="h-5 w-5 accent-blue-600" /></label>
          <label className="flex items-center justify-between gap-4 text-sm text-slate-500"><span>Push · integración pendiente</span><input type="checkbox" checked={false} disabled aria-label="Push no disponible" className="h-5 w-5" /></label>
          <label className="flex items-center justify-between gap-4 text-sm text-slate-500"><span>SMS · integración pendiente</span><input type="checkbox" checked={false} disabled aria-label="SMS no disponible" className="h-5 w-5" /></label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-bold text-slate-800">Tipos</legend>
          {([
            ['orders', 'Pedidos y compras'], ['stores', 'Actividad de tiendas'], ['sales', 'Ventas'], ['invoices', 'Facturas'], ['messages', 'Mensajes'],
            ['promotions', 'Promociones'], ['security', 'Seguridad'], ['system', 'Novedades del sistema'],
          ] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 text-sm text-slate-700"><span>{label}{key === 'security' && <small className="ml-2 text-xs text-slate-500">Siempre activa</small>}</span><input type="checkbox" checked={settings.value.categories[key]} disabled={key === 'security'} onChange={(event) => updateCategory(key, event.target.checked)} className="h-5 w-5 accent-blue-600 disabled:opacity-60" /></label>)}
        </fieldset>
      </div>

      <label className="mt-5 block max-w-sm text-sm font-semibold text-slate-700">Frecuencia
        <select value={settings.value.frequency} onChange={(event) => settings.setValue({ ...settings.value, frequency: event.target.value as typeof settings.value.frequency })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="inmediata">Inmediata</option><option value="diaria">Resumen diario</option><option value="semanal">Resumen semanal</option><option value="ninguna">Ninguna</option></select>
      </label>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!settings.loaded || settings.saving || !dirty} onClick={() => void settings.save()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{settings.saving ? 'Guardando…' : 'Guardar cambios'}</button>
        <button type="button" disabled={!dirty || settings.saving} onClick={settings.cancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancelar</button>
        <span className="text-xs text-slate-500">{dirty ? 'Cambios sin guardar' : settings.loaded ? 'Sin cambios pendientes' : 'Cargando…'}</span>
      </div>
    </section>
  );
}