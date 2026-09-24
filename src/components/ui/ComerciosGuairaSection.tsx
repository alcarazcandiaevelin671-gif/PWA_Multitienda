'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import Link from 'next/link';

interface Tienda {
  id: string;
  nombre_comercio: string;
  slug: string;
  descripcion: string;
  categoria_principal: string;
  logo_url: string | null;
  portada_url: string | null;
  whatsapp: string | null;
  distritos?: {
    nombre: string;
  } | null;
}

export default function ComerciosGuairaSection() {
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchTiendas() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('tiendas')
          .select(`
            id,
            nombre_comercio,
            slug,
            descripcion,
            categoria_principal,
            logo_url,
            portada_url,
            whatsapp,
            distritos (
              nombre
            )
          `)
          .order('creado_en', { ascending: false });

        if (error) {
          console.error('Error al cargar comercios:', error);
        } else if (data) {
          setTiendas(data as any);
        }
      } catch (err) {
        console.error('Error inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTiendas();
  }, [supabase]);

  if (loading) {
    return (
      <section className="py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">🏪 Comercios del Guairá</h2>
              <p className="text-xs text-slate-500 mt-1">Cargando tiendas de la región...</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-200 animate-pulse rounded-3xl border border-slate-300" />
            ))}
          </div>
        </div>
      </section>
    );
  }

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
    <section className="py-12 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">🏪 Comercios del Guairá</h2>
            <p className="text-xs text-slate-500 mt-1">
              Explora las tiendas y emprendimientos locales en nuestro departamento.
            </p>
          </div>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200">
            {tiendas.length} {tiendas.length === 1 ? 'comercio' : 'comercios'}
          </span>
        </div>

        {/* Grilla estilo Tarjeta de Perfil / Social */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiendas.map((tienda) => {
            const distritoNombre = (tienda.distritos as any)?.nombre || 'Guairá';

            return (
              <Link
                key={tienda.id}
                href={`/tienda/${tienda.slug}`}
                className="group bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col transform hover:-translate-y-1"
              >
                {/* Banner/Portada del Comercio */}
                <div className="relative h-28 w-full bg-slate-800 overflow-hidden">
                  {tienda.portada_url ? (
                    <Image
                      src={tienda.portada_url}
                      alt={tienda.nombre_comercio}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-slate-800 via-blue-900 to-slate-900 flex items-center justify-center">
                      <span className="text-white/20 text-xs font-bold uppercase tracking-widest">Guairá Comercial</span>
                    </div>
                  )}
                  <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20">
                    📍 {distritoNombre}
                  </span>
                </div>

                {/* Perfil con Foto de Logo superpuesta */}
                <div className="px-5 pb-5 pt-0 relative flex-1 flex flex-col justify-between">
                  <div>
                    {/* Logo circular estilo Instagram */}
                    <div className="-mt-10 mb-3 flex items-end justify-between">
                      <div className="relative w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-md overflow-hidden flex-shrink-0">
                        {tienda.logo_url ? (
                          <Image
                            src={tienda.logo_url}
                            alt={tienda.nombre_comercio}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl">
                            🏪
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                        {tienda.categoria_principal}
                      </span>
                    </div>

                    {/* Nombre e Información */}
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {tienda.nombre_comercio}
                    </h3>
                    
                    {tienda.descripcion && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {tienda.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Pie de tarjeta con llamado a la acción */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-blue-600">
                      Ver catálogo de productos →
                    </span>
                    {tienda.whatsapp && (
                      <span className="text-emerald-600 flex items-center gap-1 text-[11px]">
                        💬 WhatsApp
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}