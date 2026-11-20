'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Recarga en segundo plano de los comercios destacados. Cada 20 s competía con la interacción del usuario.
const REFRESH_INTERVAL_MS = 60_000;

export default function StorefrontAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const interval = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);

    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [router]);

  return null;
}