/**
 * Ruta /api/admin/[resource] — Administración: listar/actualizar registros de una tabla permitida (/api/admin/:recurso).
 * La lógica vive en src/backend/api/admin/recursos.ts; este archivo solo la conecta con el enrutador de Next.js.
 */
export { GET, PATCH } from '@/backend/api/admin/recursos';
