'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { userFacingError } from '@/lib/user-facing-error';

export default function RegistroClientePage() {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    email: '',
    telefono: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const email = formData.email.trim().toLowerCase();
    const nombreCompleto = formData.nombreCompleto.trim();
    const telefono = formData.telefono.trim();

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: formData.password,
        options: {
          data: {
            nombre_completo: nombreCompleto,
            telefono_contacto: telefono,
            rol: 'cliente',
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('No se pudo crear la cuenta. Inténtalo nuevamente.');

      const { error: profileError } = await supabase.from('usuarios').upsert(
        {
          id: data.user.id,
          email,
          nombre_completo: nombreCompleto,
          telefono_contacto: telefono,
          rol: 'cliente',
          activo: true,
        },
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;
      setRegistered(true);
    } catch (caughtError) {
      setError(userFacingError(caughtError, 'Ocurrió un error al crear la cuenta. Inténtalo de nuevo.'));
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
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">Compra y descubre en tu comunidad</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sky-100/80">
            Crea tu cuenta de cliente para explorar comercios locales, guardar tus favoritos y gestionar tu perfil.
          </p>

          <div className="mt-8 space-y-4 text-sm text-sky-50/90">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">🏪</div>
              <p className="mt-2 font-bold">Comercios locales en un solo lugar</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">📍</div>
              <p className="mt-2 font-bold">Contacto directo y cercano</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">⚡</div>
              <p className="mt-2 font-bold">Acceso rápido a productos y tiendas</p>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-black text-slate-900">Crear cuenta de cliente</h2>
              <p className="mt-2 text-sm text-slate-500">Completa tus datos para comenzar.</p>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {registered ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <p className="font-bold text-emerald-800">Tu cuenta de cliente fue creada.</p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-700">
                  Si se solicita confirmar tu correo, revisa tu bandeja de entrada antes de iniciar sesión.
                </p>
                <Link
                  href="/auth/login"
                  className="mt-5 inline-flex rounded-xl bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-700"
                >
                  Ir a iniciar sesión
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="nombreCompleto" className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                    Nombre completo
                  </label>
                  <input
                    id="nombreCompleto"
                    name="nombreCompleto"
                    type="text"
                    autoComplete="name"
                    required
                    value={formData.nombreCompleto}
                    onChange={handleChange}
                    placeholder="Ej. María Benítez"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                </div>

                <div>
                  <label htmlFor="telefono" className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                    Teléfono de contacto
                  </label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="0981 123 456"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
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
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-sm text-slate-500">
              ¿Ya tienes una cuenta?
              <Link href="/auth/login" className="ml-2 font-bold text-sky-600 hover:underline">
                Inicia sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}