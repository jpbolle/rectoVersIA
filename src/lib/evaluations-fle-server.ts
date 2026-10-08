// Évaluations FLE — Firestore côté serveur. SERVEUR UNIQUEMENT.

import { adminDb } from '@/lib/firebase/admin';
import type { EvaluationFle, SourceEvaluation, TypeEvaluation } from '@/types/evaluation-fle';

export const COLL_EVALUATIONS = 'evaluationsFle';
export const COLL_FICHIERS = 'fichiersFle';

export function genererIdEvaluation(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `EVF-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function toISO(v: unknown): string {
  const d = v as { toDate?: () => Date } | null;
  if (d && typeof d.toDate === 'function') return d.toDate().toISOString();
  return typeof v === 'string' ? v : '';
}

export function lireEvaluation(id: string, data: FirebaseFirestore.DocumentData): EvaluationFle {
  const type = data.type;
  return {
    id,
    classeId: String(data.classeId ?? ''),
    profId: String(data.profId ?? ''),
    titre: String(data.titre ?? ''),
    type: type === 'diagnostic' || type === 'certificative' ? type : 'regulative',
    source: (data.source && typeof data.source === 'object' ? data.source : { kind: 'lien', url: '' }) as SourceEvaluation,
    createdAt: toISO(data.createdAt),
  };
}

export function estTypeEvaluation(v: unknown): v is TypeEvaluation {
  return v === 'diagnostic' || v === 'regulative' || v === 'certificative';
}

/** Les évaluations d'une liste de classes (par lots de 30), les plus récentes d'abord. */
export async function evaluationsDesClasses(classeIds: string[]): Promise<EvaluationFle[]> {
  const out: EvaluationFle[] = [];
  for (let i = 0; i < classeIds.length; i += 30) {
    const snap = await adminDb
      .collection(COLL_EVALUATIONS)
      .where('classeId', 'in', classeIds.slice(i, i + 30))
      .get();
    snap.docs.forEach((d) => out.push(lireEvaluation(d.id, d.data())));
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
