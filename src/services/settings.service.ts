import { supabase } from '@/lib/supabase';
import { getCurrentUser, isMissingTableError } from '@/services/orders.service';

export type SettingsProfile = {
  id: string;
  email: string;
  nombre_completo: string | null;
  telefono_contacto: string | null;
  avatar_url: string | null;
  rol: string | null;
  activo: boolean | null;
  creado_en?: string | null;
  actualizado_en?: string | null;
  email_verified: boolean;
  last_sign_in_at: string | null;
};

export type SecuritySnapshot = {
  providers: string[];
  factors: Array<{ id: string; factor_type: string; status: string; friendly_name?: string }>;
  currentLevel: string | null;
  nextLevel: string | null;
  sessionExpiresAt: number | null;
};

export type StoreSettings = {
  id: string | null;
  usuario_id: string | null;
  nombre_comercio: string | null;
  slug: string | null;
  descripcion: string | null;
  whatsapp: string | null;
  email: string | null;
  telefono: string | null;
  categoria_principal: string | null;
  direccion_texto: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: string | null;
  logo_url: string | null;
  portada_url: string | null;
};

export type UserPreferences = {
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  theme: 'light' | 'dark' | 'system';
};

export type NotificationPreferences = {
  channels: { inApp: boolean; email: boolean; push: boolean; sms: boolean };
  categories: {
    orders: boolean;
    stores: boolean;
    sales: boolean;
    invoices: boolean;
    messages: boolean;
    promotions: boolean;
    security: boolean;
    system: boolean;
  };
  frequency: 'inmediata' | 'diaria' | 'semanal' | 'ninguna';
};

export type PrivacySettings = {
  profileVisibility: 'public' | 'private';
  showBasicInfo: boolean;
  personalizedRecommendations: boolean;
};

export type UserSettings = {
  preferencias: UserPreferences;
  notificaciones_config: NotificationPreferences;
  privacidad: PrivacySettings;
};

export type SettingsSection = keyof UserSettings;

export function readLocalSettings<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalSettings<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin fallback obligatorio: usamos el valor en memoria del componente.
  }
}

export async function getSettingsProfile(): Promise<SettingsProfile | null> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error && !isMissingTableError(error)) {
    throw error;
  }

  if (!data) {
    return {
      id: user.id,
      email: user.email ?? '',
      nombre_completo: user.user_metadata?.nombre_completo ?? null,
      telefono_contacto: user.user_metadata?.telefono_contacto ?? null,
      avatar_url: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
      rol: null,
      activo: null,
      email_verified: Boolean(user.email_confirmed_at),
      creado_en: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    };
  }

  return {
    id: data.id ?? user.id,
    email: user.email ?? data.email ?? '',
    nombre_completo: data.nombre_completo ?? user.user_metadata?.nombre_completo ?? null,
    telefono_contacto: data.telefono_contacto ?? user.user_metadata?.telefono ?? null,
    avatar_url: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
    rol: data.rol ?? null,
    activo: typeof data.activo === 'boolean' ? data.activo : null,
    email_verified: Boolean(user.email_confirmed_at),
    creado_en: data.creado_en ?? null,
    actualizado_en: data.actualizado_en ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
  };
}

export async function updateSettingsIdentity(payload: Partial<SettingsProfile>) {
  const update: Record<string, unknown> = {};
  const allowed = ['nombre_completo', 'telefono_contacto', 'avatar_url'] as const;

  allowed.forEach((key) => {
    const value = payload[key];
    if (value !== undefined) update[key] = value;
  });

  if (!Object.keys(update).length) return;

  if (typeof update.nombre_completo === 'string') {
    const normalizedName = update.nombre_completo.trim();
    update.nombre_completo = normalizedName;
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      throw new Error('El nombre debe tener entre 2 y 100 caracteres.');
    }
  }
  if (typeof update.telefono_contacto === 'string' && update.telefono_contacto.length > 40) {
    throw new Error('El teléfono no puede superar los 40 caracteres.');
  }
  if (typeof update.telefono_contacto === 'string' && update.telefono_contacto.trim() && !/^[+\d\s().-]{6,40}$/.test(update.telefono_contacto)) {
    throw new Error('El formato del teléfono no es válido.');
  }

  const response = await fetch('/api/configuracion/identidad', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudieron guardar los datos de identidad.');
}

export async function updateAuthEmail(email: string) {
  const normalizedEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Ingresa un correo electrónico válido.');
  }
  const { error } = await supabase.auth.updateUser({ email: normalizedEmail });
  if (error) throw error;
}

