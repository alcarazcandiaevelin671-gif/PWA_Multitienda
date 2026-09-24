import ShopCard from '@/components/shops/ShopCard';
import { getFeaturedShops } from '@/services/shops.service';

export default async function TiendasPage() {
  const shops = await getFeaturedShops();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Directorio comercial</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Tiendas del Guairá</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Encuentra comercios, servicios y emprendimientos locales en un solo lugar.
          </p>
        </div>

        {shops.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="font-semibold text-slate-700">Aún no hay tiendas disponibles.</p>
            <p className="mt-2 text-sm text-slate-500">Vuelve a intentarlo más tarde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shops.map((shop: any) => (
              <ShopCard
                key={shop.id}
                id={shop.id}
                slug={shop.slug}
                nombreComercio={shop.nombre_comercio}
                descripcion={shop.descripcion}
                categoriaPrincipal={shop.categoria_principal}
                logoUrl={shop.logo_url}
                bannerUrl={shop.banner_url || shop.portada_url}
                verificada={shop.verificada}
                whatsapp={shop.whatsapp}
                distrito={shop.distritos?.nombre}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
