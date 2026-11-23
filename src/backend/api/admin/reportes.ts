/**
 * [BACKEND · API] Administración: módulo de reportes retirado; responde 410 (/api/admin/reportes).
 *
 * Ruta pública: src/app/api/admin/reportes/route.ts (solo reexporta este archivo).
 * Se ejecuta únicamente en el servidor.
 */
import 'server-only';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'El módulo de reportes ya no está disponible.' }, { status: 410 });
}