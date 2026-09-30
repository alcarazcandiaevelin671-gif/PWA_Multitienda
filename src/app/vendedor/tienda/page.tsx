'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { userFacingError } from '@/lib/user-facing-error';

// Mapa dinámico evitando SSR
const LocationPicker = dynamic(() => import('@/components/ui/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400 text-xs font-bold border border-slate-200">
      📍 Cargando Mapa del Guairá...
    </div>
  ),
});

// Lista de respaldo de Distritos del Guairá
const DISTRITOS_GUAIRA = [
  { id: 1, nombre: 'Villarrica' },
  { id: 2, nombre: 'Borja' },
  { id: 3, nombre: 'Colonia Independencia' },
  { id: 4, nombre: 'Coronel Martínez' },
  { id: 5, nombre: 'Dr. Botrell' },
  { id: 6, nombre: 'Félix Pérez Cardozo' },
  { id: 7, nombre: 'General Eugenio A. Garay' },
  { id: 8, nombre: 'Itapé' },
  { id: 9, nombre: 'Iturbe' },
  { id: 10, nombre: 'José Fassardi' },
  { id: 11, nombre: 'Mbocayaty del Guairá' },
  { id: 12, nombre: 'Natalicio Talavera' },
  { id: 13, nombre: 'Ñumí' },
  { id: 14, nombre: 'Paso Yobái' },
  { id: 15, nombre: 'San Salvador' },
  { id: 16, nombre: 'Tebicuary' },
  { id: 17, nombre: 'Yataity del Guairá' },
];

// Lista de respaldo de Categorías
const CATEGORIAS_DEFAULT = [
  { id: 1, nombre: 'Gastronomía y Comidas' },
  { id: 2, nombre: 'Ropa y Calzados' },
  { id: 3, nombre: 'Electrónica y Tecnología' },
  { id: 4, nombre: 'Supermercado y Almacén' },
  { id: 5, nombre: 'Hogar y Muebles' },
  { id: 6, nombre: 'Salud y Belleza' },
  { id: 7, nombre: 'Servicios Profesionales' },
  { id: 8, nombre: 'Artesanía y Regalos' },
  { id: 9, nombre: 'Ferretería y Construcción' },
  { id: 10, nombre: 'Otros Rubros' },
];

