'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  applyThemePreference,
  getUserSettings,
  readLocalSettings,
  writeLocalSettings,
  type UserPreferences,
} from '@/services/settings.service';

export default function ThemePreferenceSync() {
  useEffect(() => {
    let active = true;
    let stopThemeListener = applyThemePreference('system');

    const syncTheme = async (userId: string | null) => {
      stopThemeListener();
      if (!userId) {
        stopThemeListener = applyThemePreference('system');
        return;
      }

      const key = `portal-settings:${userId}:preferencias`;
      const cached = readLocalSettings<UserPreferences | null>(key, null);
      stopThemeListener = applyThemePreference(cached?.theme ?? 'system');
      try {
        const settings = await getUserSettings();
        if (!active || !settings) return;
        writeLocalSettings(key, settings.preferencias);
        stopThemeListener();
        stopThemeListener = applyThemePreference(settings.preferencias.theme);
      } catch {
        // Keep the per-user cache or system theme when remote settings are unavailable.
      }
    };

    void supabase.auth.getUser().then(({ data }) => syncTheme(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncTheme(session?.user.id ?? null);
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