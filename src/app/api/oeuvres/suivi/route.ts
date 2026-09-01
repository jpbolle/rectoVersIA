// Suivi de lecture d'une œuvre — la vue du prof sur toute sa classe.
//
// POURQUOI UNE ROUTE À PART : dans cet atelier, rien ne se corrige. Les trois
// colonnes « non ouvert / à corriger / corrigé » n'ont donc aucun sens ; ce
// que le prof veut savoir, c'est QUI LIT, où il en est, et ce qu'il a compris.
//
// Le calcul se fait ICI et non dans le navigateur pour une raison simple : les
// bonnes réponses vivent dans les sections de l'œuvre, et le navigateur du
// prof n'a pas à télécharger 67 sections (150 à 300 Ko) pour compter des QCM.
//
// ⚠️ Aucune donnée d'identité en clair ne sort d'ici sans passer par
// `decrypt` : `travaux.studentName` est chiffré (RGPD, cf. src/lib/crypto.ts).

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt } from '@/lib/crypto';
import { docToSection } from '@/lib/oeuvre-server';
import { calculerRythme, parseOeuvreProgression } from '@/types/oeuvre';
import { SANS_CLASSE } from '@/types/session';
import { estAutoCorrigeable, partReussite, reponseLiseuseVersAnswer } from '@/types/lecture';
import type { EtatLecture } from '@/types/oeuvre';

export interface SuiviEleve {
  travailId: string;
  /** UID Firebase — c'est lui qui adresse une notification */
  studentId: string;
  /** Id du document `eleves` — c'est LUI qu'attend la fiche élève, pas l'UID */
  eleveId: string | null;
  studentName: string;
  /** Vérifications complétées — le seul compteur qui fasse foi */
  faites: number;
  /** Sections ouvertes (lues sans être vérifiées) */
  vues: number;
  /** Jours distincts où l'élève a ouvert l'œuvre */
  jours: number;
  dernierJour: string | null;
  etat: EtatLecture;
  attendu: number;
  retard: number;
  /** QCM : justes / répondus, sur l'ensemble des vérifications faites */
  qcmJustes: number;
  qcmRepondus: number;
  /** Questions ouvertes auxquelles il a écrit quelque chose */
  ouvertesRepondues: number;
  /** Commentaires du professeur qu'il est allé lire (fluorage commenté) */
  commentairesLus: number;
}

export interface SuiviQuestion {
  sectionId: string;
  sectionTitre: string;
  enonce: string;
  repondus: number;
  justes: number;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const params = new URL(request.url).searchParams;
    const devoirId = params.get('devoirId');
    // La classe qu'on regarde. Une activité donnée à la 4C et à la 4D a DEUX
    // échéances et deux avancements : sans ce paramètre, le suivi mélangeait
    // les deux classes et jugeait l'une sur la date de l'autre.
    const sessionDemandee = params.get('sessionId');
    if (!devoirId) {
      return NextResponse.json({ success: false, message: 'devoirId manquant' }, { status: 400 });
    }

