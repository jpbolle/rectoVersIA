# 2026-09-12 — Éditeur de carte conceptuelle (sans Firebase)

- **Statut** : proposé → validé le 2026-09-12 (options B + M3, grammaire, 4e type) → livré le 2026-09-12 (test Chromebook par JP en attente)
- **Demande initiale** : « l'outil de schéma, sans Firebase » — voir l'éditeur à l'écran
  avant de brancher la connexion et la base. **Complément du 2026-09-12** : le schéma doit
  être **exportable et importable en Markdown** (`.md`), et ce Markdown doit permettre de
  **transformer** un schéma en un autre type quand la structure le permet (carte mentale ↔
  schéma hiérarchisé, au minimum).

## Le problème

Rien n'est visible : le projet affiche la page de démonstration de Next.js. Le cœur du
projet — l'espace où l'élève construit un schéma — n'existe pas, et c'est lui qui décide
si l'application est agréable sur Chromebook.

## Options

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Nœuds et liens par défaut de React Flow** | Boîtes grises standard, texte non modifiable en place ; il faudrait un formulaire à côté pour renommer | Rapide, mais expérience pauvre : un élève veut écrire **dans** la boîte |
| **B — Nœud et lien personnalisés** | Un composant `ConceptNode` (boîte avec zone de texte modifiable en place) et un `LabeledEdge` (lien dont le mot de liaison se modifie en cliquant dessus) | Un peu plus de code, mais c'est la forme définitive ; les deux autres éditeurs réutiliseront ces composants |
| **C — Éditeur générique pour les trois types** | Un seul composant configurable | Fausse économie : les règles diffèrent trop (arbre, dates) — on ferait un outil qui ne fait bien aucun des trois |

**Retenue : B**, parce que l'écriture en place est ce qui rend l'outil naturel pour un
élève, et que les composants serviront aux deux autres éditeurs.

### Le Markdown : quel rôle exactement ?

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **M1 — Le Markdown est le format de stockage** | On n'enregistre que du texte ; l'éditeur le lit et l'écrit à chaque modification | Simple à raisonner, lisible partout, mais les **positions et couleurs** n'ont pas de place naturelle dans un texte : il faut les glisser dans des commentaires, et convertir à chaque frappe |
| **M2 — Le JSON (`Diagram`) est le format canonique, le Markdown est une vue** | On enregistre le `Diagram` ; le Markdown se **génère** à la demande et s'**importe** en remplaçant le schéma | Positions et couleurs exactes conservées ; l'import repose sur une **mise en page automatique** (le texte ne dit pas où sont les boîtes) |
| **M3 — M2, plus les positions en commentaire dans le Markdown** | Comme M2, mais chaque ligne peut porter un commentaire `<!-- x:120 y:80 couleur:vert -->` que l'import relit si présent | Aller-retour **sans perte** quand on veut, texte qui reste lisible sans, un peu plus de code de lecture |

**Retenue : M3.** Le texte reste le format d'échange lisible par un humain (et par un
prof qui veut préparer un schéma modèle dans un éditeur de texte), et rien n'est perdu
quand on exporte puis réimporte le même schéma.

### La grammaire Markdown (fixée ici pour les trois types)

**Carte mentale et schéma hiérarchisé** — une liste imbriquée, c'est la forme la plus
naturelle d'un arbre. Le titre `#` est le nœud central ; l'indentation fait la hiérarchie.
Les deux types partagent **exactement** ce Markdown : ils ne diffèrent que par la
disposition (radiale pour la carte mentale, de haut en bas pour le schéma hiérarchisé).
```markdown
---
type: mindmap          # ou hierarchy
---
# La Révolution française
- Causes
  - Crise financière
  - Inégalités
- Événements
  - 1789 : prise de la Bastille
```

**Carte conceptuelle** — un graphe ne tient pas dans une liste imbriquée (un concept peut
avoir plusieurs parents). Deux sections : les concepts, puis les liens avec leur mot de
liaison.
```markdown
---
type: conceptmap
---
# Le cycle de l'eau

## Concepts
- Soleil
- Évaporation
- Nuages

## Liens
- Soleil → provoque → Évaporation
- Évaporation → forme → Nuages
```

**Ligne du temps** — une liste d'événements datés ; `..` sépare le début et la fin d'une
période.
```markdown
---
type: timeline
---
# Le XIXe siècle
- 1815 : Congrès de Vienne
- 1830..1831 : Révolution belge — indépendance de la Belgique
```

**Transformations possibles** (via ce Markdown) :

| De → vers | Possible ? | Ce qui se passe |
|---|---|---|
| Carte mentale ↔ schéma hiérarchisé | ✅ toujours | Même texte, autre disposition |
| Carte conceptuelle → carte mentale | ⚠️ si chaque concept a **au plus un parent** | Sinon : on garde un arbre principal et on signale les liens perdus |
| Carte mentale → carte conceptuelle | ✅ toujours | Les branches deviennent des liens, avec un mot de liaison vide à compléter |
| Ligne du temps → carte mentale | ✅ toujours | Le titre au centre, un événement par branche, dans l'ordre |
| Carte mentale → ligne du temps | ⚠️ si les branches commencent par une date | Sinon refus avec explication |

