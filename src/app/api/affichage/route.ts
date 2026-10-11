import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt } from '@/lib/crypto';
import {
  ELEMENTS_AFFICHAGE,
  MAX_NOTE_AFFICHAGE,
  type AffichageResolu,
  type ConfigAffichage,
  type EtatAffichage,
  type ReglageAffichage,
} from '@/types/affichage';

// GESTION DE L'AFFICHAGE (plan 2026-10-11-gestion-affichage) — document unique
// `configuration/affichage`.
//  GET          : tout utilisateur connecté — les réglages, RÉSOLUS pour lui
//                 (`voitMasque` : admin, prof testeur, ou élève dont un prof
//                 est l'admin ou un testeur — option A de JP) ;
//  GET ?admin=1 : l'admin — la configuration brute et la liste des profs
//                 (pour choisir les testeurs ; noms déchiffrés ici seulement) ;
//  PUT          : l'admin.
// Le document retient aussi `adminUids` (posé à chaque enregistrement) : l'admin
// est reconnu par son adresse, mais ses élèves le sont par le `profId` de leurs
// classes — un uid.

const DOC_REF = () => adminDb.collection('configuration').doc('affichage');
const CLES = new Set(ELEMENTS_AFFICHAGE.map((e) => e.cle));
const ETATS: EtatAffichage[] = ['visible', 'test', 'masque'];
const MAX_TESTEURS = 40;

interface Stocke extends ConfigAffichage {
  adminUids: string[];
}

function lire(data: unknown): Stocke {
  const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const elements: Record<string, ReglageAffichage> = {};
  const brut = d.elements && typeof d.elements === 'object' ? (d.elements as Record<string, unknown>) : {};
  for (const [cle, v] of Object.entries(brut)) {
    if (!CLES.has(cle) || !v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const etat = ETATS.includes(r.etat as EtatAffichage) ? (r.etat as EtatAffichage) : 'visible';
    if (etat === 'visible') continue;
    elements[cle] = { etat, note: typeof r.note === 'string' ? r.note.trim().slice(0, MAX_NOTE_AFFICHAGE) : '' };
  }
  const uids = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x)))] : [];
  return { elements, testeurs: uids(d.testeurs).slice(0, MAX_TESTEURS), adminUids: uids(d.adminUids).slice(0, 5) };
}

/** Un élève voit le masqué si l'un de ses profs (le `profId` d'une de ses classes) est l'admin ou un testeur. */
async function eleveVoitMasque(uid: string, voient: Set<string>): Promise<boolean> {
  if (voient.size === 0) return false;
  const fiches = await adminDb.collection('eleves').where('firebaseUid', '==', uid).get();
  const classeIds = [...new Set(fiches.docs.map((d) => String(d.data().classeId || '')).filter(Boolean))];
  if (classeIds.length === 0) return false;
  const classes = await adminDb.getAll(...classeIds.map((id) => adminDb.collection('classes').doc(id)));
  return classes.some((c) => c.exists && voient.has(String(c.data()?.profId || '')));
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const snap = await DOC_REF().get();
    const config = lire(snap.exists ? snap.data() : {});

    if (request.nextUrl.searchParams.get('admin') === '1') {
      if (!auth.isAdmin) return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      const profsSnap = await adminDb.collection('users').where('role', '==', 'prof').get();
      const profs = profsSnap.docs
        .filter((d) => d.id !== auth.uid)
        .map((d) => {
          const u = d.data();
          return { uid: d.id, nom: decrypt(u.displayName) || '', email: decrypt(u.email) || '' };
        })
        .sort((a, b) => (a.nom || a.email).localeCompare(b.nom || b.email, 'fr'));
      return NextResponse.json({
        success: true,
        data: { config: { elements: config.elements, testeurs: config.testeurs } satisfies ConfigAffichage, profs },
      });
    }

    let voitMasque = auth.isAdmin;
    if (!voitMasque && auth.role === 'prof') voitMasque = config.testeurs.includes(auth.uid);
    if (!voitMasque && auth.role === 'eleve' && Object.values(config.elements).some((r) => r.etat === 'masque')) {
      voitMasque = await eleveVoitMasque(auth.uid, new Set([...config.adminUids, ...config.testeurs]));
    }
    const resolu: AffichageResolu = { elements: config.elements, voitMasque };
    return NextResponse.json({ success: true, data: resolu });
  } catch (error) {
    console.error('Erreur GET /api/affichage:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (!auth.isAdmin) return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });

  try {
    const body = await request.json();
    const avant = await DOC_REF().get();
    const precedent = lire(avant.exists ? avant.data() : {});
    const propre = lire({
      elements: body.elements,
      testeurs: body.testeurs,
      adminUids: [...precedent.adminUids, auth.uid],
    });
    await DOC_REF().set({ ...propre, updatedAt: new Date().toISOString() });
    const config: ConfigAffichage = { elements: propre.elements, testeurs: propre.testeurs };
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Erreur PUT /api/affichage:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
