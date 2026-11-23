/**
 * [PÁGINA] Layout del panel /vendedor: verifica en el servidor que el usuario sea comerciante activo.
 */
import { requireMerchantPageAccess } from '@/backend/auth/require-merchant';

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  await requireMerchantPageAccess();
  return children;
}