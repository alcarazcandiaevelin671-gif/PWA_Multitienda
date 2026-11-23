/**
 * Ruta /api/auth/session — Sesión: copia los tokens del navegador a cookies del servidor (POST) y cierra sesión (DELETE).
 * La lógica vive en src/backend/api/auth/session.ts; este archivo solo la conecta con el enrutador de Next.js.
 */
export { POST, DELETE } from '@/backend/api/auth/session';
