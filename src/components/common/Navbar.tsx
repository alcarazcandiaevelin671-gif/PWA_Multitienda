import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="bg-[#0b0f19] text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
          <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-blue-500/30">
            G
          </span>
          Portal Guairá
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <Link href="/" className="text-white font-semibold hover:text-blue-400 transition-colors">Inicio</Link>
          <Link href="/comercios" className="hover:text-blue-400 transition-colors">Comercios</Link>
          <Link href="/categorias" className="hover:text-blue-400 transition-colors">Categorías</Link>
          <Link href="/contacto" className="hover:text-blue-400 transition-colors">Contacto</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            Ingresar
          </Link>
        </div>
      </div>
    </header>
  );
}