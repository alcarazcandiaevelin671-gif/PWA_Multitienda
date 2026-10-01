'use client';

import useUserSettingsSection from '@/components/configuracion/useUserSettingsSection';
import { getDefaultPreferences } from '@/services/settings.service';

const defaultPreferences = getDefaultPreferences();

export default function PreferenciasSection({ userId }: { userId: string }) {
  const settings = useUserSettingsSection(userId, 'preferencias', defaultPreferences);
  const dirty = JSON.stringify(settings.value) !== JSON.stringify(settings.savedValue);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-extrabold text-slate-900">Preferencias</h2>
      <p className="mt-1 text-sm text-slate-600">Se sincronizan con tu cuenta. El contenido de la interfaz continúa en español.</p>
      {settings.error && <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{settings.error}</p>}
      {settings.message && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{settings.message}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-bold text-slate-700">Tema visual</legend>
          <div role="radiogroup" aria-label="Tema visual" className="mt-2 grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((theme) => <button key={theme} type="button" role="radio" aria-checked={settings.value.theme === theme} onClick={() => settings.setValue({ ...settings.value, theme })} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${settings.value.theme === theme ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema'}</button>)}
          </div>
        </fieldset>
        <label className="text-sm font-semibold text-slate-700">Idioma
          <select value={settings.value.language} onChange={(event) => settings.setValue({ ...settings.value, language: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal">
            <option value="es">Español</option><option value="gn">Guaraní (preferencia guardada; traducción pendiente)</option><option value="en">Inglés (preferencia guardada; traducción pendiente)</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Zona horaria
          <select value={settings.value.timezone} onChange={(event) => settings.setValue({ ...settings.value, timezone: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal">
            <option value="America/Asuncion">America/Asuncion</option><option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option><option value="UTC">UTC</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Formato de fecha
          <select value={settings.value.dateFormat} onChange={(event) => settings.setValue({ ...settings.value, dateFormat: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Moneda
          <select value={settings.value.currency} onChange={(event) => settings.setValue({ ...settings.value, currency: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"><option value="PYG">Guaraní paraguayo · PYG / Gs.</option></select>
          <span className="mt-1 block text-xs font-normal text-slate-500">Se guarda como preferencia; no modifica precios ni formato global todavía.</span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!settings.loaded || settings.saving || !dirty} onClick={() => void settings.save()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{settings.saving ? 'Guardando…' : 'Guardar cambios'}</button>
        <button type="button" disabled={!dirty || settings.saving} onClick={settings.cancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancelar</button>
        <span className="text-xs text-slate-500">{dirty ? 'Cambios sin guardar' : settings.loaded ? 'Sin cambios pendientes' : 'Cargando…'}</span>
      </div>
    </section>
  );
}