import { NextRequest, NextResponse } from 'next/server';
import { schemaPourFirestore } from '@/lib/schema-devoir';
import { adminDb } from '@/lib/firebase/admin';
import { lireQuestionnaire } from '@/lib/questionnaire-lecture-server';
import { generateQuestionnaireLectureId } from '@/types/questionnaire-lecture';
import type { LectureQuiz } from '@/types/lecture';
import {
  classesDeLEleve,
  etatEffectif,
  sessionsParDevoir,
  syncSessions,
} from '@/lib/session-server';
import { eleveExclu, lireSequenceFle, restrictionElevesPourFirestore, sequenceFlePourFirestore } from '@/lib/sequence-server';
import { lirePortfolioContenu, portfolioContenuPourFirestore } from '@/lib/portfolio-server';
import { verifyAuth } from '@/lib/api-auth';
import { classesAccessibles, nomDuProf } from '@/lib/classe-acces';
import { sanitizeRessources } from '@/lib/ressources-server';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { generateDevoirId } from '@/lib/devoir-utils';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import {
  avertissementQuestionsJetees,
  sanitizeLectureQuiz,
  lectureQuizForEleve,
  lectureQuizEnDirectPourEleve,
  lectureQuizPourFirestore,
  lectureQuizDepuisFirestore,
} from '@/lib/lecture-server';
import { sanitizeAutoEvalQuiz, sanitizeSondageReglages } from '@/lib/autoevaluation-server';
import { atelierParDispositif, estSondageEnDirect, findAtelier, isTypeModal } from '@/types/didactique';

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

    const versDevoir = (doc: FirebaseFirestore.DocumentSnapshot) => {
      const data = doc.data() ?? {};
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
        // Horodatage de l'ouverture : « a-t-elle déjà été ouverte ? » (élève, archives)
        disponibleAt: data.disponibleAt?.toDate?.()?.toISOString?.() || data.disponibleAt || null,
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
        // Résolu plus bas (`quizDuDevoir`) : la liste peut compter des
        // dizaines d'activités, on ne lit la bibliothèque que pour celles qui
        // y renvoient vraiment.
        lectureQuizId: data.lectureQuizId ?? null,
        lectureMode: data.lectureMode ?? null,
        hiddenQuestions: Array.isArray(data.hiddenQuestions) ? data.hiddenQuestions : null,
        lectureQuiz: lectureQuizDepuisFirestore(data.lectureQuiz),
        autoEvalQuiz: data.autoEvalQuiz || null,
        // Sondage : ses réglages (absent = repli selon l'atelier, cf. reglagesSondage)
        sondage: data.sondage ? sanitizeSondageReglages(data.sondage) : null,
        // Lecture d'une œuvre : l'activité ne porte qu'un renvoi vers la
        // bibliothèque, jamais le contenu
        oeuvreId: data.oeuvreId || null,
        oeuvreChapitres: Array.isArray(data.oeuvreChapitres) ? data.oeuvreChapitres : null,
        oeuvreMinimum: typeof data.oeuvreMinimum === 'number' ? data.oeuvreMinimum : null,
        // Élèves concernés : null = toute la classe
        eleves: Array.isArray(data.eleves) ? (data.eleves as string[]) : null,
        // Séquence FLE : le parcours (modules)
        sequenceFle: data.typeTravail === 'sequence' ? lireSequenceFle(data.sequenceFle) : null,
        // Portfolio d'apprentissage : ses étapes
        portfolio: data.typeTravail === 'portfolio' ? lirePortfolioContenu(data.portfolio) : null,
        // Activité FLE : rangée dans Mes Ressources › Modules FLE, pas au tableau de bord
        referentiel: data.referentiel === 'fle' ? ('fle' as const) : null,
        submittedCount: undefined as number | undefined,
        monAcces: undefined as 'titulaire' | 'edition' | 'lecture' | undefined,
        auteurNom: undefined as string | undefined,
        mesClasses: undefined as string[] | undefined,
      };
    };

    let devoirs = snapshot.docs.map(versDevoir);

    // ── LES ACTIVITÉS DES AUTRES SUR MES CLASSES (coprofesseur, 2026-10-04) ──
    // Celles du titulaire pour le remplaçant, celles du remplaçant pour le
    // titulaire. Elles passent par les mêmes enrichissements que les miennes,
    // puis repartent dans un panier À PART (`partagees`) : `data` ne change
    // pas, et aucun écran existant ne les reçoit sans l'avoir demandé.
    // Le compte des copies remises s'y limite à MES sessions.
    const idsPartagees = new Set<string>();
    const mesSessionsParDevoir = new Map<string, string[]>();
    // L'état que JE vois d'une activité partagée : celui de MES sessions —
    // archivée quand elles le sont toutes, ouverte dès que l'une l'est
    const etatDeMesSessions = new Map<string, { archive: boolean; disponible: boolean }>();
    if (auth.role === 'prof') {
      const accessibles = await classesAccessibles(auth);
      const accesParDevoir = new Map<string, Set<string>>();
      // Seules les classes PARTAGÉES (avec moi, ou par moi) peuvent porter
      // l'activité d'un autre : inutile de relire les sessions des autres
      const classeIds = [...accessibles.entries()].filter(([, c]) => c.partagee).map(([id]) => id);
      for (let i = 0; i < classeIds.length; i += 30) {
        const sessionsSnap = await adminDb
          .collection('sessions')
          .where('classeId', 'in', classeIds.slice(i, i + 30))
          .get();
        sessionsSnap.docs.forEach((d) => {
          const s = d.data();
          if (s.profId === auth.uid) return; // une activité à moi : déjà listée
          const devoirId = String(s.devoirId || '');
          const classeId = String(s.classeId || '');
          if (!devoirId) return;
          mesSessionsParDevoir.set(devoirId, [...(mesSessionsParDevoir.get(devoirId) ?? []), d.id]);
          const etat = etatDeMesSessions.get(devoirId) ?? { archive: true, disponible: false };
          etatDeMesSessions.set(devoirId, {
            archive: etat.archive && s.archive === true,
            disponible: etat.disponible || s.disponible === true,
          });
          accesParDevoir.set(devoirId, new Set([...(accesParDevoir.get(devoirId) ?? []), classeId]));
        });
      }
      const autres = await Promise.all(
        [...accesParDevoir.keys()].map((id) => adminDb.collection('devoirs').doc(id).get())
      );
      const noms = new Map<string, string>();
      for (const doc of autres) {
        if (!doc.exists) continue;
        const d = versDevoir(doc);
        const classes = [...(accesParDevoir.get(doc.id) ?? [])]
          .map((c) => accessibles.get(c))
          .filter((c): c is { acces: 'titulaire' | 'edition' | 'lecture'; nom: string; partagee: boolean } => !!c);
        if (!noms.has(d.profId)) noms.set(d.profId, await nomDuProf(d.profId));
        idsPartagees.add(d.id);
        devoirs.push({
          ...d,
          ...(etatDeMesSessions.get(doc.id) ?? {}),
          // Le meilleur de mes accès sur ses classes : agir dans l'une suffit
          // à pouvoir ouvrir la page des copies en écriture (chaque session
          // garde, elle, son propre droit — cf. /api/sessions)
          monAcces: classes.some((c) => c.acces !== 'lecture')
            ? classes.some((c) => c.acces === 'titulaire') ? 'titulaire' : 'edition'
            : 'lecture',
          auteurNom: noms.get(d.profId),
          mesClasses: classes.map((c) => c.nom).sort(),
        });
      }
    }

    // ── Les questionnaires de la BIBLIOTHÈQUE ──
    // Une activité qui y renvoie doit servir le questionnaire de la
    // bibliothèque, pas la copie qu'elle porte encore. On ne lit que les
    // références réellement présentes, et chacune une seule fois.
    const refs = [...new Set(devoirs.map((d) => d.lectureQuizId).filter(Boolean))] as string[];
    if (refs.length > 0) {
      const bibliotheque = new Map<string, LectureQuiz | null>();
      await Promise.all(
        refs.map(async (id) => {
          const q = await lireQuestionnaire(id);
          if (q) bibliotheque.set(id, q.quiz);
        })
      );
      devoirs = devoirs.map((d) => {
        if (!d.lectureQuizId || !bibliotheque.has(d.lectureQuizId)) return d;
        const quiz = bibliotheque.get(d.lectureQuizId)!;
        // Le mode de l'ACTIVITÉ prime sur celui de la ressource — même règle
        // que `quizDuDevoir`, appliquée ici parce que cette liste court-circuite
        // cette fonction pour ne lire la bibliothèque qu'une fois par référence.
        if (!quiz) return { ...d, lectureQuiz: quiz };
        // ⚠ On ne retire PAS ici les questions écartées : cette liste alimente
        // l'écran d'édition du prof, qui doit continuer à les voir pour
        // pouvoir les rouvrir. Le filtrage se fait plus bas, côté élève.
        return { ...d, lectureQuiz: { ...quiz, mode: d.lectureMode ?? quiz.mode } };
      });
    }

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
            // Activité d'un autre : seulement les copies de MES sessions
            if (idsPartagees.has(d.id)) {
              const counts = await Promise.all(
                (mesSessionsParDevoir.get(d.id) ?? []).map((sid) =>
                  adminDb
                    .collection('travaux')
                    .where('sessionId', '==', sid)
                    .where('status', '==', 'submitted')
                    .count()
                    .get()
                )
              );
              return { ...d, submittedCount: counts.reduce((n, a) => n + a.data().count, 0) };
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
      // ── L'ÉTAT DÉPEND DE SA CLASSE ──
      // `disponible` et `corrigeDisponible` vivent désormais sur la SESSION :
      // une même activité peut être ouverte pour la 4C et fermée pour la 4D.
      // Une activité sans session retombe sur ses propres drapeaux — c'est ce
      // repli qui laisse fonctionner tout ce qui date d'avant les sessions.
      const mesClasses = await classesDeLEleve(auth.uid, auth.email);
      const sessions = await sessionsParDevoir(mesClasses);
      devoirs = devoirs.map((d) => {
        const ses = sessions.get(d.id) ?? [];
        const etat = etatEffectif(d, ses);
        return {
          ...d,
          disponible: etat.disponible,
          corrigeDisponible: etat.corrigeDisponible,
          dateRemise: etat.dateRemise ?? d.dateRemise,
          // ARCHIVÉE pour cet élève : par le prof (activité), ou toutes ses
          // sessions archivées (2026-10-09, onglet « Archivées » de l'élève)
          archive: d.archive === true || (ses.length > 0 && ses.every((s) => s.archive)),
          // A-t-elle déjà été ouverte à sa classe ? Une archive jamais ouverte
          // n'a rien à faire chez lui.
          disponibleAt: d.disponibleAt || ses.find((s) => s.disponibleAt)?.disponibleAt || null,
        };
      });

      // Les questions que le prof a écartées de l'activité ne partent pas chez
      // l'élève : il y répondrait pour rien.
      devoirs = devoirs.map((d) => {
        const masquees = d.hiddenQuestions ?? [];
        if (!d.lectureQuiz || masquees.length === 0) return d;
        return {
          ...d,
          lectureQuiz: {
            ...d.lectureQuiz,
            questions: d.lectureQuiz.questions.filter((q) => !masquees.includes(q.id)),
          },
        };
      });

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
          : lectureQuizEnDirectPourEleve(lectureQuizForEleve(d.lectureQuiz)),
        // Auto-évaluation : rien à filtrer, il n'y a ni bonne réponse ni corrigé.
        // SONDAGE AU RYTHME DU PROF : l'élève ne reçoit AUCUNE question à
        // l'ouverture — elles lui arrivent une à une par /api/sondage/etat,
        // quand le prof les lance (même fuite bouchée que pour la compétition).
        autoEvalQuiz: estSondageEnDirect(d) ? null : d.autoEvalQuiz || null,
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

      // Les activités OUVERTES — et les ARCHIVÉES qui l'ont été un jour : elles
      // restent lisibles dans l'onglet « Archivées » de l'élève (2026-10-09)
      devoirs = devoirs.filter(
        (d) =>
          (d.disponible === true || (d.archive === true && !!d.disponibleAt)) &&
          d.classes.some((c: string) => classeNames.includes(c))
      );

      // Activité réservée à certains élèves de la classe : les autres ne la
      // voient pas (« toute la classe » = `eleves` null)
      const mesFiches = elevesSnap.docs.map((doc) => doc.id);
      devoirs = devoirs.filter((d) => !eleveExclu(d.eleves, mesFiches));
    }

    // ── Les ACTIVITÉS FLE des collègues (Mes ressources FLE › bloc « des
    // professeurs », JP 2026-10-09) : lisibles et duplicables, jamais modifiées.
    // Panier à part, comme `partagees` : aucun écran existant ne les reçoit
    // sans l'avoir demandé.
    let autresFle: ReturnType<typeof versDevoir>[] = [];
    if (auth.role === 'prof') {
      try {
        const snapFle = await adminDb.collection('devoirs').where('referentiel', '==', 'fle').get();
        autresFle = snapFle.docs
          .filter((d) => d.data().profId !== auth.uid && d.data().archive !== true)
          .map(versDevoir);
      } catch (e) {
        console.error('Activités FLE des collègues illisibles :', e);
      }
    }

    if (idsPartagees.size > 0) {
      return NextResponse.json({
        success: true,
        data: devoirs.filter((d) => !idsPartagees.has(d.id)),
        partagees: devoirs.filter((d) => idsPartagees.has(d.id)),
        autresFle,
      });
    }
    return NextResponse.json({ success: true, data: devoirs, autresFle });
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
      sequenceFle,
      portfolio,
      eleves,
      referentiel,
      schema,
      sondage,
    } = body;

    // ACTIVITÉ FLE (Mes Ressources › Modules FLE) : jamais de classe, et née FERMÉE.
    // Sans classe il n'y a pas de session, et `etatEffectif` retombe sur
    // `disponible` : ouverte, elle l'aurait été à tout élève qui en connaît
    // l'id. Seule une séquence FLE l'ouvre (`ouvertParSequence`).
    const estFle = referentiel === 'fle' && typeTravail !== 'sequence';
    const ouverte = estFle ? false : (disponible ?? true);

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
      classes: estFle ? [] : classes,
      // null (et non champ absent) : orderBy('dateRemise') exclurait le document
      dateRemise: dateRemise ? new Date(dateRemise) : null,
      grille,
      intitule,
      consignes: consignes || '',
      // Les ressources passent par le garde-fou : l'onglet Interactif y met du
      // code à exécuter, et le contrôle du navigateur ne contrôle rien.
      ressources: sanitizeRessources(ressources, { codeAutorise: auth.isAdmin }),
      accesIA: accesIA ?? false,
      disponible: ouverte,
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
      ...(ouverte ? { disponibleAt: new Date() } : {}),
      ...(estFle ? { referentiel: 'fle' } : {}),
      // Sondage : nominatif / anonyme, rythme de l'élève / du prof (2026-10-09)
      ...(typeTravail === 'autoevaluation' ? { sondage: sanitizeSondageReglages(sondage) } : {}),
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
    // Renvoi vers la bibliothèque : c'est lui qui prime à la lecture.
    if (typeof body.lectureQuizId === 'string' && body.lectureQuizId) {
      devoirData.lectureQuizId = body.lectureQuizId;
    }
    // Comment le questionnaire se joue — porté par l'ACTIVITÉ, pas par la
    // ressource (voir `Devoir.lectureMode`). Absent = le mode du questionnaire.
    if (['worksheet', 'quiz', 'competition'].includes(body.lectureMode as string)) {
      devoirData.lectureMode = body.lectureMode;
    }
    if (Array.isArray(body.hiddenQuestions) && body.hiddenQuestions.length > 0) {
      devoirData.hiddenQuestions = body.hiddenQuestions.filter(
        (id: unknown): id is string => typeof id === 'string' && !!id
      );
    }
    // Ce que le nettoyeur écarte doit être DIT au prof : c'est ici qu'une
    // soirée de travail a disparu en silence le 2026-09-20 (dix questions
    // composées, deux enregistrées, aucun message).
    let avertissementQuiz: string | null = null;
    if (typeTravail === 'lire' && lectureQuiz && !devoirData.lectureQuizId) {
      const cleaned = sanitizeLectureQuiz(lectureQuiz);
      avertissementQuiz = avertissementQuestionsJetees(lectureQuiz, cleaned);
      if (cleaned) {
        devoirData.lectureQuiz = lectureQuizPourFirestore(cleaned);
        // ── TOUT QUESTIONNAIRE REJOINT LA BIBLIOTHÈQUE ──
        // Écrit dans l'activité, il y resterait prisonnier : le redonner
        // l'année suivante obligerait à dupliquer l'activité entière. On le
        // verse donc dans la bibliothèque sous le nom de l'activité, et
        // l'activité y renvoie. La copie embarquée reste en filet.
        try {
          const qId = generateQuestionnaireLectureId();
          await adminDb.collection('questionnairesLecture').doc(qId).set({
            id: qId,
            nom: intitule,
            description: '',
            profId: auth.uid,
            anneeScolaire,
            archive: false,
            quiz: devoirData.lectureQuiz,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          devoirData.lectureQuizId = qId;
        } catch (err) {
          // Échouer ici ne doit pas faire rater la création : l'activité garde
          // son questionnaire embarqué et fonctionne comme avant.
          console.error('Erreur versement du questionnaire en bibliothèque:', err);
        }
      }
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
    // Élèves concernés : toute la classe (null) ou une partie
    devoirData.eleves = estFle ? null : restrictionElevesPourFirestore(eleves);

    // Séquence FLE : son parcours (recopié à la duplication)
    if (typeTravail === 'sequence') {
      devoirData.sequenceFle = sequenceFlePourFirestore(sequenceFle ?? {});
    }

    // Portfolio d'apprentissage : ses étapes (copiées depuis la matrice, ou composées)
    if (typeTravail === 'portfolio') {
      devoirData.portfolio = portfolioContenuPourFirestore(portfolio ?? {}, { codeAutorise: auth.isAdmin });
    }

    // Atelier de conceptualisation : type de départ + liberté de transformer
    if (typeTravail === 'schematiser') {
      devoirData.schema = schemaPourFirestore(schema);
    }

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

    // Une session par classe visée. Elle hérite des drapeaux de l'activité :
    // à la création, toutes les classes sont donc dans le même état, et c'est
    // ensuite que le prof les dissocie (ouvrir le corrigé pour l'une seulement).
    // Un échec ici ne doit pas faire rater la création : l'activité existe, les
    // sessions se rattraperont au prochain enregistrement ou par le script.
    try {
      await syncSessions(id);
    } catch (err) {
      console.error('Erreur syncSessions (création):', err);
    }

    return NextResponse.json({
      success: true,
      data: { id, codeAcces: devoirData.codeAcces || null },
      message: `Devoir "${intitule}" cree avec succes`,
      avertissement: avertissementQuiz,
    });
  } catch (error) {
    console.error('Erreur POST /api/devoirs:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
