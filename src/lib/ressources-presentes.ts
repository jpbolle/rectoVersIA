// Une ressource jointe a-t-elle QUELQUE CHOSE à montrer ? — la même lecture
// que l'onglet Ressources (`RessourcesTab`) : texte (forme actuelle ou
// ancienne `content`), liens, fichiers, vidéos, interactifs. Un document qui
// ne contient qu'une image compte (⚠ `compterRessources` de module-fle, lui,
// ignore l'ancien `content` et juge « vide » un document sans texte — d'où
// les ressources générales du portfolio masquées à tort le 2026-10-11).

import type { DevoirRessource } from '@/types/devoir';

export function ressourcesPresentes(r: DevoirRessource | null | undefined): boolean {
  if (!r) return false;
  const outils = (r.outils ?? '').trim();
  const document = (r.document ?? '').trim();
  const ancien = (r.content ?? '').trim();
  return (
    outils.length > 0 ||
    (document.length > 0 && document !== '<p></p>') ||
    ancien.length > 0 ||
    (r.files?.length ?? 0) > 0 ||
    (r.videos?.length ?? 0) > 0 ||
    (r.interactifs?.length ?? 0) > 0
  );
}
