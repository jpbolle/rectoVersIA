import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { resolveProfilTarget, isProfilTargetError } from '@/lib/profil-target';
import {
  loadStudentBase, loadClassStats, buildSectionStats, buildDevoirStats, buildHabileteStats,
} from '@/lib/profil-stats';
import type { ProfilSection } from '@/types/profil';

// GET - Onglet Lire : stats de lecture + comparaison classe + détail par activité
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
    const empty: ProfilSection = { stats: null, devoirs: [] };
    const base = await loadStudentBase(target.uid, target.email, {
      withGrilles: true,
      // Les réponses aux questionnaires vivent dans travail.content
      withContent: true,
    });
    if (!base) return NextResponse.json({ success: true, data: empty });

    // Habiletés : indépendantes des grilles — une activité de lecture récente
    // n'en a pas, ce sont les questions qui portent la didactique
    const habiletes = buildHabileteStats(base);

    const corrs = base.corrections.filter(
      (c) => base.devoirs.get(c.devoirId)?.type === 'lire'
    );
    if (corrs.length === 0) {
      return NextResponse.json({ success: true, data: { ...empty, habiletes } });
    }

    const devoirIds = [...new Set(corrs.map((c) => c.devoirId))];
    const classStats = await loadClassStats(devoirIds);

    const data: ProfilSection = {
      stats: buildSectionStats(corrs, base, classStats),
      devoirs: buildDevoirStats(corrs, base, classStats),
      habiletes,
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET profil/lecture:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
