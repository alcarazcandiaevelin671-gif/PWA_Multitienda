import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#0b0f19] text-slate-400 border-t border-slate-800 text-sm">
      <div className="bg-blue-600 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-white text-base">Entérate de las novedades comerciales</p>
            <p className="text-blue-100 text-xs">Recibe las últimas promociones y comercios del Guairá.</p>
          </div>
          <div className="flex w-full md:w-auto max-w-md gap-2">
            <input type="email" placeholder="Ingresa tu correo" className="px-4 py-2 rounded-lg text-slate-900 text-sm w-full outline-none" />
            <button className="bg-[#0b0f19] hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors whitespace-nowrap">
              Suscribirme
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-xs text-slate-500">
        © 2026 Portal Comercial Guairá. Proyecto de Tesis - UNVES.
      </div>
    </footer>
  );
}