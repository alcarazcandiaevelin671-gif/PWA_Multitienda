/**
 * Verificación rápida de sesión y rol en el servidor (middleware, rutas API, layouts).
 *
 * 1) getClaims(): el proyecto firma los tokens con ES256, así que la firma se verifica
 *    LOCALMENTE con la clave pública (JWKS en caché). auth.getUser() hacía un viaje a
 *    Supabase (~0.3 s) en cada navegación.
 * 2) Rol y estado de la cuenta en una cookie httpOnly firmada con HMAC que dura 2 minutos:
 *    evita consultar la tabla usuarios en cada navegación. Un cambio de rol o una
 *    desactivación se aplica como máximo 2 minutos después; los datos siguen protegidos
 *    por RLS en cada consulta.
 * Usa solo Web Crypto: funciona en el runtime Edge (middleware) y en Node.
 */

type ClaimsClient = {
  auth: { getClaims: () => Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }> };
};

/** aal: nivel de verificación de la sesión (aal1 = contraseña, aal2 = contraseña + código MFA). */
export type VerifiedUser = { id: string; email: string | null; aal: 'aal1' | 'aal2' };
export type AccountProfile = { rol: string; activo: boolean };

export async function getVerifiedUser(supabase: unknown): Promise<VerifiedUser | null> {
  try {
    const { data, error } = await (supabase as ClaimsClient).auth.getClaims();
    const sub = data?.claims?.sub;
    if (error || typeof sub !== 'string' || !sub) return null;
    const email = data?.claims?.email;
    return { id: sub, email: typeof email === 'string' ? email : null, aal: data?.claims?.aal === 'aal2' ? 'aal2' : 'aal1' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie de rol firmada
// ---------------------------------------------------------------------------
export const ROLE_COOKIE = 'pg_rol';
export const ROLE_COOKIE_MAX_AGE = 120; // segundos

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function getKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  keyPromise ??= crypto.subtle.importKey('raw', encoder.encode(`pg-role-cookie:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return keyPromise;
}

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
};

/** Valor firmado: userId.rol.activo.expiración.firma */
export async function signRoleCookie(userId: string, profile: AccountProfile): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  const exp = Math.floor(Date.now() / 1000) + ROLE_COOKIE_MAX_AGE;
  const payload = `${userId}.${encodeURIComponent(profile.rol)}.${profile.activo ? 1 : 0}.${exp}`;
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

/** Devuelve el perfil si la cookie es válida, no venció y pertenece a este usuario. */
export async function readRoleCookie(value: string | undefined, userId: string): Promise<AccountProfile | null> {
  if (!value) return null;
  const key = await getKey();
  if (!key) return null;
  const parts = value.split('.');
  if (parts.length !== 5) return null;
  const [id, rol, activo, exp, signature] = parts;
  if (id !== userId || Number(exp) < Math.floor(Date.now() / 1000)) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), encoder.encode(parts.slice(0, 4).join('.')));
    return valid ? { rol: decodeURIComponent(rol), activo: activo === '1' } : null;
  } catch {
    return null;
  }
}

export const roleCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ROLE_COOKIE_MAX_AGE,
  secure: process.env.NODE_ENV === 'production',
};

type ProfileClient = {
  from: (table: 'usuarios') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/**
 * Perfil (rol/activo) desde la cookie firmada o, si no hay, desde la base de datos.
 * `writeCookie` recibe el valor nuevo para guardarlo cuando el contexto lo permite.
 */
export async function getAccountProfile(
  supabase: unknown,
  userId: string,
  cookieValue: string | undefined,
  writeCookie?: (value: string) => void,
): Promise<AccountProfile | null> {
  const cached = await readRoleCookie(cookieValue, userId);
  if (cached) return cached;
  const { data, error } = await (supabase as ProfileClient).from('usuarios').select('rol, activo').eq('id', userId).maybeSingle();
  const row = data as { rol?: unknown; activo?: unknown } | null;
  if (error || !row) return null;
  const profile = { rol: String(row.rol ?? '').trim().toLowerCase(), activo: row.activo === true };
  if (writeCookie) {
    const signed = await signRoleCookie(userId, profile);
    if (signed) writeCookie(signed);
  }
  return profile;
}
