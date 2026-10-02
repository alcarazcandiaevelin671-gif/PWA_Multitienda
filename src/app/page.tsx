import { getCategories } from '@/services/categories.service';
import { getFeaturedShops } from '@/services/shops.service';
import CategoryGrid from '@/components/home/CategoryGrid';
import AIRecommendationsSection from '@/components/home/AIRecommendationsSection';
import StorefrontAutoRefresh from '@/components/home/StorefrontAutoRefresh';
import ComerciosGuairaSection from '@/components/ui/ComerciosGuairaSection';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const categories = await getCategories();
  const shops = await getFeaturedShops();

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      <StorefrontAutoRefresh />
      {/* 1. HERO SECTION */}
      <section className="bg-[#0b0f19] text-white py-16 md:py-20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest block mb-3">
              DIRECTORIO COMERCIAL DEL GUAIRÁ
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6">
              Comercio Local.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Más Cerca Tuyo.
              </span>
            </h1>
            <p className="text-slate-400 text-sm mb-8 max-w-lg leading-relaxed">
              Descubre tiendas, restaurantes, servicios profesionales y emprendimientos en Villarrica y todo el Departamento del Guairá.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/tiendas"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all"
              >
                Explorar Productos →
              </a>
            </div>
          </div>
          
          <div className="flex justify-center">
            <div className="w-full max-w-md h-64 bg-gradient-to-tr from-blue-900/40 to-slate-800/80 rounded-3xl border border-slate-700/60 flex items-center justify-center p-8 shadow-2xl relative overflow-hidden">
              <div className="text-center z-10">
                <span className="text-5xl mb-2 block">🏪</span>
                <p className="text-xl font-bold text-white">Impulsando el Guairá</p>
                <p className="text-xs text-slate-400 mt-1">Conectando comercios con la comunidad</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ICON BANNERS */}
      <section className="border-b border-slate-100 bg-slate-50/50 py-6">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 text-center sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="h-full w-full p-3">
            <p className="font-bold text-xs text-slate-900">Locales Verificados</p>
            <p className="text-[11px] text-slate-500">Información confiable y directa</p>
          </div>
          <div className="h-full w-full p-3">
            <p className="font-bold text-xs text-slate-900">Directorio Actualizado</p>
            <p className="text-[11px] text-slate-500">Contactos y ubicación precisa</p>
          </div>
          <div className="h-full w-full p-3">
            <p className="font-bold text-xs text-slate-900">Apoyo al Comercio</p>
            <p className="text-[11px] text-slate-500">Fomento de la economía regional</p>
          </div>
          <div className="h-full w-full p-3">
            <p className="font-bold text-xs text-slate-900">Acceso 24/7</p>
            <p className="text-[11px] text-slate-500">Consulta desde cualquier dispositivo</p>
          </div>
        </div>
      </section>

      {/* 3. CATEGORÍAS PRINCIPALES */}
      {categories && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Categorías Populares</h2>
          <CategoryGrid categories={categories} />
        </section>
      )}

      {/* 4. SECCIÓN DINÁMICA DE COMERCIOS */}
      <section id="comercios-destacados" className="py-2">
        <ComerciosGuairaSection tiendas={shops} />
      </section>

      {/* 5. RECOMENDACIONES DE PRODUCTOS */}
      <AIRecommendationsSection />

    </main>
  );
}