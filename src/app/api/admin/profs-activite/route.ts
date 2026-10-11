import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// L'ACTIVITÉ DE TOUS LES PROFS d'un coup (administration › Gestion des membres,
// 2026-10-11) : pour le filtre « Profs sans aucune activité » — ceux qui n'ont
// jamais rien créé. Par adresse : classes, devoirs, grilles, et s'il s'est déjà
// connecté (un compte Firebase existe). Les fiches `professeurs` sont rangées
// par adresse, les créations par uid (`profId`) : la correspondance passe par
// Firebase Auth, comme `/api/admin/prof-stats`.

export interface ActiviteProf {
  classes: number;
  devoirs: number;
  grilles: number;
  connecte: boolean;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé' }, { status: 403 });
  }

  try {
    const profsSnap = await adminDb.collection('professeurs').get();
    const emails = profsSnap.docs.map((d) => String(d.data().email || d.id).toLowerCase()).filter(Boolean);

    // Adresse → uid (Firebase Auth, par lots de 100)
    const uidDe = new Map<string, string>();
    for (let i = 0; i < emails.length; i += 100) {
      const res = await adminAuth.getUsers(emails.slice(i, i + 100).map((email) => ({ email })));
      res.users.forEach((u) => u.email && uidDe.set(u.email.toLowerCase(), u.uid));
    }
    const uids = [...new Set(uidDe.values())];

    // Ce que chaque uid a créé : seulement le champ `profId` (lots de 30 pour `in`)
    const compte = new Map<string, { classes: number; devoirs: number; grilles: number }>();
    uids.forEach((u) => compte.set(u, { classes: 0, devoirs: 0, grilles: 0 }));
    const collections = [
      ['classes', 'classes'],
      ['devoirs', 'devoirs'],
      ['grilles', 'grilles'],
    ] as const;
    for (let i = 0; i < uids.length; i += 30) {
      const lot = uids.slice(i, i + 30);
      const snaps = await Promise.all(
        collections.map(([coll]) => adminDb.collection(coll).where('profId', 'in', lot).select('profId').get())
      );
      snaps.forEach((snap, k) => {
        const champ = collections[k][1];
        snap.docs.forEach((d) => {
          const c = compte.get(String(d.data().profId || ''));
          if (c) c[champ] += 1;
        });
      });
    }

    const data: Record<string, ActiviteProf> = {};
    for (const email of emails) {
      const uid = uidDe.get(email);
      const c = uid ? compte.get(uid) : undefined;
      data[email] = { classes: c?.classes ?? 0, devoirs: c?.devoirs ?? 0, grilles: c?.grilles ?? 0, connecte: !!uid };
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/admin/profs-activite:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
