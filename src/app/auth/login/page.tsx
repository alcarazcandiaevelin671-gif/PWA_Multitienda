'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [esRegistro, setEsRegistro] = useState(false); // Permite cambiar entre Login y Registro
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Iniciar Sesión con Google
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con Google.');
      setLoading(false);
    }
  };

  // Iniciar Sesión o Registrarse con Correo y Contraseña
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (esRegistro) {
        // 1. REGISTRO DE NUEVA CUENTA
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
        });
        if (error) throw error;

        alert('¡Cuenta creada con éxito!');
      } else {
        // 2. INICIO DE SESIÓN DE CUENTA EXISTENTE
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
      }

      // Redirigir a la página principal tras el éxito
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
          {esRegistro ? 'Crear Cuenta Nueva' : 'Iniciar Sesión'}
        </h1>
        <p className="text-slate-500 text-xs text-center mb-6">
          {esRegistro 
            ? 'Regístrate para explorar comercios de Guairá y guardar tus favoritos.' 
            : 'Accede a tu cuenta para gestionar tus compras o tu tienda.'}
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100 flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold">✕</button>
          </div>
        )}

        {/* Botón de Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
          className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-3 shadow-sm mb-4 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Continuar con Google
        </button>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-xs text-slate-400 font-medium">o con correo</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Formulario de Correo / Contraseña */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-md disabled:opacity-50"
          >
            {loading ? 'Procesando...' : esRegistro ? 'Registrarme' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Cambio entre Login y Registro */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <span>{esRegistro ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}</span>
          <button
            type="button"
            onClick={() => {
              setEsRegistro(!esRegistro);
              setErrorMsg(null);
            }}
            className="ml-1 text-blue-600 font-bold hover:underline"
          >
            {esRegistro ? 'Inicia Sesión' : 'Regístrate aquí'}
          </button>
        </div>

        {/* Enlace directo para Vendedores */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 mb-2">¿Quieres vender tus productos en el portal de Guairá?</p>
          <Link
            href="/vendedor/tienda"
            className="inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Registrar mi Tienda como Comerciante
          </Link>
        </div>
      </div>
    </div>
  );
}