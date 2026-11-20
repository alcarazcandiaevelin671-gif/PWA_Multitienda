'use client';

import { useEffect, useState } from 'react';
import AppearancePanel from '@/components/apariencia/AppearancePanel';

export const OPEN_APPEARANCE_EVENT = 'pg-abrir-personalizar';

/** Abre el panel lateral de personalización desde cualquier lugar (p. ej. el botón de la barra). */
export function openAppearancePanel() {
  window.dispatchEvent(new Event(OPEN_APPEARANCE_EVENT));
}

export default function AppearanceDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_APPEARANCE_EVENT, show);
    return () => window.removeEventListener(OPEN_APPEARANCE_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-[95] flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Personalizar apariencia"
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-md bg-slate-50 shadow-2xl"
      >
        <AppearancePanel onClose={() => setOpen(false)} />
      </aside>
    </div>
  );
}
