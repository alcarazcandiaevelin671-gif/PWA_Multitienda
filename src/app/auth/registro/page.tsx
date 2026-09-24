'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showAppMessage } from '@/lib/app-message';

export default function RegistroComerciantePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

      const { error: errorUsuario } = await supabase.from('usuarios').insert([
        {
          identificacion: signUpData.user.id,
          correo_electronico: formData.email,
          nombre_completo: formData.nombreCompleto,
          telefono_contacto: formData.telefono,
          rol: 'vendedor',
          activo: true,
        },
      ]);

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
    <div className="max-w-xl mx-auto my-10 p-6 sm:p-8 bg-white rounded-3xl shadow-xl border border-slate-200/80">
      <h1 className="text-2xl font-black text-center text-slate-900 mb-2">Registro de Comerciante</h1>
      <p className="text-sm text-center text-slate-500 mb-6">Crea tu cuenta de vendedor y publica tus productos para la comunidad de Guairá.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleRegisterVendedor} className="space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos del Propietario</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
          <input
            type="text"
            name="nombreCompleto"
            value={formData.nombreCompleto}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Ej. María Benítez"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico *</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="pass"
                value={formData.pass}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 pr-11 border border-slate-300 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
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

        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-4">Información de la Tienda / Negocio</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial de la Tienda *</label>
          <input
            type="text"
            name="nombreTienda"
            value={formData.nombreTienda}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Ej. Artesanías Villarrica, Novedades Guairá"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp *</label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0981123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Ubicación</label>
            <input
              type="text"
              name="direccionTienda"
              value={formData.direccionTienda}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ej. Centro, Villarrica"
            />
          </div>
        </div>

        <div className="pt-4 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 tracking-wider uppercase">PLAN DE MEMBRESÍA Y PAGO</h2>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-slate-800">Plan Vendedor Mensual</span>
            <span className="text-sm font-black text-emerald-700 whitespace-nowrap">50.000 PYG / mes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Tarjeta *</label>
              <input
                type="text"
                required
                inputMode="numeric"
                placeholder="4500 0000 0000 0000"
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento *</label>
              <input
                type="text"
                required
                inputMode="numeric"
                placeholder="MM/AA"
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CVC / CVV *</label>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={4}
              placeholder="123"
              className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            🔒 Transacción de prueba en modo prototipo. No se realizarán cargos reales a su cuenta.
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          {loading ? 'Creando Tienda...' : '💳 Pagar Plan y Completar Registro'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Ya tienes cuenta de vendedor?{' '}
        <Link href="/auth/login" className="text-green-600 font-semibold hover:underline">
          Inicia Sesión aquí
        </Link>
      </p>
    </div>
  );
}