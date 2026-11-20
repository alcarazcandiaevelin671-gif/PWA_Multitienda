import Link from 'next/link';

export const metadata = { title: 'Sin conexión · Portal Guairá' };

// Página estática: el service worker la guarda al instalarse y la muestra cuando
// se abre una página que nunca se visitó con conexión.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-100 text-4xl">📡</div>
      <h1 className="mt-6 text-2xl font-black text-slate-900">Estás sin conexión</h1>
      <p className="mt-3 text-slate-600">
        Esta página todavía no está guardada en tu dispositivo. Las páginas que ya visitaste
        (tiendas, productos, tus pedidos y tickets) siguen disponibles sin internet.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Si confirmás un pedido sin conexión, queda guardado y se envía solo al reconectar.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700">
          Ir al inicio
        </Link>
        <Link href="/pedidos" className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-primary-300">
          Mis pedidos
        </Link>
      </div>
    </main>
  );
}
