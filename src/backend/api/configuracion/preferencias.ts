/**
 * [BACKEND · API] Configuración: lee (GET) y guarda (PATCH) preferencias, notificaciones, privacidad y apariencia.
 *
 * Ruta pública: src/app/api/configuracion/route.ts (solo reexporta este archivo).
 * Se ejecuta únicamente en el servidor.
 */
import 'server-only';
import { requireActiveSettingsUser } from '@/backend/auth/require-active-user';
import { NextResponse } from 'next/server';
import { normalizeAppearance } from '@/shared/lib/appearance';

const notificationChannels = ['inApp', 'email', 'push', 'sms'] as const;
const notificationCategories = ['orders', 'stores', 'sales', 'invoices', 'messages', 'promotions', 'security', 'system'] as const;
const frequencies = ['inmediata', 'diaria', 'semanal', 'ninguna'] as const;
const settingsSections = ['preferencias', 'notificaciones_config', 'privacidad'] as const;

type SettingsSection = typeof settingsSections[number];
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingSettingsTable(error: { code?: string; message?: string }) {
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || /usuario_configuracion.*does not exist|could not find the table/i.test(error.message ?? '');
}

function validSettingsValue(section: SettingsSection, value: unknown): JsonRecord | null {
  if (!isRecord(value)) return null;

  if (section === 'preferencias') {
    if (
      !['es', 'gn', 'en'].includes(String(value.language))
      || !['America/Asuncion', 'UTC', 'America/Argentina/Buenos_Aires'].includes(String(value.timezone))
      || !['DD/MM/YYYY', 'YYYY-MM-DD'].includes(String(value.dateFormat))
      || value.currency !== 'PYG'
      || !['light', 'dark', 'system'].includes(String(value.theme))
    ) return null;
    return {
      language: value.language,
      timezone: value.timezone,
      dateFormat: value.dateFormat,
      currency: value.currency,
      theme: value.theme,
    };
  }

  if (section === 'notificaciones_config') {
    if (!isRecord(value.channels) || !isRecord(value.categories)) return null;
    const channels = value.channels;
    const categories = value.categories;
    if (![...notificationChannels].every((key) => typeof channels[key] === 'boolean')) return null;
    if (![...notificationCategories].every((key) => typeof categories[key] === 'boolean')) return null;
    if (!frequencies.includes(value.frequency as typeof frequencies[number])) return null;
    if (value.channels.push === true || value.channels.sms === true) return null;
    return {
      channels: { ...channels, push: false, sms: false },
      categories: { ...categories, security: true },
      frequency: value.frequency,
    };
  }

  if (!['public', 'private'].includes(String(value.profileVisibility))) return null;
  if (typeof value.showBasicInfo !== 'boolean' || typeof value.personalizedRecommendations !== 'boolean') return null;
  return {
    profileVisibility: value.profileVisibility,
    showBasicInfo: value.showBasicInfo,
    personalizedRecommendations: value.personalizedRecommendations,
  };
}

export async function GET() {
  const account = await requireActiveSettingsUser();
  if ('response' in account) return account.response;
  const { data: existing, error } = await account.supabase
    .from('usuario_configuracion')
    .select('preferencias, notificaciones_config, privacidad, created_at, updated_at')
    .eq('usuario_id', account.user.id)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) return NextResponse.json({ error: 'La migración de preferencias todavía no está aplicada en Supabase.' }, { status: 503 });
    return NextResponse.json({ error: 'No se pudo consultar tu configuración.' }, { status: 403 });
  }
  if (existing) return NextResponse.json({ settings: existing });

  const { data: created, error: insertError } = await account.supabase
    .from('usuario_configuracion')
    .insert({
      usuario_id: account.user.id,
      preferencias: {},
      notificaciones_config: {},
      privacidad: {},
    })
    .select('preferencias, notificaciones_config, privacidad, created_at, updated_at')
    .single();

  if (insertError?.code === '23505') {
    const { data: concurrentSettings, error: concurrentReadError } = await account.supabase
      .from('usuario_configuracion')
      .select('preferencias, notificaciones_config, privacidad, created_at, updated_at')
      .eq('usuario_id', account.user.id)
      .maybeSingle();
    if (!concurrentReadError && concurrentSettings) return NextResponse.json({ settings: concurrentSettings });
  }
  if (insertError || !created) {
    if (insertError && isMissingSettingsTable(insertError)) {
      return NextResponse.json({ error: 'No se pudo inicializar tu configuración en Supabase.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'No se pudo inicializar tu configuración. Verifica las políticas RLS.' }, { status: 403 });
  }
  return NextResponse.json({ settings: created });
}

export async function PATCH(request: Request) {
  const account = await requireActiveSettingsUser();
  if ('response' in account) return account.response;

  let body: { section?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no tiene un formato válido.' }, { status: 400 });
  }
  // "apariencia" se guarda dentro de preferencias.apariencia (columna jsonb existente).
  const isAppearance = body.section === 'apariencia';
  if (!isAppearance && !settingsSections.includes(body.section as SettingsSection)) {
    return NextResponse.json({ error: 'La sección de configuración no es válida.' }, { status: 400 });
  }
  const section: SettingsSection = isAppearance ? 'preferencias' : body.section as SettingsSection;
  const appearance = isAppearance && isRecord(body.value) ? normalizeAppearance(body.value) : null;
  const value = isAppearance ? (appearance ? {} : null) : validSettingsValue(section, body.value);
  if (!value) return NextResponse.json({ error: 'Uno o más valores de configuración no son válidos o no están disponibles.' }, { status: 400 });

  const { data: current, error: currentError } = await account.supabase
    .from('usuario_configuracion')
    .select('preferencias, notificaciones_config, privacidad, created_at')
    .eq('usuario_id', account.user.id)
    .maybeSingle();
  if (currentError) {
    if (isMissingSettingsTable(currentError)) return NextResponse.json({ error: 'La migración de preferencias todavía no está aplicada en Supabase.' }, { status: 503 });
    return NextResponse.json({ error: 'No se pudo leer tu configuración para guardar los cambios.' }, { status: 403 });
  }

  const currentPreferences: JsonRecord = isRecord(current?.preferencias) ? current.preferencias : {};
  const updated = {
    preferencias: currentPreferences,
    notificaciones_config: isRecord(current?.notificaciones_config) ? current.notificaciones_config : {},
    privacidad: isRecord(current?.privacidad) ? current.privacidad : {},
    [section]: value,
  };
  if (isAppearance) {
    updated.preferencias = { ...currentPreferences, apariencia: appearance };
  } else if (section === 'preferencias' && isRecord(currentPreferences.apariencia)) {
    // Guardar idioma/tema no debe borrar la personalización de colores.
    updated.preferencias = { ...value, apariencia: currentPreferences.apariencia };
  }
  const { data, error } = await account.supabase
    .from('usuario_configuracion')
    .upsert({ usuario_id: account.user.id, ...updated, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' })
    .select('preferencias, notificaciones_config, privacidad, created_at, updated_at')
    .single();
  if (error) {
    if (isMissingSettingsTable(error)) return NextResponse.json({ error: 'La migración de preferencias todavía no está aplicada en Supabase.' }, { status: 503 });
    return NextResponse.json({ error: 'No se pudo guardar la configuración. Verifica las políticas RLS.' }, { status: 403 });
  }
  return NextResponse.json({ settings: data });
}