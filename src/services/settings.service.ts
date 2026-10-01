import { supabase } from '@/lib/supabase';
import { getCurrentUser, isMissingTableError } from '@/services/orders.service';

export type SettingsProfile = {
  id: string;
  email: string;
  nombre_completo: string | null;
  telefono_contacto: string | null;
  direccion_texto: string | null;
  avatar_url: string | null;
  rol: string | null;
  activo: boolean | null;
  creado_en?: string | null;
  actualizado_en?: string | null;
  email_verified?: boolean;
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
  email: boolean;
  push: boolean;
  sms: boolean;
  orderUpdates: boolean;
  securityAlerts: boolean;
  promotions: boolean;
  news: boolean;
  accountActivity: boolean;
  frequency: 'inmediata' | 'diaria' | 'semanal' | 'desactivada';
};

export type PrivacySettings = {
  visibility: 'public' | 'private';
};

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
      direccion_texto: null,
      avatar_url: null,
      rol: user.user_metadata?.rol ?? null,
      activo: true,
      email_verified: Boolean(user.email_confirmed_at),
    };
  }

  return {
    id: data.id ?? user.id,
    email: data.email ?? user.email ?? '',
    nombre_completo: data.nombre_completo ?? user.user_metadata?.nombre_completo ?? null,
    telefono_contacto: data.telefono_contacto ?? user.user_metadata?.telefono ?? null,
    direccion_texto: data.direccion_texto ?? null,
    avatar_url: data.avatar_url ?? null,
    rol: data.rol ?? user.user_metadata?.rol ?? null,
    activo: data.activo ?? true,
    email_verified: Boolean(user.email_confirmed_at),
    creado_en: data.creado_en ?? null,
    actualizado_en: data.actualizado_en ?? null,
  };
}

export async function updateSettingsIdentity(payload: Partial<SettingsProfile>) {
  const user = await getCurrentUser();
  const update: Record<string, unknown> = {};
  const allowed = ['nombre_completo', 'telefono_contacto', 'direccion_texto', 'avatar_url'] as const;

  allowed.forEach((key) => {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      update[key] = value;
    }
  });

  if (!Object.keys(update).length) return;

  const { error } = await supabase.from('usuarios').update(update).eq('id', user.id);
  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('La tabla usuarios no está disponible en Supabase.');
    }
    throw error;
  }
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
    email: true,
    push: false,
    sms: false,
    orderUpdates: true,
    securityAlerts: true,
    promotions: false,
    news: true,
    accountActivity: true,
    frequency: 'inmediata',
  };
}

export function getDefaultPrivacy(): PrivacySettings {
  return {
    visibility: 'private',
  };
}

export function getSecurityStatus() {
  return {
    passwordChangeAvailable: true,
    mfaAvailable: true,
    mfaEnabled: false,
    oAuth: {
      google: true,
      github: false,
    },
    activeSessions: [],
  };
}
