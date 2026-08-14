import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { sanitizeScenarisation } from '@/lib/scenarisation-server';
import { DEFAULT_SEMAINES } from '@/types/scenarisation-defaults';
import type { Scenarisation } from '@/types/scenarisation';

// Scénarisations didactiques d'un prof (une par cours). Chapitres et modules
// sont imbriqués dans le document — pas de sous-collection, pas d'index.

function genererId(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `SCN-${stamp}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    // Pas d'orderBy : évite un index composite avec le filtre profId
    const snap = await adminDb
      .collection('scenarisations')
      .where('profId', '==', auth.uid)
      .get();

    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Scenarisation)
      .filter((s) => !s.archive)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/scenarisations:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const body = await request.json();
    const clean = sanitizeScenarisation(body);
    const id = genererId();
    const now = new Date().toISOString();

    const scen: Scenarisation = {
      ...clean,
      // Une scénarisation neuve part avec le calendrier scolaire par défaut
      semaines: Object.keys(clean.semaines).length ? clean.semaines : { ...DEFAULT_SEMAINES },
      id,
      profId: auth.uid,
      anneeScolaire: calculateSchoolYear(),
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('scenarisations').doc(id).set(scen);
    return NextResponse.json({ success: true, data: scen });
  } catch (error) {
    console.error('Erreur POST /api/scenarisations:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
