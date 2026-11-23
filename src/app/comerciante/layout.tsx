/**
 * [PÁGINA] Layout de /comerciante (alias de /vendedor): verifica en el servidor que el usuario sea comerciante.
 */
import { requireMerchantPageAccess } from '@/backend/auth/require-merchant';

export default async function MerchantAliasLayout({ children }: { children: React.ReactNode }) {
  await requireMerchantPageAccess();
  return children;
}