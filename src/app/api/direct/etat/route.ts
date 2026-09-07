import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { accesAccorde, accesManche, mancheDeLEleve, vueDeLaManche } from '@/lib/manche-server';
import { mancheId } from '@/types/manche';

// GET /api/direct/etat?sessionId=SES-… (prof) ou ?devoirId=DEV-… (élève)
//
// ⚠ LA ROUTE LA PLUS APPELÉE DU PROJET : une classe de 25 élèves qui joue,
// c'est 25 requêtes par seconde pendant vingt minutes. Tout ce qu'on y ajoute
// se paie 25 fois par seconde. Les lectures Firestore sont absorbées par le
// cache mémoire de 500 ms de `manche-server`.
//
// Elle ne renvoie JAMAIS « voici la question, affiche-la » mais « la question
// démarre à telle heure », deux secondes plus tard : c'est ce départ programmé
// qui met toute la classe au même instant sans ligne réseau poussée.
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
    // L'élève ne connaît que son activité : c'est SA CLASSE qui dit sur quelle
    // partie il joue. On cherche parmi toutes ses classes — il peut en avoir
    // plusieurs, et une seule joue (`mancheDeLEleve`).
    let id: string | null = sessionId ? mancheId(sessionId) : null;
    if (!id && devoirId) {
      id = await mancheDeLEleve(devoirId, auth.uid, auth.email);
    }
    if (!id) return NextResponse.json({ success: true, data: null, motif: 'aucune' });
    const acces = await accesManche(id, auth);
    // Pas de manche, ou pas pour cet utilisateur : dans les deux cas ce n'est
    // pas une erreur — mais le MOTIF part avec la réponse, parce que les deux
    // situations ne se soignent pas pareil (cf. `MotifSansManche`).
    if (!accesAccorde(acces)) {
      return NextResponse.json({ success: true, data: null, motif: acces });
    }

    // `&sommaire=1` : l'écran du prof le demande UNE FOIS, à l'ouverture.
    const vue = await vueDeLaManche(
      id,
      auth.uid,
      acces.estProf,
      params.get('sommaire') === '1'
    );
    return NextResponse.json({ success: true, data: vue });
  } catch (error) {
    console.error('Erreur GET /api/direct/etat:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
