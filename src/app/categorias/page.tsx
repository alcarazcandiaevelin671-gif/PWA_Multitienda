import Link from 'next/link';
import { getCategories } from '@/services/categories.service';

const categoryIcons: Record<string, string> = {
  Agricultura: '🌾',
  Alimentos: '🧺',
  "Ao Po'i": '👕',
  Artesanías: '🎨',
  'Comercio General': '🏪',
  Gastronomía: '🍽️',
  Otros: '📁',
  Servicios: '💼',
};

export default async function CategoriasPage() {
  const categories = await getCategories();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Explorar por rubro</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Categorías</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Encuentra rápidamente el tipo de comercio o servicio que necesitas.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="font-semibold text-slate-700">No hay categorías disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category: any) => (
              <Link
                key={category.id}
                href={`/categorias/${category.id}`}
                className="group flex min-h-36 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
              >
                <span className="text-4xl" aria-hidden="true">
                  {categoryIcons[category.nombre] || '📦'}
                </span>
                <span className="mt-5 flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-900 group-hover:text-blue-600">{category.nombre}</span>
                  <span className="text-sm font-bold text-blue-600" aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
