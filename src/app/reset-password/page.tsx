'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { userFacingError } from '@/lib/user-facing-error';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSent(false);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[75vh] bg-slate-50 px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Portal Guairá</p>
        <h1 className="mt-3 text-2xl font-black text-slate-900">Recuperar contraseña</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Ingresa el correo asociado a tu cuenta y te enviaremos instrucciones para crear una contraseña nueva.</p>

        {sent && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">Si existe una cuenta asociada a ese correo, recibirás un mensaje con las instrucciones para restablecer tu contraseña. Revisa también la carpeta de correo no deseado.</div>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-email" className="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Correo electrónico</label>
            <input id="reset-email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60">
            {loading ? 'Enviando instrucciones…' : 'Enviar instrucciones'}
          </button>
        </form>

        <Link href="/auth/login" className="mt-6 block text-center text-sm font-semibold text-slate-600 hover:text-sky-700">Volver al inicio de sesión</Link>
      </section>
    </main>
  );
}