import Link from 'next/link';

const sections = [
  { href: '/admin', label: 'Resumen', icon: '◫' },
  { href: '/admin/usuarios', label: 'Usuarios', icon: '◎' },
  { href: '/admin/comercios', label: 'Comercios', icon: '⌂' },
  { href: '/admin/productos', label: 'Productos', icon: '▦' },
  { href: '/admin/pedidos', label: 'Pedidos', icon: '▤' },
  { href: '/admin/ventas', label: 'Ventas', icon: '↗' },
  { href: '/admin/facturas', label: 'Facturas', icon: '▧' },
  { href: '/admin/categorias', label: 'Categorías', icon: '◇' },
  { href: '/admin/departamentos', label: 'Departamentos', icon: '⌖' },
  { href: '/admin/distritos', label: 'Distritos', icon: '⌖' },
  { href: '/admin/auditorias', label: 'Auditoría', icon: '◷' },
  { href: '/admin/notificaciones', label: 'Notificaciones', icon: '♧' },
  { href: '/admin/reportes', label: 'Reportes', icon: '⌁' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[calc(100vh-8rem)] bg-[#091321] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 flex items-center justify-between border-b border-white/10 pb-4 lg:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">Portal Guairá</p>
            <p className="mt-1 text-lg font-bold">Administración</p>
          </div>
          <Link href="/" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5">Ver portal</Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="mb-7 border-b border-white/10 pb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300">Portal Guairá</p>
                <h1 className="mt-2 text-xl font-extrabold">Administración</h1>
                <p className="mt-1 text-xs text-slate-400">Gestión comercial</p>
              </div>
              <nav aria-label="Navegación administrativa" className="space-y-1">
                {sections.map((item) => (
                  <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
                    <span aria-hidden="true" className="w-5 text-center text-sky-300">{item.icon}</span>{item.label}
                  </Link>
                ))}
              </nav>
              <Link href="/" className="mt-7 block border-t border-white/10 pt-4 text-xs font-semibold text-slate-400 hover:text-white">← Volver al portal</Link>
            </div>
          </aside>

          <div className="min-w-0">
            <nav aria-label="Secciones administrativas" className="mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {sections.map((item) => (
                <Link key={item.href} href={item.href} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{item.label}</Link>
              ))}
            </nav>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}