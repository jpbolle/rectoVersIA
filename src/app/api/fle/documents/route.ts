import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { documentsDe } from '@/lib/lecture-cours-server';

// GET — « Mes documents » : les PDF que l'élève connecté a importés
// (documentsCours, plan du 2026-10-12). Sans la transcription.

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'eleve') {
    return NextResponse.json({ success: false, message: 'Accès réservé aux élèves' }, { status: 403 });
  }
  try {
    return NextResponse.json({ success: true, data: await documentsDe(auth.uid) });
  } catch (error) {
    console.error('Erreur GET /api/fle/documents:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
