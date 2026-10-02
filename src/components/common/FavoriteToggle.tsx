'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { showAppMessage } from '@/lib/app-message';
import { supabase } from '@/lib/supabase';

type FavoriteKind = 'tienda' | 'producto';

export default function FavoriteToggle({
  kind,
  targetId,
  className = '',
  onChange,
}: {
  kind: FavoriteKind;
  targetId: string;
  className?: string;
  onChange?: (isFavorite: boolean) => void;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadFavorite = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(user?.id ?? null);
      if (!user) {
        setLoading(false);
        return;
      }

      const column = kind === 'tienda' ? 'tienda_id' : 'producto_id';
      const { data } = await supabase
        .from('favoritos')
        .select('id')
        .eq('usuario_id', user.id)
        .eq(column, targetId)
        .limit(1)
        .maybeSingle();
      if (active) {
        setFavoriteId(data?.id ?? null);
        setLoading(false);
      }
    };

    void loadFavorite();
    return () => { active = false; };
  }, [kind, targetId]);

  const toggleFavorite = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!userId) {
      router.push('/auth/login');
      return;
    }
    if (loading || saving) return;

    setSaving(true);
    try {
      let nextFavoriteId: string | null = null;
      if (favoriteId) {
        const { error } = await supabase.from('favoritos').delete().eq('id', favoriteId).eq('usuario_id', userId);
        if (error) {
          showAppMessage('No se pudo actualizar el favorito. Verifica que la política SQL de favoritos esté aplicada.', 'Favoritos', 'error');
          return;
        }
      } else {
        const { data, error } = await supabase.from('favoritos').insert({
          usuario_id: userId,
          tienda_id: kind === 'tienda' ? targetId : null,
          producto_id: kind === 'producto' ? targetId : null,
        }).select('id').single();
        if (error || !data?.id) {
          showAppMessage('No se pudo actualizar el favorito. Verifica que la política SQL de favoritos esté aplicada.', 'Favoritos', 'error');
          return;
        }
        nextFavoriteId = data.id;
      }

      setFavoriteId(nextFavoriteId);
      onChange?.(Boolean(nextFavoriteId));
    } catch {
      showAppMessage('No se pudo actualizar el favorito. Inténtalo de nuevo.', 'Favoritos', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isFavorite = Boolean(favoriteId);
  const label = isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isFavorite}
      title={label}
      disabled={loading || saving}
      onClick={(event) => void toggleFavorite(event)}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-2xl leading-none shadow-md transition hover:scale-105 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-wait disabled:opacity-60 ${isFavorite ? 'text-amber-500' : 'text-slate-500'} ${className}`}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
}