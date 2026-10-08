# Atelier de conceptualisation — schémas dans Recto-versIA

> Rollup du chantier « schématisation » (macro-plan, chantier 2). Plan :
> `harnais/plans/2026-10-04-atelier-conceptualisation.md`.

## 2026-10-04 — les quatre étapes écrites d'un bloc, puis **TESTÉES ET VALIDÉES par JP le soir même, DÉPLOYÉES**

JP est parti faire du vélo après avoir validé le plan (« tu fais toutes les étapes
sans mon accord et je testerai ensuite »). À son retour : « j'ai vu et testé », « tout
est ok, version bien déployée ». Déploiement VPS le 2026-10-04 (après un build OOM :
`NODE_OPTIONS` manquait dans le skill `/deploy`, corrigé).

### Ce qui a été retrouvé (et où)

- Le « méga-plan » = `harnais/macro-plan.md`. La note « plans introuvables » du
  04/10 au soir venait du MacBook Pro ; sur le Studio, rien de plus que le distant.
- La **maquette SchémaKit** n'était ni sur un Mac ni dans un artefact : sur GitHub,
  `github.com/jpbolle/schemakit` (privé). Copiée **sans historique git** dans
  `archives/schemakit/` (exclu de `tsconfig.json` et d'`eslint.config.mjs`). C'est
  une trace : on **copie**, on n'y code plus.
- `github.com/jpbolle/vibecoding` (card « Schéma » = petit draw.io, React Flow) et
  `github.com/jpbolle/mapkit` (ancêtre, dépassé) ont été lus, pas copiés.

### Étape 1 — popup de choix du type d'activité

`AtelierChoiceModal` (+ `AtelierChoiceGrid` sans portail, + `AtelierPicto` : un SVG
dessiné par atelier). Ouverte par la carte « Créer un nouveau travail » du tableau de
bord, par « Créer une activité FLE » (filtre `modeFle`, sans séquence) et par le chemin
« Créer » de `ModuleActivitesModal` (grille inline, « ← Retour »). La carte choisie
ouvre `CreationForm` avec `atelierInitial` (+ `key` pour repartir à zéro). Le `<select>`
du recto reste. `Atelier.description` (une ligne) ajouté dans `ATELIERS`.
`SequencesFlePanel` n'a pas de popup : le type y est connu.

### Étape 2 — moteur + « Mes schémas » élève

- `npm install @xyflow/react html-to-image` (accord JP du 04/10).
- Transposé tel quel : `src/types/diagram.ts`, `src/lib/diagram/*` (préférences
  d'affichage = `preferences.ts`, le `local-store` de la maquette n'existe plus),
  `src/components/Diagram/*` (+ `Diagram/ui/` : `Modal`, `buttons.module.css`).
  Cinq tokens ajoutés à `globals.css` (`--c-surface`, `--c-canvas`, `--c-grid`,
  `--c-muted`, `--c-edge`).
- `DiagramWorkspace` : props `embedded` (pas de colonne de gauche, hauteur du
  conteneur) et `lockType` (pas de barre de transformation).
- **5ᵉ type `libre`** (formes libres, repris de VibeCoding mais réécrit en CSS
  Modules) : `DiagramNode.shape/width/height`, `DiagramEdge.path/arrow` ; le
  `ConceptMapEditor` en mode `free` (formes dans la barre, `NodeResizer`, sélecteur
  de forme dans la barre flottante, tracé courbe/coudé/droit et sens de la flèche
  sur le lien). Transformations : libre ↔ carte conceptuelle (les formes s'oublient),
  le reste via la carte. Markdown : `forme:losange taille:160x80`, `tracé:coudé`,
  `flèche:deux`.
- Collection **`schemasPersonnels`** (uid, titre, type, diagram, thumbnail, dates) —
  routes `/api/schemas/personnel` (GET liste, POST créer / `duplicateOf`) et
  `/api/schemas/personnel/[id]` (GET, PUT `{diagram?, thumbnail?}`, DELETE). Pas de
  `orderBy` (tri en mémoire → aucun index). Vignette ≤ 200 Ko, schéma ≤ 600 Ko JSON.
  `src/lib/schemas-personnels.ts` porte constantes et aides.
- `MesSchemasPanel` dans `/mes-ressources` (onglet « Mes schémas » remplace « À
  venir »), page `/mes-ressources/schemas/[id]` plein écran (enregistrement différé
  0,8 s, vignette PNG à 4 s).

### Étape 3 — dispositif `schematiser`, atelier `conceptualisation`

- `TypeTravail` + `Dispositif` + entrée `ATELIERS` (« Atelier de conceptualisation »,
  court « Schéma », mode `ecrire` — JP : « lire-écrire »), `estSchema()`.
- `Devoir.schema: { typeDepart, typeLibre }` (`SchemaConfig`), `src/lib/schema-devoir.ts`
  (`schemaPourFirestore`, `schemaDuDevoir`). Recto de `CreationForm` et
  `EditDevoirModal` : « Schéma de départ » + case « L'élève peut changer de type »
  (défaut libre). Verso : **ressources seules** (`aContenus = false`) — la base
  documentaire. POST/PUT/GET `/api/devoirs`, `devoir-copie.ts`.
- Page élève : `isSchema` → `SchemaActivity` (embarque `DiagramWorkspace` embedded ;
  lit `travail.content` JSON ou crée le schéma de départ ; `onChange → updateContent`).
  Pas d'onglet Remarques ; onglet Évaluation = `SchemaEvaluation` (pas de note, le
  commentaire général quand il est visible).

### Étape 4 — correction

Page de correction : branche `schematiser` → `SchemaActivity readOnly` (zoom, vue), le
commentaire général existant (texte + audio) et « Rendre visible ». Pas de notation
(O5-A), le `AssistancePanel` prof affiche `SchemaEvaluation`.

## Scénario de test (déroulé par JP le 2026-10-04 : tout OK)

1. Tableau de bord → « Créer un nouveau travail » : la popup à 9 cartes ; choisir
   « Atelier de conceptualisation » → formulaire réglé dessus, bloc « Schéma de
   départ ». Même chose depuis Modules FLE › Activités (8 cartes) et depuis un module
   de scénarisation.
2. Élève → Mes ressources › Mes schémas : créer (titre + type), éditer, transformer,
   recharger (tout est là ? vignette ?), dupliquer, supprimer.
3. Le type « Schéma libre » : formes, poignées, tracés, sens des flèches ; passage en
   carte conceptuelle (formes perdues, message) et retour.
4. Prof : atelier avec un texte + une image en ressources, ouvert à une classe ;
   élève : schéma à gauche, Ressources à droite, remise ; prof : correction en lecture
   seule + commentaire général rendu visible → l'élève le lit dans Évaluation.

## Limites connues / dettes

- `copieCorrigee()` (`correction-etat.ts`) ne connaît pas le schéma : une copie de
  schéma n'est jamais « corrigée » dans les états (il faudrait compter le commentaire).
- Vignette des copies dans la liste des travaux : **pas faite** (titre et type seulement).
- La page `/roadmap` est pilotée par Firestore : l'entrée « Nouveautés » est à saisir
  dans l'app par l'admin.
- Les trois boîtes éditables (`ConceptNode`, `TreeNode`, `EventNode`) restent trois
  implémentations (dette héritée de la maquette, notée dans son `init.md`).
- Lint : deux erreurs **préexistantes** (`EditDevoirModal.tsx:157` refs pendant le
  rendu, `CreationForm.tsx:320` mémoïsation) — vérifiées sur le code commité.
- Pendant la session, deux fichiers neufs ont été **modifiés sur le disque** par autre
  chose que l'agent (un « s » devant `'use client'` dans `SchemaActivity.tsx`, le CSS
  tronqué) — corrigés. Si ça se reproduit : formatteur ou extension de l'éditeur ?

