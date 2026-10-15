import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { verifyAuth } from '@/lib/api-auth';
import { surveillanceComplete } from '@/lib/rapport-couts';

// Surveillance des coûts IA, à appeler toutes les heures par une tâche
// planifiée du VPS (cron) :
//   curl -s -H "X-Surveillance: $SURVEILLANCE_SECRET" https://<site>/api/admin/couts/surveillance
// Le secret vit dans `.env.local` (SURVEILLANCE_SECRET). Un admin connecté
// peut aussi la lancer. Applique les seuils (alertes, coupure d'une activité
// qui échoue en boucle) et purge les traces de plus de 12 mois.

function secretValide(recu: string | null): boolean {
  const attendu = process.env.SURVEILLANCE_SECRET;
  if (!attendu || !recu) return false;
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!secretValide(request.headers.get('x-surveillance'))) {
    const auth = await verifyAuth(request);
    if (!auth?.isAdmin) return NextResponse.json({ success: false, message: 'Accès réservé' }, { status: 403 });
  }
  try {
    const resultat = await surveillanceComplete();
    return NextResponse.json({ success: true, data: resultat });
  } catch (error) {
    console.error('Erreur GET /api/admin/couts/surveillance:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