    const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirSnap.exists) {
      return NextResponse.json({ success: false, message: 'Activité introuvable' }, { status: 404 });
    }
    const devoir = devoirSnap.data() as {
      profId?: string;
      oeuvreId?: string | null;
      oeuvreChapitres?: string[] | null;
      oeuvreMinimum?: number | null;
      dateRemise?: unknown;
      disponibleAt?: unknown;
      createdAt?: unknown;
    };
    if (devoir.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    if (!devoir.oeuvreId) {
      return NextResponse.json(
        { success: false, message: 'Cette activité n’est pas une lecture d’œuvre' },
        { status: 400 }
      );
    }

    // ── Les sections retenues par l'activité ──
    // Une activité peut ne donner qu'une partie de l'œuvre (`oeuvreChapitres`) :
    // compter sur l'anthologie entière fausserait tous les dénominateurs.
    const oeuvreSnap = await adminDb.collection('oeuvres').doc(devoir.oeuvreId).get();
    const chapitres = (oeuvreSnap.data()?.chapitres || []) as {
      id: string;
      sections: { id: string }[];
    }[];
    const retenus = devoir.oeuvreChapitres?.length
      ? chapitres.filter((c) => devoir.oeuvreChapitres!.includes(c.id))
      : chapitres;
    const sectionsRetenues = new Set(retenus.flatMap((c) => c.sections.map((s) => s.id)));

    // Les sections elles-mêmes : c'est là que vivent les bonnes réponses.
    const sectionsSnap = await adminDb
      .collection('oeuvres')
      .doc(devoir.oeuvreId)
      .collection('sections')
      .get();
    const sections = new Map(
      sectionsSnap.docs
        .filter((d) => sectionsRetenues.has(d.id))
        .map((d) => [d.id, docToSection(d)])
    );

    // ── La session choisie ──
    // On lit son échéance et son ouverture : c'est sur SA date que le rythme
    // de lecture se juge, pas sur celle de l'activité.
    let session: { dateRemise?: unknown; disponibleAt?: unknown } | null = null;
    if (sessionDemandee && sessionDemandee !== SANS_CLASSE) {
      const snap = await adminDb.collection('sessions').doc(sessionDemandee).get();
      if (snap.exists && snap.data()!.devoirId === devoirId) {
        session = snap.data() as { dateRemise?: unknown; disponibleAt?: unknown };
      }
    }

    // ── Les travaux ──
    // Le filtrage se fait en mémoire, et non par un second `where` : ce serait
    // un index composite de plus à déployer à la main pour une poignée de
    // copies (cf. AGENTS.md — les règles et index se déploient séparément).
    const travauxSnap = await adminDb
      .collection('travaux')
      .where('devoirId', '==', devoirId)
      .get();

    const travauxDocs = !sessionDemandee
      ? travauxSnap.docs
      : sessionDemandee === SANS_CLASSE
        ? travauxSnap.docs.filter((d) => !d.data().sessionId)
        : travauxSnap.docs.filter((d) => d.data().sessionId === sessionDemandee);

    // La fiche élève s'ouvre sur l'id du document `eleves`, jamais sur l'UID
    // Firebase. On fait la correspondance ici, en une passe, plutôt qu'une
    // requête par ligne du tableau.
    const uids = [
      ...new Set(
        travauxDocs.map((d) => (d.data() as { studentId?: string }).studentId).filter(Boolean)
      ),
    ] as string[];
    const eleveIdParUid = new Map<string, string>();
    // `in` plafonne à 30 valeurs : on découpe (une classe dépasse rarement 30,
    // une activité donnée à cinq classes, si).
    for (let i = 0; i < uids.length; i += 30) {
      const lot = uids.slice(i, i + 30);
      if (!lot.length) break;
      const snap = await adminDb.collection('eleves').where('firebaseUid', 'in', lot).get();
      for (const d of snap.docs) {
        const uid = (d.data() as { firebaseUid?: string }).firebaseUid;
        if (uid && !eleveIdParUid.has(uid)) eleveIdParUid.set(uid, d.id);
      }
    }

    const minimum = devoir.oeuvreMinimum || 0;
    // La session prime, l'activité sert de repli — la règle du chantier des
    // sessions (`etatEffectif`), appliquée ici aux deux dates du rythme.
    const echeance = session ? toIso(session.dateRemise) : toIso(devoir.dateRemise);
    const debut = session
      ? toIso(session.disponibleAt) || toIso(devoir.createdAt)
      : toIso(devoir.disponibleAt) || toIso(devoir.createdAt);

    // Statistiques par question — ce que la classe a raté
    const parQuestion = new Map<string, SuiviQuestion>();

    const eleves: SuiviEleve[] = travauxDocs.map((doc) => {
      const t = doc.data() as {
        studentId?: string;
        studentName?: string;
        content?: string;
      };
      const progression = parseOeuvreProgression(t.content);

      let faites = 0;
      let vues = 0;
      let qcmJustes = 0;
      let qcmRepondus = 0;
      let ouvertesRepondues = 0;
      // Les commentaires du prof que l'élève est allé lire — demande de JP :
      // ce qu'un élève va chercher renseigne plus que le fait qu'il ait
      // tourné la page. Ce n'est PAS une note, c'est un signe de lecture.
      let commentairesLus = 0;

      for (const [sectionId, etat] of Object.entries(progression?.sections || {})) {
        // Une section retirée de l'activité ne compte plus, même si l'élève
        // l'avait lue quand elle en faisait partie.
        if (!sectionsRetenues.has(sectionId)) continue;
        if (etat.vueLe) vues += 1;
        if (etat.termineLe) faites += 1;

        const section = sections.get(sectionId);
        if (!section) continue;

        // On ne compte que les commentaires qui existent ENCORE : un
        // commentaire supprimé depuis gonflerait le compteur d'une lecture
        // que plus personne ne peut faire.
        const vivants = new Set((section.commentaires ?? []).map((c) => c.id));
        commentairesLus += (etat.commentairesOuverts ?? []).filter((id) => vivants.has(id)).length;

        for (const question of section.questions) {
          const reponse = etat.reponses?.[question.id];
          if (reponse === undefined || reponse === null || reponse === '') continue;

          // Tout ce que la machine sait corriger entre dans le compteur, pas
          // seulement les QCM : un appariement n'est pas une question ouverte.
          // Le barème étant PARTIEL, « juste » veut dire entièrement juste —
          // une matrice à moitié bonne n'est pas une réussite.
          if (estAutoCorrigeable(question)) {
            qcmRepondus += 1;
            const part = partReussite(question, reponseLiseuseVersAnswer(question, reponse));
            const juste = part === 1;
            if (juste) qcmJustes += 1;

            const cle = `${sectionId}::${question.id}`;
            const ligne = parQuestion.get(cle) || {
              sectionId,
              sectionTitre: section.titre,
              enonce: question.enonce,
              repondus: 0,
              justes: 0,
            };
            ligne.repondus += 1;
            if (juste) ligne.justes += 1;
            parQuestion.set(cle, ligne);
          } else {
            ouvertesRepondues += 1;
          }
        }
      }

      const jours = progression?.jours || [];
      const rythme = calculerRythme(faites, minimum, debut, echeance);

      return {
        travailId: doc.id,
        studentId: t.studentId || '',
        eleveId: (t.studentId && eleveIdParUid.get(t.studentId)) || null,
        // studentName est chiffré en base (RGPD) — jamais renvoyé tel quel
        studentName: decrypt(t.studentName) || 'Élève',
        faites,
        vues,
        jours: jours.length,
        dernierJour: jours.length ? [...jours].sort().at(-1) || null : null,
        etat: rythme.etat,
        attendu: rythme.attendu,
        retard: rythme.retard,
        qcmJustes,
        qcmRepondus,
        ouvertesRepondues,
        commentairesLus,
      };
    });

    eleves.sort((a, b) => a.studentName.localeCompare(b.studentName));

    // Les questions les plus ratées, et seulement celles qu'assez d'élèves ont
    // vues : une question répondue par un seul élève ne dit rien de la classe.
    const questionsDifficiles = [...parQuestion.values()]
      .filter((q) => q.repondus >= 3)
      .sort((a, b) => a.justes / a.repondus - b.justes / b.repondus)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        eleves,
        questionsDifficiles,
        minimum,
        echeance,
        // Nombre de sections effectivement données, et combien portent un
        // formulaire : les deux dénominateurs du tableau.
        totalSections: sectionsRetenues.size,
        totalVerifications: [...sections.values()].filter((s) => s.questions.length > 0).length,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/oeuvres/suivi:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

function toIso(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return '';
}