## 2026-10-05 — premiers retours de JP à l'écran, corrigés (rien commité)

- **Saisie coupée dans la carte mentale** (« comédie de car ») : `TreeEditor` et
  `TimelineEditor` recréent leurs nœuds à chaque rendu ; sans `measured`, React Flow
  repasse la boîte en `visibility: hidden` → le champ perd le focus → validé à moitié.
  ⚠ **Toujours passer `measured: sizes.get(id)`** aux nœuds recréés.
- **Nouvelle boîte sans curseur** (les espaces retapaient « Ajouter », d'où des « Idée »
  en série) : focus réessayé image par image (`ConceptNode`, `TreeNode`).
- **Schéma libre** : une boîte sans taille fixée (venue d'une carte) n'avait plus de
  largeur max → une seule ligne. `data-sized` ne lève la limite que pour une boîte
  dimensionnée.
- **Schéma vide → carte mentale** refusé (« la carte forme une boucle ») : `emptyOf()`
  dans `diagram-transform.ts`.
- **Volet du bas** : hauteur au contenu (250 px fixes seulement pour Markdown).
- **Liens de la carte conceptuelle déplaçables** (`onReconnect`, pastilles aux bouts du
  lien sélectionné) — interprétation « rattacher le bout à une autre boîte », à confirmer.
- ⚠ Piège de test : l'onglet Chrome piloté par l'agent était en arrière-plan
  (`visibilityState: hidden`) → ni `requestAnimationFrame` ni mesures : essais trompeurs.
- Ce Mac n'avait pas `@xyflow/react` / `html-to-image` dans `node_modules` :
  `npm install` (lockfile inchangé).

## Fin de session (2026-10-04, soir)

- L'activité « Fable? » (`DEV-20261004-9555`) était en base avec **`classes: []`** (classe
  non enregistrée à la création — cause non établie). JP a ensuite tout testé et déclaré
  « tout est ok » : considérer le point clos, sauf récidive.
- **Tout vu, testé et déployé** — d'après JP, sans détail par étape.
