/**
 * [FRONTEND] Etiqueta de precio estilo tienda de moda: si el producto está en oferta muestra el
 * precio anterior tachado ARRIBA, el precio de oferta resaltado y una insignia "-X%".
 *
 * No usa estado ni efectos: sirve tanto en componentes del servidor como del navegador.
 *
 * Uso: <PriceTag price={p.precio_gs} offer={p.precio_oferta} size="md" />
 */
import { getPricing } from '@/shared/lib/product-pricing';

interface PriceTagProps {
  /** Precio normal en guaraníes. */
  price: unknown;
  /** Precio de oferta opcional (se ignora si no es menor al normal). */
  offer?: unknown;
  /** Tamaño del precio principal. */
  size?: 'sm' | 'md' | 'lg';
  /** Color del precio cuando NO hay oferta (clase de Tailwind). */
  className?: string;
  /** Oculta la insignia de porcentaje (útil en espacios chicos). */
  hideBadge?: boolean;
}

const SIZES = {
  sm: { main: 'text-xs', old: 'text-[10px]', badge: 'text-[9px] px-1.5' },
  md: { main: 'text-base', old: 'text-xs', badge: 'text-[10px] px-1.5' },
  lg: { main: 'text-2xl', old: 'text-sm', badge: 'text-xs px-2' },
} as const;

const formatGs = (value: number) => `${value.toLocaleString('es-PY')} Gs.`;

export default function PriceTag({ price, offer, size = 'md', className = 'text-primary-600', hideBadge = false }: PriceTagProps) {
  const pricing = getPricing(price, offer);
  const styles = SIZES[size];

  if (pricing.originalPrice === null) {
    return <span className={`${styles.main} font-extrabold ${className}`}>{formatGs(pricing.price)}</span>;
  }

  return (
    <span className="inline-flex flex-col leading-tight" aria-label={`Oferta: ${formatGs(pricing.price)}, antes ${formatGs(pricing.originalPrice)}`}>
      <span className={`${styles.old} font-semibold text-slate-400 line-through decoration-1`}>
        {formatGs(pricing.originalPrice)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`${styles.main} font-extrabold text-rose-600`}>{formatGs(pricing.price)}</span>
        {!hideBadge && (
          <span className={`${styles.badge} rounded bg-rose-600 py-0.5 font-black text-white`}>-{pricing.discountPercent}%</span>
        )}
      </span>
    </span>
  );
}
