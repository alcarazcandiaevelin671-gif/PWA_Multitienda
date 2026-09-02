'use client';

import { useState, useEffect } from 'react';
import { productsService } from '@/services/products.service';
import { shopsService } from '@/services/shops.service';
import { authService } from '@/services/auth.service';
import { Product } from '@/types/product';

export default function GestionProductosPage() {
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);
  const [productos, setProductos] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: 0,
    precio_oferta: 0,
    stock: 1,
    imagen_url: '',
    destacado: false,
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const profile = await authService.getCurrentProfile();
      if (!profile) return;

      // Obtener la tienda del comerciante
      const tiendas = await shopsService.getShopsByOwner(profile.id);
      if (tiendas.length > 0) {
        const miTienda = tiendas[0];
        setShopId(miTienda.id);
        const listaProductos = await productsService.getProductsByShop(miTienda.id);
        setProductos(listaProductos);
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (prod?: Product) => {
    if (prod) {
      setEditingProduct(prod);
      setFormData({
        nombre: prod.nombre,
        descripcion: prod.descripcion || '',
        precio: prod.precio,
        precio_oferta: prod.precio_oferta || 0,
        stock: prod.stock,
        imagen_url: prod.imagen_url || '',
        destacado: prod.destacado || false,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        nombre: '',
        descripcion: '',
        precio: 0,
        precio_oferta: 0,
        stock: 1,
        imagen_url: '',
        destacado: false,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;

    try {
      if (editingProduct) {
        await productsService.updateProduct(editingProduct.id, {
          ...formData,
          tienda_id: shopId,
        });
      } else {
        await productsService.createProduct({
          ...formData,
          tienda_id: shopId,
          activo: true,
        });
      }
      setModalOpen(false);
      cargarDatos();
    } catch (error) {
      alert('Error al guardar el producto');
    }
  };

  const handleToggleEstado = async (prod: Product) => {
    try {
      await productsService.toggleProductStatus(prod.id, prod.activo);
      cargarDatos();
    } catch (error) {
      alert('Error cambiando estado del producto');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este producto?')) {
      try {
        await productsService.deleteProduct(id);
        cargarDatos();
      } catch (error) {
        alert('Error eliminando producto');
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando inventario...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Productos</h1>
          <p className="text-sm text-gray-500">Publica y actualiza los artículos visibles en tu tienda</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all shadow-md"
        >
          + Agregar Nuevo Producto
        </button>
      </div>

      {/* Lista de Productos */}
      {productos.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 mb-4">Aún no has publicado productos en tu catálogo.</p>
          <button
            onClick={() => handleOpenModal()}
            className="text-green-600 font-semibold hover:underline"
          >
            Publica tu primer producto aquí
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productos.map((prod) => (
            <div key={prod.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="h-48 bg-gray-100 relative">
                {prod.imagen_url ? (
                  <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin Imagen</div>
                )}
                <span className={`absolute top-3 right-3 px-3 py-1 text-xs font-semibold rounded-full ${prod.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {prod.activo ? 'Publicado' : 'Pausado'}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{prod.nombre}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{prod.descripcion || 'Sin descripción'}</p>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-xl font-extrabold text-green-700">Gs. {prod.precio.toLocaleString('es-PY')}</span>
                    <span className="text-xs text-gray-400">Stock: {prod.stock}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleOpenModal(prod)}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleEstado(prod)}
                    className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium transition-colors"
                  >
                    {prod.activo ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleDelete(prod.id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para Crear/Editar Producto */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (Gs.) *</label>
                  <input
                    type="number"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: Number(e.target.value) })}
                    required
                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Disponible *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    required
                    className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de la Imagen</label>
                <input
                  type="url"
                  value={formData.imagen_url}
                  onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value })}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow-md"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}