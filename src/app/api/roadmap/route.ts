import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

const DOC_REF = () => adminDb.collection('roadmap').doc('config');

export async function GET() {
  try {
    const doc = await DOC_REF().get();
    if (doc.exists) {
      return NextResponse.json({ success: true, data: doc.data() });
    }
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error('Erreur GET /api/roadmap:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    await DOC_REF().set(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/roadmap:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
