/**
 * Ruta /api/admin/comercios/[id]/reject — Administración: rechazar un comercio pendiente (/api/admin/comercios/:id/reject).
 * La lógica vive en src/backend/api/admin/comercio-rechazar.ts; este archivo solo la conecta con el enrutador de Next.js.
 */
export { POST } from '@/backend/api/admin/comercio-rechazar';
