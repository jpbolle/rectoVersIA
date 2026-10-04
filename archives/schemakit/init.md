# SchémaKit — Briefing agent

> Briefing dense lu au début de chaque session pour se localiser vite.
> Ce n'est PAS une documentation exhaustive. Ce qui change session par session vit dans
> `harnais/memoire/`. Le cahier des charges de départ est dans `README.md`.

---

## ⚡ TL;DR

- **Quoi** : les élèves schématisent (ligne du temps, carte mentale, schéma hiérarchisé,
  carte conceptuelle) dans des devoirs donnés par leur prof, qui consulte les travaux.
- **Nature** : **maquette** (décision JP du 2026-09-13) — sera refondue dans **Recto-versIA**
  (`~/Documents/rectoVersIA`, activité `typeTravail: 'schematiser'`). Tout ce qui est propre
  au schéma (`src/types/diagram.ts`, `src/lib/`, `src/components/diagram/`) doit rester
  **transposable tel quel** : pas de dépendance à l'app, conventions de Recto-versIA
  (CSS Modules, tokens `--c-*` Classica).
- **Statut** : **maquette fonctionnelle, quatre types livrés** — accueil « Mes schémas »
  (stockage local), carte conceptuelle, carte mentale, schéma hiérarchisé, ligne du temps
  à étages ; styles, transformations avec « à placer », Markdown, export PNG/PDF. Pas de
  Firebase, aucun utilisateur réel. Prochaine étape : refonte dans Recto-versIA.
- **Stack** : Next.js (App Router) + React + TypeScript + React Flow (`@xyflow/react`) +
  `html-to-image` — CSS Modules. `firebase` / `firebase-admin` installés mais **inutilisés**
  (maquette : stockage local du navigateur).
- **Branche** : `main` → le push ne déploie pas ; déploiement manuel (skill `/deploiement`).
- **Harnais** : né de la matrice `harnais` v1.2.0, taille L.
  Règles impératives dans `AGENTS.md` (source unique, `CLAUDE.md` est un symlink).
  Carte : [`harnais/README.md`](./harnais/README.md).

---

## 1. Coordonnées techniques

| Élément | Valeur |
|---|---|
| Projet Firebase | *à créer* — région **Europe** (irréversible) |
| Hébergement | *à confirmer* — VPS Hostinger pressenti (même procédure que Recto-versIA) |
| URL production | *aucune* |

### Variables d'environnement
`NEXT_PUBLIC_FIREBASE_*` (SDK client), `FIREBASE_ADMIN_*` (compte de service — restaurer
les `\n` de la clé privée), `ADMIN_EMAILS` — **ne jamais écrire les valeurs ici.**
Fichier local : `.env.local` (ignoré par git).

### Développement local
```
npm run dev        # http://localhost:3000
npx tsc --noEmit   # vérification (aussi dans le hook pre-push)
npm run build      # build complet
```

---

## 2. Conventions

- Composants React : PascalCase (`ConceptMapEditor`) ; hooks : `use` + camelCase ;
  types : PascalCase (`Assignment`, `Work`, `Diagram`).
- Routes API : kebab-case (`/api/assignments`).
- IDs Firestore : `works/{assignmentId}_{studentId}` (composé → un seul travail par élève
  et par devoir). Les autres collections : identifiant automatique.
- L'échéance d'un devoir se libelle **« Échéance »** et reste **facultative** (`null`,
  jamais champ absent).

### Palette / design
*À définir au premier écran.* CSS Modules, tokens dans `src/app/globals.css`.

### Patterns imposés

