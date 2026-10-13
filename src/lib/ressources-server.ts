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
import {
  TAILLE_MAX_DIAPORAMA,
  tailleDiaporama,
  type Dia,
  type DiaBloc,
  type RessourceDiaporama,
} from '@/types/diaporama';

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

// Le DIAPORAMA (points de théorie FLE, plan 2026-10-13) porte, lui aussi, des
// dias HTML : même règle que l'Interactif — une page tierce passe la liste
// blanche, du code n'est accepté que de l'administrateur. Une dia HTML vidée
// par ce contrôle disparaît. Les blocs sont recopiés champ par champ.
function nettoyerBloc(raw: unknown): DiaBloc | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const id = texte(b.id, 60) || `blc-${Math.random().toString(36).slice(2, 8)}`;
  const brut = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  switch (b.kind) {
    case 'texte':
      return { id, kind: 'texte', texte: brut(b.texte, 20_000) };
    case 'encadre': {
      const largeur = entier(b.largeur, 20, 100);
      return {
        id,
        kind: 'encadre',
        label: brut(b.label, 500),
        valeur: brut(b.valeur, 500),
        ...(largeur && largeur < 100 ? { largeur } : {}),
      };
    }
    case 'lien':
      return { id, kind: 'lien', label: brut(b.label, 300), url: brut(b.url, 2000) };
    case 'image': {
      const taille = entier(b.taille, 20, 200);
      const lien = typeof b.lien === 'string' ? b.lien.slice(0, 2000) : undefined;
      const f = b.fenetre as Record<string, unknown> | undefined;
      const fenetre =
        f && typeof f === 'object' ? { titre: brut(f.titre, 300), corps: brut(f.corps, 20_000) } : undefined;
      return {
        id,
        kind: 'image',
        src: brut(b.src, 2000),
        alt: brut(b.alt, 500),
        ...(taille ? { taille } : {}),
        ...(lien !== undefined ? { lien } : fenetre ? { fenetre } : b.agrandir === true ? { agrandir: true } : {}),
      };
    }
    default:
      return null;
  }
}

function nettoyerDiaporama(input: unknown, codeAutorise: boolean): RessourceDiaporama | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as Record<string, unknown>;
  if (!Array.isArray(d.dias)) return null;
  const dias: Dia[] = [];
  (d.dias as unknown[]).slice(0, 200).forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Record<string, unknown>;
    const id = texte(r.id, 60) || `dia-${i}`;
    const titre = typeof r.titre === 'string' ? r.titre.slice(0, 300) : '';
    if (r.html && typeof r.html === 'object') {
      const h = r.html as Record<string, unknown>;
      const url = texte(h.url, 2000);
      const code = typeof h.code === 'string' ? h.code : '';
      const html: Dia['html'] = {};
      if (url && integrationAutorisee(url)) html.url = url;
      if (codeAutorise && code.trim() && code.length <= TAILLE_MAX_CODE) html.code = code;
      // Rien de recevable : la dia est jetée (elle ne pouvait venir de l'interface)
      if (!html.url && !html.code && (url || code.trim())) return;
      const zoom = entier(r.zoom, 10, 400);
      dias.push({
        id,
        titre,
        blocs: [],
        html,
        ...(zoom ? { zoom } : {}),
        ...(r.centrer === true ? { centrer: true } : {}),
      });
      return;
    }
    const blocs = Array.isArray(r.blocs)
      ? (r.blocs as unknown[]).slice(0, 50).map(nettoyerBloc).filter((b): b is DiaBloc => b !== null)
      : [];
    dias.push({ id, titre, blocs });
  });
  if (dias.length === 0) return null;
  const out: RessourceDiaporama = { titre: typeof d.titre === 'string' ? d.titre.slice(0, 300) : '', dias };
  return tailleDiaporama(out) > TAILLE_MAX_DIAPORAMA ? null : out;
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
  const diaporama = nettoyerDiaporama(brut.diaporama, codeAutorise);
  if (diaporama) out.diaporama = diaporama;
  else delete out.diaporama;
  return out;
}
