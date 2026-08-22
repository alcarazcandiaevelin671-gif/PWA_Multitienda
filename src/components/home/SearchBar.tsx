'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchAll } from '@/services/search.service';
import type { Product } from '@/services/products.service';
import type { Shop } from '@/services/search.service';

interface SearchBarProps {
	className?: string;
	placeholder?: string;
}

interface SearchResults {
	products: Product[];
	shops: Shop[];
}

const EMPTY_RESULTS: SearchResults = { products: [], shops: [] };
const DEBOUNCE_MS = 350;

function formatPrice(price: number): string {
	return `${new Intl.NumberFormat('es-PY').format(price)} Gs.`;
}

export default function SearchBar({
	className = '',
	placeholder = 'Busca comercios, productos o categorias...',
}: SearchBarProps) {
	const router = useRouter();
	const containerRef = useRef<HTMLDivElement>(null);
	const requestIdRef = useRef(0);
	const [term, setTerm] = useState('');
	const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
	const [isSearching, setIsSearching] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const handleOutsideClick = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, []);

	useEffect(() => {
		const normalizedTerm = term.trim();
		const requestId = ++requestIdRef.current;

		if (!normalizedTerm) {
			setResults(EMPTY_RESULTS);
			setIsSearching(false);
			setIsOpen(false);
			return;
		}

		setIsSearching(true);
		setIsOpen(true);

		const timeoutId = window.setTimeout(async () => {
			const nextResults = await searchAll(normalizedTerm);

			if (requestId === requestIdRef.current) {
				setResults(nextResults);
				setIsSearching(false);
			}
		}, DEBOUNCE_MS);

		return () => window.clearTimeout(timeoutId);
	}, [term]);

	const hasResults = results.shops.length > 0 || results.products.length > 0;

	const navigateTo = (path: string) => {
		setIsOpen(false);
		router.push(path);
	};

	return (
		<div ref={containerRef} className={`relative w-full max-w-2xl ${className}`}>
			<div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 shadow-2xl shadow-black/20 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
				<svg
					aria-hidden="true"
					className="h-5 w-5 shrink-0 text-slate-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth="1.8"
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.4a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z" />
				</svg>
				<input
					type="search"
					value={term}
					onChange={(event) => setTerm(event.target.value)}
					onFocus={() => term.trim() && setIsOpen(true)}
					placeholder={placeholder}
					aria-label="Buscar comercios, productos o categorias"
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
				/>
				{isSearching && (
					<span className="shrink-0 text-xs font-medium text-blue-400">Buscando...</span>
				)}
			</div>

			{isOpen && !isSearching && term.trim() && (
				<div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(70vh,32rem)] overflow-y-auto rounded-2xl border border-slate-800 bg-[#111827] p-2 shadow-2xl shadow-black/40">
					{hasResults ? (
						<>
							{results.shops.length > 0 && (
								<section>
									<h2 className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">
										Comercios
									</h2>
									<div className="space-y-1">
										{results.shops.map((shop) => (
											<button
												key={shop.id}
												type="button"
												onClick={() => navigateTo(`/comercios/${shop.id}`)}
												className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
											>
												<span className="block truncate text-sm font-semibold text-white">{shop.nombre_comercio}</span>
												<span className="mt-1 block truncate text-xs font-medium text-blue-300">{shop.categoria_principal}</span>
												<span className="mt-1 block line-clamp-2 text-xs text-slate-400">{shop.descripcion}</span>
											</button>
										))}
									</div>
								</section>
							)}

							{results.products.length > 0 && (
								<section className="mt-2 border-t border-slate-800 pt-2">
									<h2 className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">
										Productos
									</h2>
									<div className="space-y-1">
										{results.products.map((product) => (
											<button
												key={product.id}
												type="button"
												onClick={() => navigateTo(`/productos/${product.id}`)}
												className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
											>
												<span className="block truncate text-sm font-semibold text-white">{product.titulo}</span>
												<span className="mt-1 block line-clamp-2 text-xs text-slate-400">{product.descripcion}</span>
												<span className="mt-2 block text-xs font-bold text-emerald-400">{formatPrice(product.precio_gs)}</span>
											</button>
										))}
									</div>
								</section>
							)}
						</>
					) : (
						<p className="px-4 py-6 text-center text-sm text-slate-400">
							No encontramos resultados para &quot;{term.trim()}&quot;.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
