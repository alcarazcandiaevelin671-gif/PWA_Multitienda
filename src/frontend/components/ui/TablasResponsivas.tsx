'use client';

/**
 * [FRONTEND] Tablas legibles en el celular: copia el título de cada columna (th) a sus celdas como
 * data-label. En pantallas angostas, globals.css muestra cada fila como una tarjeta con "Título: valor"
 * en lugar de obligar a deslizar la tabla de costado. No cambia los datos ni el comportamiento.
 */
import { useEffect } from 'react';

function etiquetar(tabla: HTMLTableElement) {
  const fila = tabla.tHead?.rows[tabla.tHead.rows.length - 1];
  if (!fila) return;
  const titulos: string[] = [];
  for (const celda of Array.from(fila.cells)) {
    const texto = (celda.textContent ?? '').trim();
    for (let i = 0; i < (celda.colSpan || 1); i += 1) titulos.push(texto);
  }
  for (const cuerpo of Array.from(tabla.tBodies)) {
    for (const tr of Array.from(cuerpo.rows)) {
      let columna = 0;
      for (const celda of Array.from(tr.cells)) {
        const titulo = celda.colSpan > 1 ? '' : titulos[columna] ?? '';
        if (celda.getAttribute('data-label') !== titulo) celda.setAttribute('data-label', titulo);
        columna += celda.colSpan || 1;
      }
    }
  }
}

export default function TablasResponsivas() {
  useEffect(() => {
    let pendiente = 0;
    const revisar = () => {
      pendiente = 0;
      document.querySelectorAll<HTMLTableElement>('main table').forEach(etiquetar);
    };
    const programar = () => {
      if (!pendiente) pendiente = window.requestAnimationFrame(revisar);
    };
    revisar();
    // Las tablas se llenan después de cargar los datos: se vuelve a etiquetar cuando cambian.
    const observador = new MutationObserver(programar);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      observador.disconnect();
      if (pendiente) window.cancelAnimationFrame(pendiente);
    };
  }, []);

  return null;
}