## Ce qu'on fait

1. **Le format de données** — `src/types/diagram.ts` : les types `Diagram`, `DiagramNode`,
   `DiagramEdge` du README §5.3. C'est **notre** format, indépendant de React Flow.
2. **La conversion** — `src/lib/diagram-convert.ts` : `Diagram` → nœuds/liens React Flow
   et retour. Tout ce qui sort de l'éditeur repasse par là.
3. **Le nœud** — `src/components/diagram/ConceptNode.tsx` (+ `.module.css`) : boîte
   arrondie, texte modifiable en place (double-clic ou touche Entrée), quatre points
   d'accroche pour tirer un lien, couleur choisie parmi une petite palette.
4. **Le lien** — `src/components/diagram/LabeledEdge.tsx` : flèche avec mot de liaison
   au milieu ; clic sur le mot → champ de saisie.
5. **La barre d'outils** — `src/components/diagram/DiagramToolbar.tsx` : boutons
   **visibles** (pas de clic droit, pas de molette obligatoire) : *Ajouter un concept*,
   *Supprimer la sélection*, *Zoom +*, *Zoom −*, *Tout voir*.
6. **L'éditeur** — `src/components/diagram/ConceptMapEditor.tsx` : assemble React Flow,
   le nœud, le lien et la barre ; reçoit un `Diagram`, appelle `onChange(diagram)` à
   chaque modification.
7. **Le Markdown** — `src/lib/diagram-markdown.ts` : `toMarkdown(diagram)` et
   `fromMarkdown(texte)` selon la grammaire ci-dessus. Dans ce chantier : implémenté et
   testé pour la **carte conceptuelle** ; la grammaire des deux autres types est fixée
   mais leur code viendra avec leur éditeur.
8. **La page de test** — `src/app/atelier/page.tsx` : la mise en page cible — colonne
   gauche **1/5** avec une consigne fictive, colonne droite **4/5** avec l'éditeur — et
   un volet repliable **« Markdown »** qui montre le texte du schéma **en direct**, avec
   deux boutons : *Copier* (export) et *Appliquer* (on modifie le texte à la main, le
   schéma se reconstruit = import). Route provisoire, sans connexion.
9. **La palette** — `src/app/globals.css` : quelques tokens de couleur (fond, texte,
   accent, couleurs des concepts). À ajuster à l'œil ensuite.

Nouvelle dépendance : **aucune** (React Flow est déjà installé).

## Ce qu'on ne fait pas dans ce chantier

- Pas de sauvegarde, pas de connexion, pas de Firebase — recharger la page efface le schéma.
- Pas de carte mentale ni de ligne du temps — donc **pas encore de transformation** entre
  types : elle arrive avec le deuxième éditeur, sur la grammaire fixée ici.
- Pas de téléchargement de fichier `.md` ni d'ouverture d'un fichier : copier/appliquer
  du texte suffit pour valider le format.
- Pas d'annuler/rétablir, pas d'export image, pas d'images dans les nœuds.
- Pas de contrainte pédagogique (nombre de concepts, mots imposés).

## Comment on saura que ça marche

Sur `http://localhost:3000/atelier` :
- la consigne occupe 1/5 de la largeur, l'éditeur 4/5 ;
- *Ajouter un concept* crée une boîte au centre de l'écran, on écrit dedans ;
- on tire un lien d'une boîte à l'autre, on clique sur le lien et on écrit « provoque » ;
- les boutons de zoom fonctionnent **sans molette** ;
- le volet « Markdown » montre le texte du schéma et se met à jour quand on édite ;
- on modifie le texte (ajout d'un lien `- Nuages → donne → Pluie`), *Appliquer* : le
  schéma se reconstruit, avec les positions conservées pour les concepts déjà placés ;
- le tout est utilisable au pavé tactile d'un Chromebook (à tester par JP).

## Points à trancher par l'utilisateur

- [ ] Valider l'option B, l'option M3 et la grammaire Markdown ci-dessus.
- [x] « Schéma hiérarchisé » = un **4e type** — validé le 2026-09-12 : arbre dessiné
      comme un **organigramme**, nœuds **numérotés automatiquement** (1, 1.1, 1.2, 1.2.1…).
      La numérotation est calculée à l'affichage, jamais saisie. L'import Markdown
      accepte la liste imbriquée **et** des lignes numérotées (`1.2.1 Titre`).
- [ ] Le double-clic pour modifier un texte convient-il au pavé tactile ? Sinon : un
      seul clic sélectionne, un second clic sur une boîte déjà sélectionnée édite.
