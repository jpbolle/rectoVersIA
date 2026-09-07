import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { accesAccorde, accesManche, ouvrirManche, piloterManche, vueDeLaManche } from '@/lib/manche-server';
import { mancheId } from '@/types/manche';
import type { MancheAction } from '@/types/manche';

const ACTIONS: MancheAction[] = ['ouvrir', 'lancer', 'stopper', 'reveler', 'terminer'];

// POST /api/direct/pilote — le professeur mène la partie.
//
// Cinq gestes, et pas un de plus : ouvrir la salle, lancer une question,
// l'arrêter avant la fin du chrono, RÉVÉLER la bonne réponse, arrêter la
// partie (« la sonnerie n'attend pas », JP). Ils vivent dans la barre d'actions
// au bas de l'espace de jeu.
//
// La manche vit sur le SERVEUR : le prof peut refermer son onglet et revenir,
// la partie l'attend où il l'a laissée.
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      action?: string;
      chronoSec?: number;
      /** Le rang que le prof choisit de poser ; absent = la première non posée */
      index?: number;
    };
    const { sessionId, chronoSec, index } = body;
    const action = body.action as MancheAction;

    if (!sessionId || !ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
    }

    const id = mancheId(sessionId);

    // « Ouvrir » crée la manche si elle n'existe pas encore, et la remet à zéro
    // si elle existe déjà. L'identifiant étant déduit de la session, deux clics
    // ne font pas deux parties.
    if (action === 'ouvrir') {
      const manche = await ouvrirManche(sessionId, auth.uid);
      if (!manche) {
        return NextResponse.json({ success: false, message: 'Session introuvable' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: await vueDeLaManche(id, auth.uid, true),
      });
    }

    const acces = await accesManche(id, auth);
    if (!accesAccorde(acces) || !acces.estProf) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const manche = await piloterManche(id, action, { chronoSec, index });
    if (!manche) {
      return NextResponse.json({ success: false, message: 'Manche introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: await vueDeLaManche(id, auth.uid, true) });
  } catch (error) {
    console.error('Erreur POST /api/direct/pilote:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
