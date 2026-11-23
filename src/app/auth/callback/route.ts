/**
 * Ruta /auth/callback — regreso desde Supabase Auth (login con Google con código o confirmación de correo).
 * La lógica vive en src/backend/api/auth/callback.ts; este archivo solo la conecta con el enrutador de Next.js.
 */
export { GET } from '@/backend/api/auth/callback';
