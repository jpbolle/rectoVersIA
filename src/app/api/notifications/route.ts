import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt } from '@/lib/crypto';
import { queryElevesByEmail } from '@/lib/eleve-lookup';

// ── Notifications calculées à la lecture (pas de collection dédiée) ──
// GET : événements récents selon le rôle, comparés côté client à
// users/{uid}.notifsLastSeen pour le badge « non lu ».
// PUT : { lastSeen?, enabled? } → notifsLastSeen / notifsEnabled du user.
//
// Élève : nouvelles activités disponibles (devoirs.disponibleAt) + corrigés
// rendus visibles (corrections.visibleAt, devoirs.corrigeDisponibleAt).
// Prof : copies remises (travaux.submittedAt) sur ses devoirs.
// Admin : notifs prof + section admin (vide pour l'instant).

const WINDOW_DAYS = 14;      // fenêtre de calcul des événements
const MAX_NOTIFS = 20;

interface NotifItem {
  id: string;                          // stable (déduit de l'événement)
  type: 'remise' | 'activite' | 'corrige';
  title: string;
  sub: string;
  date: string;                        // ISO
}

// Timestamp Firestore | Date | string ISO → ISO string ('' si absent)
function toIso(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return '';
}

// Charge des devoirs par lots de 30 ids → Map id → data
async function fetchDevoirs(ids: string[]): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  const map = new Map<string, FirebaseFirestore.DocumentData>();
  const unique = [...new Set(ids)];
  const batches = Array.from(
    { length: Math.ceil(unique.length / 30) },
    (_, i) => unique.slice(i * 30, (i + 1) * 30)
  );
  await Promise.all(batches.map(async (batch) => {
    if (batch.length === 0) return;
    const snap = await adminDb.collection('devoirs').where('__name__', 'in', batch).get();
    for (const doc of snap.docs) map.set(doc.id, doc.data());
  }));
  return map;
}

// Copies remises récemment sur les devoirs du prof
async function profNotifications(uid: string, cutoffIso: string): Promise<NotifItem[]> {
  const snap = await adminDb
    .collection('travaux')
    .where('submittedAt', '>', cutoffIso)
    .orderBy('submittedAt', 'desc')
    .limit(100)
    .get();

  const travaux = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; devoirId: string; submittedAt: string; studentName?: string; status?: string }))
    .filter((t) => t.status === 'submitted');
  if (travaux.length === 0) return [];

  const devoirs = await fetchDevoirs(travaux.map((t) => t.devoirId));
  const notifs: NotifItem[] = [];
  for (const t of travaux) {
    const devoir = devoirs.get(t.devoirId);
    if (!devoir || devoir.profId !== uid) continue;
    notifs.push({
      id: `trav-${t.id}`,
      type: 'remise',
      title: devoir.intitule || 'Activité',
      sub: `${decrypt(t.studentName) || 'Un élève'} a remis sa copie`,
      date: t.submittedAt,
    });
  }
  return notifs;
}

// Nouvelles activités + corrigés disponibles pour l'élève
async function eleveNotifications(
  uid: string,
  email: string,
  cutoffIso: string
): Promise<NotifItem[]> {
  const notifs: NotifItem[] = [];

  // 1. Classes de l'élève (par UID, repli sur l'empreinte email)
  const byUid = await adminDb.collection('eleves').where('firebaseUid', '==', uid).get();
  let eleveDocs = byUid.docs;
  if (eleveDocs.length === 0) {
    eleveDocs = (await queryElevesByEmail(email)).docs;
  }
  const classeIds = [...new Set(eleveDocs.map((d) => d.data().classeId).filter(Boolean))];
  const classeNames: string[] = [];
  await Promise.all(classeIds.map(async (cid) => {
    const doc = await adminDb.collection('classes').doc(cid).get();
    if (doc.exists && doc.data()?.nom) classeNames.push(doc.data()!.nom);
  }));

  // 2. Activités disponibles récemment dans ses classes
  if (classeNames.length > 0) {
    const devSnap = await adminDb
      .collection('devoirs')
      .where('classes', 'array-contains-any', classeNames.slice(0, 10))
      .get();
    for (const doc of devSnap.docs) {
      const d = doc.data();
      if (!d.disponible || d.archive) continue;
      const openedAt = toIso(d.disponibleAt) || toIso(d.createdAt);
      if (openedAt > cutoffIso) {
        notifs.push({
          id: `dev-${doc.id}`,
          type: 'activite',
          title: d.intitule || 'Activité',
          sub: 'Nouvelle activité disponible',
          date: openedAt,
        });
      }
      // Corrigé global du devoir rendu disponible (ex. questionnaire de lecture)
      const corrigeAt = toIso(d.corrigeDisponibleAt);
      if (d.corrigeDisponible && corrigeAt > cutoffIso) {
        notifs.push({
          id: `devcor-${doc.id}`,
          type: 'corrige',
          title: d.intitule || 'Activité',
          sub: 'Le corrigé est disponible',
          date: corrigeAt,
        });
      }
    }
  }

  // 3. Ses corrections rendues visibles récemment
  const corrSnap = await adminDb
    .collection('corrections')
    .where('studentId', '==', uid)
    .get();
  const visibles = corrSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; devoirId: string; visibleParEleve?: boolean; visibleAt?: string; updatedAt?: string }))
    .filter((c) => c.visibleParEleve && (toIso(c.visibleAt) || toIso(c.updatedAt)) > cutoffIso);
  if (visibles.length > 0) {
    const devoirs = await fetchDevoirs(visibles.map((c) => c.devoirId));
    for (const c of visibles) {
      notifs.push({
        id: `corr-${c.id}`,
        type: 'corrige',
        title: devoirs.get(c.devoirId)?.intitule || 'Activité',
        sub: 'Ta copie corrigée est disponible',
        date: toIso(c.visibleAt) || toIso(c.updatedAt),
      });
    }
  }

  return notifs;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const userDoc = await adminDb.collection('users').doc(auth.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const enabled = userData?.notifsEnabled !== false;
    const lastSeen: string | null = userData?.notifsLastSeen || null;

    if (!enabled) {
      return NextResponse.json({
        success: true,
        data: { notifications: [], lastSeen, enabled: false, isAdmin: auth.isAdmin },
      });
    }

    const cutoffIso = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
    const notifications =
      auth.role === 'prof'
        ? await profNotifications(auth.uid, cutoffIso)
        : await eleveNotifications(auth.uid, auth.email, cutoffIso);

    notifications.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications.slice(0, MAX_NOTIFS),
        lastSeen,
        enabled: true,
        isAdmin: auth.isAdmin,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/notifications:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (typeof body.lastSeen === 'string') update.notifsLastSeen = body.lastSeen;
    if (typeof body.enabled === 'boolean') update.notifsEnabled = body.enabled;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, message: 'Rien à mettre à jour' }, { status: 400 });
    }
    await adminDb.collection('users').doc(auth.uid).set(update, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PUT /api/notifications:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
