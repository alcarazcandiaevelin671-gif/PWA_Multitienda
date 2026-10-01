'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { userFacingError } from '@/lib/user-facing-error';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recoveryValid, setRecoveryValid] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hasRecoveryMarker = hash.get('type') === 'recovery' || params.has('code') || params.has('token_hash');

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session && active) {
        setRecoveryValid(true);
        setError('');
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(userFacingError(sessionError, 'El enlace de recuperación no es válido o ya expiró.'));
      } else if (hasRecoveryMarker && data.session) {
        setRecoveryValid(true);
      } else {
        setError('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.');
      }
      setLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      router.replace('/auth/login?password_updated=1');
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo actualizar la contraseña. El enlace podría haber expirado; solicita uno nuevo.'));
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[75vh] bg-slate-50 px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Portal Guairá</p>
        <h1 className="mt-3 text-2xl font-black text-slate-900">Crear nueva contraseña</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Elige una contraseña de entre 12 y 128 caracteres para proteger tu cuenta.</p>

        {loading && <p role="status" className="mt-6 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Verificando el enlace de recuperación…</p>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800">{error}</div>}

        {!loading && recoveryValid && <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Nueva contraseña</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Confirmar nueva contraseña</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
          </div>
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60">
            {saving ? 'Actualizando contraseña…' : 'Guardar nueva contraseña'}
          </button>
        </form>}

        {!loading && !recoveryValid && <Link href="/reset-password" className="mt-6 block rounded-xl bg-sky-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-sky-800">Solicitar un nuevo enlace</Link>}
      </section>
    </main>
  );
}