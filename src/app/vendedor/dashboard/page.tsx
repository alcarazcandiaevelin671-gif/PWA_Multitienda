'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { showAppConfirm } from '@/lib/app-message';
import { supabase } from '@/lib/supabase';
import { userFacingError } from '@/lib/user-facing-error';

const LocationPicker = dynamic(() => import('@/components/ui/LocationPicker'), { ssr: false });

// Helper para convertir nombres a slugs limpios
const crearSlug = (texto: string) => {
  return texto
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
    .replace(/[^a-z0-9 -]/g, '')    // Elimina caracteres especiales
    .replace(/\s+/g, '-')           // Reemplaza espacios por guiones
    .replace(/-+/g, '-');           // Elimina guiones dobles
};

interface Tienda {
  id: string;
  slug?: string;
  nombre_comercio: string;
  descripcion: string | null;
  whatsapp: string;
  logo_url: string | null;
  portada_url: string | null;
  categoria_principal?: string | null;
  direccion_texto?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  plan_tipo: string;
  fecha_fin_prueba: string;
  estado: string;
}

interface Producto {
  id: string;
  tienda_id: string;
  titulo: string;
  nombre?: string | null;
  descripcion: string | null;
  precio_gs: number;
  imagen_url: string | null;
  disponible: boolean;
  categoria_id?: string | null;
}

