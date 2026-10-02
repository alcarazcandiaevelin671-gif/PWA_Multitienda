import Image from 'next/image';
import Link from 'next/link';
import FavoriteToggle from '@/components/common/FavoriteToggle';

interface TiendaPublica {
  id: string;
  nombre_comercio: string | null;
  slug: string | null;
  descripcion: string | null;
  categoria_principal: string | null;
  logo_url: string | null;
  portada_url: string | null;
  whatsapp: string | null;
  distritos: { id: number; nombre: string | null } | null;
}

export default function ComerciosGuairaSection({ tiendas }: { tiendas: TiendaPublica[] }) {

  if (tiendas.length === 0) {
    return (
      <section className="py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">🏪 Comercios del Guairá</h2>
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm">
            <span className="text-4xl block mb-2">🏬</span>
            <p className="text-sm font-bold text-slate-700">Aún no hay comercios registrados</p>
            <p className="text-xs text-slate-500 mt-1">El directorio se actualizará cuando haya nuevos comercios disponibles.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Directorio local</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Comercios del Guairá</h2>
          </div>
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700">
            {tiendas.length} {tiendas.length === 1 ? 'comercio' : 'comercios'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tiendas.map((tienda) => {
            const distritoNombre = tienda.distritos?.nombre || 'Guairá';
            const nombreComercio = tienda.nombre_comercio || 'Comercio del Guairá';

            return (
              <article key={tienda.id} className="group relative flex flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_35px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(14,116,144,0.12)]">
                <div className="relative h-36 w-full overflow-hidden bg-slate-800">
                  {tienda.portada_url ? (
                    <Image
                      src={tienda.portada_url}
                      alt={nombreComercio}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-r from-slate-800 via-blue-900 to-slate-900 text-xs font-black uppercase tracking-[0.28em] text-white/20">
                      Guairá Comercial
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/45 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    📍 {distritoNombre}
                  </span>
                  <FavoriteToggle kind="tienda" targetId={tienda.id} className="absolute right-3 top-3 z-20" />
                </div>

                <div className="relative flex flex-1 flex-col px-5 pb-5 pt-0">
                  <div className="-mt-8 mb-3 flex items-end justify-between gap-3">
                    <div className="relative h-16 w-16 overflow-hidden rounded-[18px] border-4 border-white bg-slate-100 shadow-md">
                      {tienda.logo_url ? (
                        <Image src={tienda.logo_url} alt={nombreComercio} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-slate-100 text-2xl">🏪</div>
                      )}
                    </div>

                    <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                      {tienda.categoria_principal}
                    </span>
                  </div>

                  <h3 className="line-clamp-1 text-lg font-black text-slate-900 transition-colors group-hover:text-sky-700">
                    {nombreComercio}
                  </h3>

                  {tienda.descripcion && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
                      {tienda.descripcion}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-slate-600">
                    <Link href={`/tienda/${tienda.slug}`} className="flex items-center gap-1 text-sky-700 hover:text-sky-900">Ver catálogo →</Link>
                    {tienda.whatsapp && <span className="text-emerald-600">💬 WhatsApp</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}