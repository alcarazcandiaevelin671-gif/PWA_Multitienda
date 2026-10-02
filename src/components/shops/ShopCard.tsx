'use client';

import Link from 'next/link';
import Image from 'next/image';
import FavoriteToggle from '@/components/common/FavoriteToggle';

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
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-[26px] border border-slate-200 bg-white p-3 shadow-[0_18px_35px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(14,116,144,0.12)]">
      {verificada && (
        <span className="absolute left-5 top-5 z-10 rounded-full border border-blue-200 bg-blue-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-sm">
          Verificado
        </span>
      )}

      <div className="relative h-44 overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-md">
        {imageUrl ? (
          <Image src={imageUrl} alt={nombre} fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-sky-100 text-4xl font-black text-slate-500">
            {nombre ? nombre.charAt(0).toUpperCase() : 'G'}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent" />
        <FavoriteToggle kind="tienda" targetId={id} className="absolute right-3 top-3 z-20" />
      </div>

      <div className="mt-4 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-600">
            {categoriaPrincipal || 'Comercio'}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
            Local
          </span>
        </div>

        <h3 className="line-clamp-1 text-base font-black text-slate-900 transition-colors group-hover:text-sky-700">
          {nombre}
        </h3>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
          {detalle || 'Comercio registrado en el Departamento del Guairá.'}
        </p>
        {distanceLabel && <p className="mt-2 text-xs font-bold text-sky-700">📍 {distanceLabel}</p>}
      </div>

      <Link
        href={`/tienda/${slug || id}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-center text-xs font-black text-white transition-all duration-200 hover:bg-sky-700"
      >
        Ver local →
      </Link>
    </div>
  );
}