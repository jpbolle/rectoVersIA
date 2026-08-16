// Bilan de lecture d'UN élève sur son œuvre — ce que montre son onglet
// « Évaluation ».
//
// AUCUNE NOTE. C'est la règle fondatrice de cet atelier : on est en formatif,
// « je suis juste là pour les inviter à lire ». Ce bilan compte donc des
// gestes (formulaires complétés, extraits lus) et un degré de réussite aux
// QCM — jamais des points à encoder.
//
// POURQUOI CÔTÉ SERVEUR : les bonnes réponses vivent dans les sections. La
// liseuse en charge UNE à la fois, précisément pour ne pas transporter 150 à
// 300 Ko. Calculer le bilan dans le navigateur obligerait à tout retélécharger.
//
// Pendant prof : /api/oeuvres/suivi (toute la classe).

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { docToSection } from '@/lib/oeuvre-server';
import { parseOeuvreProgression } from '@/types/oeuvre';

export interface BilanFormulaire {
  sectionId: string;
  titre: string;
  groupe?: string;
  /** QCM justes / QCM répondus — les seules questions auto-corrigeables */
  justes: number;
  total: number;
  /** Questions ouvertes auxquelles l'élève a écrit quelque chose */
  ouvertes: number;
  termine: boolean;
}

export interface BilanOeuvre {
  formulairesFaits: number;
  formulairesTotal: number;
  minimum: number;
  extraitsLus: number;
  extraitsTotal: number;
  jours: number;
  formulaires: BilanFormulaire[];
  /** Moyenne des degrés de réussite, sur les seuls formulaires notables */
  moyenne: number | null;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const devoirId = new URL(request.url).searchParams.get('devoirId');
    if (!devoirId) {
      return NextResponse.json({ success: false, message: 'devoirId manquant' }, { status: 400 });
    }

    const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirSnap.exists) {
      return NextResponse.json({ success: false, message: 'Activité introuvable' }, { status: 404 });
    }
    const devoir = devoirSnap.data() as {
      oeuvreId?: string | null;
      oeuvreChapitres?: string[] | null;
      oeuvreMinimum?: number | null;
    };
    if (!devoir.oeuvreId) {
      return NextResponse.json(
        { success: false, message: 'Cette activité n’est pas une lecture d’œuvre' },
        { status: 400 }
      );
    }

    // Le travail de CET élève — l'id est déterministe, aucune requête filtrée
    // n'est nécessaire (et donc aucun index composite).
    const travailSnap = await adminDb
      .collection('travaux')
      .doc(`TRV-${devoirId}-${auth.uid}`)
      .get();
    const progression = parseOeuvreProgression(
      travailSnap.exists ? (travailSnap.data() as { content?: string }).content : null
    );

    // Les sections effectivement données par l'activité : une œuvre peut
    // n'être donnée qu'en partie, et compter sur l'anthologie entière
    // fausserait tous les dénominateurs.
    const oeuvreSnap = await adminDb.collection('oeuvres').doc(devoir.oeuvreId).get();
    const chapitres = (oeuvreSnap.data()?.chapitres || []) as {
      id: string;
      sections: { id: string }[];
    }[];
    const retenus = devoir.oeuvreChapitres?.length
      ? chapitres.filter((c) => devoir.oeuvreChapitres!.includes(c.id))
      : chapitres;
    const ordre = retenus.flatMap((c) => c.sections.map((s) => s.id));
    const retenusSet = new Set(ordre);

    const sectionsSnap = await adminDb
      .collection('oeuvres')
      .doc(devoir.oeuvreId)
      .collection('sections')
      .get();
    const sections = new Map(
      sectionsSnap.docs.filter((d) => retenusSet.has(d.id)).map((d) => [d.id, docToSection(d)])
    );

    const formulaires: BilanFormulaire[] = [];
    let extraitsLus = 0;

    // On parcourt dans l'ORDRE DU SOMMAIRE, pas dans celui où l'élève a
    // répondu : son bilan doit se lire comme son livre.
    for (const sectionId of ordre) {
      const etat = progression?.sections[sectionId];
      if (etat?.vueLe) extraitsLus += 1;

      const section = sections.get(sectionId);
      if (!section || section.questions.length === 0) continue;

      let justes = 0;
      let total = 0;
      let ouvertes = 0;

      for (const question of section.questions) {
        const reponse = etat?.reponses?.[question.id];
        if (question.type === 'qcm') {
          // Le dénominateur ne compte que les QCM AUXQUELS il a répondu : une
          // question sautée n'est pas une erreur, c'est une question sautée.
          if (reponse === undefined || reponse === null) continue;
          total += 1;
          if (reponse === question.correctIndex) justes += 1;
        } else if (reponse !== undefined && reponse !== null && reponse !== '') {
          ouvertes += 1;
        }
      }

      // Un formulaire jamais ouvert n'a pas sa place dans le bilan : il ferait
      // une ligne vide par scène non lue, soit 60 lignes sur 67.
      if (!etat?.termineLe && total === 0 && ouvertes === 0) continue;

      formulaires.push({
        sectionId,
        titre: section.titre,
        groupe: section.groupe,
        justes,
        total,
        ouvertes,
        termine: !!etat?.termineLe,
      });
    }

    const notables = formulaires.filter((f) => f.total > 0);
    const moyenne = notables.length
      ? Math.round(
          notables.reduce((s, f) => s + (f.justes / f.total) * 100, 0) / notables.length
        )
      : null;

    const bilan: BilanOeuvre = {
      formulairesFaits: Object.values(progression?.sections || {}).filter(
        (s) => !!s.termineLe
      ).length,
      formulairesTotal: [...sections.values()].filter((s) => s.questions.length > 0).length,
      minimum: devoir.oeuvreMinimum || 0,
      extraitsLus,
      extraitsTotal: ordre.length,
      jours: progression?.jours.length || 0,
      formulaires,
      moyenne,
    };

    return NextResponse.json({ success: true, data: bilan });
  } catch (error) {
    console.error('Erreur GET /api/oeuvres/bilan:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
