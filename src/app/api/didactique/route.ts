import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { DEFAULT_DIDACTIQUE } from '@/types/didactique';
import type { DidactiqueConfig, DidactiqueItem } from '@/types/didactique';

// Configuration « Didactique du français » (UAA + gestes), document unique
// configuration/didactique. GET pour tout utilisateur connecté (les
// formulaires prof et les affichages élève en ont besoin), PUT admin.

const DOC_REF = () => adminDb.collection('configuration').doc('didactique');

const CATEGORY_KEYS: (keyof DidactiqueConfig)[] = [
  'uaa',
  'gestesLecture',
  'gestesEcriture',
  'gestesRecherche',
];

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const doc = await DOC_REF().get();
    const config: DidactiqueConfig = doc.exists
      ? { ...DEFAULT_DIDACTIQUE, ...(doc.data() as Partial<DidactiqueConfig>) }
      : DEFAULT_DIDACTIQUE;
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Erreur GET /api/didactique:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// Nettoie une liste d'items reçue du client
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
    const config: DidactiqueConfig = { ...DEFAULT_DIDACTIQUE };
    for (const key of CATEGORY_KEYS) {
      config[key] = sanitizeItems(body?.[key]);
    }
    await DOC_REF().set(config);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Erreur PUT /api/didactique:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
