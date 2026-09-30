'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showAppMessage } from '@/lib/app-message';
import { supabase } from '@/lib/supabase';

export default function RegistroComerciantePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nombreCompleto: '',
    email: '',
    pass: '',
    telefono: '',
    nombreTienda: '',
    direccionTienda: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegisterVendedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    showAppMessage('Iniciando registro de vendedor...', 'Registro', 'info');

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.pass,
        options: {
          data: {
            rol: 'vendedor',
            nombre_completo: formData.nombreCompleto,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('No se pudo crear la cuenta del vendedor.');

      const { error: errorUsuario } = await supabase.from('usuarios').upsert(
        {
          id: signUpData.user.id,
          email: formData.email,
          nombre_completo: formData.nombreCompleto,
          telefono_contacto: formData.telefono,
          rol: 'vendedor',
          activo: true,
        },
        { onConflict: 'id' }
      );

      if (errorUsuario) {
        console.error('Error al registrar usuario:', errorUsuario);
        alert(errorUsuario.message || 'Falta un dato requerido en el registro del usuario.');
        setLoading(false);
        return;
      }

      const slug = formData.nombreTienda
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

      const { error: errorTienda } = await supabase.from('tiendas').insert([
        {
          usuario_id: signUpData.user.id,
          distrito_id: 1,
          nombre_comercio: formData.nombreTienda,
          slug,
          descripcion: formData.direccionTienda || '',
        },
      ]);

      if (errorTienda) {
        console.error('Error al crear tienda:', errorTienda);
        alert(errorTienda.message || 'No se pudo crear la tienda por una restricción de la base de datos.');
        setLoading(false);
        return;
      }

      showAppMessage('¡Tienda y cuenta registradas con éxito! Ahora puedes gestionar tus productos.', 'Registro completado', 'success');

      if (typeof window !== 'undefined') {
        router.push('/vendedor/dashboard');
        router.refresh();
      }
    } catch (error: any) {
      console.error('Error al registrar vendedor:', error);
      alert(error?.message || 'Ocurrió un error al registrar la tienda.');
      setError(error?.message || 'Ocurrió un error al registrar la tienda.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    await handleRegisterVendedor(e);
  };

  return (
    <div className="min-h-[80vh] bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[0.95fr_1.25fr]">
        <aside className="bg-gradient-to-br from-emerald-900 via-green-800 to-teal-700 p-8 text-white lg:p-10">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-50">
            Vende en Guairá
          </div>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">Publica tu negocio y conecta con clientes locales</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-emerald-50/80">
            Crea tu tienda digital, promociona tus productos y llega a la comunidad del Guairá con una presencia comercial moderna.
          </p>

          <div className="mt-8 space-y-4 text-sm text-emerald-50/90">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">📦</div>
              <p className="mt-2 font-bold">Gestiona tu catálogo de productos</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">💬</div>
              <p className="mt-2 font-bold">Atiende consultas por WhatsApp</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="text-lg">📈</div>
              <p className="mt-2 font-bold">Aumenta visibilidad en la región</p>
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-black text-slate-900">Registro de comerciante</h2>
              <p className="mt-2 text-sm text-slate-500">Completa tus datos para crear tu cuenta y empezar a vender.</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleRegisterVendedor} className="space-y-5">
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Datos del propietario</h3>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Nombre completo *</label>
                  <input
                    type="text"
                    name="nombreCompleto"
                    value={formData.nombreCompleto}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="Ej. María Benítez"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Correo electrónico *</label>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="tu@correo.com"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Contraseña *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="pass"
                        value={formData.pass}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                        placeholder="••••••••"
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
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Información de la tienda</h3>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Nombre comercial de la tienda *</label>
                  <input
                    type="text"
                    name="nombreTienda"
                    value={formData.nombreTienda}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="Ej. Artesanías Villarrica"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Teléfono / WhatsApp *</label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="0981123456"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Dirección / Ubicación</label>
                    <input
                      type="text"
                      name="direccionTienda"
                      value={formData.direccionTienda}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                      placeholder="Ej. Centro, Villarrica"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Plan de membresía</h3>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm">
                  <span>Plan Vendedor Mensual</span>
                  <span className="text-emerald-600">50.000 PYG / mes</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Número de tarjeta *</label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      placeholder="4500 0000 0000 0000"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Vencimiento *</label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      placeholder="MM/AA"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">CVC / CVV *</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="123"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  🔒 Transacción de prueba en modo prototipo. No se realizarán cargos reales a su cuenta.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Creando tienda...' : '💳 Pagar plan y completar registro'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              ¿Ya tienes cuenta de vendedor?{' '}
              <Link href="/auth/login" className="font-bold text-emerald-600 hover:underline">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}