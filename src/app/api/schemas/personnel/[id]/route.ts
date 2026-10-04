import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import {
  DIAGRAM_JSON_MAX,
  SCHEMAS_PERSONNELS as COLLECTION,
  VIGNETTE_MAX,
  estDiagramPlausible,
} from '@/lib/schemas-personnels';

// ── Un schéma personnel ── (voir ../route.ts pour la collection)
// Seul son propriétaire (uid) peut le lire, le modifier ou le supprimer.

async function charger(id: string, uid: string) {
  const doc = await adminDb.collection(COLLECTION).doc(id).get();
  if (!doc.exists || doc.data()?.uid !== uid) return null;
  return doc;
}

// GET — le schéma entier
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  try {
    const doc = await charger(id, auth.uid);
    if (!doc) return NextResponse.json({ error: 'Schéma introuvable' }, { status: 404 });
    const data = doc.data()!;
    return NextResponse.json({
      success: true,
      data: { id: doc.id, titre: data.titre, type: data.type, diagram: data.diagram, updatedAt: data.updatedAt },
    });
  } catch (error) {
    console.error('Erreur GET /api/schemas/personnel/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT — { diagram?, thumbnail? } : enregistrement différé depuis l'éditeur
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  let body: { diagram?: unknown; thumbnail?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.diagram !== undefined) {
    if (!estDiagramPlausible(body.diagram)) {
      return NextResponse.json({ error: 'Schéma illisible' }, { status: 400 });
    }
    if (JSON.stringify(body.diagram).length > DIAGRAM_JSON_MAX) {
      return NextResponse.json({ error: 'Schéma trop volumineux' }, { status: 413 });
    }
    patch.diagram = body.diagram;
    patch.type = body.diagram.type;
    patch.titre = (body.diagram.title || '').trim().slice(0, 120) || 'Sans titre';
  }
  if (typeof body.thumbnail === 'string' && body.thumbnail.startsWith('data:image/png') && body.thumbnail.length <= VIGNETTE_MAX) {
    patch.thumbnail = body.thumbnail;
  }

  try {
    const doc = await charger(id, auth.uid);
    if (!doc) return NextResponse.json({ error: 'Schéma introuvable' }, { status: 404 });
    await doc.ref.update(patch);
    return NextResponse.json({ success: true, data: { updatedAt: patch.updatedAt } });
  } catch (error) {
    console.error('Erreur PUT /api/schemas/personnel/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  try {
    const doc = await charger(id, auth.uid);
    if (!doc) return NextResponse.json({ error: 'Schéma introuvable' }, { status: 404 });
    await doc.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/schemas/personnel/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
