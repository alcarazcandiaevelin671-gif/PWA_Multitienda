import { getCategories } from '@/services/categories.service';
import CategoryGrid from '@/components/home/CategoryGrid';
import ShopCard from '@/components/shops/ShopCard';

export default async function Home() {
  const categories = await getCategories();

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      {/* Hero Section */}
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
              Descubre tiendas, restaurantes, servicios profesionales y emprendimientos locales en Villarrica y todo el Departamento.
            </p>
            <a
              href="#comercios-destacados"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all"
            >
              Explorar Locales →
            </a>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-md h-64 bg-gradient-to-tr from-blue-900/40 to-slate-800/80 rounded-3xl border border-slate-700/60 flex items-center justify-center p-8 shadow-2xl">
              <div className="text-center">
                <span className="text-5xl mb-2 block">🏪</span>
                <p className="text-xl font-bold text-white">Impulsando el Guairá</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categorías Principales */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-bold text-slate-900">Categorías Populares</h2>
        <CategoryGrid categories={categories} />
      </section>

      {/* Comercios Destacados */}
      <section id="comercios-destacados" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-12">
        <h2 className="text-2xl font-black text-slate-900 mb-6">Comercios Destacados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ShopCard id="1" title="Comercial Villarrica" description="Abarrotes, bazar y productos varios." badge="Destacado" />
          <ShopCard id="2" title="Gastronomía Guairá" description="Los mejores platos y minutas tradicionales." badge="Popular" />
          <ShopCard id="3" title="Electrónica Yuty" description="Reparación y venta de insumos tecnológicos." />
          <ShopCard id="4" title="Moda & Confecciones" description="Prendas exclusivas y ropa de producción local." badge="Nuevo" />
        </div>
      </section>
    </main>
  );
}