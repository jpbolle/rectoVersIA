import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { devoirsRattaches, sanitizeScenarisation } from '@/lib/scenarisation-server';
import type { Scenarisation } from '@/types/scenarisation';

// Lecture, enregistrement et suppression d'une scénarisation.
// Le PUT réécrit le document entier : l'écran édite chapitres et modules
// ensemble, un enregistrement partiel n'aurait pas de sens.

async function charger(id: string, uid: string) {
  const ref = adminDb.collection('scenarisations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ref, doc: null as Scenarisation | null, refuse: false };
  const doc = { id: snap.id, ...snap.data() } as Scenarisation;
  return { ref, doc, refuse: doc.profId !== uid };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { doc, refuse } = await charger(id, auth.uid);
    if (!doc) return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    if (refuse) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error('Erreur GET /api/scenarisations/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { ref, doc, refuse } = await charger(id, auth.uid);
    if (!doc) return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    if (refuse) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

    const body = await request.json();
    const clean = sanitizeScenarisation(body);
    const now = new Date().toISOString();
    await ref.update({ ...clean, updatedAt: now });

    // Passerelle en retour : chaque activité rattachée sait de quel module elle
    // relève, pour l'afficher côté Mes Activités. Les liens rompus sont effacés.
    const avant = new Set(devoirsRattaches(doc));
    const apres = new Set(devoirsRattaches({ chapitres: clean.chapitres }));
    const majDevoir = async (devoirId: string, valeur: unknown) => {
      const dref = adminDb.collection('devoirs').doc(devoirId);
      const dsnap = await dref.get();
      if (!dsnap.exists || dsnap.data()?.profId !== auth.uid) return;
      await dref.update({ scenarisationRef: valeur });
    };
    await Promise.all([
      ...[...apres].map((devoirId) => majDevoir(devoirId, { scenarisationId: id, nom: clean.nom })),
      ...[...avant].filter((d) => !apres.has(d)).map((devoirId) => majDevoir(devoirId, null)),
    ]);

    return NextResponse.json({ success: true, data: { ...doc, ...clean, updatedAt: now } });
  } catch (error) {
    console.error('Erreur PUT /api/scenarisations/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const { ref, doc, refuse } = await charger(id, auth.uid);
    if (!doc) return NextResponse.json({ success: true });
    if (refuse) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

    // Les activités survivent à la scénarisation : on ne fait que couper le lien
    await Promise.all(
      devoirsRattaches(doc).map(async (devoirId) => {
        const dref = adminDb.collection('devoirs').doc(devoirId);
        const dsnap = await dref.get();
        if (dsnap.exists && dsnap.data()?.profId === auth.uid) {
          await dref.update({ scenarisationRef: null });
        }
      })
    );
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/scenarisations/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
