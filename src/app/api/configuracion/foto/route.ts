/**
 * Ruta /api/configuracion/foto — Cuenta: sube (POST) o elimina (DELETE) la foto de perfil en el bucket avatars.
 * La lógica vive en src/backend/api/configuracion/foto.ts; este archivo solo la conecta con el enrutador de Next.js.
 */
export { POST, DELETE } from '@/backend/api/configuracion/foto';
