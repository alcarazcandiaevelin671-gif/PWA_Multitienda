'use client';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import Link from 'next/link';
import { showAppConfirm } from '@/lib/app-message';

export default function VendedorProductosPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Estados de carga y sesión
  const [fetching, setFetching] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [tienda, setTienda] = useState<any>(null);
  const [productos, setProductos] = useState<any[]>([]);

  // Estados del formulario de producto
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const [nuevoProducto, setNuevoProducto] = useState({
    titulo: '',
    descripcion: '',
    precio_gs: '',
    imagen_url: '',
    disponible: true,
  });

  // Cargar tienda y sus productos desde la BD
  const cargarTiendaYProductos = useCallback(async () => {
    try {
      setFetching(true);
      setMensaje(null);

      // 1. Verificar sesión activa
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setSessionUser(null);
        setFetching(false);
        return;
      }

      const user = session.user;
      setSessionUser(user);

      // 2. Buscar tienda ligada al usuario
      let { data: tiendaBD, error: tiendaErr } = await supabase
        .from('tiendas')
        .select('*')
        .eq('usuario_id', user.id)
        .maybeSingle();

      if (!tiendaBD) {
        await new Promise((res) => setTimeout(res, 1000));
        const retry = await supabase
          .from('tiendas')
          .select('*')
          .eq('usuario_id', user.id)
          .maybeSingle();
        tiendaBD = retry.data;
      }

      if (tiendaErr) console.error('Error al consultar tienda:', tiendaErr);

      if (!tiendaBD) {
        setTienda(null);
        setFetching(false);
        return;
      }

      setTienda(tiendaBD);

      // 3. Cargar productos usando el esquema exacto de la BD
      const { data: prodsBD, error: prodsErr } = await supabase
        .from('productos')
        .select('*')
        .eq('tienda_id', tiendaBD.id)
        .order('creado_en', { ascending: false });

      if (prodsErr) {
        console.error('Error al cargar productos:', prodsErr);
      } else {
        setProductos(prodsBD || []);
      }

    } catch (err) {
      console.error('Error crítico al obtener información:', err);
    } finally {
      setFetching(false);
    }
  }, [supabase]);

  useEffect(() => {
    cargarTiendaYProductos();
  }, [cargarTiendaYProductos]);

  // Subir imagen del producto
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionUser) return;

    try {
      setUploadingImg(true);
      setMensaje(null);

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `producto_${sessionUser.id}_${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('tiendas-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('tiendas-media')
        .getPublicUrl(fileName);

      setNuevoProducto((prev) => ({ ...prev, imagen_url: publicUrlData.publicUrl }));
      setMensaje({ tipo: 'exito', texto: 'Imagen del producto subida correctamente.' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al subir la imagen.' });
    } finally {
      setUploadingImg(false);
    }
  };

  // Guardar producto
  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tienda) {
      setMensaje({ tipo: 'error', texto: 'No se detectó una tienda válida.' });
      return;
    }

    try {
      setLoading(true);
      setMensaje(null);

      const payload = {
        tienda_id: tienda.id,
        titulo: nuevoProducto.titulo,
        descripcion: nuevoProducto.descripcion,
        precio_gs: Number(nuevoProducto.precio_gs) || 0,
        imagen_url: nuevoProducto.imagen_url || null,
        disponible: nuevoProducto.disponible,
      };

      const { data: prodCreado, error: prodErr } = await supabase
        .from('productos')
        .insert(payload)
        .select()
        .single();

      if (prodErr) throw prodErr;

      setProductos((prev) => [prodCreado, ...prev]);
      setNuevoProducto({
        titulo: '',
        descripcion: '',
        precio_gs: '',
        imagen_url: '',
        disponible: true,
      });

      setMensaje({ tipo: 'exito', texto: '¡Producto publicado con éxito en tu tienda!' });
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      setMensaje({ tipo: 'error', texto: err.message || 'No se pudo guardar el producto.' });
    } finally {
      setLoading(false);
    }
  };

  // Eliminar producto
  const handleEliminarProducto = async (id: string) => {
    const confirmed = await showAppConfirm('¿Estás seguro de que deseas eliminar este producto?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;

      setProductos((prev) => prev.filter((p) => p.id !== id));
      setMensaje({ tipo: 'exito', texto: 'Producto eliminado correctamente.' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error al eliminar el producto.' });
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-3xl mb-2 animate-bounce">📦</div>
        <p className="text-xs font-bold text-slate-500 animate-pulse">
          Buscando la información de tu tienda y productos...
        </p>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
          <span className="text-4xl">🔒</span>
          <h2 className="text-lg font-black text-slate-900 mt-3">Sesión Requerida</h2>
          <p className="text-slate-500 text-xs mt-1 mb-6">
            Debes iniciar sesión con tu cuenta de vendedor para gestionar productos.
          </p>
          <Link
            href="/vendedor/tienda"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all"
          >
            🔑 Ir al Login de Vendedor
          </Link>
        </div>
      </div>
    );
  }

  if (!tienda) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
          <span className="text-4xl">🏪</span>
          <h2 className="text-lg font-black text-slate-900 mt-3">No se encontró una tienda</h2>
          <p className="text-slate-500 text-xs mt-1 mb-6">
            Necesitas guardar los datos básicos de tu tienda por primera vez para poder cargar productos.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={cargarTiendaYProductos}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer mb-1"
            >
              🔄 Volver a verificar en la Base de Datos
            </button>
            <Link
              href="/vendedor/tienda"
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all"
            >
              ⚙️ Registrar / Configurar Mi Tienda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header con el Link de Tienda Pública integrado */}
        <div className="bg-[#0b0f19] text-white p-6 sm:p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded-full uppercase tracking-wider mb-2">
              Comercio: {tienda.nombre_comercio}
            </span>
            <h1 className="text-2xl font-black">📦 Catálogo de Productos</h1>
            <p className="text-slate-400 text-xs mt-1">
              Agrega y administra los artículos visibles para tus clientes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ENLACE A LA TIENDA PÚBLICA */}
            <Link
              href={`/tienda/${tienda.slug}`}
              target="_blank"
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              👁️ Ver mi tienda pública
            </Link>

            <Link
              href="/vendedor/tienda"
              className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
            >
              ⚙️ Configurar Tienda
            </Link>

            <Link
              href="/"
              className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 transition-all"
            >
              🏠 Inicio
            </Link>
          </div>
        </div>

        {/* Mensajes de Estado */}
        {mensaje && (
          <div className={`p-4 rounded-2xl text-xs font-bold border ${
            mensaje.tipo === 'exito'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        {/* Formulario de Carga de Producto */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-6">
            ➕ Agregar Nuevo Producto
          </h2>

          <form onSubmit={handleGuardarProducto} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título / Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={nuevoProducto.titulo}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, titulo: e.target.value })}
                  placeholder="Ej: Empanada de Carne, remera azul..."
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Precio en Guaraníes (Gs.) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={nuevoProducto.precio_gs}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio_gs: e.target.value })}
                  placeholder="Ej: 5000"
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Descripción del Producto
              </label>
              <textarea
                rows={2}
                value={nuevoProducto.descripcion}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, descripcion: e.target.value })}
                placeholder="Detalles, características o tamaño..."
                className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </div>

            {/* Imagen del Producto */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Imagen del Producto
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                  {nuevoProducto.imagen_url ? (
                    <Image src={nuevoProducto.imagen_url} alt="Producto" fill className="object-cover" />
                  ) : (
                    <span className="text-3xl text-slate-300">📦</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImg}
                    className="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {uploadingImg && <p className="text-[10px] text-blue-600 font-bold mt-1">Subiendo imagen...</p>}
                </div>
              </div>
            </div>

            {/* Checkbox Disponibilidad */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="disponible"
                checked={nuevoProducto.disponible}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, disponible: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="disponible" className="text-xs font-bold text-slate-700 cursor-pointer">
                Disponible para la venta
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-4 rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {loading ? '⏳ Guardando Producto...' : '🚀 Publicar Producto'}
            </button>
          </form>
        </div>

        {/* Listado de Productos Registrados */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            📋 Mis Productos Publicados ({productos.length})
          </h2>

          {productos.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-xs font-bold">Aún no has registrado ningún producto.</p>
              <p className="text-[11px] mt-1">Completa el formulario de arriba para empezar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {productos.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-all"
                >
                  <div className="relative w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden flex-shrink-0">
                    {prod.imagen_url ? (
                      <Image src={prod.imagen_url} alt={prod.titulo || 'Producto'} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-slate-300">
                        📦
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 truncate">{prod.titulo}</h3>
                    <p className="text-xs font-black text-blue-600 mt-0.5">
                      {Number(prod.precio_gs).toLocaleString('es-PY')} Gs.
                    </p>
                    <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full mt-1 ${
                      prod.disponible ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {prod.disponible ? 'Disponible' : 'Agotado / No disponible'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleEliminarProducto(prod.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-xs"
                    title="Eliminar producto"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}