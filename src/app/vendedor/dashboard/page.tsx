'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import Link from 'next/link';

interface Tienda {
  id: string;
  nombre_comercio: string;
  descripcion: string | null;
  whatsapp: string;
  logo_url: string | null;
  portada_url: string | null;
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
}

export default function VendedorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [activeTab, setActiveTab] = useState<'perfil' | 'productos'>('productos');

  // Estados del Formulario de Perfil
  const [perfilForm, setPerfilForm] = useState({
    nombre_comercio: '',
    descripcion: '',
    whatsapp: '',
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Estados del Formulario de Producto
  const [prodForm, setProdForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    precio_oferta: '',
  });
  const [imagenProducto, setImagenProducto] = useState<File | null>(null);
  const [guardandoProd, setGuardandoProd] = useState(false);
  const [msgExito, setMsgExito] = useState<string | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    cargarDatosVendedor();
  }, []);

  const cargarDatosVendedor = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/auth/login';
        return;
      }

      // 1. Obtener la tienda del usuario logueado
      const { data: tiendaData, error: tiendaError } = await supabase
        .from('tiendas')
        .select('*')
        .eq('usuario_id', user.id)
        .maybeSingle();

      if (tiendaError) throw tiendaError;

      if (!tiendaData) {
        window.location.href = '/vendedor/tienda';
        return;
      }

      setTienda(tiendaData);
      setPerfilForm({
        nombre_comercio: tiendaData.nombre_comercio || '',
        descripcion: tiendaData.descripcion || '',
        whatsapp: tiendaData.whatsapp || '',
      });

      // 2. Obtener los productos de esta tienda
      const { data: prodData, error: prodError } = await supabase
        .from('productos')
        .select('*')
        .eq('tienda_id', tiendaData.id)
        .order('creado_en', { ascending: false });

      if (prodError) throw prodError;
      setProductos(prodData || []);
    } catch (err: any) {
      console.error('Error al cargar datos del vendedor:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CÁLCULO DE DÍAS DE PRUEBA ---
  const calcularDiasRestantes = () => {
    if (!tienda?.fecha_fin_prueba) return 0;
    const fin = new Date(tienda.fecha_fin_prueba).getTime();
    const hoy = new Date().getTime();
    const diferenciaDias = Math.ceil((fin - hoy) / (1000 * 3600 * 24));
    return diferenciaDias > 0 ? diferenciaDias : 0;
  };

  // --- SUBIR LOGO / FOTO DE PERFIL DE LA TIENDA ---
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
      setMsgError('Error al subir el logo: ' + err.message);
    } finally {
      setSubiendoLogo(false);
    }
  };

  // --- ACTUALIZAR DATOS DE LA TIENDA ---
  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tienda) return;

    setMsgExito(null);
    setMsgError(null);

    try {
      const { error } = await supabase
        .from('tiendas')
        .update({
          nombre_comercio: perfilForm.nombre_comercio,
          descripcion: perfilForm.descripcion || null,
          whatsapp: perfilForm.whatsapp,
        })
        .eq('id', tienda.id);

      if (error) throw error;

      setTienda({ ...tienda, ...perfilForm });
      setMsgExito('Datos de la tienda actualizados.');
    } catch (err: any) {
      setMsgError(err.message);
    }
  };

  // --- REGISTRAR NUEVO PRODUCTO ---
  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tienda) return;

    setGuardandoProd(true);
    setMsgExito(null);
    setMsgError(null);

    try {
      let prodImagenUrl: string | null = null;

      if (imagenProducto) {
        const fileExt = imagenProducto.name.split('.').pop();
        const fileName = `prod_${tienda.id}_${Date.now()}.${fileExt}`;
        const filePath = `productos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('tiendas-media')
          .upload(filePath, imagenProducto);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('tiendas-media')
          .getPublicUrl(filePath);

        prodImagenUrl = publicUrlData.publicUrl;
      }

      const { data: nuevoProd, error: insertError } = await supabase
        .from('productos')
        .insert([
          {
            tienda_id: tienda.id,
            titulo: prodForm.nombre,
            nombre: prodForm.nombre,
            descripcion: prodForm.descripcion || null,
            precio_gs: Number(prodForm.precio),
            imagen_url: prodImagenUrl,
            disponible: true,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      setProductos([nuevoProd, ...productos]);
      setProdForm({ nombre: '', descripcion: '', precio: '', precio_oferta: '' });
      setImagenProducto(null);
      setMsgExito('¡Producto publicado con éxito!');
    } catch (err: any) {
      setMsgError('Error al guardar el producto: ' + err.message);
    } finally {
      setGuardandoProd(false);
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

  const diasPrueba = calcularDiasRestantes();

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* BANNER DE PRUEBA */}
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
        {/* ENCABEZADO DE LA TIENDA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
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

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            >
              🌐 Ver Sitio Principal
            </Link>

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
          </div>
        </div>

        {/* NOTIFICACIONES */}
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

        {/* NAVEGACIÓN PESTAÑAS */}
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

        {/* CONTENIDO 1: CATÁLOGO DE PRODUCTOS */}
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
                    placeholder="Ej: Empanada de Carne"
                    value={prodForm.nombre}
                    onChange={(e) => setProdForm({ ...prodForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Precio (Gs.) *</label>
                    <input
                      type="number"
                      required
                      placeholder="5000"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Imagen del Producto</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImagenProducto(e.target.files?.[0] || null)}
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
                  {guardandoProd ? 'Guardando...' : 'Publicar Producto'}
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
                  <div key={prod.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100 flex items-center justify-center">
                      {prod.imagen_url ? (
                        <Image src={prod.imagen_url} alt={prod.titulo || prod.nombre || 'Producto'} fill className="object-cover" />
                      ) : (
                        <span className="text-xl">📦</span>
                      )}
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-bold text-slate-900 text-sm">{prod.titulo || prod.nombre}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-bold text-blue-600 text-sm">
                          {Number(prod.precio_gs).toLocaleString('es-PY')} Gs.
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO 2: EDITAR PERFIL DE TIENDA */}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={perfilForm.descripcion}
                  onChange={(e) => setPerfilForm({ ...perfilForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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