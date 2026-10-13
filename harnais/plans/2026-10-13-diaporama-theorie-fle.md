# 2026-10-13 — Diaporama, 6ᵉ outil des points de théorie FLE

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-13 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé le 2026-10-13** (« go » de JP)
- **Demande initiale** : intégrer l'outil de diapo de l'app VibeCoding
  (`~/Documents/vibecoding/src/components/module/SlidesCardView.tsx`) comme 6ᵉ outil
  pour expliquer un point théorique (à côté d'Image, Lien, Texte, Vidéo, Interactif).

## Le problème

Un point de théorie FLE se porte aujourd'hui par un document, des images, des vidéos, des
liens ou un contenu interactif. Rien ne permet d'**expliquer pas à pas**, une idée par écran,
ni de **projeter** l'explication en classe. VibeCoding a cet outil (une dia à la fois, plein
écran, mise en page automatique en 16:9), écrit en Tailwind — que RectoVerso n'utilise pas.

## Options

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Transposition fidèle, 2 bibliothèques ajoutées** | `@dnd-kit` (glisser-déposer des blocs) + `react-markdown` / `remark-gfm` (texte des dias en Markdown, comme VibeCoding) ; styles réécrits en CSS modules | 4 paquets de plus ; les profs écrivent en Markdown |
| **B — Aucune dépendance** | Texte dans l'éditeur Tiptap déjà en place, ordre des blocs par flèches ↑ ↓ | Plus loin de VibeCoding ; zéro dette nouvelle |
| **C — Glisser-déposer seul** | `@dnd-kit` + Tiptap pour le texte | Compromis |

**Retenue : A** (choix JP, 2026-10-13).

### Arbitrages rendus par JP (2026-10-13)

| Question | Décision |
|---|---|
| Portée | **Points de théorie seulement** — les activités, portfolios et œuvres gardent leurs 5 outils |
| Bibliothèques | **Ajouter `@dnd-kit` et `react-markdown`** (option A) |
| Dia HTML | **Même règle que l'Interactif** : adresse d'une page = tous les profs, liste blanche (`src/lib/integration.ts`) ; code collé = **admin seulement**, bac à sable fermé |
| Bloc « Code » (wifi) | **Gardé, renommé « Encadré »** (étiquette + forme à retenir : « avoir, 1re pers. → j'ai ») |
| Reprendre une dia | **Oui, depuis MES points de théorie** (copie indépendante) |
| Nombre | **Un seul diaporama** par point de théorie (autant de dias que voulu) |

## Ce qu'on fait

1. **Dépendances + modèle** — `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-markdown remark-gfm`
   (npm obligatoire : le VPS lit `package-lock.json`). Type `RessourceDiaporama`
   (`{ titre, dias: Dia[] }`, `Dia` = titre + blocs Texte / Image / Lien / Encadré, ou dia HTML
   `url` | `code` + zoom + centrage) ; champ `diaporama?` dans `DevoirRessource`.
   `compterRessources` et `ressourcesPresentes` le comptent.
   Fichiers : `package.json`, `src/types/devoir.ts`, `src/types/module-fle.ts`, `src/lib/ressources-presentes.ts`.
   Rangé **dans le document du module** (`modulesFle`) : les images sont des adresses
   (`/api/ressources/upload`, déjà en place), pas des données ; le code d'une dia HTML est
   plafonné à `TAILLE_MAX_CODE` (100 Ko) par dia, et le diaporama entier à ~700 Ko (limite
   Firestore : 1 Mo par document) — message clair au-delà.

2. **L'afficheur** `src/components/Diaporama/DiaporamaVue.tsx` (+ `.module.css`, + `Markdown.tsx`) —
   repris de `SlideView` / `SlideHtml` / `SlideImage` / `Overlay` : une dia à la fois, flèches
   et clavier, points, « 3 / 8 », **plein écran** ; mise en page en unités relatives à la
   largeur de la dia (`cqw`) : la même en petit et projetée. Couleurs de RectoVerso.
   Dia HTML : page tierce **seulement si sur la liste blanche** ; code en
   `sandbox="allow-scripts"` **sans** `allow-same-origin` (même précaution que l'Interactif).

3. **L'éditeur** `src/components/Diaporama/DiaporamaEditeur.tsx` — repris de `SlideEditor`,
   `BlockRow`, `ImageField`, `HtmlField`, `ReuseSlide` : titre du diaporama, l'afficheur en
   haut, l'éditeur de la dia affichée en dessous (ajouter / supprimer / déplacer une dia ;
   blocs glissés-déposés ; image : taille, au clic → lien / texte / agrandissement).
   « Dia HTML » : champ adresse pour tous, champ code pour l'admin seulement.
   « Reprendre une dia » : miniatures des dias de **mes** autres points de théorie.

4. **Le 6ᵉ onglet** — `RessourcesInput` reçoit une option `avecDiaporama` que **seul**
   `ModuleFleEditor` passe : onglet « Diaporama » après « Interactif ». Les autres
   utilisateurs du composant ne changent pas.
   Fichiers : `src/components/RessourcesInput/RessourcesInput.tsx`, `src/components/ModuleFleEditor/ModuleFleEditor.tsx`.

5. **Côté élève** — `RessourcesTab` affiche un volet « 🎞️ Diaporama » (titre du diaporama),
   **en premier** des volets : c'est l'explication principale. Visible partout où un point de
   théorie s'ouvre (séquence FLE : `SequenceFleActivity`).

6. **Garde-fou serveur** — à l'enregistrement d'un point de théorie (`/api/modules-fle` POST et
   PATCH, `dupliquer`), le code des dias HTML d'un **non-admin** est retiré, et une adresse hors
   liste blanche aussi.
   ⚠ Corrigé à l'écriture : la réserve de l'Interactif était DÉJÀ contrôlée côté serveur
   (`sanitizeRessources`, `src/lib/ressources-server.ts`) — le diaporama y a été ajouté.

## Ce qu'on ne fait pas dans ce chantier

- Pas de diaporama dans les activités, portfolios, œuvres (décision JP — un `avecDiaporama`
  suffira le jour venu).
- Pas de reprise depuis les points de théorie des collègues.
- Pas de génération de dias par l'IA.
- Pas de route « Ouvrir en grand » pour une dia HTML : le plein écran du diaporama en tient lieu.
- On ne touche pas à VibeCoding.

## Comment on saura que ça marche

- Mes ressources FLE › un point de théorie › « La théorie » : un 6ᵉ onglet **Diaporama** ;
  on crée 3 dias (texte + image, encadré, lien), on change l'ordre des blocs à la souris,
  on enregistre, on rouvre : tout est là.
- Une activité classique (verso) n'a **toujours que 5 onglets**.
- Côté élève (séquence contenant ce point) : volet « Diaporama » en premier, flèches,
  **plein écran sur Chromebook**.
- Un compte prof non admin ne voit pas le champ « code » d'une dia HTML.

## Points à trancher par l'utilisateur

- [ ] Validation du plan (en particulier : volet élève **en premier** ; garde-fou serveur de l'étape 6).
