import { NextResponse } from 'next/server';

import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await pool.query('SELECT 1');
    return NextResponse.json(
      { status: 'ready' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Readiness check failed:', error);
    return NextResponse.json(
      { status: 'not_ready' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
