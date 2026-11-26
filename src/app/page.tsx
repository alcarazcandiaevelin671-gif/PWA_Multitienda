/**
 * [PÁGINA] Página / (inicio): portada, comercios destacados y recomendaciones. Se regenera cada 30 s (catálogo público).
 */
import Image from 'next/image';
import { getFeaturedShops } from '@/backend/catalog/shops';
import AIRecommendationsSection from '@/frontend/components/home/AIRecommendationsSection';
import StorefrontAutoRefresh from '@/frontend/components/home/StorefrontAutoRefresh';
import ComerciosGuairaSection from '@/frontend/components/ui/ComerciosGuairaSection';

// Catálogo público: se regenera en segundo plano cada 30 s (Next 15+ ya no cachea las consultas solo).
export const revalidate = 30;

export default async function Home() {
  const shops = await getFeaturedShops();

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      <StorefrontAutoRefresh />
      {/* 1. PORTADA: foto con el logo (public/portada-inicio.jpg). El texto va arriba, sobre un
          oscurecido, y el logo de la foto queda visible abajo. Siempre con texto claro sobre la foto. */}
      <section className="relative isolate flex min-h-[500px] items-start overflow-hidden border-b border-slate-800 bg-slate-950 text-white md:h-[min(55.8vw,85vh)] md:min-h-[520px]">
        <Image
          src="/portada-inicio.jpg"
          alt="Galería comercial y cerros del Guairá con el logo de Portal Guairá Multitienda"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-bottom"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/85 via-slate-950/45 to-transparent" />
        <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-10 text-center sm:px-6 md:pt-14 lg:pt-16">
          <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-primary-300 [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
            Directorio comercial del Guairá
          </span>
          <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-white [text-shadow:0_2px_16px_rgb(0_0_0/0.45)] md:text-5xl lg:text-6xl">
            Comercio Local.
            <span className="block text-primary-300">Más Cerca Tuyo.</span>
          </h1>
          <p className="mx-auto mb-7 max-w-xl text-sm leading-relaxed text-white/90 [text-shadow:0_1px_8px_rgb(0_0_0/0.5)] md:text-base">
            Descubre tiendas, restaurantes, servicios profesionales y emprendimientos en Villarrica y todo el Departamento del Guairá.
          </p>
          <a
            href="/tiendas"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-all hover:bg-primary-700"
          >
            Explorar Productos →
          </a>
        </div>
      </section>

      {/* 2. ICON BANNERS */}
      <section className="border-b border-slate-100 bg-slate-50/50 py-6">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-2 px-4 text-center sm:gap-4 sm:px-6 lg:grid-cols-4 lg:px-8">
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

      {/* 3. SECCIÓN DINÁMICA DE COMERCIOS */}
      <section id="comercios-destacados" className="py-2">
        <ComerciosGuairaSection tiendas={shops} />
      </section>

      {/* 4. RECOMENDACIONES DE PRODUCTOS */}
      <AIRecommendationsSection />

    </main>
  );
}