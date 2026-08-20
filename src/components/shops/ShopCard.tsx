import Link from 'next/link';

interface ShopCardProps {
  id: string | number;
  title: string;
  description?: string;
  badge?: string;
}

export default function ShopCard({ id, title, description, badge }: ShopCardProps) {
  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 relative flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
      {badge && (
        <span className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm z-10">
          {badge}
        </span>
      )}
      <div className="w-full h-40 bg-slate-200/60 rounded-xl flex items-center justify-center my-2 overflow-hidden group-hover:scale-[1.02] transition-transform">
        <span className="text-slate-400 font-extrabold text-3xl select-none">
          {title.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="mt-2">
        <h3 className="font-bold text-slate-900 text-base mb-1 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-2 mb-4">
          {description || 'Comercio verificado en la región del Guairá.'}
        </p>
      </div>
      <Link
        href={`/comercios/${id}`}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl text-center transition-colors shadow-md shadow-blue-500/20"
      >
        Ver Local →
      </Link>
    </div>
  );
}