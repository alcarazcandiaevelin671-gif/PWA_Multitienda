/**
 * Ruta /api/configuracion — Configuración: lee (GET) y guarda (PATCH) preferencias, notificaciones, privacidad y apariencia.
 * La lógica vive en src/backend/api/configuracion/preferencias.ts; este archivo solo la conecta con el enrutador de Next.js.
 */
export { GET, PATCH } from '@/backend/api/configuracion/preferencias';
