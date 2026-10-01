'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { showAppConfirm } from '@/lib/app-message';
import { userFacingError } from '@/lib/user-facing-error';
import { authService } from '@/services/auth.service';
import {
  changeAuthPassword,
  getSecuritySnapshot,
  removeMfaFactor,
  startTotpEnrollment,
  unlinkAuthIdentity,
  verifyTotpEnrollment,
  type SecuritySnapshot,
} from '@/services/settings.service';
import { supabase } from '@/lib/supabase';

type PendingFactor = { id: string; qrCode: string; secret: string };

export default function SeguridadSection({ role }: { role: string | null }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<SecuritySnapshot | null>(null);
  const [pendingFactor, setPendingFactor] = useState<PendingFactor | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [factorToRemove, setFactorToRemove] = useState<string | null>(null);
  const [removeCode, setRemoveCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refreshSecurity = async () => {
    setLoading(true);
    try {
      setSnapshot(await getSecuritySnapshot());
      setError('');
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo consultar el estado de seguridad de Supabase.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshSecurity(); }, []);

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await changeAuthPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Contraseña actualizada.');
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo cambiar la contraseña.'));
    } finally {
      setBusy(false);
    }
  };

  const enrollMfa = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setPendingFactor(await startTotpEnrollment());
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo iniciar la inscripción MFA.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingFactor) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await verifyTotpEnrollment(pendingFactor.id, totpCode);
      setPendingFactor(null);
      setTotpCode('');
      setMessage('Segundo factor verificado y activado por Supabase.');
      await refreshSecurity();
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo verificar el código.'));
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async (factorId: string) => {
    if (!(await showAppConfirm('Ingresa un nuevo código TOTP para verificar tu identidad y quitar este factor.', 'Desactivar segundo factor'))) return;
    setFactorToRemove(factorId);
    setRemoveCode('');
  };

  const confirmDisableMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorToRemove) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await removeMfaFactor(factorToRemove, removeCode);
      setFactorToRemove(null);
      setRemoveCode('');
      setMessage('Factor eliminado por Supabase.');
      await refreshSecurity();
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo verificar el código o quitar el factor.'));
    } finally {
      setBusy(false);
    }
  };

  const unlinkProvider = async (provider: string) => {
    if (!(await showAppConfirm(`Se desvinculará ${provider} de esta cuenta.`, 'Desvincular identidad'))) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await unlinkAuthIdentity(provider);
      setMessage(`${provider} se desvinculó mediante Supabase Auth.`);
      await refreshSecurity();
    } catch (cause) {
      setError(userFacingError(cause, `No se pudo desvincular ${provider}. Supabase puede requerir que mantengas otra identidad.`));
    } finally {
      setBusy(false);
    }
  };

  const connectGoogle = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (linkError) throw linkError;
    } catch (cause) {
      setError(userFacingError(cause, 'Google no pudo vincularse. Revisa si el proveedor y el vínculo manual están habilitados en Supabase.'));
      setBusy(false);
    }
  };

  const closeOtherSessions = async () => {
    if (!(await showAppConfirm('Se cerrarán las demás sesiones de esta cuenta.', 'Cerrar otras sesiones'))) return;
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
      if (signOutError) throw signOutError;
      setMessage('Supabase cerró las demás sesiones. Esta sesión permanece activa.');
      await refreshSecurity();
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudieron cerrar las demás sesiones.'));
    } finally {
      setBusy(false);
    }
  };

  const closeCurrentSession = async () => {
    setBusy(true);
    try {
      await authService.signOut();
      router.replace('/auth/login');
      router.refresh();
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo cerrar la sesión actual.'));
    } finally {
      setBusy(false);
    }
  };

  const verifiedFactors = snapshot?.factors.filter((factor) => factor.status === 'verified') ?? [];
  const googleConnected = snapshot?.providers.includes('google') ?? false;
  const githubConnected = snapshot?.providers.includes('github') ?? false;
  const isAdmin = ['admin', 'administrador'].includes(String(role ?? '').toLowerCase());

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-extrabold text-slate-900">Seguridad</h2>
        <p className="mt-1 text-sm text-slate-600">Las conexiones y factores se consultan directamente en Supabase Auth.</p>
      </header>
      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-bold text-slate-900">Cambiar contraseña</h3>
        <p className="mt-1 text-xs text-slate-500">Se valida tu contraseña actual antes de actualizarla en Supabase Auth.</p>
        <form onSubmit={savePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Contraseña actual<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <span className="hidden sm:block" />
          <label className="text-sm font-semibold text-slate-700">Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-700">Confirmar contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          <button type="submit" disabled={busy} className="w-fit rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Procesando…' : 'Actualizar contraseña'}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-bold text-slate-900">Autenticación en dos pasos</h3><p className="mt-1 text-sm text-slate-600">{loading ? 'Consultando Supabase…' : verifiedFactors.length ? `Activada · ${verifiedFactors.length} factor(es) verificado(s)` : 'No hay factores verificados.'}</p></div>
          {!pendingFactor && <button type="button" disabled={busy || loading} onClick={() => void enrollMfa()} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50">Configurar TOTP</button>}
        </div>
        {isAdmin && !verifiedFactors.length && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Prioridad de administración: no hay un factor MFA verificado. El repositorio no contiene una regla que fuerce MFA para administradores; esa exigencia necesita configurarse y validarse en Supabase/backend.</p>}
        {pendingFactor && <form onSubmit={verifyMfa} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Escanea el QR con tu aplicación autenticadora y confirma el código.</p>
          <Image src={pendingFactor.qrCode} alt="QR para configurar MFA" width={192} height={192} unoptimized className="mt-4 rounded-lg border border-slate-200 bg-white p-2" />
          <p className="mt-3 break-all text-xs text-slate-600">Clave manual: <span className="font-mono font-bold">{pendingFactor.secret}</span></p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} required value={totpCode} onChange={(event) => setTotpCode(event.target.value)} aria-label="Código de verificación" className="w-40 rounded-xl border border-slate-300 px-3 py-2.5 font-mono" />
            <button type="submit" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Verificar y activar</button>
            <button type="button" disabled={busy} onClick={() => setPendingFactor(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600">Cancelar</button>
          </div>
        </form>}
        {verifiedFactors.map((factor) => <div key={factor.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><span className="text-sm font-semibold text-emerald-900">{factor.friendly_name || factor.factor_type} · verificado</span><button type="button" disabled={busy} onClick={() => void disableMfa(factor.id)} className="text-sm font-bold text-rose-700 hover:underline disabled:opacity-50">Quitar factor</button></div>)}
        {factorToRemove && <form onSubmit={(event) => void confirmDisableMfa(event)} className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <label className="text-sm font-semibold text-slate-700">Código actual de la aplicación autenticadora<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,8}" maxLength={8} required value={removeCode} onChange={(event) => setRemoveCode(event.target.value)} className="mt-1 block w-48 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono" /></label>
          <button type="submit" disabled={busy} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Verificando…' : 'Verificar y quitar'}</button>
          <button type="button" disabled={busy} onClick={() => setFactorToRemove(null)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
        </form>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-bold text-slate-900">Conexiones</h3>
        <p className="mt-1 text-xs text-slate-500">Se muestran identidades vinculadas que reporta Supabase; la disponibilidad de proveedores se configura en el proyecto.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-800">Google</span>{googleConnected ? <button type="button" disabled={busy} onClick={() => void unlinkProvider('google')} className="text-xs font-bold text-rose-700 hover:underline disabled:opacity-50">Desvincular</button> : <button type="button" disabled={busy || loading} onClick={() => void connectGoogle()} className="text-sm font-bold text-blue-700 hover:underline disabled:opacity-50">Vincular</button>}</div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-800">GitHub</span>{githubConnected ? <button type="button" disabled={busy} onClick={() => void unlinkProvider('github')} className="text-xs font-bold text-rose-700 hover:underline disabled:opacity-50">Desvincular</button> : <span className="text-xs text-slate-600">No vinculado; proveedor no verificado en Supabase</span>}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-bold text-slate-900">Sesiones</h3>
        <p className="mt-1 text-sm text-slate-600">{loading ? 'Consultando sesión…' : `Sesión actual activa${snapshot?.sessionExpiresAt ? ` · vence ${new Date(snapshot.sessionExpiresAt * 1000).toLocaleString('es-PY')}` : ''}. Supabase no proporciona aquí un listado de dispositivos.`}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void closeOtherSessions()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cerrar otras sesiones</button>
          <button type="button" disabled={busy} onClick={() => void closeCurrentSession()} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cerrar sesión actual</button>
        </div>
      </section>
    </div>
  );
}