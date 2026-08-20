// Nettoyage des RESSOURCES d'une activité avant écriture.
//
// Le reste de l'objet (texte, liens, images, vidéos) traverse tel quel : il
// n'a jamais été filtré et n'exécute rien. Ce fichier existe pour l'onglet
// « Interactif », qui, lui, met du CODE À EXÉCUTER dans une page ouverte par
// des mineurs.
//
// ⚠️ C'EST LE SEUL CONTRÔLE QUI COMPTE. Celui du navigateur ne fait
// qu'éviter au professeur de se tromper : une requête forgée ne passe pas
// par lui. Toute nouvelle route qui écrit `devoirs.ressources` doit appeler
// `sanitizeRessources`.

import { integrationAutorisee, TAILLE_MAX_CODE } from '@/lib/integration';
import type { DevoirRessource, RessourceInteractif } from '@/types/devoir';

function texte(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function entier(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(Math.round(n), min), max);
}

/**
 * @param codeAutorise  Le demandeur a-t-il le droit de déposer du code
 *   exécutable ? (administrateur uniquement). Faux : les entrées `code` sont
 *   JETÉES — silencieusement pour la requête, mais elles ne peuvent pas être
 *   arrivées par l'interface, qui ne montre pas le champ.
 */
export function sanitizeRessources(
  input: unknown,
  { codeAutorise }: { codeAutorise: boolean }
): DevoirRessource | null {
  if (!input || typeof input !== 'object') return null;
  const brut = input as Record<string, unknown>;

  const interactifs: RessourceInteractif[] = [];
  if (Array.isArray(brut.interactifs)) {
    (brut.interactifs as unknown[]).forEach((raw, i) => {
      if (!raw || typeof raw !== 'object') return;
      const it = raw as Record<string, unknown>;
      const id = texte(it.id, 40) || `int-${i}`;
      const legende = texte(it.legende, 200);
      const hauteur = entier(it.hauteur, 120, 2000);
      const largeur = entier(it.largeur, 200, 4000);
      const ratio = typeof it.ratio === 'number' && it.ratio > 0 ? it.ratio : undefined;
      const proportions = it.proportions === true && !!ratio;

      if (it.kind === 'code') {
        if (!codeAutorise) return;
        const code = typeof it.code === 'string' ? it.code : '';
        if (!code.trim() || code.length > TAILLE_MAX_CODE) return;
        interactifs.push({
          id,
          kind: 'code',
          code,
          ...(legende ? { legende } : {}),
          ...(hauteur ? { hauteur } : {}),
          ...(largeur ? { largeur } : {}),
        });
        return;
      }

      // Contenu tiers : la liste blanche tranche, ici et nulle part ailleurs.
      const url = texte(it.url, 2000);
      if (!integrationAutorisee(url)) return;
      interactifs.push({
        id,
        kind: 'url',
        url: url!,
        ...(legende ? { legende } : {}),
        ...(hauteur ? { hauteur } : {}),
        ...(largeur ? { largeur } : {}),
        ...(proportions ? { proportions: true, ratio } : {}),
      });
    });
  }

  // Firestore refuse `undefined` : on ne pose la clé que s'il y a quelque chose.
  const out = { ...brut } as unknown as DevoirRessource;
  if (interactifs.length > 0) out.interactifs = interactifs;
  else delete out.interactifs;
  return out;
}
