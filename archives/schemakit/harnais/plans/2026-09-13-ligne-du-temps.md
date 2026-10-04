# 2026-09-13 — Ligne du temps à étages

- **Statut** : proposé → validé le 2026-09-13 (O2-B dates fines, O3 formulaire puis glisser, sans étage = sur l'axe) → livré le 2026-09-13 (partie formulaire)
- **Demande initiale** (JP, 2026-09-13) : « comme dans une frise chronologique, plusieurs
  étages : une ligne graduée et, au-dessus ou au-dessous, des bandeaux (économie,
  politique…) — placer un événement à la fois dans le temps et dans une catégorie. »

## Le problème

Le quatrième type de schéma manque, et c'est le seul dont la position ne se choisit pas
à la main : elle **se calcule** à partir des dates. Une frise scolaire a en plus des
**catégories** (les étages), ce que le format actuel ne sait pas dire.

## Options

### O1 — Ce qu'est un étage

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Liste d'étages dans le schéma** (`Diagram.lanes`, chaque événement porte `laneId`) | Bandeaux nommés, colorés, dessus ou dessous de l'axe, dans l'ordre choisi ; un événement sans étage se pose sur l'axe | Simple, lisible ; se transforme naturellement : étage = branche de carte mentale, événement = idée enfant |
| **B — Étages = coordonnée libre** (l'élève glisse l'événement où il veut verticalement) | Pas de catégorie explicite | Ne répond pas à la demande : rien ne dit « économie » |

**Recommandation : A.**

### O2 — Les dates

| Option | Ce que ça implique |
|---|---|
| **A — Années seulement** (`1815`, `-52` pour av. J.-C.) | Simple, suffit à la plupart des frises d'histoire |
| **B — Années, mois, jours** (`1815`, `1815-06`, `1815-06-18`, années négatives) | Frises fines (une révolution, une guerre) ; l'axe se gradue tout seul (siècles, décennies, années, mois) selon l'étendue |

**Recommandation : B** — la saisie reste « 1815 » quand on n'a que l'année ; la précision
est facultative. Périodes : `1830..1831` (bandeau étiré).

### O3 — Comment on place un événement

| Option | Ce que ça implique |
|---|---|
| **A — Formulaire** : bouton *Ajouter un événement* → popup (date, fin facultative, titre, étage) ; double-clic sur un événement pour le modifier | Fiable au pavé tactile ; la date est tapée, donc juste |
| **B — A + glisser** : déplacer un événement le long de l'axe change sa date (aimantée à la graduation), le glisser dans un autre bandeau change son étage | Plus vivant ; un peu plus de code (aimantation, retour vers la date) |

**Recommandation : B**, en deux temps : A d'abord (une soirée), le glisser ensuite.

### O4 — Le zoom

| Option | Ce que ça implique |
|---|---|
| **A — Zoom uniforme** (celui de React Flow, boutons − / + / Tout voir) | Déjà là ; une frise longue se lit en zoomant |
| **B — Étirement de l'axe** (l'échelle horizontale change, la hauteur non) | Plus proche d'une vraie frise ; à faire après A si le besoin se confirme |

**Recommandation : A** pour ce chantier, B noté dans la roadmap.

## Ce qu'on fait

1. **Données** — `Diagram.lanes?: { id, label, side: 'above' | 'below', color? }[]` ;
   `DiagramNode.date`, `endDate`, `laneId` (déjà prévus pour les deux premiers).
   Analyse des dates dans `src/lib/dates.ts` (année, mois, jour, années négatives).
2. **Échelle et graduation** — `src/lib/timeline-layout.ts` : étendue → échelle
   (pixels par jour), graduations lisibles (siècles / décennies / années / mois),
   empilement des événements dans un étage pour éviter les chevauchements.
3. **Éditeur** — `TimelineEditor.tsx` : axe et bandeaux dessinés dans le repère du schéma
   (`ViewportPortal` de React Flow), événements = boîtes (`EventNode`) ; barre : *Ajouter
   un événement*, *Ajouter un étage*, *Supprimer*, zoom ; popup d'événement (Modal) ;
   étages renommables, colorables, déplaçables dessus/dessous.
4. **Markdown** — déjà fixé pour les événements (`- 1815 : Congrès de Vienne`,
   `- 1830..1831 : Révolution belge`) ; les étages deviennent des sections :
   ```markdown
   ---
   type: timeline
   ---
   # Le XIXe siècle
   ## Politique <!-- côté:dessus couleur:bleu -->
   - 1815 : Congrès de Vienne
   - 1830..1831 : Révolution belge — indépendance de la Belgique
   ## Économie <!-- côté:dessous -->
   - 1835 : Première ligne de chemin de fer Bruxelles–Malines
   ```
   Sans section : l'événement se pose sur l'axe. Sans `côté` : dessus, dessous, en alternance.
5. **Transformations** — frise → carte mentale / organigramme : titre au centre, un étage
   par branche, un événement par idée (« 1815 : Congrès de Vienne »), dans l'ordre du temps.
   Arbre → frise : une branche = un étage si ses idées commencent par une date ; les idées
   sans date vont dans « À placer ». Carte conceptuelle ↔ frise : via l'arbre (avec les
   mêmes pertes signalées).
6. **Accueil** — le type « Ligne du temps » devient disponible.
7. **Outils** — l'onglet Outils sait styler un événement (fond, encadré) et un étage
   (couleur) ; export PNG/PDF inchangé.

Nouvelle dépendance : **aucune**.

## Ce qu'on ne fait pas dans ce chantier

- Pas d'étirement de l'axe (O4-B), pas d'images dans les événements.
- Pas d'axe vertical, pas d'échelle logarithmique (préhistoire / géologie).
- Pas de glisser dans un premier temps (O3 : A puis B).

## Comment on saura que ça marche

Sur `/atelier/[id]` en ligne du temps : deux étages « Politique » (dessus) et « Économie »
(dessous), quatre événements dont une période ; l'axe est gradué en décennies ; deux
événements proches dans le même étage s'empilent sans se chevaucher ; *Tout voir* montre
toute la frise ; le Markdown ci-dessus s'applique et reconstruit la frise ; *Carte
mentale* donne deux branches avec leurs événements dans l'ordre.

## Points à trancher par l'utilisateur

- [ ] O2 : années seules, ou aussi mois et jours (et années négatives) ?
- [ ] O3 : formulaire d'abord puis glisser, ou glisser dès le départ ?
- [ ] Un événement **sans étage** se pose sur l'axe lui-même : d'accord ?
