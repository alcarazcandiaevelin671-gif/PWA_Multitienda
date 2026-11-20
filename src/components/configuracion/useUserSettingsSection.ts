'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyThemePreference,
  getUserSettings,
  readLocalSettings,
  updateUserSettings,
  writeLocalSettings,
  type SettingsSection,
  type UserSettings,
} from '@/services/settings.service';

export default function useUserSettingsSection<Section extends SettingsSection>(
  userId: string,
  section: Section,
  defaultValue: UserSettings[Section]
) {
  const storageKey = `portal-settings:${userId}:${section}`;
  const [value, setValue] = useState<UserSettings[Section]>(defaultValue);
  const [savedValue, setSavedValue] = useState<UserSettings[Section]>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    const cached = readLocalSettings<UserSettings[Section] | null>(storageKey, null);
    let stopThemeListener = () => {};
    if (section === 'preferencias') {
      const initialTheme = (cached as UserSettings['preferencias'] | null)?.theme ?? (defaultValue as UserSettings['preferencias']).theme;
      stopThemeListener = applyThemePreference(initialTheme);
    }
    if (cached) {
      setValue(cached);
      setSavedValue(cached);
    }

    getUserSettings()
      .then(async (settings) => {
        if (!current) return;
        if (settings) {
          const storedValue = settings[section] as UserSettings[Section];
          setValue(storedValue);
          setSavedValue(storedValue);
          writeLocalSettings(storageKey, storedValue);
          if (section === 'preferencias') stopThemeListener = applyThemePreference((storedValue as UserSettings['preferencias']).theme);
        } else if (cached) {
          const synced = await updateUserSettings(section, cached);
          if (!current) return;
          const storedValue = synced[section] as UserSettings[Section];
          setValue(storedValue);
          setSavedValue(storedValue);
          writeLocalSettings(storageKey, storedValue);
        } else {
          setValue(defaultValue);
          setSavedValue(defaultValue);
        }
      })
      .catch((cause: unknown) => {
        if (current) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración guardada.');
      })
      .finally(() => {
        if (current) setLoaded(true);
      });

    return () => {
      current = false;
      stopThemeListener();
    };
  }, [defaultValue, section, storageKey]);

  const save = useCallback(async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const settings = await updateUserSettings(section, value);
      const saved = settings[section] as UserSettings[Section];
      setValue(saved);
      setSavedValue(saved);
      writeLocalSettings(storageKey, saved);
      if (section === 'preferencias') applyThemePreference((saved as UserSettings['preferencias']).theme);
      setMessage('Cambios guardados en tu cuenta.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }, [section, storageKey, value]);

  const cancel = useCallback(() => {
    setValue(savedValue);
    setError('');
    setMessage('');
    if (section === 'preferencias') applyThemePreference((savedValue as UserSettings['preferencias']).theme);
  }, [savedValue, section]);

  return { value, setValue, savedValue, loaded, saving, error, message, save, cancel };
}