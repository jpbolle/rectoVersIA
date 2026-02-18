import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';

// GET - Resoudre le role d'un utilisateur (utilise par AuthContext pour les non-cnddinant.be)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);

  if (!auth) {
    return NextResponse.json({ success: false, role: null, isAdmin: false });
  }

  return NextResponse.json({
    success: true,
    role: auth.role,
    isAdmin: auth.isAdmin,
  });
}
