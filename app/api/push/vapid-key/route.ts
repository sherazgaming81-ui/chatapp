import { NextResponse } from 'next/server';

// GET /api/push/vapid-key — public VAPID key runtime me do.
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY build-time par embed hoti hai; ye route fallback hai
// taake key badalne par rebuild ki zaroorat na pare.)
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  if (!key) return NextResponse.json({ error: 'VAPID key configured nahi hai' }, { status: 500 });
  return NextResponse.json({ key });
}
