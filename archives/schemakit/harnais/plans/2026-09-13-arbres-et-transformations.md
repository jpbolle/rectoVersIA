# 2026-09-13 — Carte mentale, schéma hiérarchisé et transformations

- **Statut** : validé le 2026-09-13 (« go pour la suite du chantier ») → livré le 2026-09-13
- **Demande initiale** : le chantier suivant après la carte conceptuelle ; les deux types en
  arbre partagent le Markdown, donc on les livre ensemble, avec la première transformation.

## Le problème

Un seul type de schéma existe. Le Markdown est fixé pour les quatre, mais rien ne prouve
encore qu'il porte une **transformation** d'un type à l'autre — c'est l'exigence posée le
2026-09-12.

## Options

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Disposition automatique écrite à la main** | Un algorithme d'arbre classique (largeur des sous-arbres, centrage sous le parent) ; carte mentale = même chose tournée de 90°, moitié des branches à droite, moitié à gauche | ~100 lignes, aucune dépendance, comportement maîtrisé |
| **B — Bibliothèque de disposition** (`d3-hierarchy`, `dagre`, `elkjs`) | Disposition éprouvée, plus d'options | Une dépendance de plus (à demander), API à apprendre, réglages pas toujours adaptés à un petit arbre d'élève |
| **C — Placement libre** (l'élève déplace ses idées) | Réutilise l'éditeur de carte conceptuelle | Un arbre déplacé à la main devient vite illisible ; la transformation vers l'organigramme perdrait tout |

**Retenue : A.** Consigne durable : pas de dépendance sans demande ; et un arbre d'élève
compte quelques dizaines de nœuds, un algorithme simple suffit.

## Ce qu'on fait

1. **Arbre** — `src/lib/tree.ts` : racine, enfants, sous-arbre, **numérotation** calculée
   (enfants de la racine 1, 2, 3 ; puis 1.1, 1.2.1…). Pour les types en arbre, la
   structure vit dans `parentId` ; `edges` reste vide.
2. **Disposition** — `src/lib/tree-layout.ts` : `hierarchy` de haut en bas (organigramme),
   `mindmap` racine au centre, branches à droite puis à gauche. Tailles réelles des boîtes
   mesurées par React Flow, estimation avant la première mesure.
3. **Markdown des arbres** — dans `diagram-markdown.ts` : export `# Racine` + liste
   imbriquée ; import de la liste imbriquée **ou** de lignes numérotées (`1.2.1 Titre`).
4. **Transformations** — `src/lib/diagram-transform.ts` : mindmap ↔ hierarchy (rien à
   perdre) ; arbre → carte conceptuelle (branches → liens sans mot) ; carte conceptuelle →
   arbre (refusée si cycle ; concept à plusieurs parents → on garde le premier lien et on
   **liste les liens perdus** ; plusieurs racines → rattachées à la première).
5. **Éditeur d'arbre** — `TreeEditor.tsx` + `TreeNode.tsx` : boîtes non déplaçables
   (disposition automatique), double-clic pour écrire, barre : *Ajouter une idée* (enfant
   de la sélection), *Supprimer* (le sous-arbre, jamais la racine), zoom. Clavier :
   **Tab** = idée enfant, **Entrée** = idée sœur.
6. **Page `/atelier`** — sélecteur de type en haut de l'éditeur ; changer de type =
   transformer, avec les avertissements affichés.

Nouvelle dépendance : **aucune**.

## Ce qu'on ne fait pas dans ce chantier

- Pas de ligne du temps.
- Pas de déplacement manuel des idées, pas de pliage de branche, pas d'icônes.
- Toujours pas de sauvegarde ni de Firebase.

## Comment on saura que ça marche

Sur `/atelier` : on part de la carte conceptuelle d'exemple, on clique *Carte mentale* → les
concepts deviennent des branches, disposées automatiquement ; *Schéma hiérarchisé* → le
même arbre en organigramme numéroté ; *Carte conceptuelle* → on retrouve des liens (mots à
compléter). Tab / Entrée ajoutent des idées sans la souris. Le volet Markdown montre la
liste imbriquée ; on y tape `1.3 Nouvelle idée`, *Appliquer* → la branche apparaît.

## Points à trancher par l'utilisateur

- [ ] Numérotation : la racine porte le titre **sans numéro**, ses enfants sont 1, 2, 3…
      (hypothèse retenue). Alternative : la racine est « 1 » et ses enfants 1.1, 1.2.
