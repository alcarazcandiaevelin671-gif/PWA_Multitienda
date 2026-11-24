/**
 * [FRONTEND] Preferencia "Recomendaciones personalizadas" (Configuración > Privacidad).
 *
 * Si el usuario la desactiva: no se usan sus favoritos, búsquedas ni compras para recomendar
 * (recibe sugerencias generales) y no se registran nuevas búsquedas ni interacciones.
 */
import { supabase } from '@/shared/supabase/client';

const CACHE_MS = 60_000;
let cached: { userId: string; enabled: boolean; at: number } | null = null;

/** ¿El usuario permite personalizar? Ante un error de lectura se responde "no" (opción más protectora). */
export async function personalizationEnabled(userId: string): Promise<boolean> {
  if (cached && cached.userId === userId && Date.now() - cached.at < CACHE_MS) return cached.enabled;
  const { data, error } = await supabase
    .from('usuario_configuracion')
    .select('privacidad')
    .eq('usuario_id', userId)
    .maybeSingle();
  if (error) return false;
  const privacy = data?.privacidad as { personalizedRecommendations?: unknown } | null | undefined;
  const enabled = privacy?.personalizedRecommendations !== false;
  cached = { userId, enabled, at: Date.now() };
  return enabled;
}

/** Se llama al guardar la privacidad para que el cambio se aplique al instante. */
export function resetPersonalizationCache() {
  cached = null;
}
