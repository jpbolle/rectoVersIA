import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import {
  loadStudentBase, loadClassStats, buildSectionStats, buildDevoirStats,
} from '@/lib/profil-stats';
import type { ProfilSection } from '@/types/profil';

// GET - Onglet Écrire : stats d'écriture + comparaison classe + détail par activité
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  try {
    const empty: ProfilSection = { stats: null, devoirs: [] };
    const base = await loadStudentBase(auth.uid, auth.email, { withGrilles: true });
    if (!base) return NextResponse.json({ success: true, data: empty });

    const corrs = base.corrections.filter(
      (c) => (base.devoirs.get(c.devoirId)?.type || 'ecrire') === 'ecrire'
    );
    if (corrs.length === 0) return NextResponse.json({ success: true, data: empty });

    const devoirIds = [...new Set(corrs.map((c) => c.devoirId))];
    const classStats = await loadClassStats(devoirIds);

    const data: ProfilSection = {
      stats: buildSectionStats(corrs, base, classStats),
      devoirs: buildDevoirStats(corrs, base, classStats),
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET profil/ecriture:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
