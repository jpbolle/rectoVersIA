import { NextRequest, NextResponse } from 'next/server';
import { repliquerCorrection, repliquerEtatCopie } from '@/lib/ecriture-groupe-server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { ecrireScoreLecture } from '@/lib/lecture-score-persistance';
import { accesTravail, peutAgir } from '@/lib/classe-acces';
import type { UpdateCorrectionData } from '@/types/correction';

// PATCH - Mettre a jour une correction
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body: UpdateCorrectionData = await request.json();

    const docRef = adminDb.collection('corrections').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Correction non trouvee' },
        { status: 404 }
      );
    }

    // Qui peut retoucher une correction : la COPIE en décide, plus le seul
    // `profId` de la correction — l'auteur de l'activité (sur une classe qu'on
    // ne lui a pas retirée), ou le titulaire / coprofesseur EN ÉCRITURE de la
    // classe (2026-10-04). Copie disparue : l'ancienne porte, en repli.
    const travailSnap = await adminDb
      .collection('travaux')
      .doc(String(docSnap.data()?.travailId || ''))
      .get();
    const autorise = travailSnap.exists
      ? peutAgir((await accesTravail(travailSnap.data()!, auth))?.acces)
      : docSnap.data()?.profId === auth.uid;
    if (!autorise) {
      return NextResponse.json(
        { success: false, message: 'Acces refuse' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.evaluation !== undefined) {
      updateData.evaluation = body.evaluation;
    }

    if (body.commentaireGeneral !== undefined) {
      updateData.commentaireGeneral = body.commentaireGeneral;
    }

    if (body.commentairesCriteres !== undefined) {
      updateData.commentairesCriteres = body.commentairesCriteres;
    }

    if (body.score !== undefined) {
      updateData.score = body.score;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'finalized') {
        updateData.finalizedAt = new Date().toISOString();
      }
    }

    if (body.visibleParEleve !== undefined) {
      updateData.visibleParEleve = body.visibleParEleve;
      // Horodatage de la mise à disposition (notifications élève)
      if (body.visibleParEleve === true && docSnap.data()?.visibleParEleve !== true) {
        updateData.visibleAt = new Date().toISOString();
      }
    }

    if (body.annotatedContent !== undefined) {
      updateData.annotatedContent = body.annotatedContent;
    }

    if (body.audioAnnotations !== undefined) {
      updateData.audioAnnotations = body.audioAnnotations;
    }

    if (body.questionScores !== undefined) {
      // Points des questions ouvertes d'un questionnaire de lecture
      const raw = body.questionScores;
      const clean: Record<string, number> = {};
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) clean[k] = v;
        }
      }
      updateData.questionScores = clean;
    }

    if (body.rechercheScores !== undefined) {
      // Activité de recherche : deux notes + deux commentaires par question
      const raw = body.rechercheScores;
      const clean: Record<string, Record<string, number | string>> = {};
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (!v || typeof v !== 'object') continue;
          const src = v as Record<string, unknown>;
          const entry: Record<string, number | string> = {};
          for (const champ of ['reponse', 'demarche'] as const) {
            const n = src[champ];
            if (typeof n === 'number' && Number.isFinite(n) && n >= 0) entry[champ] = n;
          }
          for (const champ of ['reponseComment', 'demarcheComment'] as const) {
            const t = src[champ];
            if (typeof t === 'string' && t.trim()) entry[champ] = t;
          }
          if (Object.keys(entry).length) clean[k] = entry;
        }
      }
      updateData.rechercheScores = clean;
    }

    if (body.autoEvalProf !== undefined) {
      // Auto-évaluation : le regard du prof, une position par question.
      // Ce n'est pas une note — d'où l'absence de barème à valider ici.
      const raw = body.autoEvalProf;
      const clean: Record<string, { echelon?: string; likert?: number }> = {};
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (!v || typeof v !== 'object') continue;
          const src = v as Record<string, unknown>;
          const entry: { echelon?: string; likert?: number } = {};
          if (typeof src.echelon === 'string' && src.echelon.trim()) {
            entry.echelon = src.echelon.trim().slice(0, 40);
          }
          if (typeof src.likert === 'number' && Number.isFinite(src.likert) && src.likert > 0) {
            entry.likert = Math.min(5, Math.round(src.likert));
          }
          if (Object.keys(entry).length) clean[k.slice(0, 60)] = entry;
        }
      }
      updateData.autoEvalProf = clean;
    }
    if (body.schemaMarques !== undefined) {
      // Pastilles du schéma : deux dictionnaires id → 'ok' | 'faux', bornés
      const nettoyer = (raw: unknown) => {
        const out: Record<string, 'ok' | 'faux'> = {};
        if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 500)) {
            if ((v === 'ok' || v === 'faux') && k.length <= 80) out[k] = v;
          }
        }
        return out;
      };
      const raw = (body.schemaMarques ?? {}) as { boites?: unknown; liens?: unknown };
      updateData.schemaMarques = { boites: nettoyer(raw.boites), liens: nettoyer(raw.liens) };
    }
    if (body.draftAnnotations !== undefined) {
      updateData.draftAnnotations = body.draftAnnotations;
    }

    if (body.commentaireGeneralAudio !== undefined) {
      updateData.commentaireGeneralAudio = body.commentaireGeneralAudio;
    }

    await docRef.update(updateData);

    // RENDRE VISIBLE = la copie est RENDUE (JP, 2026-10-11) : qu'il l'ait remise
    // lui-même ou non — la remise n'est qu'une indication pour le prof —, la
    // copie corrigée et publiée se verrouille chez l'élève, et l'onglet
    // « Corrigé » s'ouvre. « Remettre la copie à l'élève » la rouvre.
    // Pas pour une séquence FLE (sa copie vit d'étape en étape) ni pour une
    // copie constatée « non rendu ». Le portfolio, oui (triple bouton de JP).
    if (body.visibleParEleve === true && travailSnap.exists) {
      const travail = travailSnap.data()!;
      if (travail.status !== 'submitted' && !travail.nonRendu) {
        const devoirSnap = await adminDb.collection('devoirs').doc(String(travail.devoirId || '')).get();
        const type = devoirSnap.data()?.typeTravail;
        if (type !== 'sequence') {
          await travailSnap.ref.update({
            status: 'submitted',
            submittedAt: travail.submittedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    // COPIE DE GROUPE (portfolio, 2026-10-11) : le prof corrige une fois, chaque
    // membre reçoit la même correction — et, publiée, la même copie rendue
    if (travailSnap.exists) {
      try {
        await repliquerCorrection(travailSnap.id);
        if (body.visibleParEleve === true) {
          const apres = (await travailSnap.ref.get()).data();
          if (apres?.status === 'submitted') {
            await repliquerEtatCopie(travailSnap.id, { status: 'submitted', submittedAt: apres.submittedAt ?? new Date().toISOString() });
          }
        }
      } catch (e) {
        console.error('Réplication de la correction :', e);
      }
    }

    // Le total d'un questionnaire de lecture n'existe nulle part ailleurs :
    // `score` ne vaut que pour les grilles. On l'écrit ici, à chaque
    // enregistrement — sans quoi KitSchool importe 0 % (vécu le 2026-09-21).
    // Sur une activité qui n'est pas de la lecture, l'appel ne fait rien.
    await ecrireScoreLecture(adminDb, id);

    return NextResponse.json({
      success: true,
      message: 'Correction mise a jour',
    });
  } catch (error) {
    console.error('Erreur PATCH /api/corrections/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
