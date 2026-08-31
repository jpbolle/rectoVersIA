import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { sanitizeRessources } from '@/lib/ressources-server';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { generateDevoirId } from '@/lib/devoir-utils';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import {
  sanitizeLectureQuiz,
  lectureQuizForEleve,
  lectureQuizPourFirestore,
  lectureQuizDepuisFirestore,
} from '@/lib/lecture-server';
import { sanitizeAutoEvalQuiz } from '@/lib/autoevaluation-server';
import { atelierParDispositif, findAtelier, isTypeModal } from '@/types/didactique';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    let snapshot;
    try {
      // Chaque prof ne voit que ses propres devoirs
      if (auth.role === 'prof') {
        snapshot = await adminDb
          .collection('devoirs')
          .where('profId', '==', auth.uid)
          .orderBy('dateRemise', 'desc')
          .get();
      } else {
        snapshot = await adminDb
          .collection('devoirs')
          .orderBy('dateRemise', 'desc')
          .get();
      }
    } catch (queryError: unknown) {
      // Collection vide ou inexistante
      const error = queryError as { code?: number };
      if (error.code === 5) {
        return NextResponse.json({ success: true, data: [] });
      }
      throw queryError;
    }

    let devoirs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        classes: data.classes || [],
        dateRemise: data.dateRemise?.toDate?.()?.toISOString?.() || data.dateRemise || '',
        grille: data.grille || '',
        intitule: data.intitule || '',
        consignes: data.consignes || '',
        ressources: data.ressources || null,
        accesIA: data.accesIA ?? false,
        disponible: data.disponible ?? true,
        archive: data.archive ?? false,
        corrige: data.corrige ?? false,
        corrigeDisponible: data.corrigeDisponible ?? false,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
        anneeScolaire: data.anneeScolaire || '',
        profId: data.profId || '',
        typeTravail: data.typeTravail || 'ecrire',
        modePrincipal: data.modePrincipal || undefined,
        // Activités créées avant le champ : l'atelier se déduit du dispositif
        atelier: data.atelier || atelierParDispositif(data.typeTravail || 'ecrire').id,
        habiletes: Array.isArray(data.habiletes) ? data.habiletes : null,
        questionnaireId: data.questionnaireId || undefined,
        scenarisationRef: data.scenarisationRef || null,
        codeAcces: data.codeAcces || undefined,
        vocabulaireThemes: data.vocabulaireThemes || undefined,
        vocabulaireDiagnostic: data.vocabulaireDiagnostic ?? undefined,
        hiddenCriteria: data.hiddenCriteria || undefined,
        // Écrits à la création mais jusqu'ici absents de la liste : la
        // duplication les perdait faute de les recevoir.
        evaluation: data.evaluation === 'certificatif' ? 'certificatif' : 'formatif',
        flipInverted: data.flipInverted ?? false,
        autoEvaluation: data.autoEvaluation !== false,
        corrigeReference: data.corrigeReference || null,
        ressourcesToIA: data.ressourcesToIA ?? false,
        // Déballage des corrigés de matrice multiple (cf. lecture-server.ts) —
        // point de lecture unique : le filtrage élève plus bas repart d'ici.
        lectureQuiz: lectureQuizDepuisFirestore(data.lectureQuiz),
        autoEvalQuiz: data.autoEvalQuiz || null,
        // Lecture d'une œuvre : l'activité ne porte qu'un renvoi vers la
        // bibliothèque, jamais le contenu
        oeuvreId: data.oeuvreId || null,
        oeuvreChapitres: Array.isArray(data.oeuvreChapitres) ? data.oeuvreChapitres : null,
        oeuvreMinimum: typeof data.oeuvreMinimum === 'number' ? data.oeuvreMinimum : null,
        submittedCount: undefined as number | undefined,
      };
    });

    // Côté prof : nombre de copies remises par devoir.
    // Requêtes d'agrégation count() — pas de lecture de documents.
    if (auth.role === 'prof') {
      devoirs = await Promise.all(
        devoirs.map(async (d) => {
          try {
            if (d.typeTravail === 'rechercher') {
              // Une réponse NavigKid n'est écrite qu'à la soumission
              if (!d.questionnaireId) return { ...d, submittedCount: 0 };
              const agg = await adminDb
                .collection('questionnaires')
                .doc(d.questionnaireId)
                .collection('reponses')
                .count()
                .get();
              return { ...d, submittedCount: agg.data().count };
            }
            const agg = await adminDb
              .collection('travaux')
              .where('devoirId', '==', d.id)
              .where('status', '==', 'submitted')
              .count()
              .get();
            return { ...d, submittedCount: agg.data().count };
          } catch {
            // Le comptage ne doit jamais faire échouer la liste
            return d;
          }
        })
      );
    }

    // Côté élève, le corrigé de référence n'expose que la production du prof,
    // et uniquement quand la correction est disponible (jamais le plan)
    if (auth.role === 'eleve') {
      devoirs = devoirs.map((d) => ({
        ...d,
        corrigeReference:
          d.corrigeDisponible && d.corrigeReference?.production
            ? { production: d.corrigeReference.production }
            : null,
        // Quiz complet (bonnes réponses, réponses idéales, soulignage attendu)
        // dès que le corrigé est disponible, sinon version filtrée
        lectureQuiz: d.corrigeDisponible
          ? d.lectureQuiz || null
          : lectureQuizForEleve(d.lectureQuiz),
        // Auto-évaluation : rien à filtrer, il n'y a ni bonne réponse ni corrigé
        autoEvalQuiz: d.autoEvalQuiz || null,
      }));
    }

    // Enrichir chaque devoir avec les UAA de sa grille (jointure par nom de grille)
    const grilleNames = [...new Set(devoirs.map((d) => d.grille).filter(Boolean))];
    if (grilleNames.length > 0) {
      const grillesSnap = await adminDb.collection('grilles').get();
      const grillesByName = grillesSnap.docs.map((doc) => ({
        name: doc.data().name || '',
        profId: doc.data().profId || '',
        uaa: (doc.data().uaa || []) as number[],
      }));
      devoirs = devoirs.map((d) => {
        if (!d.grille) return d;
        // Priorite a la grille du meme prof (les noms peuvent se repeter entre profs)
        const match =
          grillesByName.find((g) => g.name === d.grille && g.profId === d.profId) ||
          grillesByName.find((g) => g.name === d.grille);
        return { ...d, uaa: match?.uaa || [] };
      });
    }

    // Les eleves ne voient que les devoirs disponibles ET assignes a leur(s) classe(s)
    if (auth.role === 'eleve') {
      const elevesSnap = await queryElevesByEmail(auth.email);
      const classeIds = elevesSnap.docs.map((doc) => doc.data().classeId);

      // devoir.classes contient des noms ("Formation"), eleve.classeId contient des IDs
      // → résoudre les IDs en noms de classes
      const classeNames: string[] = [];
      for (const cId of classeIds) {
        const classeDoc = await adminDb.collection('classes').doc(cId).get();
        if (classeDoc.exists) {
          classeNames.push(classeDoc.data()?.nom);
        }
      }

      devoirs = devoirs.filter(
        (d) => d.disponible === true && d.classes.some((c: string) => classeNames.includes(c))
      );
    }

    return NextResponse.json({ success: true, data: devoirs });
  } catch (error) {
    console.error('Erreur GET /api/devoirs:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Génère un code d'accès 6 caractères (alphabet réduit sans 0/O/1/I/L)
function generateCodeAcces(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      classes,
      dateRemise,
      grille,
      intitule,
      consignes,
      ressources,
      accesIA,
      disponible,
      typeTravail,
      modePrincipal,
      atelier,
      habiletes,
      evaluation,
      hiddenCriteria,
      questionnaire,
      vocabulaireConfig,
      flipInverted,
      autoEvaluation,
      corrigeReference,
      ressourcesToIA,
      lectureQuiz,
      autoEvalQuiz,
      oeuvreId,
      oeuvreChapitres,
      oeuvreMinimum,
    } = body;

    // Validation des champs requis. Seules les activités d'écriture s'appuient
    // sur une grille : lecture, recherche et vocabulaire portent leur
    // didactique dans leurs habiletés.
    // Classes et date de remise sont facultatives (activité préparée à l'avance).
    const grilleRequired = (typeTravail || 'ecrire') === 'ecrire';
    if (!Array.isArray(classes) || (grilleRequired && !grille) || !intitule) {
      return NextResponse.json(
        { success: false, message: 'Grille et intitulé requis' },
        { status: 400 }
      );
    }

    const id = generateDevoirId();
    const anneeScolaire = calculateSchoolYear();

    // Données de base du devoir
    const devoirData: Record<string, unknown> = {
      id,
      classes,
      // null (et non champ absent) : orderBy('dateRemise') exclurait le document
      dateRemise: dateRemise ? new Date(dateRemise) : null,
      grille,
      intitule,
      consignes: consignes || '',
      // Les ressources passent par le garde-fou : l'onglet Interactif y met du
      // code à exécuter, et le contrôle du navigateur ne contrôle rien.
      ressources: sanitizeRessources(ressources, { codeAutorise: auth.isAdmin }),
      accesIA: accesIA ?? false,
      disponible: disponible ?? true,
      archive: false,
      corrige: false,
      corrigeDisponible: false,
      createdAt: new Date(),
      anneeScolaire,
      profId: auth.uid,
      typeTravail: typeTravail || 'ecrire',
      // Didactique : compétence en jeu + atelier. Le dispositif reste
      // typeTravail — l'atelier ne fait que le nommer côté prof.
      modePrincipal: isTypeModal(modePrincipal) ? modePrincipal : null,
      atelier: findAtelier(atelier)?.id ?? atelierParDispositif(typeTravail || 'ecrire').id,
      // null = toutes les habiletés de l'atelier (cas par défaut)
      habiletes: Array.isArray(habiletes)
        ? habiletes.filter((h: unknown) => typeof h === 'string')
        : null,
      evaluation: evaluation === 'certificatif' ? 'certificatif' : 'formatif',
      flipInverted: flipInverted ?? false,
      // Absent = activé (activités antérieures au réglage)
      autoEvaluation: autoEvaluation !== false,
      // Horodatage de l'ouverture aux élèves (notifications)
      ...(disponible ?? true ? { disponibleAt: new Date() } : {}),
    };

    // Critères de la grille masqués pour ce devoir (ids)
    if (Array.isArray(hiddenCriteria) && hiddenCriteria.length > 0) {
      devoirData.hiddenCriteria = hiddenCriteria.filter((c: unknown) => typeof c === 'string');
    }

    // Corrigé de référence du prof (type ecrire uniquement) : plan + production
    // + toggles « corrigé IA » (quels contenus sont transmis à l'IA)
    if ((typeTravail || 'ecrire') === 'ecrire') {
      if (corrigeReference) {
        const ref: Record<string, unknown> = {};
        if (typeof corrigeReference.theme === 'string' && corrigeReference.theme.trim()) {
          ref.theme = corrigeReference.theme.trim();
          ref.planToIA = corrigeReference.planToIA === true;
        }
        if (Array.isArray(corrigeReference.plan) && corrigeReference.plan.length > 0) {
          ref.plan = corrigeReference.plan;
          ref.planToIA = corrigeReference.planToIA === true;
        }
        if (typeof corrigeReference.production === 'string' && corrigeReference.production.trim()) {
          ref.production = corrigeReference.production.trim();
          ref.productionToIA = corrigeReference.productionToIA === true;
        }
        if (Object.keys(ref).length > 0) {
          devoirData.corrigeReference = ref;
        }
      }
      devoirData.ressourcesToIA = ressourcesToIA === true;
    }

    // Si type "lire", questionnaire de lecture (nettoyé côté serveur)
    if (typeTravail === 'lire' && lectureQuiz) {
      const cleaned = sanitizeLectureQuiz(lectureQuiz);
      if (cleaned) devoirData.lectureQuiz = lectureQuizPourFirestore(cleaned);
    }

    // Lecture d'une œuvre : renvoi vers la bibliothèque + rythme attendu.
    // `dateRemise` se lit ici comme une ÉCHÉANCE DE LECTURE — rien ne se remet
    // dans cet atelier, le parcours reste ouvert.
    if (typeTravail === 'lire' && typeof oeuvreId === 'string' && oeuvreId) {
      devoirData.oeuvreId = oeuvreId;
      devoirData.oeuvreChapitres = Array.isArray(oeuvreChapitres)
        ? oeuvreChapitres.filter((c: unknown) => typeof c === 'string')
        : null;
      const minimum = Number(oeuvreMinimum);
      devoirData.oeuvreMinimum = Number.isFinite(minimum) && minimum > 0 ? Math.round(minimum) : null;
    }

    // Si type "autoevaluation", questionnaire d'auto-évaluation
    if (typeTravail === 'autoevaluation' && autoEvalQuiz) {
      const cleaned = sanitizeAutoEvalQuiz(autoEvalQuiz);
      if (cleaned) devoirData.autoEvalQuiz = cleaned;
    }

    // Si type "vocabulaire", stocker la config
    if (typeTravail === 'vocabulaire' && vocabulaireConfig) {
      devoirData.vocabulaireThemes = vocabulaireConfig.themes || [];
      devoirData.vocabulaireDiagnostic = vocabulaireConfig.diagnostic ?? false;
    }

    // Si type "rechercher", créer le questionnaire dans Firestore
    if (typeTravail === 'rechercher' && questionnaire) {
      const codeAcces = generateCodeAcces();
      const questionnaireRef = adminDb.collection('questionnaires').doc();
      const questionnaireId = questionnaireRef.id;

      await questionnaireRef.set({
        titre: intitule,
        theme: questionnaire.themes || '',
        consignes: consignes || '',
        questions: questionnaire.questions || [],
        codeAcces,
        profId: auth.uid,
        devoirId: id,
        archive: false,
        creeLe: new Date(),
      });

      devoirData.questionnaireId = questionnaireId;
      devoirData.codeAcces = codeAcces;
    }

    await adminDb.collection('devoirs').doc(id).set(devoirData);

    return NextResponse.json({
      success: true,
      data: { id, codeAcces: devoirData.codeAcces || null },
      message: `Devoir "${intitule}" cree avec succes`,
    });
  } catch (error) {
    console.error('Erreur POST /api/devoirs:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
