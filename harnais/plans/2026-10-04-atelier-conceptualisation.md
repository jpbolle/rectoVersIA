# 2026-10-04 — Atelier de conceptualisation (+ popup de choix d'atelier)

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-04 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé le 2026-10-04** (O1 = SchémaKit **et** formes libres dès la v1 ; O3 = pas de maquette, code direct ; O4 = l'élève change de type à tout moment, encadré « À placer » conservé ; O5 = A ; libellé « Atelier de conceptualisation », mode lire-écrire ; ordre popup puis moteur) — JP : « tu fais toutes les étapes sans mon accord et je testerai ensuite » → **livré le 2026-10-04** : étapes 1 à 4 écrites, testées par JP et déployées le jour même (voir `memoire/rollup_conceptualisation.md`)
- **Demande initiale** (JP, 2026-10-04) : une nouvelle activité de français, l'**Atelier de
  conceptualisation** — à partir d'une **base documentaire** (colonne de droite, dans
  l'esprit de la lecture d'une œuvre), les élèves construisent un **schéma** avec un outil
  « comme draw.io mais très flexible » (métamorphose en carte mentale, ligne du temps…).
  Côté prof : l'atelier. Côté élève : aussi la possibilité de **créer ses propres cartes sans
  base documentaire** dans *Mes ressources*. Et, parce qu'il y a désormais beaucoup
  d'ateliers : à la création, **d'abord une grande popup qui présente les types d'atelier**
  (schéma, titre, très courte explication), **puis** le double panneau recto/verso.
- **Décisions déjà prises le 2026-10-04** : accord pour ajouter `@xyflow/react` et
  `html-to-image` ; le schéma est un **dispositif** (pas un type de question — plus tard,
  sur le même éditeur).

## Ce qui existe déjà — et qu'on ne réécrit pas

