import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { sessionsDuDevoir, syncSessions } from '@/lib/session-server';
import { accesClasse, accesDevoir, accesSessionDepuis } from '@/lib/classe-acces';

// GET /api/sessions?devoirId=DEV-… — les sessions d'une activité (prof).
//
// Les sessions manquantes sont créées à la volée : une activité antérieure aux
// sessions se rattrape ainsi à sa première consultation, sans script ni
// migration bloquante.
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }

  const devoirId = request.nextUrl.searchParams.get('devoirId');
  const classeId = request.nextUrl.searchParams.get('classeId');

  // ── Deuxième porte d'entrée : les activités d'UNE CLASSE ──
  // Le prof pense tantôt à son activité (« où en est ce diagnostic ? »),
  // tantôt à sa classe (« qu'est-ce que la 4C a en cours ? »). Les deux mènent
  // aux mêmes sessions ; c'est une VUE de plus, pas un modèle de plus.
  if (classeId) {
    try {
      // Titulaire ou coprofesseur de la classe : TOUTES ses activités, quel
      // qu'en soit l'auteur (le remplaçant voit les tiennes, tu vois les
      // siennes). Avant le 2026-10-04 : les seules sessions dont on était
      // l'auteur, sans même vérifier que la classe était la sienne.
      const classe = await accesClasse(classeId, auth);
      if (!classe) {
        return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
      }
      return NextResponse.json({ success: true, data: await activitesDeLaClasse(classeId) });
    } catch (error) {
      console.error('Erreur GET /api/sessions (classe):', error);
      return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
    }
  }

  if (!devoirId) {
    return NextResponse.json({ success: false, message: 'devoirId ou classeId requis' }, { status: 400 });
  }

  try {
    // L'activité doit être la sienne — ou viser une classe dont il est
    // titulaire ou coprofesseur : il ne reçoit alors que les sessions de SES
    // classes, chacune avec ce qu'il peut y faire (`monAcces`).
    // L'accès d'abord : un compte prof quelconque ne déclenche aucune écriture
    // sur l'activité d'un autre en devinant son identifiant
    const acces = await accesDevoir(devoirId, auth);
    if (!acces) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }
    await syncSessions(devoirId);

    const sessions = (await sessionsDuDevoir(devoirId))
      .filter((s) => !acces.sessionIds || acces.sessionIds.has(s.id))
      .map((s) => ({ ...s, monAcces: accesSessionDepuis(acces, s) ?? undefined }));
    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Erreur GET /api/sessions:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * Les sessions d'une classe, enrichies de ce qu'il faut pour les lire :
 * l'intitulé de l'activité et l'avancement des remises.
 *
 * Les compteurs se font sur une requête ALLÉGÉE (`select`) : une copie porte
 * tout le travail de l'élève, et en charger deux cents pour compter des
 * statuts serait absurde. Deux champs suffisent, et l'index sur `sessionId`
 * est automatique (champ unique) — aucun index composite à déployer.
 */
async function activitesDeLaClasse(classeId: string) {
  const snap = await adminDb
    .collection('sessions')
    .where('classeId', '==', classeId)
    .get();

  const sessions = snap.docs.map((d) => d.data());
  if (sessions.length === 0) return [];

  // Les activités, lues une fois chacune
  const devoirIds = [...new Set(sessions.map((s) => String(s.devoirId)))];
  const devoirs = new Map<string, { intitule: string; typeTravail: string }>();
  await Promise.all(
    devoirIds.map(async (id) => {
      const d = await adminDb.collection('devoirs').doc(id).get();
      if (d.exists) {
        devoirs.set(id, {
          intitule: d.data()?.intitule || '',
          typeTravail: d.data()?.typeTravail || 'ecrire',
        });
      }
    })
  );

  return Promise.all(
    sessions.map(async (s) => {
      const copies = await adminDb
        .collection('travaux')
        .where('sessionId', '==', s.id)
        .select('status', 'nonRendu')
        .get();
      const total = copies.size;
      const remises = copies.docs.filter(
        (c) => c.data().status === 'submitted' && !c.data().nonRendu
      ).length;
      const devoir = devoirs.get(String(s.devoirId));
      return {
        sessionId: String(s.id),
        devoirId: String(s.devoirId),
        intitule: devoir?.intitule ?? '(activité supprimée)',
        typeTravail: devoir?.typeTravail ?? 'ecrire',
        anneeScolaire: String(s.anneeScolaire ?? ''),
        disponible: s.disponible === true,
        corrigeDisponible: s.corrigeDisponible === true,
        archive: s.archive === true,
        remises,
        total,
      };
    })
  );
}
