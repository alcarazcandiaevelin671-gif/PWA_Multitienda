import { requireMerchantPageAccess } from '@/lib/merchant-server';

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  await requireMerchantPageAccess();
  return children;
}