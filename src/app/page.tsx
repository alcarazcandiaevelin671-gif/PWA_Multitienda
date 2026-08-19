'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [cat, setCat] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorSupabase, setErrorSupabase] = useState<string | null>(null);

  useEffect(() => {
    async function cargarDatos() {
      let respuesta = await supabase.from('categorías').select('*');

      if (respuesta.error || !respuesta.data || respuesta.data.length === 0) {
        const alt = await supabase.from('categorias').select('*');
        if (alt.data && alt.data.length > 0) {
          respuesta = alt;
        }
      }

      if (respuesta.error) {
        console.error('Error detallado:', respuesta.error);
        setErrorSupabase(respuesta.error.message);
      } else {
        setCat(respuesta.data || []);
      }
      setCargando(false);
    }

    cargarDatos();
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Portal Comercial Guairá</h1>
      <h2>Categorías Registradas:</h2>

      {cargando ? (
        <p>Cargando datos desde Supabase...</p>
      ) : errorSupabase ? (
        <p style={{ color: 'red' }}>Error de Supabase: {errorSupabase}</p>
      ) : cat.length > 0 ? (
        <ul>
          {cat.map((item, index) => (
            <li key={item.identificador || item.id || index}>
              <strong>{item.nombre || item.name || JSON.stringify(item)}</strong>
              {(item.descripción || item.descripcion) && ` - ${item.descripción || item.descripcion}`}
            </li>
          ))}
        </ul>
      ) : (
        <p>No se encontraron registros en la tabla.</p>
      )}
    </main>
  );
}