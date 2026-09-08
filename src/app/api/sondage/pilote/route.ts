import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { accesAccorde, accesManche } from '@/lib/manche-server';
import { ouvrirSondage, piloterSondage, vueDuSondage } from '@/lib/sondage-server';
import { mancheId } from '@/types/manche';
import type { SondageAction } from '@/types/manche';

const ACTIONS: SondageAction[] = ['ouvrir', 'lancer', 'stopper', 'terminer'];

// POST /api/sondage/pilote — le professeur mène le sondage.
//
// Quatre gestes : ouvrir la salle, lancer une question, l'arrêter, arrêter le
// sondage. Pas de « révéler » — rien à révéler.
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
      index?: number;
    };
    const { sessionId, index } = body;
    const action = body.action as SondageAction;

    if (!sessionId || !ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
    }

    const id = mancheId(sessionId);

    if (action === 'ouvrir') {
      const manche = await ouvrirSondage(sessionId, auth.uid);
      if (!manche) {
        return NextResponse.json({ success: false, message: 'Session introuvable' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: await vueDuSondage(id, auth.uid, true) });
    }

    const acces = await accesManche(id, auth);
    if (!accesAccorde(acces) || !acces.estProf) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const manche = await piloterSondage(id, action, { index });
    if (!manche) {
      return NextResponse.json({ success: false, message: 'Sondage introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: await vueDuSondage(id, auth.uid, true) });
  } catch (error) {
    console.error('Erreur POST /api/sondage/pilote:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
