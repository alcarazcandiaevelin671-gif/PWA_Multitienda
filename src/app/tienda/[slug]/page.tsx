import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TiendaPerfilPage({ params }: Props) {
  const { slug } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  // 1. Obtener la tienda según el slug
  const { data: tienda, error: tiendaErr } = await supabase
    .from('tiendas')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (tiendaErr || !tienda) {
    notFound();
  }

  // 2. Obtener productos disponibles
  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .eq('tienda_id', tienda.id)
    .eq('disponible', true)
    .order('creado_en', { ascending: false });

  const cleanWhatsapp = tienda.whatsapp ? tienda.whatsapp.replace(/\D/g, '') : '';
  const listaProductos = productos || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Cabecera / Banner */}
      <div className="bg-[#0b0f19] text-white py-12 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-xs font-semibold text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Volver a Comercios
          </Link>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 flex items-center justify-center flex-shrink-0">
              {tienda.logo_url ? (
                <Image
                  src={tienda.logo_url}
                  alt={tienda.nombre_comercio}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="text-4xl">🏪</span>
              )}
            </div>

            <div className="text-center md:text-left flex-1">
              <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded-full uppercase tracking-wider mb-2">
                {tienda.categoria_principal || 'Comercio'}
              </span>
              <h1 className="text-3xl font-black tracking-tight">{tienda.nombre_comercio}</h1>
              {tienda.descripcion && (
                <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
                  {tienda.descripcion}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-3 justify-center md:justify-start">
                {cleanWhatsapp && (
                  <a
                    href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                      `Hola ${tienda.nombre_comercio}, quiero consultar sobre sus productos.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    💬 Contactar por WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Catálogo de Productos */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          📦 Productos Disponibles ({listaProductos.length})
        </h2>

        {listaProductos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
            <span className="text-4xl mb-2 block">🛍️</span>
            <p className="text-slate-700 font-bold text-base">
              Esta tienda aún no ha publicado productos.
            </p>
            <p className="text-slate-400 text-xs mt-1">Vuelve a consultar más tarde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {listaProductos.map((prod) => {
              const nombreProducto = prod.titulo || prod.nombre || 'Producto';
              const mensajeWsp = encodeURIComponent(
                `Hola ${tienda.nombre_comercio}, estoy interesado/a en comprar: *${nombreProducto}*`
              );

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="relative w-full h-48 bg-slate-100 flex items-center justify-center">
                      {prod.imagen_url ? (
                        <Image
                          src={prod.imagen_url}
                          alt={nombreProducto}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-4xl text-slate-300">📦</span>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-bold text-slate-900 text-base line-clamp-1">
                        {nombreProducto}
                      </h3>
                      {prod.descripcion && (
                        <p className="text-slate-500 text-xs mt-1 line-clamp-2">
                          {prod.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Precio</span>
                      <span className="font-extrabold text-blue-600 text-base">
                        {Number(prod.precio_gs || 0).toLocaleString('es-PY')} Gs.
                      </span>
                    </div>

                    {cleanWhatsapp && (
                      <a
                        href={`https://wa.me/${cleanWhatsapp}?text=${mensajeWsp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                      >
                        Pedir 💬
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}