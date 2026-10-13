# 2026-10-13 — Séquence FLE côté élève : « J'ai lu » et page à deux colonnes

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-13 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé le 2026-10-13** (« go! » de JP) → écrit le 2026-10-14
- **Demande initiale** (JP, 2026-10-13, vue élève de « Se présenter ») : « la séquence est
  considérée comme vue alors que l'élève n'a pas marqué l'étape comme terminée… bouton
  manquant (regarde sur lecture d'un cours) » ; « le design ne ressemble plus à la page de
  travail de RectoVerso : où est le système en 2 colonnes habituel ? »

## Le problème

1. **Une théorie n'a pas d'état.** `SequenceFleActivity` ne compte que les ACTIVITÉS
   (`aFaire`) : une séquence faite de théorie seule affiche « Tout est fait. Bravo ! » dès
   l'ouverture. Aucun geste ne permet à l'élève de dire « j'ai lu ».
2. **La page n'est pas la page de travail.** `/activites/[id]` sort AVANT le gabarit à deux
   colonnes pour une séquence et montre un « serpentin » centré (ligne de crans + étapes
   empilées) — un autre monde visuel que toutes les autres activités (et que le portfolio,
   qui, lui, a été remis dans les deux colonnes le 2026-10-09).

## Options — où ranger « j'ai lu » (le seul choix technique)

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Un document de progression à part** `progressionsSequence/{devoirId}_{uid}` : `{ lues: [idÉtape…], majAt }` | Lu/écrit par une route serveur (`/api/devoirs/[id]/parcours-fle`, PATCH) ; ne touche à rien d'existant | Une collection de plus (serveur seulement : aucune règle Firestore) |
| **B — Une « copie » de l'élève pour la séquence** `TRV-{devoirId}-{uid}` avec `theoriesLues` | Patron des travaux, comme `consignesCochees` | La séquence aurait des « copies » : compteurs « copies remises », page des copies, accueil prof (À corriger, retards)… à neutraliser partout |
| **C — Rien de stocké : « vu » = ouvert une fois** | Aucune écriture | Ce n'est pas ce que JP demande (geste explicite, comme « J'ai lu, je continue ») |

**Retenue : A** (choix JP, 2026-10-13) — isolée, rien à neutraliser ailleurs.

## Ce qu'on fait

1. **« J'ai lu, je continue »** sous chaque théorie (même libellé et même rendu que
   `BoutonLu` de la lecture de cours) → l'étape passe à « fait », la suivante s'ouvre.
   `EtapeParcoursTheorie` reçoit un `etat` (lu ou non) ; « Tout est fait » compte TOUTES les
   étapes. Le prof en aperçu voit le bouton, sans écrire.
   Fichiers : `src/types/sequence-fle.ts`, `src/app/api/devoirs/[id]/parcours-fle/route.ts`
   (GET lit, PATCH écrit), `SequenceFleActivity`.
2. **La page de travail à deux colonnes**, comme le portfolio :
   - **colonne 1** = l'étape ouverte : théorie (introduction + ressources en volets + « J'ai
     lu ») ou activité (sa carte : état, type, bouton « Ouvrir l'activité ») ;
   - **colonne 2 (rail à onglets)** = **« Sommaire de la séquence »** : les étapes dans
     l'ordre, cochées quand elles sont faites, cliquables (au modèle de `PortfolioSommaire`),
     + « Consignes » si la séquence en porte.
   La ligne de crans et le serpentin centré disparaissent.
   Fichiers : `src/app/activites/[id]/page.tsx` (la séquence entre dans le gabarit au lieu
   d'en sortir), `SequenceFleActivity` (scindée : étape / sommaire).

## Ce qu'on ne fait pas dans ce chantier

- Pas de suivi de la lecture des théories côté prof (qui a lu quoi) — à demander si besoin.
- Pas de blocage « lire avant de passer à l'activité » : l'élève reste libre de l'ordre.
- On ne touche pas à la page d'une activité ouverte depuis la séquence.

## Comment on saura que ça marche

- Compte 007 : « Se présenter » s'ouvre dans les deux colonnes ; « Prépositions » n'est pas
  cochée ; « J'ai lu, je continue » → coché dans le sommaire, « Tout est fait » seulement
  quand toutes les étapes le sont ; on recharge : l'état est conservé.
- Prof en « Vue élève » : même page, rien n'est enregistré.

## Points à trancher par l'utilisateur

- [x] Où ranger « j'ai lu » : **A** (JP, 2026-10-13).
- [ ] Validation du plan.
