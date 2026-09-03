'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createBrowserClient } from '@supabase/ssr';

const LocationPicker = dynamic(() => import('@/components/ui/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-slate-100 rounded-xl animate-pulse flex items-center justify-center text-slate-400 text-sm">
      Cargando mapa de Guairá...
    </div>
  ),
});

export default function MiTiendaPage() {
  const [loading, setLoading] = useState(false);
  const [cargandoDistritos, setCargandoDistritos] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exitoGuardado, setExitoGuardado] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState<any>(null);
  const [distritos, setDistritos] = useState<Array<{ id: number; nombre: string }>>([]);

  const [emailAuth, setEmailAuth] = useState('');
  const [passwordAuth, setPasswordAuth] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [modoAuth, setModoAuth] = useState<'login' | 'register'>('register');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [formTienda, setFormTienda] = useState({
    nombre_comercio: '',
    categoria_principal: 'Gastronomía',
    distrito_id: '',
    descripcion: '',
    whatsapp: '',
    telefono: '',
    email: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    direccion_texto: '',
    latitud: -25.7806,
    longitud: -56.4486,
  });

  useEffect(() => {
    const inicializarDatos = async () => {
      // 1. Obtener sesión de usuario
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuarioActual(user);
        setFormTienda((prev) => ({ ...prev, email: user.email || '' }));
      }

      // 2. Obtener lista real de distritos desde public.distritos
      try {
        setCargandoDistritos(true);
        const { data, error } = await supabase
          .from('distritos')
          .select('id, nombre')
          .eq('activo', true)
          .order('nombre', { ascending: true });

        if (error) {
          console.error('Error al obtener distritos:', error.message);
        } else if (data && data.length > 0) {
          setDistritos(data);
          // Asigna por defecto Villarrica o el primer elemento obtenido
          setFormTienda((prev) => ({ ...prev, distrito_id: data[0].id.toString() }));
        }
      } catch (err) {
        console.error('Error inesperado leyendo distritos:', err);
      } finally {
        setCargandoDistritos(false);
      }
    };

    inicializarDatos();
  }, [supabase]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/vendedor/tienda`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con Google.');
      setLoading(false);
    }
  };

  const obtenerUbicacionGps = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormTienda((prev) => ({
          ...prev,
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        }));
        alert('¡Ubicación GPS obtenida con éxito!');
      },
      () => {
        alert('Error al obtener la ubicación GPS.');
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      let activeUser = usuarioActual;

      if (!activeUser) {
        if (!emailAuth || !passwordAuth) {
          throw new Error('Por favor ingresa un correo y contraseña para continuar.');
        }

        if (modoAuth === 'register') {
          const { data, error } = await supabase.auth.signUp({
            email: emailAuth,
            password: passwordAuth,
            options: {
              data: { full_name: nombreUsuario || formTienda.nombre_comercio },
            },
          });
          if (error) throw error;
          activeUser = data.user;
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: emailAuth,
            password: passwordAuth,
          });
          if (error) throw error;
          activeUser = data.user;
        }
      }

      if (!activeUser) {
        throw new Error('No se pudo establecer la sesión del usuario.');
      }

      const nombreAUsar = formTienda.nombre_comercio || nombreUsuario || activeUser.email;

      // 1. Actualización / Inserción del usuario
      const { error: userError } = await supabase.from('usuarios').upsert(
        {
          id: activeUser.id,
          email: activeUser.email,
          nombre: nombreAUsar,
          rol: 'comerciante',
          telefono: formTienda.whatsapp || formTienda.telefono || null,
        },
        { onConflict: 'id' }
      );

      if (userError) {
        console.error('Error al actualizar rol de usuario:', userError);
      }

      // 2. Generar slug único para la tienda
      const slugBase = formTienda.nombre_comercio
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const slugFinal = `${slugBase}-${Date.now().toString().slice(-4)}`;

      // 3. Registrar la tienda
      const { error: tiendaError } = await supabase.from('tiendas').insert([
        {
          usuario_id: activeUser.id,
          distrito_id: Number(formTienda.distrito_id),
          nombre_comercio: formTienda.nombre_comercio,
          slug: slugFinal,
          descripcion: formTienda.descripcion || null,
          categoria_principal: formTienda.categoria_principal,
          whatsapp: formTienda.whatsapp,
          telefono: formTienda.telefono || formTienda.whatsapp || null,
          email: formTienda.email || activeUser.email,
          facebook: formTienda.facebook || null,
          instagram: formTienda.instagram || null,
          tiktok: formTienda.tiktok || null,
          direccion_texto: formTienda.direccion_texto || null,
          latitud: formTienda.latitud,
          longitud: formTienda.longitud,
          estado: 'activa',
        },
      ]);

      if (tiendaError) {
        throw new Error(tiendaError.message);
      }

      setExitoGuardado(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error al intentar registrar el comercio.');
    } finally {
      setLoading(false);
    }
  };

  if (exitoGuardado) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-3xl shadow-lg border border-slate-100 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Tienda Registrada con Éxito!</h2>
        <p className="text-slate-600 text-sm mb-6">
          Los datos de <strong className="text-slate-800">{formTienda.nombre_comercio}</strong> ya están visibles en la plataforma.
        </p>
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md"
        >
          Volver al Inicio y Ver Tiendas
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Registro de Vendedor y Comercio</h1>
      <p className="text-slate-600 text-sm mb-6">
        Configura los accesos de tu cuenta y posiciona tu tienda en el mapa interactivo de Guairá.
      </p>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECCIÓN 1: DATOS DE ACCESO / CUENTA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>👤</span> 1. Cuenta de Acceso Vendedor
          </h2>

          {usuarioActual ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 font-medium">Sesión activa detectada:</p>
                <p className="text-sm font-bold text-emerald-900">{usuarioActual.email}</p>
              </div>
              <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded-md font-semibold">
                Conectado
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Iniciar Sesión con Google
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-xs text-slate-400 uppercase font-semibold">o con correo</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {modoAuth === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    placeholder="Ej: Juan Pérez"
                    value={nombreUsuario}
                    onChange={(e) => setNombreUsuario(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={emailAuth}
                    onChange={(e) => setEmailAuth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordAuth}
                    onChange={(e) => setPasswordAuth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  {modoAuth === 'register' ? '¿Ya tienes una cuenta?' : '¿Eres un comerciante nuevo?'}
                </span>
                <button
                  type="button"
                  onClick={() => setModoAuth(modoAuth === 'register' ? 'login' : 'register')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  {modoAuth === 'register' ? 'Iniciar Sesión' : 'Crear Cuenta Nueva'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN 2: DATOS DEL COMERCIO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span>🏪</span> 2. Información del Comercio
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Comercio *</label>
              <input
                type="text"
                required
                placeholder="Ej: Comercial San José"
                value={formTienda.nombre_comercio}
                onChange={(e) => setFormTienda({ ...formTienda, nombre_comercio: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría Principal *</label>
              <select
                value={formTienda.categoria_principal}
                onChange={(e) => setFormTienda({ ...formTienda, categoria_principal: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Gastronomía">Gastronomía</option>
                <option value="Indumentaria">Indumentaria / Moda</option>
                <option value="Electrónica">Electrónica / Tecnología</option>
                <option value="Artesanía">Artesanía / Ao Po'i</option>
                <option value="Servicios">Servicios</option>
                <option value="Supermercado">Supermercado / Almacén</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp de Pedidos *</label>
              <input
                type="text"
                required
                placeholder="Ej: 0981123456"
                value={formTienda.whatsapp}
                onChange={(e) => setFormTienda({ ...formTienda, whatsapp: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Distrito (Guairá) *</label>
              <select
                required
                value={formTienda.distrito_id}
                onChange={(e) => setFormTienda({ ...formTienda, distrito_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={cargandoDistritos}
              >
                {cargandoDistritos ? (
                  <option value="">Cargando distritos del Guairá...</option>
                ) : distritos.length > 0 ? (
                  distritos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))
                ) : (
                  <option value="">No se encontraron distritos</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción corta</label>
            <textarea
              rows={2}
              placeholder="Descripción de los productos o servicios ofrecidos..."
              value={formTienda.descripcion}
              onChange={(e) => setFormTienda({ ...formTienda, descripcion: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SECCIÓN 3: REDES SOCIALES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span>🌐</span> 3. Redes Sociales (Opcional)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Instagram (@usuario)</label>
              <input
                type="text"
                placeholder="@mitienda"
                value={formTienda.instagram}
                onChange={(e) => setFormTienda({ ...formTienda, instagram: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Facebook (Página / Usuario)</label>
              <input
                type="text"
                placeholder="mitienda.py"
                value={formTienda.facebook}
                onChange={(e) => setFormTienda({ ...formTienda, facebook: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">TikTok (@usuario)</label>
              <input
                type="text"
                placeholder="@mitienda.py"
                value={formTienda.tiktok}
                onChange={(e) => setFormTienda({ ...formTienda, tiktok: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: UBICACIÓN Y MAPA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>📍</span> 4. Ubicación del Local
            </h2>
            <button
              type="button"
              onClick={obtenerUbicacionGps}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors"
            >
              📍 Usar mi ubicación GPS
            </button>
          </div>

          <LocationPicker
            latInicial={formTienda.latitud}
            lngInicial={formTienda.longitud}
            onLocationChange={(lat, lng) => {
              setFormTienda((prev) => ({ ...prev, latitud: lat, longitud: lng }));
            }}
          />

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Dirección o Referencia
            </label>
            <input
              type="text"
              placeholder="Ej: Frente a la plaza principal, Barrio Ybaroty"
              value={formTienda.direccion_texto}
              onChange={(e) => setFormTienda({ ...formTienda, direccion_texto: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-colors text-base shadow-lg disabled:opacity-50"
        >
          {loading ? 'Guardando datos...' : 'Completar Registro y Publicar Tienda'}
        </button>
      </form>
    </div>
  );
}