export default function ComercianteDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [activeTab, setActiveTab] = useState<'perfil' | 'productos'>('productos');

  // Estados Formulario Perfil
  const [perfilForm, setPerfilForm] = useState({
    nombre_comercio: '',
    descripcion: '',
    whatsapp: '',
    categoria_principal: '',
    direccion_texto: '',
    latitud: -25.7806,
    longitud: -56.4486,
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);

  // Estados Formulario Producto
  const [prodForm, setProdForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    precio_oferta: '',
    categoria_id: '',
  });
  const [imagenesProducto, setImagenesProducto] = useState<File[]>([]);
  const [editandoProducto, setEditandoProducto] = useState<string | null>(null);
  const [guardandoProd, setGuardandoProd] = useState(false);
  const [msgExito, setMsgExito] = useState<string | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  const cargarDatosComerciante = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/auth/login';
        return;
      }

      const { data: userProfile, error: userProfileError } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

      if (userProfileError || String(userProfile?.rol || '').toLowerCase() !== 'comerciante') {
        window.location.href = '/perfil';
        return;
      }

      const { data: tiendaData, error: tiendaError } = await supabase
        .from('tiendas')
        .select('*')
        .eq('usuario_id', user.id)
        .maybeSingle();

      if (tiendaError) throw tiendaError;

      if (!tiendaData) {
        window.location.href = '/comerciante/tienda';
        return;
      }

      setTienda(tiendaData);
      setPerfilForm({
        nombre_comercio: tiendaData.nombre_comercio || '',
        descripcion: tiendaData.descripcion || '',
        whatsapp: tiendaData.whatsapp || '',
        categoria_principal: tiendaData.categoria_principal || '',
        direccion_texto: tiendaData.direccion_texto || '',
        latitud: Number(tiendaData.latitud) || -25.7806,
        longitud: Number(tiendaData.longitud) || -56.4486,
      });

      if (!['activa', 'activo'].includes(String(tiendaData.estado || '').toLowerCase())) {
        setProductos([]);
        return;
      }

      const { data: categoriasData } = await supabase
        .from('categorias')
        .select('id, nombre')
        .order('nombre');
      setCategorias(categoriasData || []);

      const { data: prodData, error: prodError } = await supabase
        .from('productos')
        .select('*')
        .eq('tienda_id', tiendaData.id)
        .order('creado_en', { ascending: false });

      if (prodError) throw prodError;
      setProductos(prodData || []);
    } catch (err: any) {
      console.error('Error al cargar datos del comerciante:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatosComerciante();
  }, [cargarDatosComerciante]);

  const calcularDiasRestantes = () => {
    if (!tienda?.fecha_fin_prueba) return 0;
    const fin = new Date(tienda.fecha_fin_prueba).getTime();
    const hoy = new Date().getTime();
    const diferenciaDias = Math.ceil((fin - hoy) / (1000 * 3600 * 24));
    return diferenciaDias > 0 ? diferenciaDias : 0;
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tienda) return;

    setSubiendoLogo(true);
    setMsgError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${tienda.id}_${Date.now()}.${fileExt}`;
      const filePath = `tiendas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tiendas-media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('tiendas-media')
        .getPublicUrl(filePath);

      const logoUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from('tiendas')
        .update({ logo_url: logoUrl })
        .eq('id', tienda.id);

      if (dbError) throw dbError;

      setTienda({ ...tienda, logo_url: logoUrl });
      setMsgExito('Foto de perfil actualizada correctamente.');
    } catch (err: any) {
      setMsgError(userFacingError(err, 'No se pudo subir el logotipo. Inténtalo de nuevo.'));
    } finally {
      setSubiendoLogo(false);
    }
  };

  // Reemplazo de handleGuardarPerfil con soporte para Slug
  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tienda) return;

    setMsgExito(null);
    setMsgError(null);

    const nuevoSlug = crearSlug(perfilForm.nombre_comercio);

    try {
      const { error } = await supabase
        .from('tiendas')
        .update({
          nombre_comercio: perfilForm.nombre_comercio,
          slug: nuevoSlug,
          descripcion: perfilForm.descripcion || null,
          whatsapp: perfilForm.whatsapp,
          categoria_principal: perfilForm.categoria_principal || null,
          direccion_texto: perfilForm.direccion_texto || null,
          latitud: perfilForm.latitud,
          longitud: perfilForm.longitud,
        })
        .eq('id', tienda.id);

      if (error) throw error;

      setTienda({ ...tienda, ...perfilForm, slug: nuevoSlug });
      setMsgExito('Datos de la tienda actualizados correctamente.');
    } catch (err: any) {
      setMsgError(userFacingError(err, 'No se pudo guardar la información del comercio. Inténtalo de nuevo.'));
    }
  };

  const handleUploadPortada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tienda) return;

    setSubiendoPortada(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `tiendas/portada_${tienda.id}_${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('tiendas-media').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('tiendas-media').getPublicUrl(filePath);
      const { error: dbError } = await supabase.from('tiendas').update({ portada_url: data.publicUrl }).eq('id', tienda.id);
      if (dbError) throw dbError;

      setTienda({ ...tienda, portada_url: data.publicUrl });
      setMsgExito('Portada actualizada correctamente.');
    } catch (err: any) {
      setMsgError(userFacingError(err, 'No se pudo subir la portada. Inténtalo de nuevo.'));
    } finally {
      setSubiendoPortada(false);
    }
  };

  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tienda) return;

    setGuardandoProd(true);
    setMsgExito(null);
    setMsgError(null);

    try {
      let prodImagenUrl: string | null = null;

      if (imagenesProducto.length > 0) {
        const imagenSubida = imagenesProducto[0];
        const fileExt = imagenSubida.name.split('.').pop();
        const fileName = `prod_${tienda.id}_${Date.now()}.${fileExt}`;
        const filePath = `productos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('tiendas-media')
          .upload(filePath, imagenSubida);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('tiendas-media')
          .getPublicUrl(filePath);

        prodImagenUrl = publicUrlData.publicUrl;
      }

      const productData = {
        titulo: prodForm.nombre,
        nombre: prodForm.nombre,
        descripcion: prodForm.descripcion || null,
        categoria_id: prodForm.categoria_id || null,
        precio_gs: Number(prodForm.precio),
        precio_oferta: prodForm.precio_oferta ? Number(prodForm.precio_oferta) : null,
        imagen_url: prodImagenUrl,
      };
      let nuevoProd: Producto | null = null;
      let insertError = null;

      if (editandoProducto) {
        const result = await supabase
          .from('productos')
          .update(productData)
          .eq('id', editandoProducto)
          .select()
          .single();
        nuevoProd = result.data as Producto | null;
        insertError = result.error;
      } else {
        const result = await supabase
          .from('productos')
          .insert([{ tienda_id: tienda.id, ...productData, disponible: true }])
          .select()
          .single();
        nuevoProd = result.data as Producto | null;
        insertError = result.error;
      }

      if (insertError) throw insertError;
      if (!nuevoProd) throw new Error('No se pudo guardar el producto.');

      setProductos(editandoProducto ? productos.map((prod) => prod.id === editandoProducto ? nuevoProd : prod) : [nuevoProd, ...productos]);
      setProdForm({ nombre: '', descripcion: '', precio: '', precio_oferta: '', categoria_id: '' });
      setImagenesProducto([]);
      setEditandoProducto(null);
      setMsgExito(editandoProducto ? 'Producto actualizado correctamente.' : '¡Producto publicado con éxito!');
    } catch (err: any) {
      setMsgError(userFacingError(err, 'No se pudo guardar el producto. Inténtalo de nuevo.'));
    } finally {
      setGuardandoProd(false);
    }
  };

  const editarProducto = (producto: Producto) => {
    setEditandoProducto(producto.id);
    setProdForm({
      nombre: producto.titulo || producto.nombre || '',
      descripcion: producto.descripcion || '',
      precio: String(producto.precio_gs || ''),
      precio_oferta: '',
      categoria_id: producto.categoria_id || '',
    });
    setActiveTab('productos');
  };

  const cambiarDisponibilidad = async (producto: Producto) => {
    const { error } = await supabase.from('productos').update({ disponible: !producto.disponible }).eq('id', producto.id);
    if (error) {
      setMsgError(userFacingError(error, 'No se pudo cambiar la disponibilidad. Inténtalo de nuevo.'));
      return;
    }
    setProductos(productos.map((prod) => prod.id === producto.id ? { ...prod, disponible: !producto.disponible } : prod));
  };

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  const handleEliminarProducto = async (id: string) => {
    const confirmed = await showAppConfirm('¿Estás seguro de que deseas eliminar este producto?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);

      if (error) throw error;

      setProductos(productos.filter((prod) => prod.id !== id));
      setMsgExito('Producto eliminado correctamente.');
    } catch (err: any) {
      setMsgError(userFacingError(err, 'No se pudo eliminar el producto. Inténtalo de nuevo.'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-500 text-sm">Cargando panel de tu tienda...</p>
        </div>
      </div>
    );
  }

  if (tienda && !['activa', 'activo'].includes(String(tienda.estado || '').toLowerCase())) {
    const estado = String(tienda.estado || 'pendiente').toLowerCase();
    const estadoVisible = estado === 'pendiente'
      ? 'Pendiente de aprobación'
      : estado.replace(/[_-]/g, ' ');

    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-800">Estado del comercio</p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">{tienda.nombre_comercio}</h1>
          <p className="mt-2 font-bold text-amber-900">{estadoVisible}</p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-700">
            {estado === 'pendiente'
              ? 'Tu solicitud está en revisión. El panel de productos y ventas estará disponible cuando un administrador apruebe el comercio.'
              : 'Las funciones del panel estarán disponibles cuando el comercio sea aprobado.'}
          </p>
          <Link href="/perfil" className="mt-6 inline-flex rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-800">
            Ver mi perfil
          </Link>
        </div>
      </div>
    );
  }

  const diasPrueba = calcularDiasRestantes();

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className={`py-3 px-4 text-center text-sm font-medium ${diasPrueba > 0 ? 'bg-amber-500 text-slate-950' : 'bg-red-600 text-white'}`}>
        {diasPrueba > 0 ? (
          <span>
            🎁 Cuenta en <strong>Periodo de Prueba Gratis</strong>: Te quedan <strong>{diasPrueba} días</strong> de acceso completo.
          </span>
        ) : (
          <span>
            ⚠️ Tu periodo de prueba ha finalizado. Por favor ponte en contacto para renovar tu suscripción.
          </span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8">
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Membresía</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Suscripción Activa (Prototipo)</h2>
          </div>
          <p className="text-sm font-semibold text-emerald-800">
            Próximo vencimiento: {tienda?.fecha_fin_prueba ? new Date(tienda.fecha_fin_prueba).toLocaleDateString('es-PY') : 'No definido'}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-md flex items-center justify-center flex-shrink-0">
              {tienda?.logo_url ? (
                <Image src={tienda.logo_url} alt={tienda.nombre_comercio} fill className="object-cover" />
              ) : (
                <span className="text-3xl">🏪</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{tienda?.nombre_comercio}</h1>
              <p className="text-xs text-slate-500 mt-1">
                WhatsApp: <span className="font-semibold text-slate-700">{tienda?.whatsapp}</span> | Estado:{' '}
                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold capitalize text-xs">
                  {tienda?.estado}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Botón a la tienda pública */}
            {tienda?.slug && (
              <Link
                href={`/tienda/${tienda.slug}`}
                target="_blank"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
              >
                🏪 Ver Mi Tienda Pública
              </Link>
            )}

            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            >
              🌐 Ver Sitio Principal
            </Link>

            <button
              type="button"
              onClick={handleCerrarSesion}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              🚪 Cerrar Sesión
            </button>

            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
              {subiendoLogo ? 'Subiendo...' : '📷 Cambiar Logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadLogo}
                disabled={subiendoLogo}
                className="hidden"
              />
            </label>
            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
              {subiendoPortada ? 'Subiendo...' : '🖼️ Cambiar Portada'}
              <input type="file" accept="image/*" onChange={handleUploadPortada} disabled={subiendoPortada} className="hidden" />
            </label>
          </div>
        </div>

        {msgExito && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200 flex justify-between items-center">
            <span>{msgExito}</span>
            <button onClick={() => setMsgExito(null)} className="font-bold">✕</button>
          </div>
        )}
        {msgError && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 flex justify-between items-center">
            <span>{msgError}</span>
            <button onClick={() => setMsgError(null)} className="font-bold">✕</button>
          </div>
        )}

        <div className="flex border-b border-slate-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('productos')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'productos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📦 Catálogo de Productos ({productos.length})
          </button>
          <button
            onClick={() => setActiveTab('perfil')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'perfil'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚙️ Editar Perfil de Tienda
          </button>
        </div>

        {activeTab === 'productos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
              <h2 className="text-base font-bold text-slate-900 mb-4">➕ Publicar Nuevo Producto</h2>
              <form onSubmit={handleGuardarProducto} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Producto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Chipa al Paso"
                    value={prodForm.nombre}
                    onChange={(e) => setProdForm({ ...prodForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Precio (Gs.) *</label>
                    <input
                      type="number"
                      required
                      placeholder="15000"
                      value={prodForm.precio}
                      onChange={(e) => setProdForm({ ...prodForm, precio: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Oferta (Gs.)</label>
                    <input
                      type="number"
                      placeholder="Opcional"
                      value={prodForm.precio_oferta}
                      onChange={(e) => setProdForm({ ...prodForm, precio_oferta: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={prodForm.categoria_id}
                    onChange={(e) => setProdForm({ ...prodForm, categoria_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Imagen del Producto</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setImagenesProducto(Array.from(e.target.files || []))}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    placeholder="Detalles sobre el producto..."
                    value={prodForm.descripcion}
                    onChange={(e) => setProdForm({ ...prodForm, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={guardandoProd}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors shadow-md disabled:opacity-50"
                >
                  {guardandoProd ? 'Guardando...' : editandoProducto ? 'Guardar Cambios' : 'Publicar Producto'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {productos.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
                  <p className="text-4xl mb-2">🛍️</p>
                  <p className="font-semibold text-sm">Aún no has agregado ningún producto.</p>
                  <p className="text-xs text-slate-400 mt-1">Usa el formulario de la izquierda para comenzar a armar tu catálogo.</p>
                </div>
              ) : (
                productos.map((prod) => (
                  <div key={prod.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100 flex items-center justify-center">
                        {prod.imagen_url ? (
                          <Image src={prod.imagen_url} alt={prod.titulo || prod.nombre || 'Producto'} fill className="object-cover" />
                        ) : (
                          <span className="text-xl">📦</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{prod.titulo || prod.nombre}</h3>
                        <p className="font-bold text-blue-600 text-sm mt-0.5">
                          Gs. {Number(prod.precio_gs).toLocaleString('es-PY')}
                        </p>
                        {prod.descripcion && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{prod.descripcion}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => editarProducto(prod)}
                      title="Editar producto"
                      className="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition-colors text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => cambiarDisponibilidad(prod)}
                      title={prod.disponible ? 'Pausar producto' : 'Activar producto'}
                      className={`px-2 py-1 rounded-lg text-xs font-bold ${prod.disponible ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {prod.disponible ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleEliminarProducto(prod.id)}
                      title="Eliminar producto"
                      className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4">⚙️ Datos Principales de la Tienda</h2>
            <form onSubmit={handleGuardarPerfil} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  value={perfilForm.nombre_comercio}
                  onChange={(e) => setPerfilForm({ ...perfilForm, nombre_comercio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp de Pedidos *</label>
                <input
                  type="text"
                  required
                  value={perfilForm.whatsapp}
                  onChange={(e) => setPerfilForm({ ...perfilForm, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                <select
                  value={perfilForm.categoria_principal}
                  onChange={(e) => setPerfilForm({ ...perfilForm, categoria_principal: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((categoria) => <option key={categoria.id} value={categoria.nombre}>{categoria.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={perfilForm.descripcion}
                  onChange={(e) => setPerfilForm({ ...perfilForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Ubicación</label>
                <input
                  type="text"
                  value={perfilForm.direccion_texto}
                  onChange={(e) => setPerfilForm({ ...perfilForm, direccion_texto: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <LocationPicker
                latInicial={perfilForm.latitud}
                lngInicial={perfilForm.longitud}
                onLocationChange={(lat, lng) => setPerfilForm({ ...perfilForm, latitud: lat, longitud: lng })}
              />

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors shadow-md"
              >
                Guardar Cambios
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}