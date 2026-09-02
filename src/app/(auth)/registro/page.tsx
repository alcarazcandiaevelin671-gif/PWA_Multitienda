'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/auth.service';

export default function RegistroComerciantePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authService.signUpComerciante(formData);
      alert('¡Tienda y cuenta registradas con éxito! Ahora puedes gestionar tus productos.');
      router.push('/admin/comercios');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al registrar la tienda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto my-12 p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Registro de Comerciante</h1>
      <p className="text-sm text-center text-gray-500 mb-6">Crea tu cuenta de vendedor y publica tus productos para la comunidad de Guairá</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
            <input
              type="password"
              name="pass"
              value={formData.pass}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
            />
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

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md disabled:opacity-50"
        >
          {loading ? 'Creando Tienda...' : 'Completar Registro de Tienda'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Ya tienes cuenta de vendedor?{' '}
        <Link href="/login" className="text-green-600 font-semibold hover:underline">
          Inicia Sesión aquí
        </Link>
      </p>
    </div>
  );
}