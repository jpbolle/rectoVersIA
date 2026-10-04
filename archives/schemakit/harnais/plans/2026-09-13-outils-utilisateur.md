# 2026-09-13 — Outils de l'utilisateur (avant la ligne du temps)

- **Statut** : proposé → validé le 2026-09-13 (O1 = C stockage local, O2 = A html-to-image, O3 = palette fermée **+ bouton « + » sélecteur libre**) → livré le 2026-09-13
- **Demande initiale** (JP, 2026-09-13) : avant la ligne du temps, doter l'utilisateur
  d'outils — fond quadrillé affichable/masquable, page d'accueil avec ses schémas, outils
  de forme (traits, encadrés), encadré des éléments non transformés (tags déplaçables),
  export PDF et PNG, le tout **dans le volet du bas** qui ne contient que le Markdown.
  Contexte nouveau : **SchémaKit est une maquette**, qui sera refondue dans Recto-versIA.

## Le problème

L'éditeur fonctionne mais ne donne aucun contrôle sur l'apparence, ne s'exporte pas, et
perd silencieusement des éléments à la transformation (ils ne sont que listés dans un
message). Et le volet du bas est un panneau Markdown, pas une boîte à outils.

## Le contexte qui pèse sur chaque choix : c'est une maquette

Le code sera **refondu dans Recto-versIA** (`~/Documents/rectoVersIA`). Conséquences :

- **Réutiliser ses conventions** : CSS Modules, tokens `--c-*` du design system Classica
  (déjà le cas), composants React purs. Ce qui est propre à SchémaKit (types `Diagram`,
  Markdown, transformations, éditeurs) doit rester **sans dépendance à l'app** : un
  dossier `src/lib/` + `src/components/diagram/` transposable tel quel.
- **Ne pas construire ce que Recto-versIA a déjà** : connexion, classes, devoirs, travaux,
  interface prof. Dans Recto-versIA, un schéma sera une **activité** (`typeTravail:
  'schematiser'`, liste fermée des dispositifs) et le `Diagram` vivra dans `travaux`.
- **La passerelle « schéma → document »** (demande « à terme ») : c'est l'export
  Markdown qui la rend possible — un schéma exporté en `.md` devient du texte insérable
  dans l'éditeur d'écriture (Tiptap) de Recto-versIA. Pas de travail supplémentaire
  ici, hors un bouton « Copier pour un document » quand on y sera.

## Options

### O1 — La page d'accueil « mes schémas » : où vivent-ils ?

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Firebase (nouveau projet)** | Auth par code de classe + Firestore, comme prévu dans le README | Plusieurs soirées ; **jetable** : Recto-versIA a déjà tout ça (auth Google, `devoirs`, `travaux`) |
| **B — Firebase de Recto-versIA** | Nouvelles collections dans la base de prod | Non : on ne touche pas à une base avec des élèves réels pour une maquette |
| **C — Stockage local du navigateur** | Liste « Mes schémas » (titre, type, date, vignette) dans `localStorage` ; ouvrir / dupliquer / supprimer | Une soirée ; la page d'accueil se **voit** et se **teste** ; perdu si on vide le navigateur (acceptable pour une maquette) |

**Recommandation : C.** Ce qu'on veut valider, c'est l'expérience « je retrouve mes
schémas et j'en ouvre un » — pas une base de données qu'on refera de toute façon dans
Recto-versIA. Le `README.md` (§5–6, Firebase) devient une **annexe pour plus tard**.

### O2 — Export PNG et PDF

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — `html-to-image` + impression navigateur** | PNG : bibliothèque recommandée par React Flow (transforme le DOM du schéma en image). PDF : le bouton ouvre l'aperçu d'impression du navigateur avec une feuille de style « impression » (le Chromebook enregistre en PDF nativement) | **1 dépendance** légère, bien connue ; PDF sans bibliothèque |
| **B — `html-to-image` + `jspdf`** | PDF généré dans la page, mise en page contrôlée | 2 dépendances ; jsPDF est lourd pour une maquette |
| **C — Tout à la main** | Sérialiser le DOM en SVG `foreignObject` → canvas → PNG | Fragile (polices, styles CSS Modules à recopier) ; plusieurs soirées pour un résultat moins fiable |

**Recommandation : A.** À valider explicitement : c'est une dépendance ajoutée.

