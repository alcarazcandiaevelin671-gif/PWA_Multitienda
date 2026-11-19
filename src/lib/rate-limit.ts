/**
 * Limitador de peticiones en memoria (ventana fija por IP y regla).
 * OWASP ASVS V11.1 / V2.2 (anti-automatización) · ISO 27002 8.6 (gestión de capacidad).
 *
 * Funciona por instancia del servidor: suficiente para un único servidor Node.
 * Con varias instancias o serverless conviene un almacén compartido (p. ej. Redis/Upstash).
 */

type Rule = { name: string; limit: number; windowMs: number };

// Reglas por ruta de la API (la primera que coincide). Valores conservadores para uso normal.
const RULES: Array<{ match: (path: string) => boolean; rule: Rule }> = [
  { match: (p) => p.startsWith('/api/registro-'), rule: { name: 'registro', limit: 5, windowMs: 15 * 60_000 } },
  { match: (p) => p === '/api/configuracion/exportar-datos', rule: { name: 'exportar', limit: 5, windowMs: 60 * 60_000 } },
  { match: (p) => p === '/api/configuracion/desactivar', rule: { name: 'desactivar', limit: 5, windowMs: 60 * 60_000 } },
  { match: (p) => p === '/api/checkout', rule: { name: 'checkout', limit: 15, windowMs: 60_000 } },
  { match: (p) => p === '/api/auth/session', rule: { name: 'sesion', limit: 40, windowMs: 60_000 } },
  { match: (p) => p.startsWith('/api/configuracion/foto'), rule: { name: 'foto', limit: 10, windowMs: 10 * 60_000 } },
  { match: () => true, rule: { name: 'api', limit: 120, windowMs: 60_000 } },
];

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  buckets.forEach((value, key) => { if (value.resetAt <= now) buckets.delete(key); });
}

export type RateLimitResult = { allowed: boolean; limit: number; remaining: number; retryAfterSec: number };

export function checkRateLimit(path: string, clientKey: string): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const { rule } = RULES.find(({ match }) => match(path))!;
  const key = `${rule.name}:${clientKey}`;
  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, entry);
  }
  entry.count += 1;
  return {
    allowed: entry.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - entry.count),
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}
