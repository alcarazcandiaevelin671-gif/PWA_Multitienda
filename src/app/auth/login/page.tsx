'use client';

import { useState } from 'react';
import Link from 'next/link';
import { showAppMessage } from '@/lib/app-message';
import { supabase } from '@/lib/supabase';

const normalizeRole = (value: unknown): 'admin' | 'vendedor' | 'cliente' => {
  const normalized = String(value ?? 'cliente').trim().toLowerCase();

  if (['admin', 'administrador'].includes(normalized)) return 'admin';
  if (['comerciante', 'vendedor'].includes(normalized)) return 'vendedor';
  return 'cliente';
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [esRegistro, setEsRegistro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con Google.');
      setLoading(false);
    }
  };

  const handleRegisterCliente = async () => {
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (signUpError) throw signUpError;

      if (signUpData.user) {
        const { error: errorUsuario } = await supabase.from('usuarios').insert([
          {
            identificacion: signUpData.user.id,
            correo_electronico: email,
            nombre_completo: email.split('@')[0],
            telefono_contacto: '',
            rol: 'cliente',
            activo: true,
          },
        ]);

        if (errorUsuario) {
          console.error('Error al registrar usuario:', errorUsuario);
          alert(errorUsuario.message || 'No se pudo registrar el usuario.');
          return;
        }
      }

      showAppMessage('¡Cuenta creada con éxito!', 'Registro completado', 'success');
    } catch (error: any) {
      console.error('Error al registrar cliente:', error);
      alert(error?.message || 'Ocurrió un error al registrar la cuenta.');
      setErrorMsg(error?.message || 'Ocurrió un error al registrar la cuenta.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        await supabase.auth.setSession(data.session);
      }

      window.location.href = '/perfil';
    } catch (err: any) {
      console.error('Error al iniciar sesión:', err.message);
      setErrorMsg(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (esRegistro) {
        await handleRegisterCliente();
      } else {
        await handleLogin(e);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_1.2fr]">
        <aside className="bg-gradient-to-br from-sky-900 via-blue-900 to-indigo-900 p-8 text-white lg:p-10">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-100">
            Portal Guairá
          </div>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            {esRegistro ? 'Abre tu comercio' : 'Encuentra lo que buscas'}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sky-100/80">
            {esRegistro
              ? 'Crea tu tienda y conecta con clientes del Guairá en un solo lugar.'
              : 'Accede a tu cuenta para guardar favoritos, consultar tu perfil y apoyar al comercio local.'}
          </p>

          <div className="mt-8 space-y-4 text-sm text-sky-50/90">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">🏪</div>
              <p className="mt-2 font-bold">Comercios locales verificados</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">📍</div>
              <p className="mt-2 font-bold">Ubicación y contacto directo</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">⚡</div>
              <p className="mt-2 font-bold">Acceso rápido a tiendas y productos</p>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-black text-slate-900">
                {esRegistro ? 'Crear cuenta nueva' : 'Iniciar sesión'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {esRegistro
                  ? 'Regístrate para descubrir comercios y guardar tus favoritos.'
                  : 'Ingresa tus credenciales para continuar.'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <span>{errorMsg}</span>
                <button type="button" onClick={() => setErrorMsg(null)} className="font-black">
                  ✕
                </button>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              type="button"
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continuar con Google
            </button>

            <div className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              o con correo
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
                        <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-4.29 5.3" />
                        <path d="M6.61 6.61A17.75 17.75 0 0 0 2 12s3.5 7 10 7a10.65 10.65 0 0 0 5.39-1.61" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-700 disabled:opacity-50"
              >
                {loading ? 'Procesando...' : esRegistro ? 'Registrarme' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              <span>{esRegistro ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}</span>
              <button
                type="button"
                onClick={() => {
                  setEsRegistro(!esRegistro);
                  setErrorMsg(null);
                }}
                className="ml-2 font-bold text-sky-600 hover:underline"
              >
                {esRegistro ? 'Inicia sesión' : 'Regístrate aquí'}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Comercio</p>
              <p className="mt-2 text-sm text-slate-600">¿Quieres vender en el portal del Guairá?</p>
              <Link href="/auth/registro" className="mt-3 inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700">
                Registrar mi tienda
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}