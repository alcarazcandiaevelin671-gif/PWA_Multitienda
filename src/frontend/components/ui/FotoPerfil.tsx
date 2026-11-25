'use client';

/**
 * [FRONTEND · UI] Foto de perfil con respaldo: si la imagen no carga (por ejemplo, Google la rechaza
 * o no hay conexión) se muestra el contenido alternativo en lugar del ícono de imagen rota.
 */
import { useState, type ReactNode } from 'react';
import Image from 'next/image';

type Props = { src: unknown; alt: string; sizes?: string; fallback: ReactNode };

export default function FotoPerfil({ src, alt, sizes, fallback }: Props) {
  const url = typeof src === 'string' ? src.trim() : '';
  const [fallida, setFallida] = useState('');

  if (!url || fallida === url) return <>{fallback}</>;
  // Sin remitente: Google puede rechazar sus fotos según la página que las pide.
  return <Image src={url} alt={alt} fill sizes={sizes} unoptimized referrerPolicy="no-referrer" onError={() => setFallida(url)} className="object-cover" />;
}
