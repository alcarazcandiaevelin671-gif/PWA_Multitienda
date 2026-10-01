'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  { href: '/admin', label: 'Resumen', icon: '◫' },
  { href: '/admin/usuarios', label: 'Usuarios', icon: '◎' },
  { href: '/admin/comercios', label: 'Comercios', icon: '⌂' },
  { href: '/admin/categorias', label: 'Categorías', icon: '◇' },
  { href: '/admin/departamentos', label: 'Departamentos', icon: '⌖' },
  { href: '/admin/distritos', label: 'Distritos', icon: '⌖' },
  { href: '/admin/auditorias', label: 'Auditoría', icon: '◷' },
  { href: '/admin/notificaciones', label: 'Notificaciones', icon: '♧' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <section className="admin-theme min-h-[calc(100vh-8rem)] bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4 lg:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Portal Guairá</p>
            <p className="mt-1 text-lg font-bold text-slate-900">Administración</p>
          </div>
          <Link href="/" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50">Ver portal</Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-5 border-b border-slate-100 pb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-700">Portal Guairá</p>
                <h1 className="mt-2 text-xl font-extrabold text-slate-900">Administración</h1>
                <p className="mt-1 text-xs text-slate-500">Gestión comercial</p>
              </div>
              <nav aria-label="Navegación administrativa" className="space-y-1">
                {sections.map((item) => {
                  const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'}`}>
                      <span aria-hidden="true" className={`w-5 text-center ${active ? 'text-blue-700' : 'text-slate-400'}`}>{item.icon}</span>{item.label}
                    </Link>
                  );
                })}
              </nav>
              <Link href="/" className="mt-5 block border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500 hover:text-blue-700">← Volver al portal</Link>
            </div>
          </aside>

          <div className="min-w-0">
            <nav aria-label="Secciones administrativas" className="mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {sections.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
                return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${active ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}>{item.label}</Link>;
              })}
            </nav>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}