| Situation qui revient | Forme imposée | Exemple à recopier |
|---|---|---|
| Boîte de schéma avec texte modifiable en place | `textarea` ouverte au double-clic, Entrée valide, Échap annule (et supprime une boîte jamais nommée), classes `nodrag nowheel`, `field-sizing: content` ; barre `NodeToolbar` au-dessus avec `ColorPicker` ; zone de dépôt des tags (`hasTagData` / `readTagData`) | `ConceptNode.tsx` (le premier), `TreeNode.tsx`, `EventNode.tsx` (3 occurrences : un composant commun serait justifié lors de la refonte Recto-versIA) |
| Lecture du stockage local dans un composant | Jamais dans un `useEffect` (règle lint `set-state-in-effect`) : soit `useSyncExternalStore` (préférence), soit garde `useMounted()` + composant enfant avec `useState(() => load())` (pages) | `DiagramWorkspace.tsx` (grid), `app/page.tsx`, `app/atelier/[id]/page.tsx` |
| Choix de couleur | `ColorPicker` : palette fermée (`fill` ou `stroke`) + bouton « + » vers `<input type=color>` ; valeur = nom de palette ou hex (`resolveFill` / `resolveStroke`) | `ColorPicker.tsx` |
| Popup de confirmation | `Modal` (fond assombri, en-tête, pied d'actions), jamais `confirm()` | `app/page.tsx` (suppression) |
| Éditeur React Flow | `ReactFlowProvider` autour, `nodeTypes` définis hors du composant, `panOnScroll` + `zoomOnScroll={false}` (pavé tactile), `FIT_OPTIONS = { padding: 0.25, maxZoom: 1 }`, barre `DiagramToolbar` | `ConceptMapEditor.tsx`, `TreeEditor.tsx` |

---

## 3. Permissions

Trois couches qui doivent rester cohérentes : **interface ⊆ route serveur ⊆ règle Firestore**.

1. **Interface** — rôle résolu côté client (`useAuth`), pages `/eleve/*` vs `/prof/*`
2. **Route serveur** — jeton Firebase vérifié (`verifyIdToken`) dans chaque route
   `/api/*` ; le SDK admin **contourne** les règles Firestore
3. **Règles Firestore** — `firestore.rules`, déploiement **manuel**
   (`firebase deploy --only firestore:rules`)

**Règles d'or** :
- Source des rôles : `users/{uid}` (`role: 'student' | 'teacher'`). Un prof est reconnu
  à la connexion Google si son email est dans `teachers/` ou dans `ADMIN_EMAILS`.
- Isolation multi-prof : chaque classe et chaque devoir porte un `teacherId`.
- Trois symptômes distincts : `Missing or insufficient permissions` (règle) vs 401/403
  sur `/api/...` (route) vs rien ne se passe (garde d'interface).

---

## 4. Modèle de données (Firestore)

Les types TypeScript complets sont dans `README.md` §5.3 tant que `src/types/` n'existe
pas ; dès qu'ils existent, `src/types/` fait foi.

### Collections principales
- `users/{uid}` — rôle et lien vers l'élève (`studentId`) ou le prof
- `teachers/{email}` — les profs autorisés (créés par un admin)
- `classes/{id}` — `name`, `code` (code de classe, 6 caractères), `teacherId`, `schoolYear`
- `students/{id}` — `classId`, `lastName`, `firstName`, `uids: string[]` (tous les
  navigateurs rattachés)
- `assignments/{id}` — devoir : `title`, `instructions`, `diagramType`, `classIds`,
  `teacherId`, `published`, `dueDate`
- `works/{assignmentId}_{studentId}` — travail : `status`, `diagram` (format `Diagram`,
  stocké dans le document), `updatedAt`, `submittedAt`

### Documents de configuration
*aucun*

---

## 5. Rôles et identité

### Rôles
`student`, `teacher`. Pas d'`admin` distinct : un prof dont l'email est dans
`ADMIN_EMAILS` peut créer d'autres profs.

### Authentification
| Public | Mécanisme |
|---|---|
| Élèves | **Code de classe + nom** → Firebase Auth **anonyme** ; le `uid` est ajouté à `students/{id}.uids` |
| Profs | **Google OAuth** (n'importe quel compte Google, reconnu via `teachers/`) — *choix à confirmer* |

### Résolution d'identité
À la connexion : `users/{uid}` → si `role = 'student'`, charger `students/{studentId}` ;
si `role = 'teacher'`, charger ses classes. Un `uid` inconnu = écran de saisie du code.

---

## 6. Modules livrés

| Module | Route | État | Note |
|---|---|---|---|
| Connexion élève (code) | `/` | placeholder | |
| Connexion prof (Google) | `/prof/login` | placeholder | |
| Liste des devoirs élève | `/eleve/devoirs` | placeholder | |
| Page devoir (1/5 consignes + 4/5 éditeur) | `/eleve/devoirs/[id]` | placeholder | |
| Éditeur carte conceptuelle | `components/diagram/ConceptMapEditor` | **livré** (sans sauvegarde) | nœud `ConceptNode`, lien `LabeledEdge`, barre `DiagramToolbar` ; à tester sur Chromebook |
| Accueil « Mes schémas » | `/` | **livré** (stockage local) | vignettes, nouveau (choix du type), dupliquer, supprimer (popup) — `src/lib/local-store.ts` |
| Schéma enregistré | `/atelier/[id]` | **livré** | enregistrement automatique différé (0,8 s), vignette (4 s) |
| Bac à sable | `/atelier` | **livré**, provisoire | exemple non enregistré ; `?type=mindmap` ouvre un type directement (captures) |
| Espace de travail commun | `components/diagram/DiagramWorkspace` | **livré** | colonne 1/5 (titre éditable, consignes) + sélecteur de type + éditeur + volet du bas |
| Volet du bas | `components/diagram/BottomPanel` | **livré** | onglets Outils (style de la sélection ou défauts) · Markdown · À placer (n) ; rail : quadrillage, PNG, PDF |
| Styles (traits, encadrés) | `src/types/diagram.ts` (`LineStyle`, `BoxStyle`, `defaults`) | **livré** | palette fermée + bouton « + » (sélecteur libre, hex) ; dans le Markdown en commentaires |
| Mémoire des positions | `Diagram.layouts.conceptmap` | **livré** | carte → arbre garde les positions ; arbre → carte les restitue, une idée née dans l'arbre se place sous son parent |
| Barres flottantes | `NodeToolbar` (boîtes), `EdgeToolbar` (liens) | **livré** | l'essentiel sur place + bouton « Outils… » vers le volet |
| Éléments à placer | `Diagram.pending` + `PendingPanel` | **livré** | tags glissables sur une boîte (HTML5 drag & drop, `src/lib/tag-drop.ts`) ; alimentés par les transformations |
| Export PNG / PDF | `src/lib/diagram-export.ts` | **livré** | PNG via `html-to-image` ; PDF = fenêtre d'impression du navigateur |
| Export / import Markdown | `src/lib/diagram-markdown.ts` | **livré** pour les 4 types | grammaire des 4 types fixée dans le plan du 2026-09-12 ; import des listes imbriquées et des lignes numérotées |
| Transformations entre types | `src/lib/diagram-transform.ts` | **livré** (4 types) | arbre ↔ arbre ; arbre ↔ carte conceptuelle ; frise ↔ arbre (étage = branche, événement = « 1815 : Titre ») ; carte ↔ frise via l'arbre ; pertes → « À placer » |
| Éditeur d'arbre (carte mentale + schéma hiérarchisé) | `components/diagram/TreeEditor` | **livré** (sans sauvegarde) | un seul éditeur, deux dispositions (`src/lib/tree-layout.ts`, écrit à la main) ; Tab = idée enfant, Entrée = idée sœur ; numérotation 1 / 1.1 / 1.2.1 calculée (`src/lib/tree.ts`) |
| Éditeur ligne du temps | `components/diagram/TimelineEditor` | **livré** (formulaire ; le glisser viendra) | axe gradué + étages (`ViewportPortal`), événements `EventNode` placés par `src/lib/timeline-layout.ts` (empilement par rangées), dates `src/lib/dates.ts`, popups `TimelineModals` ; tags déposés sur un bandeau |
| Classes et devoirs prof | `/prof/*` | placeholder | |
| Travaux rendus | `/prof/devoirs/[id]` | placeholder | |

---

## 7. Gotchas opérationnels

### Compte élève anonyme lié au navigateur
Voir `AGENTS.md` (gotcha critique). **Symptôme** : « j'ai perdu mon travail » → vérifier
`students/{id}.uids` avant de chercher ailleurs.

### Un événement de frise n'a pas de point d'accroche
`useNodesInitialized()` de React Flow ne passe **jamais** à `true` pour des nœuds sans
`Handle` : le recadrage initial n'avait jamais lieu. `TimelineEditor` se fie à ses
propres mesures (`sizes`). **Symptôme** : frise affichée à l'échelle 1:1, collée en haut.

### Le portail de viewport se dessine par-dessus les nœuds
Les bandeaux et l'axe (`ViewportPortal`) ont `z-index: -1`, sinon ils voilent les
événements. **Symptôme** : boîtes délavées dans les étages.

### Sauvegarde différée
Le schéma s'enregistre quelques secondes après la dernière modification, avec un
indicateur « Enregistré / Enregistrement… ». **Symptôme** d'un oubli : compteur
d'écritures Firestore qui explose, ou travail perdu à la fermeture du Chromebook.

### SDK client initialisé paresseusement
`getAuth()` / `getDb()` appelés à l'usage. **Symptôme** sinon : build qui échoue en CI
faute de variables d'environnement.

---

## 8. Pointeurs

### Documentation
- [`README.md`](./README.md) — cahier des charges de départ (fonctionnalités, options, glossaire)
- [`AGENTS.md`](./AGENTS.md) — règles impératives
- [`roadmap.md`](./roadmap.md) — intention
- [`harnais/README.md`](./harnais/README.md) — carte du harnais
- [`harnais/memoire/MEMORY.md`](./harnais/memoire/MEMORY.md) — état cross-sessions

### Skills
- `/session-ritual` — début et fin de session
- `/deploiement` — application (manuel) + règles Firestore (manuel)

### Code
```
src/app/            pages (App Router) — voir README.md §5.2 pour l'arborescence cible
src/components/     diagram/ = éditeurs + panneaux + DiagramWorkspace ; ui/ = Modal, buttons.module.css
src/lib/            diagram-convert.ts, diagram-markdown.ts, diagram-transform.ts, tree.ts, tree-layout.ts,
                    dates.ts, timeline-layout.ts, diagram-export.ts, tag-drop.ts, local-store.ts, use-mounted.ts
src/types/          diagram.ts (livré), assignment.ts, work.ts
firestore.rules     règles — déployées à la main
```

---

## 9. Contexte métier

- Collège Notre-Dame de Dinant, secondaire, FWB. **Chaque élève a un Chromebook** :
  écran ~1366×768, pavé tactile, pas de clic droit intuitif, pas de molette. L'éditeur
  doit être utilisable **sans clic droit ni molette**.
- L'application sert aussi de **matériel de formation** hors Collège (d'où le code de
  classe plutôt que le compte Google de l'école).
- Année scolaire `2026-2027` : commence vers le 20 août, finit vers le 10 juillet.
- Les quatre schémas ne se valent pas : carte mentale et schéma hiérarchisé = **arbre**
  (un seul parent ; radial vs organigramme numéroté), carte conceptuelle = **graphe à
  liens étiquetés**, ligne du temps = **positions calculées à partir des dates**.
  Voir `README.md` §4. Le **Markdown** est le pivot d'échange et de transformation
  (`README.md` §5.4).
