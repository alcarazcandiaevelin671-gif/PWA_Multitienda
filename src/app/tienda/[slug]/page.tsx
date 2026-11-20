import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StorefrontCart from '@/components/cart/StorefrontCart';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TiendaPerfilPage(props: Props) {
  const params = await props.params;
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

  // Una sola ronda a Supabase: la tienda con sus productos disponibles (consulta anidada)
  // y las categorías en paralelo. Antes eran 3 consultas en serie (~0.3 s cada una).
  const [tiendaResult, categoriasResult] = await Promise.all([
    supabase
      .from('tiendas')
      .select('*, productos(*)')
      .eq('slug', slug)
      .eq('productos.disponible', true)
      .order('creado_en', { referencedTable: 'productos', ascending: false })
      .maybeSingle(),
    supabase.from('categorias').select('id, nombre'),
  ]);

  const tienda = tiendaResult.data;
  if (tiendaResult.error || !tienda) {
    notFound();
  }

  const productos = tienda.productos;
  const categorias = categoriasResult.data;

  const cleanWhatsapp = tienda.whatsapp ? tienda.whatsapp.replace(/\D/g, '') : '';
  // Solo las tiendas activas aceptan pedidos (la base de datos también lo exige en el checkout).
  const aceptaPedidos = String(tienda.estado ?? '').toLowerCase() === 'activa';
  const motivoInactiva: Record<string, string> = {
    pendiente: 'Este comercio está pendiente de aprobación.',
    suspendida: 'Este comercio está suspendido temporalmente.',
    rechazada: 'Este comercio no fue aprobado en el portal.',
  };
  const listaProductos = productos || [];
  const listaCategorias = categorias || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Cabecera / Banner */}
      <div className="zone-hero text-white py-12 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-xs font-semibold text-primary-400 hover:underline mb-4 inline-block"
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
              <span className="inline-block px-3 py-1 bg-primary-500/20 text-primary-400 text-[10px] font-black rounded-full uppercase tracking-wider mb-2">
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

        {!aceptaPedidos ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-amber-200 p-8">
            <span className="text-4xl mb-2 block">⏸️</span>
            <p className="text-slate-700 font-bold text-base">
              {motivoInactiva[String(tienda.estado ?? '').toLowerCase()] ?? 'Este comercio no está disponible.'}
            </p>
            <p className="text-slate-500 text-sm mt-1">Por ahora no acepta pedidos. Vuelve a consultar más tarde.</p>
            <Link href="/tiendas" className="mt-5 inline-flex rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700">
              Ver otras tiendas
            </Link>
          </div>
        ) : listaProductos.length === 0 ? (
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