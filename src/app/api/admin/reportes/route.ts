import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'El módulo de reportes ya no está disponible.' }, { status: 410 });
}