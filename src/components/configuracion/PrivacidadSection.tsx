'use client';

import useUserSettingsSection from '@/components/configuracion/useUserSettingsSection';
import AccountDangerZone from '@/components/configuracion/AccountDangerZone';
import { getDefaultPrivacy } from '@/services/settings.service';
import { useState } from 'react';

const defaultPrivacy = getDefaultPrivacy();

export default function PrivacidadSection({ userId }: { userId: string }) {
  const settings = useUserSettingsSection(userId, 'privacidad', defaultPrivacy);
  const dirty = JSON.stringify(settings.value) !== JSON.stringify(settings.savedValue);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');

  const exportData = async () => {
    setExportMessage('');
    setExportError('');
    setExportBusy(true);
    try {
      const response = await fetch('/api/configuracion/exportar-datos', { cache: 'no-store' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'No se pudieron exportar tus datos.');
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setExportMessage('Descarga preparada con los datos de tu cuenta.');
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'No se pudieron exportar tus datos.');
    } finally {
      setExportBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-extrabold text-slate-900">Privacidad y control</h2>
        <p className="mt-1 text-sm text-slate-600">Las opciones quedan asociadas a tu cuenta; la visibilidad todavía no cambia consultas públicas.</p>
        {settings.error && <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{settings.error}</p>}
        {settings.message && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{settings.message}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Visibilidad del perfil
            <select value={settings.value.profileVisibility} onChange={(event) => settings.setValue({ ...settings.value, profileVisibility: event.target.value as typeof settings.value.profileVisibility })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="private">Privado</option><option value="public">Público (preferencia guardada; las consultas públicas no están integradas)</option></select>
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><span>Mostrar información básica públicamente<small className="mt-1 block text-xs text-slate-500">No modifica RLS ni lecturas públicas.</small></span><input type="checkbox" checked={settings.value.showBasicInfo} onChange={(event) => settings.setValue({ ...settings.value, showBasicInfo: event.target.checked })} className="h-5 w-5 accent-blue-600" /></label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><span>Recomendaciones personalizadas<small className="mt-1 block text-xs text-slate-500">Preferencia guardada; la API actual de recomendaciones aún no la consulta.</small></span><input type="checkbox" checked={settings.value.personalizedRecommendations} onChange={(event) => settings.setValue({ ...settings.value, personalizedRecommendations: event.target.checked })} className="h-5 w-5 accent-blue-600" /></label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!settings.loaded || settings.saving || !dirty} onClick={() => void settings.save()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{settings.saving ? 'Guardando…' : 'Guardar privacidad'}</button>
          <button type="button" disabled={!dirty || settings.saving} onClick={settings.cancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancelar</button>
          <span className="text-xs text-slate-500">{dirty ? 'Cambios sin guardar' : settings.loaded ? 'Sin cambios pendientes' : 'Cargando…'}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-extrabold text-slate-900">Descargar datos personales</h3>
        <p className="mt-1 text-sm text-slate-600">El servidor determina la cuenta desde la sesión; no se acepta un UUID del navegador.</p>
        {exportMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{exportMessage}</p>}
        {exportError && <p role="alert" className="mt-3 text-sm text-rose-700">{exportError}</p>}
        <button type="button" disabled={exportBusy} onClick={() => void exportData()} className="mt-4 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{exportBusy ? 'Preparando…' : 'Descargar JSON'}</button>
      </section>

      <AccountDangerZone />
    </div>
  );
}