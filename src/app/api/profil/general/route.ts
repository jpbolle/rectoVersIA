import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import {
  loadStudentBase, buildSectionStats, buildVocabulaireProfil,
} from '@/lib/profil-stats';
import type { ProfilGeneral } from '@/types/profil';

// GET - Onglet Général : données élève uniquement, pas de stats de classe (rapide)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  try {
    const empty: ProfilGeneral = {
      travauxRemis: 0, reussites: 0, echecs: 0, attention: [],
      lire: null, ecrire: null, rechercher: null, vocabulaire: null,
    };

    const base = await loadStudentBase(auth.uid, auth.email, {
      withGrilles: true, withContent: true,
    });
    if (!base || base.travaux.length === 0) {
      return NextResponse.json({ success: true, data: empty });
    }

    const typeOf = (devoirId: string) => base.devoirs.get(devoirId)?.type || 'ecrire';
    const corrEcrire = base.corrections.filter((c) => typeOf(c.devoirId) === 'ecrire');
    const corrLire = base.corrections.filter((c) => typeOf(c.devoirId) === 'lire');

    // Compteurs écriture
    const travauxRemis = base.travaux.filter(
      (t) => typeOf(t.devoirId) === 'ecrire' && t.status === 'submitted'
    ).length;
    const reussites = corrEcrire.filter((c) => c.score >= 60).length;
    const echecs = corrEcrire.filter((c) => c.score < 60).length;

    // Points d'attention : pires critères d'écriture (< 50), sans stats de classe
    const noClass = new Map();
    const ecritureStats = buildSectionStats(corrEcrire, base, noClass);
    const attention = (ecritureStats?.criteria ?? [])
      .filter((c) => c.averageScore < 50)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 2)
      .map((c) => c.name);

    const avg = (scores: number[]) =>
      Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

    // Tuile Rechercher : recherches remises / total
    const rechercheDevoirs = base.travaux
      .map((t) => ({ devoirId: t.devoirId, devoir: base.devoirs.get(t.devoirId) }))
      .filter((e) => e.devoir?.type === 'rechercher' && e.devoir.questionnaireId);
    let remises = 0;
    await Promise.all(rechercheDevoirs.map(async (e) => {
      const rep = await adminDb
        .collection('questionnaires').doc(e.devoir!.questionnaireId!)
        .collection('reponses').doc(auth.uid).get();
      if (rep.exists) remises++;
    }));

    // Tuile Vocabulaire : mots connus / total
    const vocab = await buildVocabulaireProfil(auth.uid, base);
    const allVocabWords = vocab.groups.flatMap((g) => g.words);
    const connus = allVocabWords.filter((w) => w.level >= 4).length;

    const profil: ProfilGeneral = {
      travauxRemis, reussites, echecs, attention,
      ecrire: corrEcrire.length > 0
        ? { score: avg(corrEcrire.map((c) => c.score)), evaluations: corrEcrire.length }
        : null,
      lire: corrLire.length > 0
        ? { score: avg(corrLire.map((c) => c.score)), evaluations: corrLire.length }
        : null,
      rechercher: rechercheDevoirs.length > 0
        ? { remises, total: rechercheDevoirs.length }
        : null,
      vocabulaire: allVocabWords.length > 0
        ? { connus, total: allVocabWords.length }
        : null,
    };

    return NextResponse.json({ success: true, data: profil });
  } catch (error) {
    console.error('Erreur GET profil/general:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
