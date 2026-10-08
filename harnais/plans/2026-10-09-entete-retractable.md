# 2026-10-09 — En-tête qui se rétracte au défilement

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-09 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé (« ok pour ta recommandation ») et ÉCRIT le 2026-10-09, rien vu à l'écran**. Choix par défaut : le titre disparaît entièrement en mode réduit ; même comportement sous le bandeau de prévisualisation (`topOffset` se cumule)
- **Demande initiale** (JP, 2026-10-09) : l'en-tête est fixe ; quand on fait défiler une
  page, il devrait se réduire à la ligne des boutons. Le grand logo se réduit par le
  centre, progressivement ; la cloche, l'avatar et le double bouton des espaces
  descendent progressivement pour rejoindre la ligne des boutons, à droite.

## Le problème

L'en-tête fait ~190 px (logo 90 px, titre, sous-titre, ligne de boutons) et reste fixe :
sur un Chromebook, il mange un quart de l'écran pendant toute la lecture d'une copie
ou d'une liste.

## Options

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Deux états, transition CSS** : passé 80 px de défilement, le `Header` reçoit une classe `compact` ; titre, sous-titre et logo disparaissent, les actions passent sur la ligne des boutons. Un seul écouteur de défilement | 1 fichier CSS, 1 hook (`useDefilement`) dans `Header.tsx`. Aucune page à toucher | Pas « progressif » : un basculement animé (≈ 250 ms). Le plus robuste |
| **B — Progressif, piloté par le défilement** : une variable CSS `--t` (0 → 1 sur les 140 premiers px) posée sur l'en-tête à chaque image (`requestAnimationFrame`) ; le logo fait `scale(1 - t)` depuis son centre et s'efface, titre/sous-titre se replient, les actions glissent de `translateY` vers la ligne des boutons, à droite | Même périmètre de fichiers, mais la hauteur de l'en-tête devient continue | Fidèle à la demande. À encadrer : `prefers-reduced-motion` ⇒ option A ; au clavier, pas de saut |
| **C — Supprimer le fixe** (l'en-tête défile avec la page) | Trivial | Les boutons de navigation disparaissent — hors demande |

**Retenue : B**, avec A comme repli automatique pour les utilisateurs qui ont demandé
moins d'animations.

## Ce qu'on fait

1. `src/components/Header/Header.tsx` — mesure du défilement (un seul écouteur passif,
   `rAF`), variable `--t` sur `<header>`, classe `compact` quand `t === 1`.
2. `src/components/Header/Header.module.css` — le logo : `transform: scale(calc(1 - var(--t)))`
   + `opacity`, origine au centre ; titre et sous-titre : hauteur et opacité pilotées par
   `--t` ; `.headerActions` : de `top: 20px` à la ligne des boutons (`translateY`), toujours
   collé à droite ; la ligne de boutons reste centrée. Padding de l'en-tête de 25 px à 10 px.
3. ⚠ **Rien à changer dans les pages** : elles réservent la hauteur de l'en-tête par des
   marges en dur (`margin-top: 220px` / `280px` dans ~20 CSS). Cette réserve correspond à
   l'en-tête **déplié**, qui est l'état en haut de page — c'est précisément là qu'elle sert.
   (Gotcha à consigner dans `init.md` : la hauteur de l'en-tête vit dans 20 fichiers.)
4. Variantes : prof, élève, FLE et admin partagent le même mécanisme (même composant).
   `topOffset` (bandeau de prévisualisation) se cumule comme aujourd'hui.

## Ce qu'on ne fait pas dans ce chantier

- Pas de refonte des marges des pages ni de passage à une variable CSS de hauteur.
- Pas de changement des menus ni du double bouton.
- Pas d'en-tête différent sur mobile.

## Comment on saura que ça marche

Sur `/dashboard` avec une dizaine d'activités : en haut, l'en-tête complet ; en
descendant, le logo se contracte vers son centre, le titre se replie, la cloche,
l'avatar et le double bouton glissent sur la ligne des boutons à droite ; arrivé à
140 px, il ne reste qu'une bande de boutons. En remontant, l'inverse. Aucun saut de
contenu, aucun tressautement au-dessus d'une page courte.

## Points à trancher par l'utilisateur

- [ ] Le titre « RectoVerso » disparaît-il entièrement en mode réduit, ou reste-t-il en
      petit à gauche, à la place du logo ?
- [ ] Même comportement sur les pages à bandeau (prévisualisation élève) ?
