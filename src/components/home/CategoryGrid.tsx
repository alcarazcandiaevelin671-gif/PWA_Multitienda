import Link from 'next/link';

interface CategoryGridProps {
  categories: any[];
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  if (!categories || categories.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">Cargando categorías desde Supabase...</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
      {categories.slice(0, 4).map((item, index) => (
        <Link
          key={item.id || index}
          href={`/categorias/${item.id || index}`}
          className="bg-[#f0f3f9] hover:bg-blue-50/80 p-5 rounded-2xl flex items-center justify-between border border-transparent hover:border-blue-200 transition-all group"
        >
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-blue-600">
              {item.nombre || item.name || 'Categoría'}
            </h4>
            <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
              Explorar →
            </span>
          </div>
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-700 font-bold shadow-sm">
            📁
          </div>
        </Link>
      ))}
    </div>
  );
}