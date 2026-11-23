'use client';

/**
 * [FRONTEND] Aplica el modo claro/oscuro y la apariencia guardados del usuario al iniciar sesión (y los restablece al cerrarla).
 */
import { useEffect } from 'react';
import { supabase } from '@/shared/supabase/client';
import {
  applyThemePreference,
  getUserSettings,
  readLocalSettings,
  writeLocalSettings,
  type UserPreferences,
} from '@/frontend/services/settings.service';
import { DEFAULT_APPEARANCE, applyAppearance, readAppearanceOwner } from '@/shared/lib/appearance';

export default function ThemePreferenceSync() {
  useEffect(() => {
    let active = true;
    let stopThemeListener = applyThemePreference('system');

    const syncTheme = async (userId: string | null) => {
      stopThemeListener();
      if (!userId) {
        stopThemeListener = applyThemePreference('system');
        // Al cerrar sesión, la apariencia de esa cuenta no queda para el próximo usuario.
        if (readAppearanceOwner()) applyAppearance(DEFAULT_APPEARANCE, { owner: null });
        return;
      }

      const key = `portal-settings:${userId}:preferencias`;
      const cached = readLocalSettings<UserPreferences | null>(key, null);
      stopThemeListener = applyThemePreference(cached?.theme ?? 'system');
      try {
        // Justo después del login, la cookie de sesión del servidor se sincroniza en paralelo:
        // si la API responde 401, se reintenta brevemente en lugar de perder las preferencias.
        let settings: Awaited<ReturnType<typeof getUserSettings>> = null;
        for (let attempt = 0; ; attempt += 1) {
          try {
            settings = await getUserSettings();
            break;
          } catch (error) {
            if (attempt >= 3 || !active) throw error;
            await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
          }
        }
        if (!active) return;
        if (settings) {
          writeLocalSettings(key, settings.preferencias);
          stopThemeListener();
          stopThemeListener = applyThemePreference(settings.preferencias.theme);
        }
        if (settings?.apariencia) {
          applyAppearance(settings.apariencia, { owner: userId });
        } else {
          const owner = readAppearanceOwner();
          // Sin personalización guardada: conservar la elegida como visitante en este dispositivo,
          // pero no heredar la de otra cuenta.
          if (owner && owner !== userId) applyAppearance(DEFAULT_APPEARANCE, { owner: userId });
        }
      } catch {
        // Keep the per-user cache or system theme when remote settings are unavailable.
      }
    };

    // INITIAL_SESSION llega al suscribirse: sin getUser() aparte, y solo se consulta
    // /api/configuracion cuando cambia el usuario (no en cada TOKEN_REFRESHED).
    let lastUserId: string | null | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId === lastUserId) return;
      lastUserId = nextUserId;
      void syncTheme(nextUserId);
    });

    return () => {
      active = false;
      stopThemeListener();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      if (document.documentElement.dataset.themePreference === 'system') applyThemePreference('system');
    };
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  return null;
}