import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { resolveProfilTarget, isProfilTargetError } from '@/lib/profil-target';
import { loadStudentBase, buildVocabulaireProfil } from '@/lib/profil-stats';
import type { ProfilVocabulaire } from '@/types/profil';

// GET - Onglet Vocabulaire : maîtrise lexicale par série + liste personnelle
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  const target = await resolveProfilTarget(auth, request);
  if (isProfilTargetError(target)) {
    return NextResponse.json(
      { success: false, message: target.errorMessage },
      { status: target.errorStatus }
    );
  }

  try {
    const empty: ProfilVocabulaire = { groups: [], perso: [], activites: [] };
    const base = await loadStudentBase(target.uid, target.email, { withContent: true });
    if (!base) return NextResponse.json({ success: true, data: empty });

    const data = await buildVocabulaireProfil(target.uid, base);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET profil/vocabulaire:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
