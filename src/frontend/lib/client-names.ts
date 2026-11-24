'use client';

/**
 * [FRONTEND] Nombres de los clientes que compraron en las tiendas del comerciante.
 * Se usa en pedidos, ventas y facturas para mostrar el nombre en lugar del identificador.
 */
import { useEffect, useState } from 'react';

/** Devuelve una función que da el nombre de un cliente. Si todavía no cargó (o no hay conexión), usa un texto corto. */
export function useClientNames(): (id?: string | null) => string {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    fetch('/api/vendedor/clientes', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { nombres?: Record<string, string> } | null) => { if (active && body?.nombres) setNames(body.nombres); })
      .catch(() => { /* Sin conexión: queda el texto corto. */ });
    return () => { active = false; };
  }, []);

  return (id) => (id ? names[id] ?? `Cliente ${id.slice(0, 6)}` : 'Cliente');
}