export async function changeAuthPassword(currentPassword: string, newPassword: string) {
  const user = await getCurrentUser();
  if (!user.email) throw new Error('No se puede validar una contraseña para esta cuenta.');
  if (newPassword.length < 12 || newPassword.length > 128) {
    throw new Error('La nueva contraseña debe tener entre 12 y 128 caracteres.');
  }
  if (newPassword === currentPassword) throw new Error('La nueva contraseña debe ser diferente.');

  const { data, error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError || data.user?.id !== user.id) {
    throw new Error('No se pudo verificar la contraseña actual.');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getSecuritySnapshot(): Promise<SecuritySnapshot> {
  const [identityResult, factorResult, assuranceResult, sessionResult] = await Promise.all([
    supabase.auth.getUserIdentities(),
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.getSession(),
  ]);

  if (identityResult.error) throw identityResult.error;
  if (factorResult.error) throw factorResult.error;
  if (assuranceResult.error) throw assuranceResult.error;
  if (sessionResult.error) throw sessionResult.error;

  return {
    providers: Array.from(new Set(identityResult.data.identities.map((identity) => identity.provider))),
    factors: factorResult.data.all.map(({ id, factor_type, status, friendly_name }) => ({ id, factor_type, status, friendly_name })),
    currentLevel: assuranceResult.data.currentLevel,
    nextLevel: assuranceResult.data.nextLevel,
    sessionExpiresAt: sessionResult.data.session?.expires_at ?? null,
  };
}

export async function startTotpEnrollment() {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Portal Comercial Guairá',
  });
  if (error) throw error;
  return { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotpEnrollment(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw error;
}

export async function removeMfaFactor(factorId: string, code: string) {
  const { error: verificationError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (verificationError) throw verificationError;
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function unlinkAuthIdentity(provider: string) {
  const { data, error: identitiesError } = await supabase.auth.getUserIdentities();
  if (identitiesError) throw identitiesError;
  const identity = data.identities.find((item) => item.provider === provider);
  if (!identity) throw new Error('No se encontró esa identidad vinculada.');
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw error;
}

export async function uploadProfileAvatar(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/configuracion/foto', { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo subir la foto.');
  return result.url as string;
}

export async function deleteProfileAvatar(url: string) {
  const response = await fetch('/api/configuracion/foto', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo eliminar la foto.');
}

export async function getUserSettings(): Promise<UserSettings | null> {
  const response = await fetch('/api/configuracion', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo cargar la configuración.');
  const stored = result.settings as Partial<UserSettings> | null;
  if (!stored) return null;
  const defaults = getDefaultUserSettings();
  const storedPreferences: Record<string, unknown> = isSettingsRecord(stored.preferencias) ? stored.preferencias : {};
  const storedNotifications: Record<string, unknown> = isSettingsRecord(stored.notificaciones_config) ? stored.notificaciones_config : {};
  const storedChannels: Record<string, unknown> = isSettingsRecord(storedNotifications.channels) ? storedNotifications.channels : {};
  const storedCategories: Record<string, unknown> = isSettingsRecord(storedNotifications.categories) ? storedNotifications.categories : {};
  const storedPrivacy: Record<string, unknown> = isSettingsRecord(stored.privacidad) ? stored.privacidad : {};
  const frequency = storedNotifications.frequency;
  return {
    preferencias: {
      language: ['es', 'gn', 'en'].includes(String(storedPreferences.language)) ? String(storedPreferences.language) : defaults.preferencias.language,
      timezone: ['America/Asuncion', 'UTC', 'America/Argentina/Buenos_Aires'].includes(String(storedPreferences.timezone)) ? String(storedPreferences.timezone) : defaults.preferencias.timezone,
      dateFormat: ['DD/MM/YYYY', 'YYYY-MM-DD'].includes(String(storedPreferences.dateFormat)) ? String(storedPreferences.dateFormat) : defaults.preferencias.dateFormat,
      currency: storedPreferences.currency === 'PYG' ? 'PYG' : defaults.preferencias.currency,
      theme: ['light', 'dark', 'system'].includes(String(storedPreferences.theme)) ? storedPreferences.theme as UserPreferences['theme'] : defaults.preferencias.theme,
    },
    notificaciones_config: {
      channels: {
        inApp: typeof storedChannels.inApp === 'boolean' ? storedChannels.inApp : defaults.notificaciones_config.channels.inApp,
        email: typeof storedChannels.email === 'boolean' ? storedChannels.email : defaults.notificaciones_config.channels.email,
        push: false,
        sms: false,
      },
      categories: {
        orders: typeof storedCategories.orders === 'boolean' ? storedCategories.orders : defaults.notificaciones_config.categories.orders,
        stores: typeof storedCategories.stores === 'boolean' ? storedCategories.stores : defaults.notificaciones_config.categories.stores,
        sales: typeof storedCategories.sales === 'boolean' ? storedCategories.sales : defaults.notificaciones_config.categories.sales,
        invoices: typeof storedCategories.invoices === 'boolean' ? storedCategories.invoices : defaults.notificaciones_config.categories.invoices,
        messages: typeof storedCategories.messages === 'boolean' ? storedCategories.messages : defaults.notificaciones_config.categories.messages,
        promotions: typeof storedCategories.promotions === 'boolean' ? storedCategories.promotions : defaults.notificaciones_config.categories.promotions,
        security: true,
        system: typeof storedCategories.system === 'boolean' ? storedCategories.system : defaults.notificaciones_config.categories.system,
      },
      frequency: ['inmediata', 'diaria', 'semanal', 'ninguna'].includes(String(frequency)) ? frequency as NotificationPreferences['frequency'] : defaults.notificaciones_config.frequency,
    },
    privacidad: {
      profileVisibility: storedPrivacy.profileVisibility === 'public' ? 'public' : 'private',
      showBasicInfo: storedPrivacy.showBasicInfo === true,
      personalizedRecommendations: typeof storedPrivacy.personalizedRecommendations === 'boolean' ? storedPrivacy.personalizedRecommendations : defaults.privacidad.personalizedRecommendations,
    },
  };
}

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function updateUserSettings(section: SettingsSection, value: UserSettings[SettingsSection]) {
  const response = await fetch('/api/configuracion', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, value }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo guardar la configuración.');
  return result.settings as UserSettings;
}

export async function updatePreferences(value: UserPreferences) {
  return updateUserSettings('preferencias', value);
}

export async function updateNotificationPreferences(value: NotificationPreferences) {
  return updateUserSettings('notificaciones_config', value);
}

export async function updatePrivacySettings(value: PrivacySettings) {
  return updateUserSettings('privacidad', value);
}

export async function deactivateAccount(password: string, confirmation: string) {
  const response = await fetch('/api/configuracion/desactivar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, confirmation }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo desactivar la cuenta.');
  await supabase.auth.signOut();
  return Boolean(result.auditRecorded);
}

export async function updateStoreSettings(payload: Partial<StoreSettings>) {
  const user = await getCurrentUser();
  const { data: store, error: storeError } = await supabase
    .from('tiendas')
    .select('*')
    .eq('usuario_id', user.id)
    .maybeSingle();

  if (storeError) {
    if (isMissingTableError(storeError)) {
      throw new Error('La tabla tiendas no está disponible en Supabase.');
    }
    throw storeError;
  }

  if (!store) {
    throw new Error('No tienes un comercio asociado para actualizar.');
  }

  const update: Record<string, unknown> = {};
  const allowed = ['nombre_comercio', 'slug', 'descripcion', 'whatsapp', 'email', 'telefono', 'categoria_principal', 'direccion_texto', 'latitud', 'longitud', 'logo_url', 'portada_url'] as const;

  allowed.forEach((key) => {
    const value = payload[key];
    if (value !== undefined) {
      update[key] = value;
    }
  });

  if (!Object.keys(update).length) return;

  const { error } = await supabase.from('tiendas').update(update).eq('id', store.id);
  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('La tabla tiendas no está disponible en Supabase.');
    }
    throw error;
  }
}

export async function getStoreSettings(): Promise<StoreSettings | null> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('tiendas')
    .select('*')
    .eq('usuario_id', user.id)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) throw error;
    return null;
  }

  return (data as StoreSettings | null) ?? null;
}

