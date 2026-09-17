import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Panel de Administración</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestiona los productos y la información comercial de tu local en Guairá.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/productos"
          className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
        >
          <div>
            <span className="text-3xl mb-3 block">📦</span>
            <h2 className="text-xl font-bold text-slate-900">Gestión de Productos</h2>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              Agrega, edita, pausa o elimina los artículos disponibles en tu catálogo.
            </p>
          </div>
          <span className="text-xs font-bold text-blue-600 mt-6 inline-block">
            Administrar Inventario →
          </span>
        </Link>

        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm opacity-60">
          <span className="text-3xl mb-3 block">🏪</span>
          <h2 className="text-xl font-bold text-slate-900">Perfil de la Tienda</h2>
          <p className="text-slate-500 text-xs mt-2 leading-relaxed">
            Actualiza la dirección, número de WhatsApp y horario de atención de tu local.
          </p>
          <span className="text-xs font-bold text-slate-400 mt-6 inline-block">
            Próximamente
          </span>
        </div>
      </div>
    </div>
  );
}