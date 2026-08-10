import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { generateDevoirId } from '@/lib/devoir-utils';
import { queryElevesByEmail } from '@/lib/eleve-lookup';

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
        questionnaireId: data.questionnaireId || undefined,
        codeAcces: data.codeAcces || undefined,
        vocabulaireThemes: data.vocabulaireThemes || undefined,
        vocabulaireDiagnostic: data.vocabulaireDiagnostic ?? undefined,
        corrigeReference: data.corrigeReference || null,
        ressourcesToIA: data.ressourcesToIA ?? false,
      };
    });

    // Côté élève, le corrigé de référence n'expose que la production du prof,
    // et uniquement quand la correction est disponible (jamais le plan)
    if (auth.role === 'eleve') {
      devoirs = devoirs.map((d) => ({
        ...d,
        corrigeReference:
          d.corrigeDisponible && d.corrigeReference?.production
            ? { production: d.corrigeReference.production }
            : null,
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
      evaluation,
      questionnaire,
      vocabulaireConfig,
      flipInverted,
      corrigeReference,
      ressourcesToIA,
    } = body;

    // Validation des champs requis (grille non requise pour vocabulaire)
    const grilleRequired = typeTravail !== 'vocabulaire';
    if (!Array.isArray(classes) || !dateRemise || (grilleRequired && !grille) || !intitule) {
      return NextResponse.json(
        { success: false, message: 'Date de remise, grille et intitulé requis' },
        { status: 400 }
      );
    }

    const id = generateDevoirId();
    const anneeScolaire = calculateSchoolYear();

    // Données de base du devoir
    const devoirData: Record<string, unknown> = {
      id,
      classes,
      dateRemise: new Date(dateRemise),
      grille,
      intitule,
      consignes: consignes || '',
      ressources: ressources || null,
      accesIA: accesIA ?? false,
      disponible: disponible ?? true,
      archive: false,
      corrige: false,
      corrigeDisponible: false,
      createdAt: new Date(),
      anneeScolaire,
      profId: auth.uid,
      typeTravail: typeTravail || 'ecrire',
      evaluation: evaluation === 'certificatif' ? 'certificatif' : 'formatif',
      flipInverted: flipInverted ?? false,
    };

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