export default function ComercianteTiendaPage() {
  const router = useRouter();

  // Estados de sesión y carga
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Estado del Formulario de Autenticación
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({
    nombre_completo: '',
    email: '',
    password: '',
    telefono_contacto: '',
  });
  const [recoveryStep, setRecoveryStep] = useState<0 | 1 | 2 | 3>(0);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState(['', '', '', '', '', '']);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const recoveryInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Estados para subida de imágenes y mensajes
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPortada, setUploadingPortada] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

  // Selectores de datos
  const [distritos, setDistritos] = useState<{ id: number; nombre: string }[]>(DISTRITOS_GUAIRA);
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>(CATEGORIAS_DEFAULT);

  // Datos del Usuario
  const [userData, setUserData] = useState({
    nombre_completo: '',
    email: '',
    telefono_contacto: '',
  });

  // Datos de la Tienda
  const [formData, setFormData] = useState({
    nombre_comercio: '',
    slug: '',
    descripcion: '',
    categoria_principal: 'Gastronomía y Comidas',
    distrito_id: 1,
    direccion_texto: '',
    latitud: -25.7808,
    longitud: -56.4486,
    whatsapp: '',
    telefono: '',
    email: '',
    instagram_username: '',
    facebook_url: '',
    logo_url: '',
    portada_url: '',
  });

  // 1. Verificar Sesión e Inicializar Datos
  useEffect(() => {
    async function loadData() {
      try {
        setFetching(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setSessionUser(null);
          setFetching(false);
          return;
        }

        setSessionUser(session.user);
        const userId = session.user.id;

        // Cargar Distritos
        const { data: distBD } = await supabase
          .from('distritos')
          .select('id, nombre')
          .order('nombre');
        if (distBD && distBD.length > 0) setDistritos(distBD);

        // Cargar Categorías
        const { data: catBD } = await supabase
          .from('categorias')
          .select('id, nombre')
          .order('nombre');
        if (catBD && catBD.length > 0) setCategorias(catBD);

        // Cargar Datos del Usuario desde BD
        const { data: userBD } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (String(userBD?.rol || '').toLowerCase() !== 'comerciante') {
          window.location.href = '/perfil';
          return;
        }

        const emailUsuario = userBD?.email || session.user.email || '';

        setUserData({
          nombre_completo: userBD?.nombre_completo || session.user.user_metadata?.nombre_completo || '',
          email: emailUsuario,
          telefono_contacto: userBD?.telefono_contacto || session.user.user_metadata?.telefono_contacto || '',
        });

        // Cargar Datos de la Tienda desde BD
        const { data: tiendaBD } = await supabase
          .from('tiendas')
          .select('*')
          .eq('usuario_id', userId)
          .maybeSingle();

        if (tiendaBD) {
          setFormData({
            nombre_comercio: tiendaBD.nombre_comercio || '',
            slug: tiendaBD.slug || '',
            descripcion: tiendaBD.descripcion || '',
            categoria_principal: tiendaBD.categoria_principal || 'Gastronomía y Comidas',
            distrito_id: tiendaBD.distrito_id || 1,
            direccion_texto: tiendaBD.direccion_texto || '',
            latitud: tiendaBD.latitud ? Number(tiendaBD.latitud) : -25.7808,
            longitud: tiendaBD.longitud ? Number(tiendaBD.longitud) : -56.4486,
            whatsapp: tiendaBD.whatsapp || '',
            telefono: tiendaBD.telefono || '',
            email: tiendaBD.email || emailUsuario,
            instagram_username: tiendaBD.instagram_username || '',
            facebook_url: tiendaBD.facebook_url || '',
            logo_url: tiendaBD.logo_url || '',
            portada_url: tiendaBD.portada_url || '',
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            email: emailUsuario,
            whatsapp: userBD?.telefono_contacto || '',
          }));
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, []);

  // Manejar Autenticación
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setMensaje(null);

    try {
      if (authMode === 'register') {
        router.push('/auth/registro');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authData.email,
        password: authData.password,
      });

      if (error) throw error;
      if (!data.session) throw new Error('No se pudo iniciar la sesión. Inténtalo de nuevo.');
      window.location.href = '/';
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo autenticar la cuenta. Revisa tus datos e inténtalo de nuevo.') });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setMensaje(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: recoveryEmail,
        options: { shouldCreateUser: false },
      });

      if (error) throw error;
      setRecoveryStep(2);
      setMensaje({ tipo: 'exito', texto: 'Te enviamos un código de 6 dígitos a tu correo.' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo enviar el código. Inténtalo de nuevo.') });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setMensaje(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: recoveryEmail,
        token: recoveryOtp.join(''),
        type: 'email',
      });

      if (error) throw error;
      setRecoveryStep(3);
      setMensaje({ tipo: 'exito', texto: 'Código verificado. Define tu nueva contraseña.' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'El código no es válido o ya expiró.') });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setMensaje(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) throw error;

      setRecoveryStep(0);
      setRecoveryOtp(['', '', '', '', '', '']);
      setRecoveryPassword('');
      setAuthData((prev) => ({ ...prev, email: recoveryEmail, password: '' }));
      setMensaje({ tipo: 'exito', texto: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo actualizar la contraseña. Inténtalo de nuevo.') });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = [...recoveryOtp];
    nextOtp[index] = digit;
    setRecoveryOtp(nextOtp);

    if (digit && index < recoveryInputRefs.current.length - 1) {
      recoveryInputRefs.current[index + 1]?.focus();
    }
  };

  const handleRecoveryOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !recoveryOtp[index] && index > 0) {
      recoveryInputRefs.current[index - 1]?.focus();
    }
  };

  const handleRecoveryOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedCode = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const nextOtp = [...recoveryOtp];
    pastedCode.split('').forEach((digit, index) => { nextOtp[index] = digit; });
    setRecoveryOtp(nextOtp);
    recoveryInputRefs.current[Math.min(pastedCode.length, 6) - 1]?.focus();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setMensaje({ tipo: 'exito', texto: 'Has cerrado sesión.' });
    window.location.href = '/';
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setGuardadoExitoso(false);
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'distrito_id' ? Number(value) : value,
    }));
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGuardadoExitoso(false);
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const uploadImage = async (file: File, type: 'logo' | 'portada') => {
    try {
      if (type === 'logo') setUploadingLogo(true);
      if (type === 'portada') setUploadingPortada(true);
      setMensaje(null);

      if (!sessionUser) throw new Error('Sesión no encontrada.');

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanFileName = `${sessionUser.id}_${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tiendas-media')
        .upload(cleanFileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('tiendas-media')
        .getPublicUrl(cleanFileName);

      if (type === 'logo') {
        setFormData((prev) => ({ ...prev, logo_url: publicUrlData.publicUrl }));
      } else {
        setFormData((prev) => ({ ...prev, portada_url: publicUrlData.publicUrl }));
      }

      setMensaje({ tipo: 'exito', texto: 'Imagen cargada correctamente.' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo subir la imagen. Inténtalo de nuevo.') });
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      if (type === 'portada') setUploadingPortada(false);
    }
  };

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  };

  const irAGestionarProductos = async () => {
    if (!sessionUser) return;
    
    const { data: tiendaBD } = await supabase
      .from('tiendas')
      .select('id')
      .eq('usuario_id', sessionUser.id)
      .maybeSingle();

    if (!tiendaBD) {
      setMensaje({
        tipo: 'error',
        texto: 'Aún no has guardado los datos de tu tienda. Completa el formulario y presiona "Guardar Datos de la Tienda".',
      });
      return;
    }

    router.push('/comerciante/productos');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    try {
      if (!sessionUser) throw new Error('No estás autenticado.');

      const userId = sessionUser.id;

      const { error: userError } = await supabase
        .from('usuarios')
        .update({
          nombre_completo: userData.nombre_completo,
          email: userData.email,
          telefono_contacto: userData.telefono_contacto,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', userId);

      if (userError) throw userError;

      const generatedSlug = slugify(formData.nombre_comercio) || `tienda-${userId.slice(0, 8)}`;

      const tiendaPayload = {
        usuario_id: userId,
        distrito_id: formData.distrito_id,
        nombre_comercio: formData.nombre_comercio,
        slug: generatedSlug,
        descripcion: formData.descripcion,
        categoria_principal: formData.categoria_principal,
        logo_url: formData.logo_url,
        portada_url: formData.portada_url,
        whatsapp: formData.whatsapp,
        telefono: formData.telefono,
        email: formData.email,
        instagram_username: formData.instagram_username,
        facebook_url: formData.facebook_url,
        direccion_texto: formData.direccion_texto,
        latitud: formData.latitud,
        longitud: formData.longitud,
        actualizado_en: new Date().toISOString(),
      };

      const { error: tiendaError } = await supabase
        .from('tiendas')
        .upsert(tiendaPayload, { onConflict: 'usuario_id' });

      if (tiendaError) throw tiendaError;

      setFormData((current) => ({ ...current, slug: generatedSlug }));
      setGuardadoExitoso(true);
      setMensaje({
        tipo: 'exito',
        texto: '¡Excelente! Los datos de tu tienda se guardaron correctamente.',
      });

    } catch (err: any) {
      console.error('Error al guardar:', err);
      setGuardadoExitoso(false);
      setMensaje({
        tipo: 'error',
        texto: userFacingError(err, 'No se pudieron guardar los datos del comercio. Inténtalo de nuevo.'),
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <p className="text-xs font-bold text-slate-500 animate-pulse">
          ⏳ Verificando sesión de comerciante...
        </p>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div className="bg-[#0b0f19] text-white p-8 text-center border-b border-slate-800">
            <span className="text-4xl">🏪</span>
            <h1 className="text-xl font-black mt-2">Portal de Comerciantes</h1>
            <p className="text-slate-400 text-xs mt-1">
              {recoveryStep > 0
                ? 'Recupera el acceso a tu cuenta de comerciante'
                : authMode === 'login'
                ? 'Ingresa tus credenciales para administrar tu tienda'
                : 'Crea tu cuenta de comerciante y publica tu comercio'}
            </p>
          </div>

          <div className={`${recoveryStep > 0 ? 'hidden' : 'flex'} border-b border-slate-100 bg-slate-50`}>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setMensaje(null); }}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                authMode === 'login'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🔑 Iniciar Sesión
            </button>
            <Link
              href="/auth/registro"
              className="flex-1 py-3 text-center text-xs font-bold text-slate-500 transition-all hover:text-slate-800"
            >
              Registrar nuevo comerciante
            </Link>
          </div>

          {mensaje && (
            <div className={`p-4 mx-6 mt-6 rounded-2xl text-xs font-bold ${
              mensaje.tipo === 'exito'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {mensaje.texto}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className={`${recoveryStep > 0 ? 'hidden' : 'block'} p-6 space-y-4`}>
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={authData.nombre_completo}
                  onChange={(e) => setAuthData({ ...authData, nombre_completo: e.target.value })}
                  placeholder="Tu nombre y apellido"
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico *</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={authData.email}
                onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                placeholder="tu@correo.com"
                className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña *</label>
              <input
                type="password"
                required
                minLength={6}
                value={authData.password}
                onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {authMode === 'login' && (
              <button
                type="button"
                onClick={() => { setRecoveryStep(1); setMensaje(null); }}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono Personal / WhatsApp</label>
                <input
                  type="text"
                  value={authData.telefono_contacto}
                  onChange={(e) => setAuthData({ ...authData, telefono_contacto: e.target.value })}
                  placeholder="Ej: 0981123456"
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            {authMode === 'register' && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Plan Comerciante (Membresía)</h2>
                    <p className="mt-1 text-xs text-slate-600">Acceso al panel y publicación de tu comercio.</p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-black text-blue-700">50.000 PYG / mes</span>
                </div>

                <div className="rounded-xl bg-white p-1 border border-blue-100">
                  <label className="cursor-pointer">
                    <input type="radio" name="metodo_pago" value="tarjeta" defaultChecked className="peer sr-only" />
                    <span className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-bold text-white">
                      Tarjeta
                    </span>
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Número de tarjeta *</label>
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9 ]{13,19}"
                      placeholder="0000 0000 0000 0000"
                      className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">MM/AA *</label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        pattern="(0[1-9]|1[0-2])/[0-9]{2}"
                        placeholder="MM/AA"
                        className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CVC *</label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{3,4}"
                        maxLength={4}
                        placeholder="123"
                        className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                  Modo Prototipo: Sin cobro real
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-4 rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {authLoading
                ? 'Procesando...'
                : authMode === 'login'
                ? '🔑 Ingresar al Panel'
                : '🚀 Confirmar Pago y Registrarme'}
            </button>
          </form>

          {recoveryStep > 0 && (
            <div className="mx-6 mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Recuperar contraseña</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {recoveryStep === 1 && 'Solicita tu código'}
                  {recoveryStep === 2 && 'Verifica tu correo'}
                  {recoveryStep === 3 && 'Crea una nueva contraseña'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {recoveryStep === 1 && 'Te enviaremos un código de 6 dígitos.'}
                  {recoveryStep === 2 && `Ingresa el código enviado a ${recoveryEmail}.`}
                  {recoveryStep === 3 && 'La nueva contraseña debe tener al menos 6 caracteres.'}
                </p>
              </div>

              {recoveryStep === 1 && (
                <form onSubmit={handleRecoveryRequest} className="space-y-3">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {recoveryLoading ? 'Enviando...' : 'Enviar código'}
                  </button>
                </form>
              )}

              {recoveryStep === 2 && (
                <form onSubmit={handleRecoveryVerify} className="space-y-4">
                  <div className="flex justify-between gap-2">
                    {recoveryOtp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => { recoveryInputRefs.current[index] = element; }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        required
                        value={digit}
                        onChange={(e) => handleRecoveryOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleRecoveryOtpKeyDown(index, e)}
                        onPaste={handleRecoveryOtpPaste}
                        aria-label={`Dígito ${index + 1} del código`}
                        className="h-12 w-10 rounded-xl border border-slate-200 bg-white text-center text-lg font-black text-slate-900 focus:ring-2 focus:ring-blue-600"
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={recoveryLoading || recoveryOtp.join('').length !== 6}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {recoveryLoading ? 'Verificando...' : 'Verificar código'}
                  </button>
                </form>
              )}

              {recoveryStep === 3 && (
                <form onSubmit={handleRecoveryPassword} className="space-y-3">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {recoveryLoading ? 'Actualizando...' : 'Guardar nueva contraseña'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => { setRecoveryStep(0); setMensaje(null); }}
                className="mt-4 w-full text-xs font-bold text-slate-500 hover:text-blue-600"
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          )}

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-blue-600">
              ← Volver a la página principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Banner Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Perfil de Comerciante</h1>
            <p className="text-slate-500 text-xs mt-1">Configura la información de tu comercio</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* LINK 1 INTEGRADO DE FORMA SEGURA */}
            {formData.nombre_comercio && (
              <Link
                href={`/tienda/${formData.slug || slugify(formData.nombre_comercio)}`}
                target="_blank"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                👁️ Ver mi tienda pública
              </Link>
            )}

            <button
              onClick={irAGestionarProductos}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              📦 Gestionar Mis Productos
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Cabecera */}
          <div className="bg-[#0b0f19] text-white p-6 sm:p-8 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs text-slate-400 font-medium">
                  Conectado como: <strong className="text-white font-bold">{userData.nombre_completo || sessionUser.email}</strong>
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">⚙️ Perfil Comercial y Tienda</h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
              >
                🏠 Ir al Inicio
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-bold bg-rose-950/40 hover:bg-rose-900 text-rose-300 px-4 py-2.5 rounded-xl border border-rose-800/50 transition-all cursor-pointer"
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          </div>

          {/* Mensajes de Alerta y Directo a Productos o Ver Tienda */}
          {mensaje && (
            <div className={`p-4 mx-8 mt-6 rounded-2xl text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              mensaje.tipo === 'exito'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}>
              <span>{mensaje.texto}</span>
              {guardadoExitoso && (
                <div className="flex items-center gap-2">
                  {/* LINK 2 INTEGRADO EN MENSAJE DE ÉXITO */}
                  <Link
                    href={`/tienda/${formData.slug || slugify(formData.nombre_comercio)}`}
                    target="_blank"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    🚀 Ver mi tienda pública →
                  </Link>
                  <button
                    type="button"
                    onClick={irAGestionarProductos}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    📦 Cargar Productos Ahora →
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-8 space-y-8">

            {/* SECCIÓN 1: PROPIETARIO */}
            <div className="space-y-4 border-b border-slate-100 pb-8">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                👤 Datos del Propietario
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    name="nombre_completo"
                    required
                    value={userData.nombre_completo}
                    onChange={handleUserChange}
                    placeholder="Tu nombre y apellido"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    name="email"
                    readOnly
                    disabled
                    value={userData.email}
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono Personal</label>
                  <input
                    type="text"
                    name="telefono_contacto"
                    value={userData.telefono_contacto}
                    onChange={handleUserChange}
                    placeholder="Ej: 0981123456"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: MULTIMEDIA */}
            <div className="space-y-4 border-b border-slate-100 pb-8">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                🖼️ Logos e Imágenes
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2">Logo del Comercio</label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                      {formData.logo_url ? (
                        <Image src={formData.logo_url} alt="Logo" fill className="object-cover" />
                      ) : (
                        <span className="text-3xl text-slate-300">🏪</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(file, 'logo');
                        }}
                        disabled={uploadingLogo}
                        className="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                      {uploadingLogo && <p className="text-[10px] text-blue-600 font-bold mt-1">Subiendo logo...</p>}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2">Portada del Comercio</label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-28 h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                      {formData.portada_url ? (
                        <Image src={formData.portada_url} alt="Portada" fill className="object-cover" />
                      ) : (
                        <span className="text-3xl text-slate-300">🖼️</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(file, 'portada');
                        }}
                        disabled={uploadingPortada}
                        className="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                      {uploadingPortada && <p className="text-[10px] text-blue-600 font-bold mt-1">Subiendo portada...</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: INFORMACIÓN DE TIENDA */}
            <div className="space-y-4 border-b border-slate-100 pb-8">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                🏪 Información del Comercio
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Comercial *</label>
                  <input
                    type="text"
                    name="nombre_comercio"
                    required
                    value={formData.nombre_comercio}
                    onChange={handleChange}
                    placeholder="Ej: Bodega Guairá"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría Principal *</label>
                  <select
                    name="categoria_principal"
                    value={formData.categoria_principal}
                    onChange={handleChange}
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nombre}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción corta</label>
                <textarea
                  name="descripcion"
                  rows={3}
                  value={formData.descripcion}
                  onChange={handleChange}
                  placeholder="Cuenta brevemente qué productos o servicios ofrece tu negocio..."
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>
            </div>

            {/* SECCIÓN 4: CONTACTO Y REDES */}
            <div className="space-y-4 border-b border-slate-100 pb-8">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                💬 Contacto y Redes
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp Comercial *
                  </label>
                  <input
                    type="text"
                    name="whatsapp"
                    required
                    value={formData.whatsapp}
                    onChange={handleChange}
                    placeholder="Ej: 0981123456"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono Alternativo (Opcional)
                  </label>
                  <input
                    type="text"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="Ej: 0541 40000"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Usuario Instagram (Opcional)
                  </label>
                  <input
                    type="text"
                    name="instagram_username"
                    value={formData.instagram_username}
                    onChange={handleChange}
                    placeholder="@mi_comercio"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Facebook (Opcional)
                  </label>
                  <input
                    type="url"
                    name="facebook_url"
                    value={formData.facebook_url}
                    onChange={handleChange}
                    placeholder="https://facebook.com/mi_comercio"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 5: UBICACIÓN */}
            <div className="space-y-4 pb-4">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                📍 Ubicación Geográfica
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Distrito *</label>
                  <select
                    name="distrito_id"
                    value={formData.distrito_id}
                    onChange={handleChange}
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {distritos.map((dist) => (
                      <option key={dist.id} value={dist.id}>
                        {dist.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dirección Escrita</label>
                  <input
                    type="text"
                    name="direccion_texto"
                    value={formData.direccion_texto}
                    onChange={handleChange}
                    placeholder="Ej: Av. General Díaz c/ Coronel Bogado"
                    className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Selecciona la ubicación exacta en el mapa
                </label>
                <LocationPicker
                  latInicial={formData.latitud}
                  lngInicial={formData.longitud}
                  onLocationChange={(lat: number, lng: number) => {
                    setGuardadoExitoso(false);
                    setFormData((prev) => ({ ...prev, latitud: lat, longitud: lng }));
                  }}
                />
              </div>
            </div>

            {/* BOTÓN DE GUARDADO DINÁMICO */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end items-center gap-4">
              <button
                type="submit"
                disabled={loading}
                className={`w-full sm:w-auto font-extrabold text-xs px-8 py-4 rounded-xl transition-all shadow-md cursor-pointer ${
                  guardadoExitoso
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } disabled:opacity-50`}
              >
                {loading
                  ? '⏳ Guardando Comercio...'
                  : guardadoExitoso
                  ? '✅ ¡Datos Guardados con Éxito!'
                  : '💾 Guardar Datos de la Tienda'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}