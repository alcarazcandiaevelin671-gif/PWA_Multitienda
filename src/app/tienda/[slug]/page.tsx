import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StorefrontCart from '@/components/cart/StorefrontCart';

interface Props {
  params: { slug: string };
}

export default async function TiendaPerfilPage({ params }: Props) {
  const { slug } = params;
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

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nombre');

  const cleanWhatsapp = tienda.whatsapp ? tienda.whatsapp.replace(/\D/g, '') : '';
  const listaProductos = productos || [];
  const listaCategorias = categorias || [];

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
          <StorefrontCart
            products={listaProductos}
            categories={listaCategorias.map((categoria) => ({
              id: categoria.id,
              nombre: categoria.nombre,
            }))}
            shop={{
              id: tienda.id,
              nombre: tienda.nombre_comercio,
              whatsapp: tienda.whatsapp,
              telefono: tienda.telefono,
            }}
          />
        )}
      </main>
    </div>
  );
}