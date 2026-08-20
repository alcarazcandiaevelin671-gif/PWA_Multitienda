import { getCategories } from '@/services/categories.service';
import CategoryGrid from '@/components/home/CategoryGrid';
import ShopCard from '@/components/shops/ShopCard';

export default async function Home() {
  const categories = await getCategories();

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      {/* 1. HERO SECTION (Dark Modern) */}
      <section className="bg-[#0b0f19] text-white py-16 md:py-24 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest block mb-3">
              DIRECTORIO COMERCIAL DEL GUAIRÁ
            </span>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-6">
              Comercio Local.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Más Cerca Tuyo.
              </span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base mb-8 max-w-lg leading-relaxed">
              Descubre tiendas, restaurantes, servicios profesionales y emprendimientos locales en Villarrica y todo el Departamento del Guairá.
            </p>
            <a
              href="#comercios-destacados"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all"
            >
              Explorar Locales →
            </a>
          </div>
          
          {/* Ilustración / Tarjeta Banner Derecha */}
          <div className="flex justify-center">
            <div className="w-full max-w-md h-72 bg-gradient-to-tr from-blue-900/40 to-slate-800/80 rounded-3xl border border-slate-700/60 flex items-center justify-center p-8 shadow-2xl relative overflow-hidden">
              <div className="text-center z-10">
                <span className="text-5xl mb-3 block">🏪</span>
                <p className="text-xl font-bold text-white">Impulsando el Guairá</p>
                <p className="text-xs text-slate-400 mt-1">Conectando negocios locales con la comunidad</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ICON BANNERS (Info rápida) */}
      <section className="border-b border-slate-100 bg-slate-50/50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-3">
            <p className="font-bold text-xs text-slate-900">Locales Verificados</p>
            <p className="text-[11px] text-slate-500">Información confiable y directa</p>
          </div>
          <div className="p-3">
            <p className="font-bold text-xs text-slate-900">Directorio Actualizado</p>
            <p className="text-[11px] text-slate-500">Contactos y ubicación precisa</p>
          </div>
          <div className="p-3">
            <p className="font-bold text-xs text-slate-900">Apoyo al Comercio</p>
            <p className="text-[11px] text-slate-500">Fomento de la economía regional</p>
          </div>
          <div className="p-3">
            <p className="font-bold text-xs text-slate-900">Acceso 24/7</p>
            <p className="text-[11px] text-slate-500">Consulta desde cualquier dispositivo</p>
          </div>
        </div>
      </section>

      {/* 3. CATEGORÍAS PRINCIPALES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-900">Categorías Populares</h2>
        </div>
        <CategoryGrid categories={categories} />
      </section>

      {/* 4. SECCIÓN TOP PICKS (Comercios Destacados) */}
      <section id="comercios-destacados" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-slate-900">Comercios Destacados</h2>
          <span className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">Ver Todos →</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ShopCard id="1" title="Comercial Villarrica" description="Abarrotes, bazar y productos de primera necesidad." badge="Destacado" />
          <ShopCard id="2" title="Gastronomía Guairá" description="Los mejores platos y minutas tradicionales." badge="Popular" />
          <ShopCard id="3" title="Electrónica Yuty" description="Reparación y venta de insumos tecnológicos." />
          <ShopCard id="4" title="Moda & Confecciones" description="Prendas exclusivas y confecciones locales." badge="Nuevo" />
        </div>
      </section>

      {/* 5. BANNER PROMOCIONAL INFERIOR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="bg-[#0b0f19] text-white rounded-3xl p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-800">
          <div className="max-w-xl z-10">
            <span className="text-blue-400 font-bold text-xs uppercase tracking-wider block mb-2">¿Tienes un comercio?</span>
            <h3 className="text-2xl md:text-4xl font-extrabold mb-4">Registra tu local en el portal de la ciudad</h3>
            <p className="text-slate-400 text-xs md:text-sm mb-6">Forma parte del catálogo digital más grande del Departamento del Guairá y llega a más clientes.</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-3 px-6 rounded-xl transition-colors">
              Registrar mi Comercio →
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}