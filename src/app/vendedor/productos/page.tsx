'use client';

/**
 * [PÁGINA] Página /vendedor/productos: alta, edición, imágenes, ofertas y stock de productos.
 *
 * Ofertas: el precio de oferta debe ser menor al normal; en la tienda se ve el precio anterior tachado.
 * Stock (opcional, vacío = sin control): la BASE DE DATOS se encarga de todo lo automático
 *   - avisa al vendedor (notificación) cuando el stock llega al mínimo, se agota o se repone;
 *   - oculta el producto al llegar a 0 y lo vuelve a mostrar al reponerlo;
 *   - descuenta stock en cada compra y lo devuelve si el pedido se cancela.
 * Ver supabase/migrations/20261123120000_ofertas_stock_auditoria.sql.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { showAppConfirm } from '@/frontend/lib/app-message';
import { supabase } from '@/shared/supabase/client';
import { userFacingError } from '@/shared/lib/user-facing-error';
import PriceTag from '@/frontend/components/products/PriceTag';

/** Formulario vacío de alta de producto. Los números se guardan como texto mientras se escriben. */
const EMPTY_PRODUCT = {
  titulo: '',
  descripcion: '',
  precio_gs: '',
  en_oferta: false,
  precio_oferta: '',
  stock: '',
  stock_minimo: '5',
  imagen_url: '',
  categoria_id: '',
  disponible: true,
};

/** Datos editables de un producto existente (precio, oferta, stock y visibilidad). */
type EditForm = {
  precio_gs: string;
  en_oferta: boolean;
  precio_oferta: string;
  stock: string;
  stock_minimo: string;
  disponible: boolean;
};

/** Estado de stock de un producto para mostrar insignias y filtrar. */
function stockState(product: { stock?: number | null; stock_minimo?: number | null }): 'sin_control' | 'agotado' | 'bajo' | 'ok' {
  if (product.stock == null) return 'sin_control';
  if (product.stock <= 0) return 'agotado';
  if (product.stock <= (product.stock_minimo ?? 5)) return 'bajo';
  return 'ok';
}

/**
 * Valida precio, oferta y stock del formulario y devuelve los valores listos para guardar.
 * Lanza un Error con un mensaje claro si algo no es válido.
 */
function parsePricingAndStock(form: { precio_gs: string; en_oferta: boolean; precio_oferta: string; stock: string; stock_minimo: string }) {
  const precio = Number(form.precio_gs);
  if (!Number.isFinite(precio) || precio <= 0) throw new Error('Ingresa un precio válido mayor a 0.');

  let oferta: number | null = null;
  if (form.en_oferta) {
    oferta = Number(form.precio_oferta);
    if (!Number.isFinite(oferta) || oferta <= 0 || oferta >= precio) {
      throw new Error('El precio de oferta debe ser mayor a 0 y menor al precio normal.');
    }
  }

  const stock = form.stock.trim() === '' ? null : Number(form.stock);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) throw new Error('El stock debe ser un número entero de 0 o más.');
  const minimo = form.stock_minimo.trim() === '' ? 5 : Number(form.stock_minimo);
  if (!Number.isInteger(minimo) || minimo < 0) throw new Error('El aviso de stock bajo debe ser un número entero de 0 o más.');

  return { precio_gs: precio, precio_oferta: oferta, stock, stock_minimo: minimo };
}

