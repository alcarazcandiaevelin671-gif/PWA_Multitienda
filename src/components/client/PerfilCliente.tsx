'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Ao Po\'i', 'Artesanías', 'Gastronomía', 'Alimentos', 'Agricultura', 'Servicios'];

const normalizeRole = (value: unknown): 'admin' | 'comerciante' | 'vendedor' | 'cliente' => {
  const normalized = String(value ?? 'cliente').trim().toLowerCase();

  if (['admin', 'administrador'].includes(normalized)) return 'admin';
  if (['comerciante', 'vendedor'].includes(normalized)) return 'vendedor';
  return 'cliente';
};

type Profile = {
  id: string;
  nombre_completo: string;
  email: string;
  telefono_contacto?: string | null;
  direccion_texto?: string | null;
  avatar_url?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  rol?: 'admin' | 'comerciante' | 'vendedor' | 'cliente';
};

type Favorite = {
  id: string;
  nombre?: string | null;
  titulo?: string | null;
  imagen_url?: string | null;
  tipo?: string | null;
};

type Order = {
  id: string;
  created_at?: string | null;
  tienda_nombre?: string | null;
  total_pyg?: number | null;
};

export default function PerfilCliente() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    nombre_completo: '',
    email: '',
    telefono_contacto: '',
    direccion_texto: '',
    latitud: '',
    longitud: '',
  });
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setMessage('Inicia sesión para ver tu perfil de cliente.');
        setLoading(false);
        return;
      }

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('identificacion', user.id)
        .maybeSingle();

      const rolDetectado = usuario?.rol || user.user_metadata?.rol || localStorage.getItem('rol_usuario') || 'cliente';
      const nombreBase = usuario?.nombre_completo || user.user_metadata?.nombre_completo || user.email?.split('@')[0] || 'Usuario';

      const nextProfile: Profile = {
        id: user.id,
        nombre_completo: nombreBase,
        email: usuario?.correo_electronico || user.email || '',
        telefono_contacto: usuario?.telefono_contacto || '',
        direccion_texto: usuario?.direccion_texto || '',
        avatar_url: usuario?.avatar_url || null,
        latitud: usuario?.latitud ?? null,
        longitud: usuario?.longitud ?? null,
        rol: normalizeRole(rolDetectado),
      };

      setProfile(nextProfile);
      setForm({
        nombre_completo: nextProfile.nombre_completo,
        email: nextProfile.email,
        telefono_contacto: nextProfile.telefono_contacto || '',
        direccion_texto: nextProfile.direccion_texto || '',
        latitud: nextProfile.latitud?.toString() || '',
        longitud: nextProfile.longitud?.toString() || '',
      });

      const [favoritesResult, ordersResult, interestsResult] = await Promise.all([
        supabase.from('favoritos').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false }).limit(12),
        supabase.from('pedidos').select('*').eq('usuario_id', user.id).order('created_at', { ascending: false }).limit(12),
        supabase.from('preferencias_usuario').select('categoria').eq('usuario_id', user.id),
      ]);

      setFavorites(favoritesResult.data || []);
      setOrders(ordersResult.data || []);
      setInterests((interestsResult.data || []).map((item) => item.categoria).filter(Boolean));
      setLoading(false);
    };

    loadProfile();
  }, []);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('usuarios')
      .update({
        nombre_completo: form.nombre_completo,
        correo_electronico: form.email,
        telefono_contacto: form.telefono_contacto,
        direccion_texto: form.direccion_texto,
        latitud: form.latitud ? Number(form.latitud) : null,
        longitud: form.longitud ? Number(form.longitud) : null,
      })
      .eq('identificacion', profile.id);

    setMessage(error ? `No se pudo guardar el perfil: ${error.message}` : 'Perfil actualizado correctamente.');
    setSaving(false);
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setUploadingAvatar(true);
    setMessage(null);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `clientes/${profile.id}/avatar_${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });

    if (uploadError) {
      setMessage(`No se pudo subir el avatar: ${uploadError.message}`);
      setUploadingAvatar(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: profileError } = await supabase.from('usuarios').update({ avatar_url: data.publicUrl }).eq('identificacion', profile.id);
    setProfile({ ...profile, avatar_url: data.publicUrl });
    setMessage(profileError ? `Avatar guardado, pero no se actualizó el perfil: ${profileError.message}` : 'Avatar actualizado correctamente.');
    setUploadingAvatar(false);
  };

  const toggleInterest = async (category: string) => {
    if (!profile) return;
    const selected = interests.includes(category);
    const nextInterests = selected ? interests.filter((item) => item !== category) : [...interests, category];
    setInterests(nextInterests);

    if (selected) {
      await supabase.from('preferencias_usuario').delete().eq('usuario_id', profile.id).eq('categoria', category);
    } else {
      await supabase.from('preferencias_usuario').upsert({ usuario_id: profile.id, categoria: category }, { onConflict: 'usuario_id,categoria' });
    }
  };

  const handleCerrarSesion = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rol_usuario');
      }
      setProfile(null);
      setMessage('Sesión cerrada correctamente.');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Cargando perfil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl rounded-[28px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-center shadow-[0_20px_60px_rgba(14,116,144,0.12)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl shadow-inner">🔐</div>
        <h2 className="text-2xl font-black text-slate-900">Tu perfil está listo para ser visto</h2>
        <p className="mt-3 text-sm text-slate-600">Inicia sesión para consultar tus compras, favoritos y preferencias personalizadas.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => router.push('/auth/login')} className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-700">
            Iniciar sesión
          </button>
          <button type="button" onClick={() => router.push('/auth/registro')} className="rounded-xl border border-sky-200 bg-white px-5 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-50">
            Crear cuenta
          </button>
        </div>
      </div>
    );
  }

const role = normalizeRole(profile?.rol || 'cliente');
  const roleTheme =
    role === 'admin'
      ? {
        header: 'bg-gradient-to-r from-violet-900 via-purple-800 to-violet-700',
        pill: 'bg-purple-100 text-purple-800 border border-purple-200',
        accent: 'text-violet-300',
        title: 'PANEL DE CONTROL GENERAL - APLICACIÓN MULTITIENDA',
        subtitle: 'Administrador del Sistema',
        description: 'Supervisa indicadores globales, comercios activos y la salud del ecosistema local.',
      }
      : role === 'vendedor'
        ? {
            header: 'bg-gradient-to-r from-emerald-900 via-emerald-700 to-emerald-600',
            pill: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
            accent: 'text-emerald-200',
            title: 'PANEL DE MI TIENDA - PORTAL GUAIRÁ',
            subtitle: 'Comerciante Verificado',
            description: 'Controla tu membresía, catálogo, negocio y presencia comercial en la región.',
          }
        : {
            header: 'bg-gradient-to-r from-blue-900 via-blue-700 to-sky-600',
            pill: 'bg-blue-100 text-blue-800 border border-blue-200',
            accent: 'text-blue-200',
            title: 'MI PERFIL Y PREFERENCIAS',
            subtitle: 'Cliente / Comprador',
            description: 'Consulta tus datos, intereses, pedidos y tiendas de tu preferencia.',
          };

  const roleModules =
    role === 'admin'
      ? (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ['Total de Comercios en Guairá', '38', 'Tiendas activas'],
            ['Productos Totales', '1.240', 'Inventario regional'],
            ['Clientes Registrados', '2.850', 'Usuarios activos'],
          ].map(([label, value, meta]) => (
            <div key={label} className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">{label}</p>
              <p className="mt-3 text-3xl font-black text-violet-900">{value}</p>
              <p className="mt-2 text-xs text-violet-700">{meta}</p>
            </div>
          ))}
          <div className="md:col-span-3 grid gap-4 lg:grid-cols-3">
            {[
              ['Panel de Aprobación / Suspensión', 'Aprobar / bloquear locales pendientes'],
              ['Auditoría de Tiendas', 'Seguimiento de estados y actividad'],
              ['Estado del Servidor / Base de Datos', 'Sincronización y disponibilidad'],
            ].map(([label, text]) => (
              <div key={label} className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-black text-slate-900">{label}</p>
                <p className="mt-2 text-xs text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>
      )
      : role === 'comerciante' || role === 'vendedor'
        ? (
          <section className="grid gap-4 lg:grid-cols-3">
            {[
              ['Estado de la Membresía', '50.000 PYG / mes • Activo'],
              ['Gestión del Negocio', 'Logo, portada, WhatsApp y coordenadas PostGIS'],
              ['Catálogo de Productos', 'Agregar, editar, pausar o eliminar artículos'],
            ].map(([label, text]) => (
              <div key={label} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{label}</p>
                <p className="mt-3 text-sm font-semibold text-slate-800">{text}</p>
              </div>
            ))}
          </section>
        )
        : (
          <section className="grid gap-4 lg:grid-cols-3">
            {[
              ['Datos Personales', 'Nombre, correo y WhatsApp de contacto'],
              ['Mis Tiendas y Productos Favoritos', 'Acceso rápido a locales y artículos guardados'],
              ['Historial de Pedidos', 'Pedidos derivados a WhatsApp y seguimiento'],
            ].map(([label, text]) => (
              <div key={label} className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">{label}</p>
                <p className="mt-3 text-sm font-semibold text-slate-800">{text}</p>
              </div>
            ))}
          </section>
        );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className={`rounded-2xl p-6 text-white shadow-sm ${roleTheme.header}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${roleTheme.accent}`}>Cuenta personal</p>
              <h1 className="mt-2 text-2xl font-black">{roleTheme.title}</h1>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${roleTheme.pill}`}>{roleTheme.subtitle}</span>
          </div>
          <p className="mt-3 text-sm text-slate-200">{roleTheme.description}</p>
        </header>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{message}</div>}

        {roleModules}

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full bg-slate-100 ring-4 ring-blue-50">
              {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Avatar del cliente" fill unoptimized className="object-cover" /> : <span className="flex h-full items-center justify-center text-5xl">👤</span>}
            </div>
            <label className="mt-5 inline-block cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
              {uploadingAvatar ? 'Subiendo...' : 'Actualizar foto'}
              <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploadingAvatar} className="hidden" />
            </label>
            <p className="mt-4 text-xs text-slate-500">Ubicación registrada</p>
            <p className="font-mono text-xs text-slate-700">{form.latitud || 'Sin latitud'}, {form.longitud || 'sin longitud'}</p>
          </div>

          <form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Datos personales</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['nombre_completo', 'Nombre Completo', 'text'],
                ['email', 'Correo Electrónico', 'email'],
                ['telefono_contacto', 'Teléfono / WhatsApp', 'tel'],
                ['direccion_texto', 'Municipio / Dirección', 'text'],
                ['latitud', 'Latitud', 'number'],
                ['longitud', 'Longitud', 'number'],
              ].map(([field, label, type]) => (
                <label key={field} className="text-xs font-bold text-slate-700">
                  {label}
                  <input type={type} value={form[field as keyof typeof form]} onChange={(event) => updateField(field as keyof typeof form, event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              ))}
            </div>
            <button type="submit" disabled={saving} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Mis Favoritos</h2>
            {favorites.length === 0 ? <p className="mt-4 text-sm text-slate-500">Todavía no tienes favoritos guardados.</p> : <div className="mt-4 grid grid-cols-2 gap-3">{favorites.map((favorite) => <div key={favorite.id} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{favorite.nombre || favorite.titulo || 'Favorito'}</div>)}</div>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Historial de Pedidos</h2>
            {orders.length === 0 ? <p className="mt-4 text-sm text-slate-500">No hay pedidos registrados.</p> : <div className="mt-4 space-y-3">{orders.map((order) => <div key={order.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span className="font-semibold text-slate-700">{order.tienda_nombre || 'Tienda'}</span><span className="font-bold text-emerald-700">Gs. {Number(order.total_pyg || 0).toLocaleString('es-PY')}</span></div>)}</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Mis Intereses / Categorías Preferidas</h2>
          <p className="mt-1 text-sm text-slate-500">Selecciona categorías para mejorar tus recomendaciones.</p>
          <div className="mt-4 flex flex-wrap gap-2">{CATEGORIES.map((category) => <button key={category} type="button" onClick={() => toggleInterest(category)} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${interests.includes(category) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}>{category}</button>)}</div>
        </section>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="rounded-xl border border-red-200 bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </main>
  );
}
