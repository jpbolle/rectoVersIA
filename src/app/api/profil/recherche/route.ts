import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { resolveProfilTarget, isProfilTargetError } from '@/lib/profil-target';
import { buildRechercheProfil, loadStudentBase } from '@/lib/profil-stats';
import type { ProfilRecherche } from '@/types/profil';

// GET - Onglet Rechercher : les recherches guidées NavigKid de l'élève, leurs
// notes (réponses / démarche) et le cumul par habileté.
//
// Comme pour la lecture, rien n'est comptabilisé tant que la correction n'a pas
// été rendue visible : le profil ne montre que ce que l'élève a le droit de voir.
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
    const vide: ProfilRecherche = { items: [], habiletes: [] };
    const base = await loadStudentBase(target.uid, target.email);
    if (!base) return NextResponse.json({ success: true, data: vide });

    const data = await buildRechercheProfil(target.uid, base);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET profil/recherche:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