export default function ComercianteProductosPage() {

  // Estados de carga y sesión
  const [fetching, setFetching] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [tienda, setTienda] = useState<any>(null);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [productos, setProductos] = useState<any[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; nombre: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');

  // Estados del formulario de producto
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const [nuevoProducto, setNuevoProducto] = useState(EMPTY_PRODUCT);

  // Edición rápida de un producto existente (oferta, stock, precio, visibilidad)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

      // 2. Obtener exclusivamente las tiendas asociadas al usuario autenticado.
      const { data: tiendasBD, error: tiendasError } = await supabase
        .from('tiendas')
        .select('*')
        .eq('usuario_id', user.id)
        .order('nombre_comercio');
      if (tiendasError) throw tiendasError;
      const ownedStores = tiendasBD || [];
      setTiendas(ownedStores);

      if (ownedStores.length === 0) {
        setTienda(null);
        setSelectedStoreId('');
        setProductos([]);
        return;
      }

      const tiendaBD = ownedStores[0];
      setSelectedStoreId(tiendaBD.id);
      setTienda(tiendaBD);

      // 3. Cargar productos usando el esquema exacto de la BD
      const [productsResult, categoriesResult] = await Promise.all([
        supabase.from('productos').select('*').eq('tienda_id', tiendaBD.id).order('creado_en', { ascending: false }),
        supabase.from('categorias').select('id, nombre').order('nombre'),
      ]);
      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      setProductos(productsResult.data || []);
      setCategories((categoriesResult.data || []) as Array<{ id: number; nombre: string }>);

    } catch (err) {
      console.error('Error crítico al obtener información:', err);
    } finally {
      setFetching(false);
    }
  }, []);

  // supabase is a shared singleton instance and does not need to be a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cargarTiendaYProductos();
  }, [cargarTiendaYProductos]);

  const handleStoreChange = async (storeId: string) => {
    const nextStore = tiendas.find((item) => item.id === storeId);
    if (!nextStore) return;
    setSelectedStoreId(storeId);
    setTienda(nextStore);
    setFetching(true);
    setMensaje(null);
    try {
      const { data, error } = await supabase.from('productos').select('*').eq('tienda_id', storeId).order('creado_en', { ascending: false });
      if (error) throw error;
      setProductos(data || []);
      setCategoryFilter('');
      setAvailabilityFilter('all');
      setSearchTerm('');
    } catch (error) {
      setMensaje({ tipo: 'error', texto: userFacingError(error, 'No se pudieron cargar los productos de esta tienda.') });
    } finally {
      setFetching(false);
    }
  };

  // Productos eliminados (baja lógica): siguen en la base para no romper pedidos/facturas,
  // pero solo se ven con el filtro "Eliminados", desde donde se pueden restaurar.
  const activeProducts = useMemo(() => productos.filter((product) => !product.eliminado_en), [productos]);
  const deletedCount = productos.length - activeProducts.length;

  const filteredProducts = useMemo(() => productos.filter((product) => {
    if (availabilityFilter === 'eliminados') return Boolean(product.eliminado_en);
    if (product.eliminado_en) return false;
    const matchesSearch = !searchTerm.trim() || String(product.titulo || '').toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesCategory = !categoryFilter || String(product.categoria_id ?? '') === categoryFilter;
    const matchesAvailability = availabilityFilter === 'all'
      || (availabilityFilter === 'oferta' ? Number(product.precio_oferta) > 0
        : availabilityFilter === 'bajo' || availabilityFilter === 'agotado' ? stockState(product) === availabilityFilter
          : String(Boolean(product.disponible)) === availabilityFilter);
    return matchesSearch && matchesCategory && matchesAvailability;
  }), [productos, searchTerm, categoryFilter, availabilityFilter]);

  // Resumen para el aviso superior (lo mismo que la base notifica, visible al entrar)
  const stockSummary = useMemo(() => ({
    bajo: activeProducts.filter((product) => stockState(product) === 'bajo'),
    agotado: activeProducts.filter((product) => stockState(product) === 'agotado'),
  }), [activeProducts]);

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
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo subir la imagen. Inténtalo de nuevo.') });
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
        ...parsePricingAndStock(nuevoProducto),
        imagen_url: nuevoProducto.imagen_url || null,
        categoria_id: nuevoProducto.categoria_id ? Number(nuevoProducto.categoria_id) : null,
        disponible: nuevoProducto.disponible,
      };

      const { data: prodCreado, error: prodErr } = await supabase
        .from('productos')
        .insert(payload)
        .select()
        .single();

      if (prodErr) throw prodErr;

      setProductos((prev) => [prodCreado, ...prev]);
      setNuevoProducto(EMPTY_PRODUCT);

      setMensaje({
        tipo: 'exito',
        texto: prodCreado.oculto_por_stock
          ? 'Producto guardado. Está oculto porque su stock es 0: se mostrará solo cuando cargues unidades.'
          : '¡Producto publicado con éxito en tu tienda!',
      });
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo guardar el producto. Inténtalo de nuevo.') });
    } finally {
      setLoading(false);
    }
  };

  // Abrir / cerrar el panel de edición de un producto
  const startEdit = (product: any) => {
    setEditingId(product.id);
    setEditForm({
      precio_gs: String(product.precio_gs ?? ''),
      en_oferta: Number(product.precio_oferta) > 0,
      precio_oferta: product.precio_oferta ? String(product.precio_oferta) : '',
      stock: product.stock == null ? '' : String(product.stock),
      stock_minimo: String(product.stock_minimo ?? 5),
      disponible: Boolean(product.disponible),
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };

  // Guardar cambios. La base aplica las reglas automáticas (ocultar/mostrar y avisar por stock).
  const handleGuardarEdicion = async (product: any) => {
    if (!editForm) return;
    try {
      setSavingEdit(true);
      setMensaje(null);
      const values = parsePricingAndStock(editForm);
      const { data, error } = await supabase
        .from('productos')
        .update({ ...values, disponible: editForm.disponible })
        .eq('id', product.id)
        .select()
        .single();
      if (error) throw error;

      setProductos((prev) => prev.map((item) => (item.id === product.id ? data : item)));
      cancelEdit();

      // Explicar lo que hizo la base automáticamente
      let texto = 'Producto actualizado.';
      if (data.oculto_por_stock) texto = 'Producto actualizado. Se ocultó de la tienda porque se quedó sin stock; vuelve a aparecer al reponerlo.';
      else if (product.oculto_por_stock && data.disponible) texto = '¡Stock repuesto! El producto vuelve a mostrarse en tu tienda.';
      else if (stockState(data) === 'bajo') texto = `Producto actualizado. Atención: quedan solo ${data.stock} unidades.`;
      setMensaje({ tipo: 'exito', texto });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo actualizar el producto. Inténtalo de nuevo.') });
    } finally {
      setSavingEdit(false);
    }
  };

  // Eliminar producto = BAJA LÓGICA. La base convierte el DELETE en "eliminado_en = ahora" y lo oculta
  // (trigger trg_productos_baja_logica): nada se borra, los pedidos y facturas siguen intactos.
  const handleEliminarProducto = async (id: string) => {
    const confirmed = await showAppConfirm(
      'El producto dejará de mostrarse en tu tienda. Sus pedidos y facturas se conservan, y podrás restaurarlo desde el filtro "Eliminados".',
      '¿Eliminar este producto?',
      'Eliminar',
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;

      // Leer el estado real que dejó la base (eliminado_en, disponible)
      const { data, error: readError } = await supabase.from('productos').select('*').eq('id', id).maybeSingle();
      if (readError) throw readError;
      setProductos((prev) => (data ? prev.map((p) => (p.id === id ? data : p)) : prev.filter((p) => p.id !== id)));
      if (editingId === id) cancelEdit();
      setMensaje({ tipo: 'exito', texto: 'Producto eliminado: ya no se muestra en tu tienda. Puedes restaurarlo desde el filtro "Eliminados".' });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo eliminar el producto. Inténtalo de nuevo.') });
    }
  };

  // Restaurar un producto eliminado (vuelve visible si tiene stock o no controla stock)
  const handleRestaurarProducto = async (id: string) => {
    try {
      const { data, error } = await supabase.from('productos').update({ eliminado_en: null }).eq('id', id).select().single();
      if (error) throw error;
      setProductos((prev) => prev.map((p) => (p.id === id ? data : p)));
      setMensaje({
        tipo: 'exito',
        texto: data.disponible ? 'Producto restaurado: ya se muestra otra vez en tu tienda.' : 'Producto restaurado. Sigue oculto porque su stock es 0: repón unidades para mostrarlo.',
      });
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: userFacingError(err, 'No se pudo restaurar el producto. Inténtalo de nuevo.') });
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
            Debes iniciar sesión con tu cuenta de comerciante para gestionar productos.
          </p>
          <Link
            href="/comerciante/tienda"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all"
          >
            🔑 Iniciar sesión como comerciante
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
              href="/comerciante/tienda"
              className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all"
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
        <div className="zone-hero text-white p-6 sm:p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-1 bg-primary-500/20 text-primary-400 text-[10px] font-black rounded-full uppercase tracking-wider mb-2">
              Comercio: {tienda.nombre_comercio}
            </span>
            <h1 className="text-2xl font-black">📦 Catálogo de Productos</h1>
            <p className="text-slate-400 text-xs mt-1">
              Agrega y administra los artículos visibles para tus clientes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tiendas.length > 1 && (
              <label className="mr-1 text-[10px] font-bold uppercase text-slate-300">
                Tienda
                <select value={selectedStoreId} onChange={(event) => void handleStoreChange(event.target.value)} className="mt-1 block max-w-52 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold normal-case text-white">
                  {tiendas.map((store) => <option key={store.id} value={store.id}>{store.nombre_comercio}</option>)}
                </select>
              </label>
            )}
            {/* ENLACE A LA TIENDA PÚBLICA */}
            <Link
              href={`/tienda/${tienda.slug}`}
              target="_blank"
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              👁️ Ver mi tienda pública
            </Link>

            <Link
              href="/comerciante/tienda"
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

        {/* Aviso de stock: lo mismo que llega en las notificaciones, visible al entrar */}
        {(stockSummary.bajo.length > 0 || stockSummary.agotado.length > 0) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-extrabold">⚠️ Revisa tu stock</p>
            {stockSummary.agotado.length > 0 && (
              <p className="mt-1">
                <strong>Agotados (ocultos en la tienda):</strong> {stockSummary.agotado.map((product) => product.titulo).join(', ')}.{' '}
                <button type="button" onClick={() => setAvailabilityFilter('agotado')} className="font-bold underline">Ver</button>
              </p>
            )}
            {stockSummary.bajo.length > 0 && (
              <p className="mt-1">
                <strong>Quedan pocas unidades:</strong> {stockSummary.bajo.map((product) => `${product.titulo} (${product.stock})`).join(', ')}.{' '}
                <button type="button" onClick={() => setAvailabilityFilter('bajo')} className="font-bold underline">Ver</button>
              </p>
            )}
          </div>
        )}

        {/* Formulario de Carga de Producto */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-6">
            ➕ Agregar Nuevo Producto
          </h2>

          <form onSubmit={handleGuardarProducto} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-600"
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
                  className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                <select value={nuevoProducto.categoria_id} onChange={(event) => setNuevoProducto({ ...nuevoProducto, categoria_id: event.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs focus:ring-2 focus:ring-primary-600">
                  <option value="">Sin categoría</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
                </select>
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
                className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-600 resize-none"
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
                    className="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary-600 file:text-white hover:file:bg-primary-700 cursor-pointer"
                  />
                  {uploadingImg && <p className="text-[10px] text-primary-600 font-bold mt-1">Subiendo imagen...</p>}
                </div>
              </div>
            </div>

            {/* Oferta y stock */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-300 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={nuevoProducto.en_oferta}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, en_oferta: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  🏷️ Poner en oferta
                </label>
                {nuevoProducto.en_oferta && (
                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">Precio de oferta (Gs.) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={nuevoProducto.precio_oferta}
                      onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio_oferta: e.target.value })}
                      placeholder="Menor al precio normal"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs focus:ring-2 focus:ring-rose-500"
                    />
                    {Number(nuevoProducto.precio_gs) > 0 && Number(nuevoProducto.precio_oferta) > 0 && (
                      <div className="mt-2 rounded-xl bg-white p-3">
                        <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Así lo verán tus clientes</p>
                        <PriceTag price={nuevoProducto.precio_gs} offer={nuevoProducto.precio_oferta} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-700">📦 Stock</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="text-[11px] font-bold text-slate-600">Unidades
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={nuevoProducto.stock}
                      onChange={(e) => setNuevoProducto({ ...nuevoProducto, stock: e.target.value })}
                      placeholder="Sin control"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs focus:ring-2 focus:ring-primary-600"
                    />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600">Avisarme con
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={nuevoProducto.stock_minimo}
                      onChange={(e) => setNuevoProducto({ ...nuevoProducto, stock_minimo: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs focus:ring-2 focus:ring-primary-600"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                  Vacío = no se controla stock. Te avisamos cuando queden pocas unidades; al llegar a 0 el producto se oculta solo y vuelve a aparecer cuando lo repongas.
                </p>
              </div>
            </div>

            {/* Checkbox Disponibilidad */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="disponible"
                checked={nuevoProducto.disponible}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, disponible: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
              />
              <label htmlFor="disponible" className="text-xs font-bold text-slate-700 cursor-pointer">
                Disponible para la venta
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs py-4 rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {loading ? '⏳ Guardando Producto...' : '🚀 Publicar Producto'}
            </button>
          </form>
        </div>

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">Buscar producto
            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nombre del producto" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Categoría
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Todas las categorías</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Disponibilidad
            <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">Toda disponibilidad</option><option value="true">Disponible</option><option value="false">No disponible</option>
              <option value="oferta">En oferta</option><option value="bajo">Stock bajo</option><option value="agotado">Sin stock</option>
              <option value="eliminados">Eliminados ({deletedCount})</option>
            </select>
          </label>
        </section>

        {/* Listado de Productos Registrados */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            📋 Productos de {tienda.nombre_comercio} ({filteredProducts.length} de {availabilityFilter === 'eliminados' ? deletedCount : activeProducts.length}{availabilityFilter === 'eliminados' ? ' eliminados' : ''})
          </h2>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-xs font-bold">{availabilityFilter === 'eliminados' ? 'No tienes productos eliminados.' : activeProducts.length === 0 ? 'Aún no has registrado ningún producto.' : 'No hay productos con estos filtros.'}</p>
              <p className="text-[11px] mt-1">{availabilityFilter === 'eliminados' ? 'Los productos que elimines aparecerán aquí para restaurarlos.' : activeProducts.length === 0 ? 'Completa el formulario de arriba para empezar.' : 'Prueba cambiando la búsqueda o los filtros.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className={`rounded-2xl border bg-slate-50 p-4 transition-all hover:border-slate-200 ${editingId === prod.id ? 'border-primary-300 sm:col-span-2' : 'border-slate-100'}`}
                >
                <div className="flex items-center gap-4">
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
                    {categories.find((category) => String(category.id) === String(prod.categoria_id)) && <p className="mt-0.5 truncate text-[10px] text-slate-500">{categories.find((category) => String(category.id) === String(prod.categoria_id))?.nombre}</p>}
                    <div className="mt-0.5">
                      <PriceTag price={prod.precio_gs} offer={prod.precio_oferta} size="sm" />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                        prod.disponible ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {prod.disponible ? 'Visible' : prod.oculto_por_stock ? 'Oculto: sin stock' : 'Oculto'}
                      </span>
                      {stockState(prod) === 'agotado' && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-extrabold text-white">Stock 0</span>}
                      {stockState(prod) === 'bajo' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-800">⚠️ Quedan {prod.stock}</span>}
                      {stockState(prod) === 'ok' && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-700">Stock: {prod.stock}</span>}
                    </div>
                  </div>

                  {prod.eliminado_en ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-700">
                        Eliminado el {new Date(prod.eliminado_en).toLocaleDateString('es-PY')}
                      </span>
                      <button
                        onClick={() => void handleRestaurarProducto(prod.id)}
                        className="cursor-pointer rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-extrabold text-white hover:bg-emerald-700"
                      >
                        ↩️ Restaurar
                      </button>
                    </div>
                  ) : (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => (editingId === prod.id ? cancelEdit() : startEdit(prod))}
                      className="cursor-pointer rounded-xl p-2 text-xs text-primary-600 transition-colors hover:bg-primary-50"
                      title="Editar precio, oferta y stock"
                      aria-label={`Editar ${prod.titulo}`}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleEliminarProducto(prod.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-xs"
                      title="Eliminar producto"
                    >
                      🗑️
                    </button>
                  </div>
                  )}
                </div>

                {/* Panel de edición: precio, oferta, stock y visibilidad */}
                {editingId === prod.id && editForm && (
                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                    <label className="text-[11px] font-bold text-slate-600">Precio normal (Gs.)
                      <input type="number" min="1" value={editForm.precio_gs} onChange={(e) => setEditForm({ ...editForm, precio_gs: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs" />
                    </label>
                    <div className="text-[11px] font-bold text-slate-600">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={editForm.en_oferta} onChange={(e) => setEditForm({ ...editForm, en_oferta: e.target.checked })} className="h-4 w-4 rounded text-rose-600" />
                        🏷️ En oferta
                      </label>
                      {editForm.en_oferta && (
                        <input type="number" min="1" value={editForm.precio_oferta} onChange={(e) => setEditForm({ ...editForm, precio_oferta: e.target.value })} placeholder="Precio de oferta" aria-label="Precio de oferta" className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-xs" />
                      )}
                    </div>
                    <label className="text-[11px] font-bold text-slate-600">Stock (vacío = sin control)
                      <div className="mt-1 flex gap-1">
                        <input type="number" min="0" step="1" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} placeholder="Sin control" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs" />
                        {[5, 10].map((amount) => (
                          <button key={amount} type="button" onClick={() => setEditForm({ ...editForm, stock: String((Number(editForm.stock) || 0) + amount) })} className="whitespace-nowrap rounded-xl bg-emerald-100 px-2 text-[10px] font-extrabold text-emerald-800 hover:bg-emerald-200" title={`Reponer ${amount} unidades`}>
                            +{amount}
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="text-[11px] font-bold text-slate-600">Avisarme cuando queden
                      <input type="number" min="0" step="1" value={editForm.stock_minimo} onChange={(e) => setEditForm({ ...editForm, stock_minimo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs" />
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-600 sm:col-span-2">
                      <input type="checkbox" checked={editForm.disponible} onChange={(e) => setEditForm({ ...editForm, disponible: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
                      Mostrar en la tienda {editForm.stock.trim() === '0' && <span className="font-semibold text-rose-600">(con stock 0 se oculta igual)</span>}
                    </label>
                    {editForm.en_oferta && Number(editForm.precio_oferta) > 0 && (
                      <div className="rounded-xl bg-white p-3 sm:col-span-2">
                        <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Vista previa</p>
                        <PriceTag price={editForm.precio_gs} offer={editForm.precio_oferta} />
                      </div>
                    )}
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="button" disabled={savingEdit} onClick={() => void handleGuardarEdicion(prod)} className="flex-1 cursor-pointer rounded-xl bg-primary-600 py-2.5 text-xs font-extrabold text-white hover:bg-primary-700 disabled:opacity-50">
                        {savingEdit ? 'Guardando...' : '💾 Guardar cambios'}
                      </button>
                      <button type="button" onClick={cancelEdit} className="cursor-pointer rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-300">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}