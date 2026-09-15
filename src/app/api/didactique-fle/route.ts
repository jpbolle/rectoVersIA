import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { DEFAULT_DIDACTIQUE_FLE } from '@/types/didactique-fle';
import type {
  DescripteurFle,
  DidactiqueFleConfig,
  DidactiqueItem,
  NiveauCecr,
} from '@/types/didactique-fle';

// Référentiel FLE (compétences du radar, niveaux du CECR, descripteurs
// « Je peux… », types de module), document unique configuration/didactique-fle.
// GET pour tout utilisateur connecté (formulaires prof, radar élève), PUT admin.
// Même mécanique que /api/didactique — un document à part, pour ne pas toucher
// au référentiel du cours de français, en production.

const DOC_REF = () => adminDb.collection('configuration').doc('didactique-fle');

// Complète un document partiel avec les défauts : une liste vide ou absente
// retombe sur celle du code (le document n'a jamais été enregistré, ou une
// liste a été vidée par erreur)
function normaliser(stored: Partial<DidactiqueFleConfig>): DidactiqueFleConfig {
  return {
    competences:
      Array.isArray(stored.competences) && stored.competences.length
        ? stored.competences
        : DEFAULT_DIDACTIQUE_FLE.competences,
    niveaux:
      Array.isArray(stored.niveaux) && stored.niveaux.length
        ? stored.niveaux
        : DEFAULT_DIDACTIQUE_FLE.niveaux,
    descripteurs: Array.isArray(stored.descripteurs) ? stored.descripteurs : [],
    typesModule:
      Array.isArray(stored.typesModule) && stored.typesModule.length
        ? stored.typesModule
        : DEFAULT_DIDACTIQUE_FLE.typesModule,
  };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const doc = await DOC_REF().get();
    const stored = doc.exists ? (doc.data() as Partial<DidactiqueFleConfig>) : {};
    const config = normaliser(stored);
    // Document jamais enregistré : les descripteurs d'amorce plutôt que rien
    if (!doc.exists) config.descripteurs = DEFAULT_DIDACTIQUE_FLE.descripteurs;
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Erreur GET /api/didactique-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// Nettoie une liste simple (compétences, types de module)
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

// Nettoie les niveaux : un rang numérique est exigé, l'ordre est celui des rangs
function sanitizeNiveaux(input: unknown): NiveauCecr[] {
  if (!Array.isArray(input)) return [];
  const items: NiveauCecr[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 60) : '';
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 60) : '';
    const rang = typeof item.rang === 'number' && Number.isFinite(item.rang) ? item.rang : NaN;
    if (!id || !label || seen.has(id) || Number.isNaN(rang)) continue;
    seen.add(id);
    items.push({ id, label, rang, visible: item.visible !== false });
  }
  return items.sort((a, b) => a.rang - b.rang);
}

// Nettoie les descripteurs : compétence et niveau doivent exister
function sanitizeDescripteurs(
  input: unknown,
  competenceIds: Set<string>,
  niveauIds: Set<string>
): DescripteurFle[] {
  if (!Array.isArray(input)) return [];
  const items: DescripteurFle[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 60) : '';
    const competence = typeof item.competence === 'string' ? item.competence : '';
    const niveau = typeof item.niveau === 'string' ? item.niveau : '';
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 400) : '';
    if (!id || seen.has(id) || !label) continue;
    if (!competenceIds.has(competence) || !niveauIds.has(niveau)) continue;
    seen.add(id);
    items.push({ id, competence, niveau, label, visible: item.visible !== false });
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
    const competences = sanitizeItems(body?.competences);
    const niveaux = sanitizeNiveaux(body?.niveaux);
    const typesModule = sanitizeItems(body?.typesModule);
    const base = normaliser({ competences, niveaux, typesModule });
    const config: DidactiqueFleConfig = {
      ...base,
      descripteurs: sanitizeDescripteurs(
        body?.descripteurs,
        new Set(base.competences.map((c) => c.id)),
        new Set(base.niveaux.map((n) => n.id))
      ),
    };
    await DOC_REF().set(config);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Erreur PUT /api/didactique-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