| Source | Ce qu'on reprend | Où c'est |
|---|---|---|
| **SchémaKit** (maquette, sept. 2026) | Le moteur entier : 4 types (carte conceptuelle, carte mentale, schéma hiérarchisé, ligne du temps à étages), **transformations entre types** avec « à placer », **Markdown bidirectionnel**, styles (palette fermée + couleur libre), barres flottantes, export PNG/PDF. ~4 500 lignes écrites **pour être transposées** (CSS Modules, tokens `--c-*`, aucune dépendance à l'app) | `archives/schemakit/src/{types/diagram.ts, lib/, components/diagram/}` |
| **VibeCoding** (card « Schéma ») | Le **dessin libre** façon draw.io : formes (rectangle, ellipse, losange, note, texte), flèches par points d'accroche, redimensionnement | `github.com/jpbolle/vibecoding`, `src/components/module/DiagramCardView.tsx` + `diagram-model.ts` (1 000 lignes) |
| **Recto-versIA** | Classes, devoirs, travaux, correction, la **page élève** (colonne de travail + rail de droite `WorkspaceRail` avec Consignes / Ressources / IA / Remarques / Évaluation), la **base documentaire** `Devoir.ressources` saisie par `RessourcesInput` et rendue en volets par `RessourcesTab`, l'enregistrement automatique `useTravail` (2,5 s), le double panneau recto/verso de `CreationForm` | voir § « Ce qu'on fait » |

Le point clé : **la colonne de droite existe déjà**. Toute activité a son rail avec l'onglet
Ressources en volets (texte annotable, images, vidéos, interactifs). L'atelier de
conceptualisation n'invente pas de base documentaire : il met un **éditeur de schéma dans la
colonne de gauche** et laisse le rail faire son travail à droite.

## Le problème

- L'app n'a aucun moyen pour un élève de **schématiser** : les productions sont du texte,
  des réponses, des annotations. Conceptualiser (hiérarchiser, relier, dater) n'a pas d'outil.
- Le prototype qui le permet (SchémaKit) vit **hors de l'app**, sans classes, sans devoirs,
  sans correction, en stockage local du navigateur.
- À la création d'une activité, le type se choisit dans un **menu déroulant de 8 entrées**
  (`CreationForm.tsx:510`) qui ne dit rien de ce que chaque atelier fait ; un 9ᵉ arrive.

## Options

### O1 — Quel éditeur : SchémaKit, VibeCoding, ou les deux ?

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — SchémaKit seul** (4 types « pédagogiques » + métamorphose) | Transposition quasi telle quelle ; pas de formes libres | 1 soirée de transposition ; l'élève ne dessine pas « à la draw.io » |
| **B — VibeCoding seul** (formes libres) | Un tableau blanc ; **aucune métamorphose** (une forme libre n'a ni parent ni date) | Perd l'essentiel de la demande (« très flexible ») |
| **C — SchémaKit d'abord, formes libres ensuite comme 5ᵉ type « schéma libre »** | On livre A ; plus tard, un type `libre` reprenant les formes de VibeCoding, **non transformable** (ou transformable avec pertes vers « À placer ») | A + 1 à 2 soirées plus tard ; les deux reposent sur React Flow, donc fusion naturelle |

**Retenue : C.** La métamorphose est ce qui distingue l'outil d'un draw.io ; les formes
libres sont un confort qu'on ajoute quand les 4 types tournent dans l'app.

### O2 — Où vit le schéma d'un élève ?

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — `travail.content` en JSON** (comme vocabulaire, lecture, auto-évaluation, œuvre) | Patron existant : `onChange → updateContent(JSON.stringify(diagram))` ; correction lit le même JSON | Zéro structure nouvelle ; un `Diagram` pèse quelques Ko (pas d'image incrustée) |
| **B — collection `schemas` à part** | Routes, règles, jointures en plus | Inutile pour l'atelier ; **utile pour les schémas personnels** (sans devoir) |

**Retenue : A pour l'atelier, B pour *Mes ressources* élève** — collection `schemasPersonnels`
(un doc par schéma : `studentEmailHash`, `titre`, `type`, `diagram`, `updatedAt`), accès
**uniquement par routes serveur** `/api/schemas/personnel` (règle RGPD du projet : jamais
Firestore direct côté client pour des données élèves). Aucun champ d'identité à chiffrer
(seule l'empreinte HMAC est stockée).

### O3 — La popup de choix d'atelier

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Icônes `lucide-react`** sur chaque carte | Vite fait ; icônes génériques (un crayon, un livre…) | Dit peu de l'atelier |
| **B — Mini-pictogrammes SVG dessinés** (un par atelier : grille, questionnaire, livre ouvert, loupe, nuage de mots, miroir, smileys, serpentin, carte conceptuelle) | Un petit SVG inline par carte, aux tokens Classica | 1 soirée de dessin ; c'est le « schéma » demandé |

**Retenue : B.** Modèle de structure : `ModuleActivitesModal` (cartes-boutons `path` /
`pathTitle` / `pathDesc`), qui enchaîne déjà vers `CreationForm`. Brique nouvelle → **une
maquette HTML** avant le code (règle des maquettes : 2 tours maximum).

### O4 — Le prof fixe-t-il le type de schéma ?

| Option | Ce que ça implique |
|---|---|
| **A — Type de départ imposé, métamorphose libre** | Le prof choisit (ex. « ligne du temps ») ; l'élève part de là et peut transformer |
| **B — Type verrouillé** | L'élève ne peut pas changer de type (consigne stricte : « faites une carte mentale ») |
| **C — Les deux, par une case « L'élève peut changer de type »** | Réglage sur le devoir, défaut = libre |

**Retenue : C.** C'est une case à cocher de plus au recto, et c'est une vraie différence
didactique (découvrir la forme qui convient ≠ exercer une forme donnée).

### O5 — Corriger un schéma

| Option | Ce que ça implique |
|---|---|
| **A — Lecture + commentaire général** | Le prof voit le schéma (éditeur en lecture seule, zoom, PNG), écrit/dicte son commentaire général existant |
| **B — A + note et remarque** sur le modèle de la recherche (`rechercheScores` : note + remarque sur la production) | Un total écrit, visible dans le tableau de bord et exportable vers KitSchool |
| **C — A + grille d'évaluation** (comme l'écriture) | Réutilise `GrilleTab` ; mais les grilles sont des grilles **d'écriture** |

**Retenue : B**, en deux temps : A dans l'étape de correction, B quand JP aura corrigé un
vrai schéma et saura quoi noter. ⚠ Si B : écrire le total comme `scoreLecture` (trace
pour KitSchool), pas seulement le recalculer.

## Ce qu'on fait — dans cet ordre

Chaque étape se **voit à l'écran** avant d'entamer la suivante (règle du macro-plan).

1. **Popup de choix d'atelier** (indépendante du reste, la plus visible, la moins chère)
   — maquette HTML d'abord. Puis composant `AtelierChoiceModal` (portail, fond assombri,
   grande grille de cartes : pictogramme + titre + une ligne), ouvert par `CreateDevoirCard`
   et les trois autres points d'entrée ; la carte choisie ouvre `CreationForm` avec
   `atelierInitial`. Le `<select>` du recto reste (changer d'avis sans fermer), la séquence
   FLE reste filtrée en mode FLE.
   Fichiers : `src/components/AtelierChoiceModal/` (nouveau), `src/app/dashboard/page.tsx`,
   `ActiviteFlePanel.tsx`, `SequencesFlePanel.tsx`, `ModuleActivitesModal.tsx`,
   `src/types/didactique.ts` (une `description` courte par atelier dans `ATELIERS`).

2. **Transposer le moteur + *Mes schémas* de l'élève** (premier hôte visible, sans devoir)
   — `npm install @xyflow/react html-to-image` ; copie de `archives/schemakit/src/types/diagram.ts`
   → `src/types/diagram.ts`, `src/lib/diagram-*.ts`, `tree*.ts`, `timeline-layout.ts`,
   `dates.ts`, `tag-drop.ts` → `src/lib/diagram/`, `components/diagram/*` →
   `src/components/Diagram/` ; `local-store.ts` et `use-mounted.ts` **ne sont pas repris**
   (remplacés par l'API). `Modal` de SchémaKit → remplacé par une popup locale au style du
   projet. Puis onglet **« Mes schémas »** dans `src/app/mes-ressources/page.tsx` (vignettes,
   nouveau → choix du type, ouvrir, dupliquer, supprimer avec popup), page
   `/mes-ressources/schemas/[id]` = `DiagramWorkspace` plein écran, enregistrement différé.
   Routes : `src/app/api/schemas/personnel/route.ts` (+ `[id]`), `adminDb`.
   ⚠ Les 3 nœuds (`ConceptNode`, `TreeNode`, `EventNode`) dupliquent la boîte éditable :
   **un composant commun** à la transposition (noté dans `init.md` de SchémaKit).

3. **Le dispositif `schematiser` / atelier `conceptualisation`** — côté prof puis élève.
   - Types : `TypeTravail` + `Dispositif` (+ `profil-stats.ts:73`, `profil.ts:40,237`),
     entrée `ATELIERS` (`label` « Atelier de conceptualisation », `modeParDefaut` à
     trancher), `Devoir.schema?: { typeDepart: DiagramType; typeLibre: boolean }`.
   - **Recto** de `CreationForm` : type de schéma de départ + case « L'élève peut changer
     de type » ; **verso** : *Ressources pour l'élève* (`RessourcesInput`, déjà là) — c'est
     la base documentaire ; pas de constructeur de contenu (`aContenus = false`).
     `EditDevoirModal` idem. `buildData`, `api/devoirs` (création, lecture, mise à jour),
     `devoir-copie.ts`, `DevoirCard` (pastille), filtre du dashboard.
   - **Page élève** `activites/[id]/page.tsx` : aiguillage `isSchema` → `DiagramWorkspace`
     dans la colonne de gauche (sans sa colonne « titre + consignes » de SchémaKit : les
     consignes sont dans le rail), `onChange → updateContent(JSON.stringify(diagram))`,
     rail de droite inchangé (Consignes · Ressources en volets · Remarques), bouton
     Remettre existant. `hideSubmit`, `showRemarques`, `correction-etat.ts`.
   - Vérification : un prof crée l'atelier avec un texte + une image en ressources ; un
     élève ouvre, lit à droite, schématise à gauche, transforme, recharge → tout est là.

4. **Correction** (O5-A) — `dashboard/travaux/[devoirId]/[travailId]/page.tsx` : branche
   `schematiser` → `DiagramWorkspace` en **lecture seule** (zoom, PNG) à gauche, rail prof
   à droite, commentaire général (texte + audio) existant, « Rendre visible ». Liste des
   copies : vignette PNG du schéma dans `dashboard/travaux/[devoirId]/page.tsx` si peu
   coûteux, sinon le titre et le type.

5. **Plus tard, dans cet ordre** (chaque point = sa propre décision) : notation (O5-B) ·
   type « schéma libre » (O1-C) · export Markdown → document d'écriture (bouton « Copier
   pour un document ») · schéma **modèle** fourni par le prof que l'élève complète · le
   schéma comme **type de question** des questionnaires · profil élève (onglet / tuile).

## Ce qu'on ne fait pas dans ce chantier

- Pas de formes libres ni d'images dans les boîtes (v1 = 4 types SchémaKit).
- Pas de notation ni de grille : lecture + commentaire général seulement (étape 4).
- Pas de travail à plusieurs sur un schéma, pas de temps réel.
- Pas de schéma dans les questionnaires, pas de tuile dans le profil, pas de certification.
- Pas de Firebase Storage : un `Diagram` ne contient aucune image.
- `archives/schemakit/` reste tel quel : c'est la trace, on **copie**, on n'y code plus.

## Comment on saura que ça marche

- **Étape 1** : « Créer un nouveau travail » ouvre une grande popup à 9 cartes dessinées ;
  je clique « Lecture d'une œuvre » → le formulaire s'ouvre déjà réglé sur cet atelier.
- **Étape 2** : un élève va dans *Mes ressources › Mes schémas*, crée une carte mentale,
  la passe en ligne du temps, ferme l'onglet, revient : elle est là, avec sa vignette.
- **Étape 3** : atelier créé par le prof avec un texte et une image ; l'élève schématise
  à gauche en lisant à droite ; il remet ; le prof voit le schéma dans la copie.
- **Étape 4** : le prof zoome sur le schéma, dicte un commentaire, le rend visible ;
  l'élève le lit sous son schéma.

## Points à trancher par l'utilisateur

- [ ] O1 : SchémaKit d'abord, formes libres **plus tard** (C) — ou exigées dès la v1 ?
- [ ] O3 : pictogrammes SVG dessinés (B) et **une maquette HTML** de la popup avant le code ?
- [ ] O4 : case « L'élève peut changer de type » (C), défaut = libre ?
- [ ] O5 : correction v1 = lecture + commentaire général (A), notation ensuite ?
- [ ] Noms : dispositif `schematiser`, atelier `conceptualisation`, libellé
      « Atelier de conceptualisation », mode principal (`modeParDefaut`) = `ecrire` ?
      (le profil range les productions par mode : lire / écrire / parler / rechercher…)
- [ ] Ordre : popup (1) avant moteur (2) — ou l'inverse si tu veux voir le schéma d'abord ?
