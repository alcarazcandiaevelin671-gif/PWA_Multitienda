/**
 * Ruta /api/admin/[resource]/[id] — Administración: leer/actualizar UN registro de una tabla permitida (/api/admin/:recurso/:id).
 * La lógica vive en src/backend/api/admin/recurso.ts; este archivo solo la conecta con el enrutador de Next.js.
 */
export { GET, PATCH } from '@/backend/api/admin/recurso';
