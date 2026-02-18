import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// POST - Creer ou mettre a jour le document utilisateur (via adminDb, bypass les rules)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const displayName = body.displayName || '';

    const userRef = adminDb.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();
    const now = new Date().toISOString();

    if (!userSnap.exists) {
      await userRef.set({
        email: auth.email,
        role: auth.role,
        displayName,
        createdAt: now,
        lastLoginAt: now,
      });
    } else {
      await userRef.update({ lastLoginAt: now });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/auth/init-user:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
