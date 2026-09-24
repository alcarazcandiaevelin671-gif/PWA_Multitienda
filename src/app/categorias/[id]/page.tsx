import Link from 'next/link';
import ShopCard from '@/components/shops/ShopCard';
import { getCategories } from '@/services/categories.service';
import { getFeaturedShops } from '@/services/shops.service';

const categoryIcons: Record<string, string> = {
	Agricultura: '🌾',
	Alimentos: '🧺',
	"Ao Po'i": '👕',
	Artesanías: '🎨',
	'Comercio General': '🏪',
	Gastronomía: '🍽️',
	Otros: '📁',
	Servicios: '💼',
};

export default async function CategoriaDetallePage({ params }: { params: { id: string } }) {
	const [categories, shops] = await Promise.all([getCategories(), getFeaturedShops()]);
	const category = categories.find((item: any) => String(item.id) === params.id);

	if (!category) {
		return (
			<main className="min-h-screen bg-slate-50 px-4 py-16 text-center">
				<h1 className="text-2xl font-black text-slate-900">Categoría no encontrada</h1>
				<Link href="/categorias" className="mt-4 inline-block font-semibold text-blue-600 hover:underline">
					Volver a categorías
				</Link>
			</main>
		);
	}

	const categoryShops = shops.filter(
		(shop: any) => shop.categoria_principal === category.nombre || shop.categoria === category.nombre,
	);

	return (
		<main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<Link href="/categorias" className="text-sm font-semibold text-blue-600 hover:underline">
					← Volver a categorías
				</Link>
				<div className="mt-6 mb-8 flex items-center gap-4">
					<span className="text-5xl" aria-hidden="true">{categoryIcons[category.nombre] || '📦'}</span>
					<div>
						<p className="text-xs font-bold uppercase tracking-wider text-blue-600">Categoría</p>
						<h1 className="mt-1 text-3xl font-black text-slate-900">{category.nombre}</h1>
					</div>
				</div>

				{categoryShops.length === 0 ? (
					<div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
						<p className="font-semibold text-slate-700">Aún no hay comercios en esta categoría.</p>
						<Link href="/tiendas" className="mt-4 inline-block font-semibold text-blue-600 hover:underline">
							Ver todas las tiendas
						</Link>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
						{categoryShops.map((shop: any) => (
							<ShopCard
								key={shop.id}
								id={shop.id}
								slug={shop.slug}
								nombreComercio={shop.nombre_comercio}
								descripcion={shop.descripcion}
								categoriaPrincipal={shop.categoria_principal}
								logoUrl={shop.logo_url}
								bannerUrl={shop.banner_url || shop.portada_url}
								verificada={shop.verificada}
								whatsapp={shop.whatsapp}
								distrito={shop.distritos?.nombre}
							/>
						))}
					</div>
				)}
			</div>
		</main>
	);
}