export function getDefaultPreferences(): UserPreferences {
  return {
    language: 'es',
    timezone: 'America/Asuncion',
    dateFormat: 'DD/MM/YYYY',
    currency: 'PYG',
    theme: 'system',
  };
}

export function getDefaultNotifications(): NotificationPreferences {
  return {
    channels: { inApp: true, email: true, push: false, sms: false },
    categories: {
      orders: true,
      stores: true,
      sales: true,
      invoices: true,
      messages: true,
      promotions: false,
      security: true,
      system: true,
    },
    frequency: 'inmediata',
  };
}

export function getDefaultPrivacy(): PrivacySettings {
  return {
    profileVisibility: 'private',
    showBasicInfo: false,
    personalizedRecommendations: true,
  };
}

export function getDefaultUserSettings(): UserSettings {
  return {
    preferencias: getDefaultPreferences(),
    notificaciones_config: getDefaultNotifications(),
    privacidad: getDefaultPrivacy(),
  };
}

export function applyThemePreference(theme: UserPreferences['theme']) {
  if (typeof document === 'undefined') return () => {};
  const root = document.documentElement;
  const media = theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = theme === 'dark' || (theme === 'system' && Boolean(media?.matches));
  root.dataset.theme = isDark ? 'dark' : 'light';
  root.dataset.themePreference = theme;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  return () => {};
}

export const getSecurityStatus = () => getSecuritySnapshot();