### O3 — Les outils de forme : jusqu'où ?

| Option | Ce que ça implique |
|---|---|
| **A — Sélection stylable** | Une boîte ou un trait sélectionné → le volet du bas montre ses réglages : **trait** (épaisseur 1/2/4, style plein/tirets/pointillé, couleur), **encadré** (couleur de fond existante + bordure épaisse/fine, coins arrondis/carrés). Les réglages entrent dans `Diagram` et dans le Markdown (`<!-- trait:tirets épaisseur:4 -->`) |
| **B — Formes libres** | Rectangles, ellipses, texte flottant, flèches libres, comme draw.io | Sort du cadre « schémas pédagogiques » ; c'est un tableau blanc (option écartée le 2026-09-12) |

**Recommandation : A.** Un « encadré » reste une **boîte de schéma** stylée, pas une forme
libre. Les couleurs viennent d'une palette fermée (lisibilité, cohérence Classica).

### O4 — Les éléments non transformés

Un seul chemin raisonnable : à la transformation, ce qui ne trouve pas sa place (concept
à plusieurs parents → le lien perdu ; mot de liaison ; boucle coupée) devient un
**tag dans un encadré « À placer »** du volet du bas. Un tag se **glisse sur une boîte**
de l'arbre → il devient une idée enfant. Les tags restent dans le `Diagram`
(`pending: string[]`) donc dans le Markdown (`## À placer`) : rien ne se perd, même en
rechargeant.

## Ce qu'on fait — dans cet ordre

1. **Le volet du bas devient une boîte à outils** à onglets : **Outils** · **Markdown** ·
   **À placer (n)** (n'apparaît que s'il y a des tags). Un rail à droite du volet :
   ☐ *Fond quadrillé*, *PNG*, *PDF*. Hauteur repliable comme aujourd'hui.
   Fichiers : `src/components/diagram/BottomPanel.tsx` (+ onglets), `/atelier` allégé.
2. **Fond quadrillé** affichable/masquable (lignes comme draw.io, points sinon) ; réglage
   mémorisé dans le navigateur (préférence d'affichage, pas une donnée du schéma).
3. **Style des traits et des encadrés** (O3-A) : extension de `Diagram` (`DiagramEdge.style`,
   `DiagramNode.style`), du Markdown, des deux éditeurs, onglet *Outils* réagissant à la
   sélection (rien de sélectionné → réglages par défaut du schéma).
4. **À placer** (O4) : `Diagram.pending`, alimenté par `transformDiagram`, onglet avec tags
   déplaçables, dépôt sur une boîte de `TreeEditor` et de `ConceptMapEditor`.
5. **Export PNG / PDF** (O2) — après ton accord sur la dépendance.
6. **Page d'accueil « Mes schémas »** (O1) : `/` liste les schémas du navigateur (vignette
   = export PNG réduit), *Nouveau schéma* (choix du type), ouverture dans `/atelier/[id]`.
   La sauvegarde automatique différée arrive avec cette étape.

## Ce qu'on ne fait pas dans ce chantier

- Pas de ligne du temps (chantier suivant).
- Pas de Firebase, pas de connexion, pas d'interface prof : Recto-versIA les a.
- Pas de formes libres (O3-B), pas d'images dans les boîtes.
- Pas de passerelle vers un document : elle se fera **dans** Recto-versIA, sur la base du
  Markdown déjà là.

## Comment on saura que ça marche

Sur `/` : trois schémas enregistrés avec leur vignette, j'en ouvre un. Sur `/atelier/[id]` :
je masque le quadrillage, je sélectionne un lien → onglet *Outils* → tirets épais rouges,
je passe en carte mentale → l'onglet *À placer (2)* apparaît, je glisse un tag sur une
branche → il devient une idée. *PNG* télécharge une image nette du schéma ; *PDF* ouvre
l'aperçu d'impression sans les barres d'outils. Je recharge : tout est encore là.

## Points à trancher par l'utilisateur

- [ ] O1 : page d'accueil en **stockage local** (C) plutôt que Firebase (A) ?
- [ ] O2 : accord pour ajouter la dépendance **`html-to-image`** (PNG) ; PDF via
      l'impression du navigateur ?
- [ ] O3 : palette fermée pour les couleurs de trait/bordure (6 couleurs Classica) —
      ou un sélecteur de couleur libre ?
