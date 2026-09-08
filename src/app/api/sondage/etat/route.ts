import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { accesAccorde, accesManche, mancheDeLEleve } from '@/lib/manche-server';
import { vueDuSondage } from '@/lib/sondage-server';
import { mancheId } from '@/types/manche';

// GET /api/sondage/etat?sessionId=SES-… (prof) ou ?devoirId=DEV-… (élève)
//
// Miroir de `/api/direct/etat` pour le SONDAGE en direct : même transport (une
// interrogation par seconde, départ programmé), autre moteur (`sondage-server`)
// — sans score et sans nom. Route à part, pour ne pas toucher à la route la
// plus appelée du projet (décision du plan du 2026-09-08).
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const sessionId = params.get('sessionId');
  const devoirId = params.get('devoirId');

  if (!sessionId && !devoirId) {
    return NextResponse.json({ success: false, message: 'sessionId requis' }, { status: 400 });
  }

  try {
    let id: string | null = sessionId ? mancheId(sessionId) : null;
    if (!id && devoirId) {
      id = await mancheDeLEleve(devoirId, auth.uid, auth.email);
    }
    if (!id) return NextResponse.json({ success: true, data: null, motif: 'aucune' });
    const acces = await accesManche(id, auth);
    if (!accesAccorde(acces)) {
      return NextResponse.json({ success: true, data: null, motif: acces });
    }

    const vue = await vueDuSondage(id, auth.uid, acces.estProf, params.get('sommaire') === '1');
    return NextResponse.json({ success: true, data: vue });
  } catch (error) {
    console.error('Erreur GET /api/sondage/etat:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
