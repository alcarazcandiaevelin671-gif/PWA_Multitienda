import { getCategories } from '@/services/categories.service';
import { getFeaturedShops } from '@/services/shops.service';
import CategoryGrid from '@/components/home/CategoryGrid';
import ShopCard from '@/components/shops/ShopCard';
import Link from 'next/link';

export default async function Home() {
  const categories = await getCategories();
  const shops = await getFeaturedShops();

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
              Descubre tiendas, restaurantes, servicios profesionales y artesanías en Villarrica y todo el Departamento del Guairá.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#comercios-destacados"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all"
              >
                Explorar Locales →
              </a>
              <Link
                href="/vendedor/tienda"
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm px-6 py-3 rounded-xl transition-all"
              >
                + Registrar mi Tienda
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-full max-w-md h-64 bg-gradient-to-tr from-blue-900/40 to-slate-800/80 rounded-3xl border border-slate-700/60 flex items-center justify-center p-8 shadow-2xl">
              <div className="text-center">
                <span className="text-5xl mb-2 block">🏪</span>
                <p className="text-xl font-bold text-white">Impulsando el Guairá</p>
                <p className="text-xs text-slate-400 mt-1">Conectando comercios con la comunidad</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categorías Principales */}
      {categories && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Categorías Populares</h2>
          <CategoryGrid categories={categories} />
        </section>
      )}

      {/* Comercios Registrados en Guairá */}
      <section id="comercios-destacados" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Comercios del Guairá</h2>
            <p className="text-xs text-slate-500 mt-0.5">Explora la lista completa de locales disponibles</p>
          </div>
          <span className="text-xs bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full border border-blue-100">
            {shops.length} {shops.length === 1 ? 'comercio' : 'comercios'}
          </span>
        </div>

        {shops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {shops.map((shop) => (
              <ShopCard
                key={shop.id}
                id={shop.id}
                nombreComercio={shop.nombre_comercio}
                descripcion={shop.descripcion}
                categoriaPrincipal={shop.categoria_principal}
                logoUrl={shop.logo_url}
                verificada={shop.verificada}
                whatsapp={shop.whatsapp}
                distrito={shop.distritos?.nombre}
              />
            ))}
          </div>
        ) : (
          /* Mensaje cuando no hay locales registrados todavía */
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-slate-200/80 p-8">
            <span className="text-4xl mb-3 block">🏪</span>
            <h3 className="text-lg font-bold text-slate-800">Aún no hay comercios activos</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-1 mb-6">
              Sé el primero en posicionar tu negocio en el mapa y catálogo del Departamento del Guairá.
            </p>
            <Link
              href="/vendedor/tienda"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-md transition-all"
            >
              Registrar Mi Comercio Ahora
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}