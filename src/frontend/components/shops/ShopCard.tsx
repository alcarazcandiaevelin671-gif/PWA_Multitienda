'use client';

/**
 * [FRONTEND] Tarjeta de un comercio (portada, logo, distrito, favorito y enlace a su vitrina).
 */
import Link from 'next/link';
import Image from 'next/image';
import FavoriteToggle from '@/frontend/components/common/FavoriteToggle';

interface ShopCardProps {
  id: string;
  slug?: string;
  nombreComercio?: string;
  title?: string;
  descripcion?: string;
  description?: string;
  categoriaPrincipal?: string;
  logoUrl?: string;
  bannerUrl?: string;
  verificada?: boolean;
  whatsapp?: string;
  distrito?: string;
  distanceLabel?: string;
  badge?: string;
}

export default function ShopCard({
  id,
  slug,
  nombreComercio,
  title,
  descripcion,
  description,
  categoriaPrincipal,
  logoUrl,
  bannerUrl,
  verificada,
  distanceLabel,
  badge: _badge,
}: ShopCardProps) {
  const nombre = nombreComercio || title || '';
  const detalle = descripcion || description;
  const imageUrl = logoUrl || bannerUrl || '';

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 sm:rounded-[26px] sm:p-3 shadow-[0_18px_35px_rgba(13,10,16,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(219,39,119,0.12)]">
      {verificada && (
        <span className="absolute left-3 top-3 z-10 rounded-full border border-primary-200 bg-primary-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider sm:left-5 sm:top-5 sm:px-2.5 sm:py-1 sm:tracking-[0.18em] text-white shadow-sm">
          Verificado
        </span>
      )}

      <div className="relative h-28 overflow-hidden rounded-xl sm:h-44 sm:rounded-2xl border border-slate-200 bg-slate-200 shadow-md">
        {imageUrl ? (
          <Image src={imageUrl} alt={nombre} fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-accent-100 text-4xl font-black text-slate-500">
            {nombre ? nombre.charAt(0).toUpperCase() : 'G'}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent" />
        <FavoriteToggle kind="tienda" targetId={id} className="absolute right-3 top-3 z-20" />
      </div>

      <div className="mt-2 flex-1 sm:mt-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1 sm:mb-2 sm:gap-3">
          <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-wider text-accent-600 sm:tracking-[0.22em]">
            {categoriaPrincipal || 'Comercio'}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
            Local
          </span>
        </div>

        <h3 className="line-clamp-1 text-sm font-black sm:text-base text-slate-900 transition-colors group-hover:text-accent-700">
          {nombre}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-slate-500 sm:mt-2 sm:line-clamp-2">
          {detalle || 'Comercio registrado en el Departamento del Guairá.'}
        </p>
        {distanceLabel && <p className="mt-2 text-xs font-bold text-accent-700">📍 {distanceLabel}</p>}
      </div>

      <Link
        href={`/tienda/${slug || id}`}
        className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2.5 sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 text-center text-xs font-black text-white transition-all duration-200 hover:bg-accent-700"
      >
        Ver local →
      </Link>
    </div>
  );
}