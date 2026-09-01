import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { quizDuDevoir } from '@/lib/questionnaire-lecture-server';
import {
  assurerFigeage,
  classesDeLEleve,
  figerQuizDeLaSession,
  etatEffectif,
  quizFigeDeSession,
  sessionsDeLEleve,
  sessionsDuDevoir,
  syncSessions,
} from '@/lib/session-server';
import { verifyAuth } from '@/lib/api-auth';
import { sanitizeRessources } from '@/lib/ressources-server';
import {
  sanitizeLectureQuiz,
  lectureQuizForEleve,
  lectureQuizPourFirestore,
  lectureQuizDepuisFirestore,
  computeLectureResume,
} from '@/lib/lecture-server';
import { parseLectureAnswers, type LectureResume } from '@/types/lecture';
import { sanitizeAutoEvalQuiz } from '@/lib/autoevaluation-server';
import { generateTravailId } from '@/lib/travail-utils';
import { atelierParDispositif, isTypeModal } from '@/types/didactique';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection('devoirs').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    const data = docSnap.data()!;

    // Les profs ne voient que leurs propres devoirs
    if (auth.role === 'prof' && data.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Acces refuse' },
        { status: 403 }
      );
    }

    // ── L'ÉTAT DÉPEND DE SA CLASSE ──
    // Ouverture et corrigé vivent sur la SESSION (une activité, une classe) :
    // la 4C peut avoir son corrigé quand la 4D passe encore l'épreuve.
    // Aucune session pour cet élève ⇒ on lit les drapeaux de l'activité, comme
    // avant. C'est ce repli qui rend la migration indolore.
    let etat = {
      disponible: data.disponible ?? true,
      corrigeDisponible: data.corrigeDisponible === true,
      dateRemise: null as string | null,
      parSession: false,
    };
    // La copie FIGÉE du questionnaire de sa session, s'il y en a une : c'est
    // elle qui fait foi, pas la version courante de la bibliothèque.
    let quizFige: unknown = null;
    if (auth.role === 'eleve') {
      const mesClasses = await classesDeLEleve(auth.uid, auth.email);
      const mes = await sessionsDeLEleve(data.id || docSnap.id, mesClasses);
      etat = etatEffectif(
        { disponible: data.disponible, corrigeDisponible: data.corrigeDisponible },
        mes.sessions
      );
      // Rattrapage : une session née ouverte (migration, classe ajoutée après
      // coup) n'est jamais passée par le figeage. Elle prend sa copie ici, au
      // plus tard — sinon une retouche du questionnaire dans la bibliothèque
      // changerait l'épreuve sous les yeux de la classe.
      // Réservé aux activités de lecture : ailleurs il n'y a pas de
      // questionnaire, et le rattrapage coûterait deux lectures par ouverture.
      quizFige =
        data.typeTravail === 'lire'
          ? await assurerFigeage(data.id || docSnap.id, mes.sessions, mes.quizFige)
          : mes.quizFige;
    } else if (auth.role === 'prof') {
      // ── LE PROF LIT CE QUE SA CLASSE A EU ──
      // Il n'a pas de classe à lui : c'est la copie qu'il ouvre qui porte le
      // `sessionId`. Sans ce paramètre il corrigeait sur la version courante
      // de la bibliothèque, où une question a pu être ajoutée depuis.
      const sessionDemandee = request.nextUrl.searchParams.get('sessionId');
      if (sessionDemandee) {
        quizFige = await quizFigeDeSession(sessionDemandee, auth.uid);
      }
    }

    // Les eleves ne peuvent voir que les devoirs disponibles
    if (auth.role === 'eleve' && !etat.disponible) {
      return NextResponse.json(
        { success: false, message: 'Devoir non disponible' },
        { status: 403 }
      );
    }

    // Corrigé réservé à ceux qui ont rendu : une copie marquée « non rendu »
    // n'y a pas accès, même si le prof l'a ouvert pour toute la classe
    let corrigeAccessible = auth.role === 'eleve' ? etat.corrigeDisponible : (data.corrigeDisponible ?? false);
    if (auth.role === 'eleve' && corrigeAccessible) {
      const travailSnap = await adminDb
        .collection('travaux')
        .doc(`TRV-${data.id || docSnap.id}-${auth.uid}`)
        .get();
      if (travailSnap.exists && travailSnap.data()!.nonRendu) {
        corrigeAccessible = false;
      }
    }

    // Questionnaire de lecture : l'onglet Évaluation calcule le score CÔTÉ
    // CLIENT (lecture-scoring). Sans `correctIndex` ni `fluoAttendu`, les QCM
    // et les soulignages sortent du total et l'élève lit un score amputé sans
    // savoir pourquoi. Le quiz complet part donc aussi dès que SA correction
    // lui est rendue visible — ce qui ne bascule pas le questionnaire en mode
    // corrigé pour autant : celui-ci suit `corrigeDisponible` (voir
    // `showCorrection` dans /activites/[id]). Même règle que les QCM d'une
    // recherche dans /api/navigkid/questionnaire.
    // Le corrigé d'une matrice à réponses multiples est stocké EMBALLÉ
    // (cf. lecture-server.ts) : on le déballe une seule fois ici, tout ce qui
    // suit repart de cette variable et jamais de `data.lectureQuiz`.
    // Le questionnaire peut venir de trois endroits (copie figée de la
    // session, bibliothèque, ou embarqué dans l'activité). `quizDuDevoir`
    // tranche l'ordre une fois pour toutes — voir questionnaire-lecture-server.
    const lectureQuiz = await quizDuDevoir(data, quizFige ? { quizFige } : null);

    let quizComplet = corrigeAccessible;
    if (auth.role === 'eleve' && !quizComplet && lectureQuiz) {
      const correctionSnap = await adminDb
        .collection('corrections')
        .doc(`CORR-${generateTravailId(data.id || docSnap.id, auth.uid)}`)
        .get();
      quizComplet = correctionSnap.exists && correctionSnap.data()!.visibleParEleve === true;
    }

    // Récapitulatif de remise : le seul chiffre dont l'élève dispose entre son
    // envoi et la correction du prof. Calculé ICI parce que le corrigé n'existe
    // qu'ici — le quiz envoyé au navigateur en est expurgé. Sans intérêt une
    // fois la correction rendue (l'onglet Évaluation dit alors mieux).
    let lectureResume: LectureResume | null = null;
    if (auth.role === 'eleve' && !quizComplet && lectureQuiz) {
      const travailSnap = await adminDb
        .collection('travaux')
        .doc(generateTravailId(data.id || docSnap.id, auth.uid))
        .get();
      const travail = travailSnap.exists ? travailSnap.data()! : null;
      if (travail?.status === 'submitted') {
        lectureResume = computeLectureResume(
          lectureQuiz,
          parseLectureAnswers(travail.content)?.answers ?? null
        );
      }
    }

    const devoir = {
      id: data.id || docSnap.id,
      classes: data.classes || [],
      dateRemise: data.dateRemise?.toDate?.()?.toISOString?.() || data.dateRemise || '',
      grille: data.grille || '',
      intitule: data.intitule || '',
      consignes: data.consignes || '',
      ressources: data.ressources || null,
      scenarisationRef: data.scenarisationRef || null,
      accesIA: data.accesIA ?? false,
      // L'ouverture telle que CET utilisateur la voit : la session de sa
      // classe pour un élève, le drapeau de l'activité pour le prof.
      disponible: etat.disponible,
      archive: data.archive ?? false,
      corrige: data.corrige ?? false,
      corrigeDisponible: corrigeAccessible,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      anneeScolaire: data.anneeScolaire || '',
      profId: data.profId || '',
      typeTravail: data.typeTravail || 'ecrire',
      modePrincipal: data.modePrincipal || undefined,
      // Activités créées avant le champ : l'atelier se déduit du dispositif
      atelier: data.atelier || atelierParDispositif(data.typeTravail || 'ecrire').id,
      habiletes: Array.isArray(data.habiletes) ? data.habiletes : null,
      questionnaireId: data.questionnaireId || null,
      codeAcces: data.codeAcces || null,
      vocabulaireThemes: data.vocabulaireThemes || undefined,
      vocabulaireDiagnostic: data.vocabulaireDiagnostic ?? undefined,
      hiddenCriteria: data.hiddenCriteria || undefined,
      flipInverted: data.flipInverted ?? false,
      autoEvaluation: data.autoEvaluation !== false,
      ressourcesToIA: data.ressourcesToIA ?? false,
      // Côté élève : seule la production est exposée, et uniquement quand la
      // correction est disponible (jamais le plan de référence)
      corrigeReference:
        auth.role === 'eleve'
          ? (corrigeAccessible && data.corrigeReference?.production
              ? { production: data.corrigeReference.production }
              : null)
          : data.corrigeReference || null,
      // Questionnaire de lecture : bonnes réponses filtrées côté élève tant
      // que ni le corrigé ni sa correction ne lui sont ouverts (voir
      // `quizComplet` plus haut)
      lectureQuiz:
        auth.role === 'eleve' && !quizComplet
          ? lectureQuizForEleve(lectureQuiz)
          : lectureQuiz,
      // Auto-évaluation : servie telle quelle, il n'y a rien à cacher
      autoEvalQuiz: data.autoEvalQuiz || null,
      // Lecture d'une œuvre : un renvoi vers la bibliothèque, le contenu vit
      // dans /api/oeuvres. Rien à filtrer — dans CET atelier, le corrigé est
      // ouvert (cf. src/lib/oeuvre-server.ts).
      oeuvreId: data.oeuvreId || null,
      oeuvreChapitres: Array.isArray(data.oeuvreChapitres) ? data.oeuvreChapitres : null,
      oeuvreMinimum: typeof data.oeuvreMinimum === 'number' ? data.oeuvreMinimum : null,
      // Enrichi à la lecture, jamais stocké (comme `uaa` et `submittedCount`)
      lectureResume,
    };

    return NextResponse.json({ success: true, data: devoir });
  } catch (error) {
    console.error('Erreur GET /api/devoirs/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const docRef = adminDb.collection('devoirs').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    // Verifier que le devoir appartient au prof
    if (docSnap.data()?.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Acces refuse' },
        { status: 403 }
      );
    }

    // Champs modifiables
    const updateData: Record<string, unknown> = {};

    if (body.disponible !== undefined) {
      updateData.disponible = body.disponible;
      // Horodatage de l'ouverture aux élèves (notifications)
      if (body.disponible === true && docSnap.data()?.disponible !== true) {
        updateData.disponibleAt = new Date();
      }
    }
    if (body.accesIA !== undefined) {
      updateData.accesIA = body.accesIA;
    }
    if (body.classes !== undefined) {
      updateData.classes = body.classes;
    }
    if (body.dateRemise !== undefined) {
      // Date facultative : null plutôt qu'une Invalid Date
      updateData.dateRemise = body.dateRemise ? new Date(body.dateRemise) : null;
    }
    if (body.grille !== undefined) {
      updateData.grille = body.grille;
    }
    if (body.intitule !== undefined) {
      updateData.intitule = body.intitule;
    }
    if (body.consignes !== undefined) {
      updateData.consignes = body.consignes;
    }
    if (body.ressources !== undefined) {
      // Même garde-fou qu'à la création (voir ressources-server.ts).
      updateData.ressources = sanitizeRessources(body.ressources, {
        codeAutorise: auth.isAdmin,
      });
    }
    if (body.evaluation !== undefined) {
      updateData.evaluation = body.evaluation === 'certificatif' ? 'certificatif' : 'formatif';
    }
    if (body.modePrincipal !== undefined) {
      updateData.modePrincipal = isTypeModal(body.modePrincipal) ? body.modePrincipal : null;
    }
    if (body.habiletes !== undefined) {
      // null = toutes les habiletés de l'atelier (pas de sélection explicite)
      updateData.habiletes = Array.isArray(body.habiletes)
        ? body.habiletes.filter((h: unknown) => typeof h === 'string')
        : null;
    }
    if (body.hiddenCriteria !== undefined) {
      // Critères masqués pour ce devoir — tableau d'ids (vide = tout évaluer)
      updateData.hiddenCriteria = Array.isArray(body.hiddenCriteria)
        ? body.hiddenCriteria.filter((c: unknown) => typeof c === 'string')
        : [];
    }
    if (body.archive !== undefined) {
      updateData.archive = body.archive;
    }
    if (body.corrige !== undefined) {
      updateData.corrige = body.corrige;
    }
    if (body.corrigeDisponible !== undefined) {
      updateData.corrigeDisponible = body.corrigeDisponible;
      // Horodatage de la mise à disposition du corrigé (notifications élève)
      if (body.corrigeDisponible === true && docSnap.data()?.corrigeDisponible !== true) {
        updateData.corrigeDisponibleAt = new Date();
      }
    }
    if (body.autoEvaluation !== undefined) {
      updateData.autoEvaluation = body.autoEvaluation;
    }
    if (body.flipInverted !== undefined) {
      updateData.flipInverted = body.flipInverted;
    }
    if (body.corrigeReference !== undefined) {
      updateData.corrigeReference = body.corrigeReference;
    }
    if (body.ressourcesToIA !== undefined) {
      updateData.ressourcesToIA = body.ressourcesToIA;
    }
    // Renvoi vers la bibliothèque. `null` le rompt : l'activité retombe alors
    // sur le questionnaire qu'elle porte en propre.
    if (body.lectureQuizId !== undefined) {
      updateData.lectureQuizId =
        typeof body.lectureQuizId === 'string' && body.lectureQuizId ? body.lectureQuizId : null;
    }
    if (body.lectureQuiz !== undefined) {
      updateData.lectureQuiz =
        body.lectureQuiz === null
          ? null
          : lectureQuizPourFirestore(sanitizeLectureQuiz(body.lectureQuiz));
    }

    if (body.oeuvreId !== undefined) {
      updateData.oeuvreId = typeof body.oeuvreId === 'string' && body.oeuvreId ? body.oeuvreId : null;
    }
    if (body.oeuvreChapitres !== undefined) {
      updateData.oeuvreChapitres = Array.isArray(body.oeuvreChapitres)
        ? body.oeuvreChapitres.filter((c: unknown) => typeof c === 'string')
        : null;
    }
    if (body.oeuvreMinimum !== undefined) {
      const minimum = Number(body.oeuvreMinimum);
      updateData.oeuvreMinimum = Number.isFinite(minimum) && minimum > 0 ? Math.round(minimum) : null;
    }

    if (body.autoEvalQuiz !== undefined) {
      updateData.autoEvalQuiz =
        body.autoEvalQuiz === null ? null : sanitizeAutoEvalQuiz(body.autoEvalQuiz);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: 'Aucune donnee a mettre a jour' },
        { status: 400 }
      );
    }

    await docRef.update(updateData);

    // Les classes ont changé : créer les sessions manquantes. Une classe
    // retirée garde la sienne — ses élèves ont des copies (cf. syncSessions).
    if (body.classes !== undefined) {
      try {
        await syncSessions(id);
      } catch (err) {
        console.error('Erreur syncSessions (édition):', err);
      }
    }

    // ── UN GESTE AU NIVEAU DE L'ACTIVITÉ VAUT POUR TOUTES SES CLASSES ──
    // C'est ce qui donne « ouvrir pour toutes les classes » sans bouton
    // supplémentaire : basculer l'activité descend sur chacune de ses sessions.
    // Sans cette descente, les deux niveaux se contrediraient et l'élève
    // continuerait de lire l'état de sa session, resté en arrière.
    const versSessions: Record<string, unknown> = {};
    if (body.disponible !== undefined) {
      versSessions.disponible = body.disponible === true;
      if (body.disponible === true) versSessions.disponibleAt = new Date();
    }
    if (body.corrigeDisponible !== undefined) {
      versSessions.corrigeDisponible = body.corrigeDisponible === true;
      if (body.corrigeDisponible === true) versSessions.corrigeDisponibleAt = new Date();
    }
    if (body.archive !== undefined) versSessions.archive = body.archive === true;
    if (body.dateRemise !== undefined) {
      versSessions.dateRemise = body.dateRemise ? new Date(body.dateRemise) : null;
    }
    if (Object.keys(versSessions).length > 0) {
      try {
        const sessions = await sessionsDuDevoir(id);
        if (sessions.length > 0) {
          const batch = adminDb.batch();
          sessions.forEach((s) =>
            batch.update(adminDb.collection('sessions').doc(s.id), {
              ...versSessions,
              updatedAt: new Date(),
            })
          );
          await batch.commit();

          // Ouvrir depuis l'activité, c'est ouvrir chaque classe : chacune
          // fige donc sa copie du questionnaire, comme si on les avait
          // ouvertes une à une.
          if (versSessions.disponible === true) {
            await Promise.all(sessions.map((s) => figerQuizDeLaSession(s.id, id)));
          }
        }
      } catch (err) {
        console.error('Erreur propagation aux sessions:', err);
      }
    }

    // Si corrigeDisponible change, bulk-set visibleParEleve sur toutes les corrections du devoir
    if (body.corrigeDisponible !== undefined) {
      const correctionsSnap = await adminDb
        .collection('corrections')
        .where('devoirId', '==', id)
        .get();

      if (!correctionsSnap.empty) {
        const batch = adminDb.batch();
        for (const doc of correctionsSnap.docs) {
          batch.update(doc.ref, { visibleParEleve: body.corrigeDisponible });
        }
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Devoir mis a jour avec succes',
    });
  } catch (error) {
    console.error('Erreur PATCH /api/devoirs/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection('devoirs').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    // Verifier que le devoir appartient au prof
    if (docSnap.data()?.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Acces refuse' },
        { status: 403 }
      );
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Devoir supprime avec succes',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/devoirs/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
