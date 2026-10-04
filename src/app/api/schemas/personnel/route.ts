import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import type { Diagram, DiagramType } from '@/types/diagram';
import { SCHEMAS_PERSONNELS as COLLECTION, diagramVide, estTypeSchema as estType, type SchemaPersonnelMeta } from '@/lib/schemas-personnels';

// ── Schémas personnels ──
// schemasPersonnels/{id} : les cartes qu'un élève (ou un prof) construit pour
// lui-même, hors de toute activité — onglet « Mes schémas » de Mes ressources
// (plan du 2026-10-04). Un document par schéma : `uid` du propriétaire, titre,
// type, le `Diagram` entier, une vignette PNG (data URL, facultative), dates.
// Aucune identité en clair : le propriétaire n'est désigné que par son uid
// Firebase. Accès uniquement par ces routes (jamais Firestore direct côté client).

// GET — la liste des schémas de l'utilisateur connecté (métadonnées + vignette)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    // Pas de `orderBy` : il exigerait un index composite ; on trie en mémoire.
    const snap = await adminDb.collection(COLLECTION).where('uid', '==', auth.uid).get();
    const list: SchemaPersonnelMeta[] = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          titre: typeof data.titre === 'string' ? data.titre : 'Sans titre',
          type: estType(data.type) ? data.type : 'conceptmap',
          thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : null,
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error('Erreur GET /api/schemas/personnel:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — créer un schéma : { type, titre } ou dupliquer : { duplicateOf: id }
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let body: { type?: unknown; titre?: unknown; duplicateOf?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const now = new Date().toISOString();
  try {
    if (typeof body.duplicateOf === 'string') {
      const src = await adminDb.collection(COLLECTION).doc(body.duplicateOf).get();
      if (!src.exists || src.data()?.uid !== auth.uid) {
        return NextResponse.json({ error: 'Schéma introuvable' }, { status: 404 });
      }
      const data = src.data()!;
      const titre = `${data.titre || 'Sans titre'} (copie)`;
      const diagram = { ...(data.diagram as Diagram), title: titre };
      const ref = await adminDb.collection(COLLECTION).add({
        uid: auth.uid,
        titre,
        type: data.type,
        diagram,
        thumbnail: data.thumbnail ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ success: true, data: { id: ref.id } });
    }

    const type: DiagramType = estType(body.type) ? body.type : 'conceptmap';
    const titre = (typeof body.titre === 'string' ? body.titre.trim() : '').slice(0, 120) || 'Sans titre';
    const ref = await adminDb.collection(COLLECTION).add({
      uid: auth.uid,
      titre,
      type,
      diagram: diagramVide(type, titre),
      thumbnail: null,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ success: true, data: { id: ref.id } });
  } catch (error) {
    console.error('Erreur POST /api/schemas/personnel:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
