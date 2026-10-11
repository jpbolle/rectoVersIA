import { NextRequest, NextResponse } from 'next/server';
import { repliquerCorrection } from '@/lib/ecriture-groupe-server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { ecrireScoreLecture } from '@/lib/lecture-score-persistance';
import { accesDevoir, accesTravail, copieVisible, peutAgir } from '@/lib/classe-acces';
import type { Correction } from '@/types/correction';

// GET - Recuperer la correction d'un travail
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const travailId = searchParams.get('travailId');
  const devoirId = searchParams.get('devoirId');

  if (!travailId && !devoirId) {
    return NextResponse.json(
      { success: false, message: 'travailId ou devoirId requis' },
      { status: 400 }
    );
  }

  try {
    // Fetch par devoirId — retourne toutes les corrections du devoir
    if (devoirId && !travailId) {
      if (auth.role !== 'prof') {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }

      // L'auteur de l'activité, ou le titulaire / coprofesseur d'une de ses
      // classes — celui-ci ne reçoit que les corrections de SES copies
      const acces = await accesDevoir(devoirId, auth);
      if (!acces) {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }

      let mesCopies: Set<string> | null = null;
      if (acces.sessionIds) {
        const copies = await adminDb
          .collection('travaux')
          .where('devoirId', '==', devoirId)
          .select('sessionId')
          .get();
        mesCopies = new Set(
          copies.docs
            .filter((c) => copieVisible(acces, c.data().sessionId))
            .map((c) => c.id)
        );
      }

      const snapshot = await adminDb
        .collection('corrections')
        .where('devoirId', '==', devoirId)
        .get();

      const docs = mesCopies
        ? snapshot.docs.filter((d) => mesCopies!.has(String(d.data().travailId || '')))
        : snapshot.docs;

      const corrections: Correction[] = docs.map((doc) => {
        const data = doc.data();
        return {
          id: data.id || doc.id,
          travailId: data.travailId,
          devoirId: data.devoirId,
          studentId: data.studentId,
          profId: data.profId,
          profEmail: data.profEmail,
          evaluation: data.evaluation || {},
          commentaireGeneral: data.commentaireGeneral || '',
          commentaireGeneralAudio: data.commentaireGeneralAudio || undefined,
          commentairesCriteres: data.commentairesCriteres || {},
          questionScores: data.questionScores || {},
          rechercheScores: data.rechercheScores || {},
          autoEvalProf: data.autoEvalProf || {},
          schemaMarques: data.schemaMarques || undefined,
          score: data.score || 0,
          status: data.status || 'draft',
          visibleParEleve: data.visibleParEleve || false,
          annotatedContent: data.annotatedContent || undefined,
          audioAnnotations: data.audioAnnotations || [],
          draftAnnotations: data.draftAnnotations || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          finalizedAt: data.finalizedAt || null,
          version: data.version || 1,
        };
      });

      return NextResponse.json({ success: true, data: corrections });
    }

    // Fetch par travailId — retourne une seule correction.
    // Un prof doit avoir accès à la COPIE (avant le 2026-10-04, n'importe quel
    // compte prof lisait n'importe quelle correction par son adresse).
    if (auth.role === 'prof') {
      const travailSnap = await adminDb.collection('travaux').doc(travailId!).get();
      if (!travailSnap.exists || !(await accesTravail(travailSnap.data()!, auth))) {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }
    }

    const correctionId = `CORR-${travailId}`;
    const docRef = adminDb.collection('corrections').doc(correctionId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: true, data: null });
    }

    const data = docSnap.data()!;

    // Pour les élèves : vérifier que c'est bien leur travail
    if (auth.role === 'eleve') {
      if (data.studentId !== auth.uid) {
        return NextResponse.json(
          { success: false, message: 'Acces refuse' },
          { status: 403 }
        );
      }
    }

    // Les annotations du prof (texte souligné) sont toujours visibles pour l'élève.
    // L'évaluation (grille + note) n'est visible que si visibleParEleve = true.
    //
    // Écriture, conceptualisation, portfolio (triple bouton, 2026-10-11) : une
    // copie RENVOYÉE POUR RÉÉCRITURE montre à l'élève les corrections (annotations,
    // pastilles, statistiques) mais PAS encore la grille, la note ni le
    // commentaire général — ils n'arrivent qu'avec « Rendre comme corrigé »
    // (copie rendue). D'où `visible`, l'évaluation, distinct de `visibleParEleve`.
    let visible = data.visibleParEleve || false;
    if (auth.role === 'eleve' && visible) {
      const [travailSnap, devoirSnap] = await Promise.all([
        adminDb.collection('travaux').doc(String(data.travailId || travailId)).get(),
        adminDb.collection('devoirs').doc(String(data.devoirId || '')).get(),
      ]);
      const type = devoirSnap.data()?.typeTravail;
      const parCopie = type === 'ecrire' || type === 'schematiser' || type === 'portfolio';
      if (parCopie && travailSnap.data()?.status !== 'submitted') visible = false;
    }
    const correction: Correction = {
      id: data.id || docSnap.id,
      travailId: data.travailId,
      devoirId: data.devoirId,
      studentId: data.studentId,
      profId: data.profId,
      profEmail: data.profEmail,
      evaluation: (auth.role !== 'eleve' || visible) ? (data.evaluation || {}) : {},
      commentaireGeneral: (auth.role !== 'eleve' || visible) ? (data.commentaireGeneral || '') : '',
      commentaireGeneralAudio: (auth.role !== 'eleve' || visible) ? (data.commentaireGeneralAudio || undefined) : undefined,
      commentairesCriteres: data.commentairesCriteres || {},
      // Notes des questions ouvertes : même règle que le reste de la correction
      // — l'élève ne les voit qu'une fois le corrigé rendu
      questionScores: (auth.role !== 'eleve' || visible) ? (data.questionScores || {}) : {},
      // Recherche : notes et remarques du prof, même règle de visibilité
      rechercheScores: (auth.role !== 'eleve' || visible) ? (data.rechercheScores || {}) : {},
      // Auto-évaluation : le regard du prof ne se découvre à l'élève qu'avec
      // la correction — sinon il lui suffirait de recopier
      autoEvalProf: (auth.role !== 'eleve' || visible) ? (data.autoEvalProf || {}) : {},
      // Pastilles du schéma : comme les annotations d'une copie écrite, mais
      // seulement une fois la correction visible (renvoi pour réécriture ou corrigé)
      schemaMarques: (auth.role !== 'eleve' || data.visibleParEleve) ? (data.schemaMarques || undefined) : undefined,
      score: (auth.role !== 'eleve' || visible) ? (data.score || 0) : 0,
      status: data.status || 'draft',
      // La PUBLICATION (corrections visibles), pas l'évaluation : l'élève en
      // réécriture doit savoir qu'une correction l'attend
      visibleParEleve: data.visibleParEleve || false,
      evaluationVisible: auth.role !== 'eleve' || visible,
      annotatedContent: data.annotatedContent || undefined,
      audioAnnotations: data.audioAnnotations || [],
      draftAnnotations: data.draftAnnotations || undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      finalizedAt: data.finalizedAt || null,
      version: data.version || 1,
    };

    return NextResponse.json({ success: true, data: correction });
  } catch (error) {
    console.error('Erreur GET /api/corrections:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Creer une correction
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { travailId, devoirId, studentId } = body;

    if (!travailId || !devoirId || !studentId) {
      return NextResponse.json(
        { success: false, message: 'travailId, devoirId et studentId requis' },
        { status: 400 }
      );
    }

    // Corriger : l'auteur de l'activité, ou le titulaire / coprofesseur EN
    // ÉCRITURE de la classe de cette copie
    const travailSnap = await adminDb.collection('travaux').doc(travailId).get();
    if (!travailSnap.exists || travailSnap.data()!.devoirId !== devoirId) {
      return NextResponse.json({ success: false, message: 'Copie introuvable' }, { status: 404 });
    }
    const acces = await accesTravail(travailSnap.data()!, auth);
    if (!acces || !peutAgir(acces.acces)) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    const correctionId = `CORR-${travailId}`;
    const now = new Date().toISOString();

    const correction = {
      id: correctionId,
      travailId,
      devoirId,
      studentId,
      // ⚠ La correction appartient à l'AUTEUR DE L'ACTIVITÉ, pas à qui la
      // rédige : sinon un remplaçant qui corrige en deviendrait propriétaire,
      // et le titulaire, à son retour, ne pourrait plus la retoucher (403).
      // Qui l'a écrite est noté à part.
      profId: acces.devoir.devoir.profId || auth.uid,
      profEmail: auth.email,
      correcteurUid: auth.uid,
      evaluation: body.evaluation || {},
      commentaireGeneral: body.commentaireGeneral || '',
      commentairesCriteres: {},
      questionScores: {},
      rechercheScores: {},
      autoEvalProf: {},
      score: body.score || 0,
      status: 'draft',
      visibleParEleve: false,
      annotatedContent: null,
      audioAnnotations: [],
      createdAt: now,
      updatedAt: now,
      finalizedAt: null,
      version: 1,
    };

    await adminDb.collection('corrections').doc(correctionId).set(correction);
    // Copie de groupe (portfolio) : chaque membre reçoit la même correction
    await repliquerCorrection(travailId).catch((e) => console.error('Réplication de la correction :', e));

    // Un questionnaire entièrement auto-corrigé a déjà sa note à la création :
    // rien n'attend le prof. Sans cet appel, sa correction resterait sans
    // total tant qu'il ne toucherait pas une question ouverte — qu'elle n'a pas.
    await ecrireScoreLecture(adminDb, correctionId);

    return NextResponse.json({
      success: true,
      data: correction,
      message: 'Correction creee',
    });
  } catch (error) {
    console.error('Erreur POST /api/corrections:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
