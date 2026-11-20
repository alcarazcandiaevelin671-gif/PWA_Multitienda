import { requireMerchantPageAccess } from '@/lib/merchant-server';

export default async function MerchantAliasLayout({ children }: { children: React.ReactNode }) {
  await requireMerchantPageAccess();
  return children;
}