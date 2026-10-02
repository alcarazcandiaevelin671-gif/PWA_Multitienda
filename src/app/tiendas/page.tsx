import ProductDirectory from '@/components/products/ProductDirectory';
import { getFeaturedProducts, getProductDistricts } from '@/services/products.service';

export const dynamic = 'force-dynamic';

export default async function TiendasPage() {
  const [products, districts] = await Promise.all([getFeaturedProducts(), getProductDistricts()]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Catálogo comercial</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Explorar Productos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Explora productos disponibles de comercios locales del Guairá.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="font-semibold text-slate-700">Aún no hay productos disponibles.</p>
            <p className="mt-2 text-sm text-slate-500">Vuelve a intentarlo más tarde.</p>
          </div>
        ) : (
          <ProductDirectory products={products} districts={districts} />
        )}
      </div>
    </main>
  );
}
