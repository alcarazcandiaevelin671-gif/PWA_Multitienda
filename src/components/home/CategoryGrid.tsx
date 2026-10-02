'use client';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Category {
  id: number;
  nombre: string;
  descripcion?: string;
  icono?: string;
}

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  if (!categories || categories.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">No hay categorías disponibles.</div>;
  }

  const iconMap: Record<string, string> = {
    shirt: '👕',
    palette: '🎨',
    utensils: '🍽️',
    wine: '🍷',
    map: '🗺️',
    shopping_basket: '🧺',
    'shopping-basket': '🧺',
    briefcase: '💼',
    store: '🏪',
    wheat: '🌾',
    home: '🏡',
    food: '🥘',
    tools: '🛠️',
    medicine: '💊',
    default: '📁',
  };

  const recordCategoryOpen = async (category: Category) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.rpc('registrar_historial_busqueda', {
        p_termino: category.nombre,
        p_categoria_id: category.id,
        p_distrito_id: null,
      });
    } catch {
      return;
    }
  };

  return (
    <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.slice(0, 8).map((cat) => {
        const icon = iconMap[cat.icono || ''] || iconMap.default;

        return (
          <Link
            key={cat.id}
            href={`/categorias/${cat.id}`}
            onClick={() => { void recordCategoryOpen(cat); }}
            className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-blue-50 p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_20px_40px_rgba(14,116,144,0.08)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_48%)] opacity-80" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-600">Explorar</p>
                <h4 className="text-sm font-black text-slate-900 transition-colors group-hover:text-sky-700">
                  {cat.nombre}
                </h4>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white text-xl shadow-sm shadow-sky-100">
                {icon}
              </div>
            </div>

            <div className="relative mt-5 flex items-center justify-between border-t border-slate-200/80 pt-3">
              <span className="text-[11px] font-bold text-slate-600">Ver categoría</span>
              <span className="text-base font-black text-sky-700 transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}