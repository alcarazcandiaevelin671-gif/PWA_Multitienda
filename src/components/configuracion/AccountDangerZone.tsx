'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showAppConfirm } from '@/lib/app-message';
import { userFacingError } from '@/lib/user-facing-error';
import { deactivateAccount } from '@/services/settings.service';

export default function AccountDangerZone() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmation !== 'DESACTIVAR') {
      setError('Escribe DESACTIVAR para confirmar la solicitud.');
      return;
    }
    if (!(await showAppConfirm('La cuenta quedará inactiva y se cerrará tu sesión. No se borrarán pedidos, ventas ni facturas.', 'Desactivar mi cuenta'))) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const auditRecorded = await deactivateAccount(password, confirmation);
      setMessage(auditRecorded
        ? 'La cuenta fue desactivada y la operación quedó registrada.'
        : 'La cuenta fue desactivada. No se pudo confirmar el registro de auditoría con las políticas actuales.');
      router.replace('/auth/login?info=account_deactivated');
      router.refresh();
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo desactivar la cuenta.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Zona de peligro</p>
      <h3 className="mt-2 text-lg font-extrabold text-slate-900">Desactivar mi cuenta</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">La cuenta dejará de acceder a las áreas protegidas. No se eliminará auth.users ni se borrarán tiendas, pedidos, ventas, facturas o auditorías. La reactivación debe solicitarse a administración.</p>
      {message && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {!expanded ? <button type="button" onClick={() => setExpanded(true)} className="mt-4 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50">Iniciar desactivación</button> : (
        <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3 sm:max-w-xl">
          <label className="text-sm font-semibold text-slate-700">Contraseña actual
            <input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Escribe DESACTIVAR para confirmar
            <input required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono font-normal" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || confirmation !== 'DESACTIVAR'} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50">{busy ? 'Procesando…' : 'Confirmar desactivación'}</button>
            <button type="button" disabled={busy} onClick={() => { setExpanded(false); setPassword(''); setConfirmation(''); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Cancelar</button>
          </div>
        </form>
      )}
    </section>
  );
}