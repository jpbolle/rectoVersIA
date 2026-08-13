 import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { ATELIER_IDS, DEFAULT_DIDACTIQUE, isTypeModal } from '@/types/didactique';
import type { DidactiqueConfig, DidactiqueItem, Habilete } from '@/types/didactique';

// Configuration « Didactique du français » (UAA + habiletés), document unique
// configuration/didactique. GET pour tout utilisateur connecté (les
// formulaires prof et les affichages élève en ont besoin), PUT admin.

const DOC_REF = () => adminDb.collection('configuration').doc('didactique');

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const doc = await DOC_REF().get();
    const stored = doc.exists ? (doc.data() as Partial<DidactiqueConfig>) : {};
    // Normalisation : les habiletés importées avant l'ajout d'un champ ne le
    // portent pas — le client doit toujours recevoir des tableaux exploitables
    const habiletes = (Array.isArray(stored.habiletes) ? stored.habiletes : []).map((h) => ({
      ...h,
      // L'objet est passé d'une valeur unique à des tags : on relit les deux
      objets: Array.isArray(h.objets)
        ? h.objets
        : h.objet?.trim()
          ? [h.objet.trim()]
          : [],
      uaa: Array.isArray(h.uaa) ? h.uaa : [],
      ateliers: Array.isArray(h.ateliers) ? h.ateliers : [],
    }));
    const config: DidactiqueConfig = {
      uaa: Array.isArray(stored.uaa) && stored.uaa.length ? stored.uaa : DEFAULT_DIDACTIQUE.uaa,
      habiletes,
    };
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Erreur GET /api/didactique:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// Nettoie la liste des UAA reçue du client
function sanitizeItems(input: unknown): DidactiqueItem[] {
  if (!Array.isArray(input)) return [];
  const items: DidactiqueItem[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 60) : '';
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 200) : '';
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, label, visible: item.visible !== false });
  }
  return items;
}

// Nettoie la liste des habiletés reçue du client. Une habileté sans geste ni
// libellé est ignorée ; le reste est borné en longueur.
function sanitizeHabiletes(input: unknown, uaaIds: Set<string>): Habilete[] {
  if (!Array.isArray(input)) return [];
  const items: Habilete[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 60) : '';
    const geste = typeof item.geste === 'string' ? item.geste.trim().slice(0, 200) : '';
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 400) : '';
    const objets = Array.isArray(item.objets)
      ? [...new Set(
          item.objets
            .filter((o): o is string => typeof o === 'string')
            .map((o) => o.trim().slice(0, 120))
            .filter(Boolean)
        )]
      : [];
    if (!id || seen.has(id) || (!geste && !label)) continue;
    if (!isTypeModal(item.type)) continue;
    seen.add(id);
    const uaa = Array.isArray(item.uaa)
      ? [...new Set(item.uaa.filter((u): u is string => typeof u === 'string' && uaaIds.has(u)))]
      : [];
    const ateliers = Array.isArray(item.ateliers)
      ? [...new Set(item.ateliers.filter((a): a is string => typeof a === 'string' && ATELIER_IDS.includes(a)))]
      : [];
    items.push({
      id,
      type: item.type,
      geste,
      label,
      objets,
      uaa,
      ateliers,
      visible: item.visible !== false,
    });
  }
  return items;
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const uaa = sanitizeItems(body?.uaa);
    const config: DidactiqueConfig = {
      uaa: uaa.length ? uaa : DEFAULT_DIDACTIQUE.uaa,
      habiletes: sanitizeHabiletes(body?.habiletes, new Set(uaa.map((u) => u.id))),
    };
    await DOC_REF().set(config);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Erreur PUT /api/didactique:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
