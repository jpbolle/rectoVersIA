# Recto-versIA — Briefing agent

> Briefing dense lu au début de chaque session pour se localiser vite.
> Ce n'est PAS une documentation exhaustive. Ce qui change session par session vit dans
> `harnais/memoire/`.

---

## ⚡ TL;DR

- **Quoi** : assistant de correction pédagogique avec IA — un prof de français corrige des
  productions d'élèves via des grilles à 6 niveaux (précorrection Claude, dictée Whisper) ;
  les élèves rédigent, s'autoévaluent, travaillent le vocabulaire et font des recherches
  guidées (extension Chrome NavigKid).
- **Statut** : v3.8, en production au Collège Notre-Dame de Dinant (profs + élèves réels)
- **Stack** : Next.js 16 (App Router) + React 19 + TypeScript 5 + Firestore (Blaze) +
  Tiptap 3 — CSS Modules, design system Classica
- **Branche** : `main` → le push ne déploie pas ; déploiement manuel sur VPS (skill `/deploy`)
- **Harnais** : né de la matrice `harnais` v1.2.0, taille L.
  Règles impératives dans `AGENTS.md` (source unique, `CLAUDE.md` est un symlink).
  Carte : [`harnais/README.md`](./harnais/README.md).

---

## 1. Coordonnées techniques

| Élément | Valeur |
|---|---|
| URL production | https://rectoversia.edukids.pedagokit.be |
| VPS | Hostinger `srv948876.hstgr.cloud` — accès **terminal web hPanel uniquement**, jamais SSH |
| Chemin VPS / process | `/var/www/rectoVersIA` — PM2 `rectoVersia` — port **3003** (3000-3002 occupés) |
| Firebase | Firestore plan Blaze — `adminDb` côté serveur, `firebase` côté client |
| Grilles legacy | Google Sheets API (lecture seule) — les grilles vivent désormais dans Firestore |
| IA | Claude `claude-sonnet-4-5-20250929` + OpenAI Whisper — API Routes serveur uniquement |
| Éditeur riche | Tiptap 3 + extensions custom (LineHeight, Indent, ContentLock, annotations) |
| Extension Chrome | NavigKid — `rechercheNavigChrome/eleve-extension` (recherche guidée + popup aides dictionnaire/traducteur + visionneuse PDF) — état de référence dans `rechercheNavigChrome/init/` |

### Variables d'environnement
`CLAUDE_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_SHEETS_ID`, `FIREBASE_*` (client + admin),
`ENCRYPTION_KEY` (chiffrement des identités élèves — **même clé sur tous les postes et
le VPS**, sinon déchiffrement impossible) — **ne jamais écrire les valeurs ici.**
Sur le VPS : `.env.local`.

### Développement local
```
npm run dev        # port 3003
npx tsc --noEmit   # vérification (aussi dans le hook pre-push)
npm run build      # build complet
```

---

## 2. Conventions

### Nommage
- Composants React : PascalCase (`CorrectionGrid`, `WorkEditor`)
- Hooks : `use` + camelCase (`useCorrection`, `useGrille`)
- Types : PascalCase (`Devoir`, `Correction`, `Grille`)
- API Routes : kebab-case (`/api/corrections`, `/api/travaux`)
- IDs Firestore : `DEV-YYYYMMDD-XXXX`, `TRV-{devoirId}-{studentId}`, `CORR-{travailId}`,
  `AIGRID-{travailId}`, `GRL-YYYYMMDD-XXXX`

### Palette / design
- CSS Modules uniquement (zéro framework CSS)
- Design system **Classica**, tokens `--c-*` dans `globals.css`
- Primary `#2d6a5a`, Accent `#d4944c`, Background `#faf6f0`, Text `#3d3832`
- Fonts : Playfair Display (titres) + Inter (corps)
- Toujours vérifier les styles existants avant d'en créer — pas de styles conflictuels

### Patterns imposés

| Situation qui revient | Forme imposée | Exemple à recopier |
|---|---|---|
| Ligne de boutons d'action encadrée par 2 traits horizontaux | Convention couleurs : **vert** (`--c-primary`) = bouton qui **génère** du contenu (IA, exercices, évaluation) ; **amber** (`--c-accent`) = bouton qui **affiche** ou **navigue**. Verts groupés d'abord, ambers ensuite. Boutons `min-height:42px / padding:0 22px / font:14px 600` | `bottomActions` dans `VocabulaireActivity.module.css`, `actionBar` dans `VocabulaireExercises.module.css` |
| Accès à un objet instable (`user`, `travail`) dans un callback mémoïsé | Pattern `ref` (jamais l'objet dans les deps — règle AGENTS.md) | `userRef` dans `AuthContext.tsx`, `travailRef` dans `useTravail` |
| Page avec `router.replace()` | State `redirecting` : `if (redirecting) return;` avant le replace, `return null;` dans le render | pages protégées existantes |
| Panneau latéral élève | `WorkspaceRail` (rail icônes droite + panneau redimensionnable) — côté prof on garde `ResizableSplit` + onglets. **Ne pas uniformiser** | `/activites/[id]` vs `/dashboard/travaux/[devoirId]/[travailId]` |

---

## 3. Permissions

Trois couches qui doivent rester cohérentes : **interface ⊆ route serveur ⊆ règle Firestore**.

1. **Interface** — rôle résolu côté client (`useAuth`, `getUserRole()`), pages prof vs élève
2. **Route serveur** — `verifyAuth()` (`src/lib/api-auth.ts`) : Bearer token +
   `adminAuth.verifyIdToken` ; le SDK admin **contourne** les règles Firestore
3. **Règles Firestore** — `firestore.rules`, déploiement **manuel**
   (`firebase deploy --only firestore:rules`)

**Règles d'or** :
- Source des rôles : email admin + collection `professeurs` (doc ID = email) ; tout autre
  compte Google = `eleve` (`getUserRole()` dans `src/lib/auth-utils.ts`).
- Isolation multi-prof : chaque devoir/classe/grille/correction porte un `profId`.
- Trois symptômes distincts : `Missing or insufficient permissions` (règle Firestore) vs
  401/403 sur `/api/...` (route serveur) vs rien ne se passe (garde d'interface).

---

## 4. Modèle de données (Firestore)

### `devoirs`
> Champs récents : `lectureQuiz` (questionnaire de lecture, type lire — voir
> `src/types/lecture.ts` ; `correctIndex`, `reponseIdeale` et `fluoAttendu`
> **filtrés côté élève** par `src/lib/lecture-server.ts` — **sauf quand
> `corrigeDisponible`** : l'élève reçoit alors le quiz complet pour voir sa
> correction) ; questions avec `audio` (base64 `ressourceImages`, ≤ 700 Ko,
> `maxEcoutes` = limite d'écoutes) et `competences: string[]` (ids de gestes de
> lecture, config didactique) ; `ressources.videos` (URLs YouTube, lecteur intégré
> nocookie côté élève — `src/lib/youtube.ts`) ; `submittedCount` (enrichi à la
> lecture par `/api/devoirs`, liste prof uniquement).
```typescript
interface Devoir {
  id: string;                    // DEV-YYYYMMDD-XXXX
  classes: string[];             // noms de classes (["4A", "4B"])
  dateRemise: Timestamp;
  grille: string;
  intitule: string;
  consignes: string;
  ressources: DevoirRessource | null;
  accesIA: boolean;              // eleve peut utiliser IA
  disponible: boolean;           // visible par eleves
  archive: boolean;
  corrige: boolean;
  corrigeDisponible: boolean;    // corrections visibles par eleves
  profId: string;
  anneeScolaire: string;         // "2025-2026" (calcul auto)
  createdAt: Timestamp;
  typeTravail: 'ecrire' | 'lire' | 'rechercher' | 'vocabulaire';
  evaluation?: 'formatif' | 'certificatif'; // certificatif = compte pour la note (tag sur les cards) ; absent sur les devoirs antérieurs
  questionnaireId?: string;       // ref questionnaires/{id} (type rechercher)
  codeAcces?: string;             // code 6 chars extension Chrome (type rechercher)
  vocabulaireThemes?: string[];   // serie lexicale imposee (type vocabulaire)
  vocabulaireDiagnostic?: boolean;
  flipInverted?: boolean;         // recto = planification au lieu de redaction
}
```

### `travaux`
```typescript
interface Travail {
  id: string;                    // TRV-{devoirId}-{studentId}
  devoirId: string;
  studentId: string;             // Firebase UID
  studentEmail: string;
  studentName: string;
  content: string;               // HTML (Tiptap)
  draftContent?: DraftContent;   // brouillon (CRC, plan, libre)
  ressourceAnnotations?: string;
  ressourceNotes?: Record<string, string>;
  status: 'draft' | 'submitted';
  selfEvaluation: Record<string, number> | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  ressourceImageShapes?: Record<string, DrawShape[]>; // tracés élève sur les images de ressources (clé = fileId)
}
```
> Pour les activités **vocabulaire** et **lire avec questionnaire**, `content` porte
> un JSON d'état (pas du HTML Tiptap) — `parseLectureAnswers` pour la lecture.

### `corrections`
```typescript
interface Correction {
  id: string;                    // CORR-{travailId}
  travailId: string;
  devoirId: string;
  studentId: string;
  profId: string;
  evaluation: Record<string, number>;
  commentaireGeneral: string;
  annotatedContent?: string;     // HTML annote par le prof
  audioAnnotations?: AudioAnnotation[];   // base64 dans Firestore, pas de Storage
  draftAnnotations?: Record<string, DraftItemAnnotation>;
  visibleParEleve: boolean;
  status: 'draft' | 'finalized';
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

### `grilles`
```typescript
interface Grille {
  id: string;                    // GRL-YYYYMMDD-XXXX
  name: string;
  description?: string;
  uaa: number[];                 // UAA ciblees (0-6)
  profId: string;
  shared: boolean;               // grille exemple visible par tous (admin seulement)
  anneeScolaire: string;
  archive: boolean;
  criteria: GrilleCriterion[];
  createdAt: string;
  updatedAt: string;
}
```
- 6 niveaux fixes (0/15/35/60/80/100 %) — **échelle à ne jamais modifier** (AGENTS.md)
- Chaque prof ne voit que ses grilles + grilles partagées ; section « Grilles des
  professeurs » : duplication en lecture seule

### `classes`, `eleves`
```typescript
interface Classe { id; nom; code; profId; anneeScolaire; archive }   // code "AB1-CD2-EF3"
interface Eleve  { id; classeId; nom; prenom; email; firebaseUid? }
```

### `questionnaires` (NavigKid)
```typescript
interface Questionnaire {
  id; titre; theme; consignes;
  questions: Question[];           // texte/qcm, nbSources, points, reponseAttendue
  codeAcces: string;               // 6 chars (alphabet reduit)
  profId; devoirId; archive; creeLe;
}
// Sous-collection : questionnaires/{id}/reponses/{eleveId}
// Collection separee : recherches/{eleveId}
```

### Autres collections
- `professeurs` : doc ID = email, géré par admin via `/admin` (supporte `expiresAt`)
- `dictionaryCache` : doc ID = mot — cache des consultations dictionnaire (accès serveur uniquement)
- `vocabulairePersonnel/{uid}` : mots dont l'élève a demandé la définition (app + NavigKid),
  format `VocabulaireWord` — accès serveur uniquement, pas de règle Firestore
- `devoirs` : le champ `uaa` affiché sur les cards est **enrichi à la lecture** par
  `/api/devoirs` (jointure grille par nom) — pas stocké dans le document
- `ressourceImages` : images de ressources en **base64** (≤ 700 Ko, compression navigateur
  `src/lib/image-compress.ts` — limite d'1 Mo par document Firestore), accès serveur
  uniquement ; servies par `/api/ressources/image/[id]` (route **publique par lien
  secret** — une balise `<img>` ne peut pas envoyer d'en-tête d'auth ; contenu
  pédagogique uniquement, jamais de donnée personnelle)
- `users/{uid}` : profil + préférences éditeur (`font`, `fontSize`, `lineHeight`, `theme`)
- `aiGridEvaluations` : ID = `AIGRID-{travailId}`, évaluation IA par critère
- Vocabulaire : séries lexicales (`profId`, `profName`, `mots`)

---

## 5. Rôles et identité

### Rôles
| Email | Rôle |
|---|---|
| `jeanphilippe.bolle@cnddinant.be` | `prof` + admin |
| Email dans collection `professeurs` | `prof` (accès temporaire possible : `expiresAt`) |
| Tout autre compte Google | `eleve` |

### Authentification
- Firebase Authentication (Google OAuth), **côté client uniquement** — pas de cookie
  session, `src/middleware.ts` est **vide**
- Côté serveur : `verifyAuth()` dans `src/lib/api-auth.ts`

### Parcours élève
- Nouvel élève : login → popup « Rejoindre une classe » (3 tentatives max)
- Élève sans classe : redirigé vers `/login` depuis toutes les pages protégées
- Page `/` : prof → `/dashboard`, élève → `/login`

---

## 6. Modules livrés

### Pages
| Route | Accès | Description |
|---|---|---|
| `/login` | public | Connexion Google + modal join classe |
| `/dashboard` | prof | Devoirs (actuels / corrigés / archivés) + création |
| `/dashboard/travaux/[devoirId]` | prof | Travaux par devoir (3 colonnes) |
| `/dashboard/travaux/[devoirId]/[travailId]` | prof | Correction + annotations (`ResizableSplit`) |
| `/classes` | prof | Gestion classes et élèves + bloc « Mes Élèves » (tous les élèves, filtre actifs/archivés, recherche) ; clic sur un élève (bloc ou détail de classe) → fiche complète en popup (`EleveProfilModal` → `ProfilPanel`) |
| `/grilles` | prof | Mes Ressources : onglets Grilles + Listes de vocabulaire |
| `/archives` | prof | Devoirs archivés |
| `/admin` | admin | Header dédié (variant `admin`) en onglets : Vue d'ensemble (stats) / Gestion des membres (professeurs) / Gestion didactique (UAA + gestes, `DidactiquePanel`) / Gestion des coûts (compteurs d'usage IA — pas de suivi tokens) |
| `/roadmap` | tous | Nouveautés + à venir — **pilotée par Firestore**, éditable par l'admin (drag « À venir » → « Nouveautés » pour marquer fait) |
| `/rgpd` | tous | Données personnelles : quelles données, protection (chiffrement), services IA, droits RGPD — statique, menu avatar |
| `/activites` | élève | Devoirs disponibles + travaux corrigés |
| `/activites/[id]` | élève | Rédaction + auto-évaluation + remise (`WorkspaceRail`) |
| `/mes-classes` | élève | Classes + rejoindre une classe |
| `/profil` | élève | Profil d'écrilecteur en 5 onglets (Général / Lire / Écrire / Rechercher / Vocabulaire), un appel API par onglet chargé à la première ouverture |

### Header
- Prof : Mes Activités → `/dashboard` | Mes Classes → `/classes` | Mes Ressources →
  `/grilles` | Vue élève (œil) → `/activites` | Avatar menu
- Élève : Mes Activités → `/activites` | Mes Classes → `/mes-classes` | Mon Profil →
  `/profil` | Avatar menu

### API Routes
| Route | Méthodes | Description |
|---|---|---|
| `/api/devoirs`, `/api/devoirs/[id]`, `/api/devoirs/upload` | CRUD | Devoirs + upload fichiers |
| `/api/travaux`, `/api/travaux/[id]`, `/api/travaux/mine` | CRUD | GET prof déclenche `ensureTravaux()` |
| `/api/corrections`, `/api/corrections/[id]`, `/api/corrections/mine` | CRUD | `mine` filtre `visibleParEleve` |
| `/api/classes`, `/api/classes/[id]`, `/api/classes/student`, `/api/classes/join`, `/api/classes/by-code` | CRUD | Classes + rejoindre par code |
| `/api/eleves`, `/api/eleves/[id]`, `/api/eleves/bulk`, `/api/eleves/link` | CRUD | Import masse (max 500), liaison UID |
| `/api/grilles`, `/api/grilles/[name]` | CRUD | Mes grilles + shared + autres profs |
| `/api/preferences` | GET, PUT | Préférences éditeur |
| `/api/profil/{general,lecture,ecriture,recherche,vocabulaire}` | GET | Profil élève, un endpoint par onglet — helpers dans `src/lib/profil-stats.ts` ; `?eleveId=` réservé au prof (fiche élève — `src/lib/profil-target.ts` vérifie l'appartenance à ses classes) |
| `/api/didactique` | GET, PUT | Config « Didactique du français » (UAA + gestes) — doc `configuration/didactique`, GET tout connecté, PUT admin ; hook client `useDidactique` (cache partagé) |
| `/api/auth/role`, `/api/auth/init-user` | GET, POST | Résolution rôle, création doc user |
| `/api/professeurs`, `/api/admin/stats`, `/api/admin/prof-stats/[profId]` | — | Admin (profId = email encodé) |
| `/api/roadmap` | GET, POST | Roadmap Firestore (POST admin) |
| `/api/ai/writing-help`, `/api/ai/grid-eval` | POST / GET+POST | Aide rédaction + évaluation IA grille |
| `/api/dictionary` | GET | Dictionnaire élève : définition/synonymes/antonymes (Wiktionnaire, suivi de flexion) + proxémie (Claude) ; cache Firestore `dictionaryCache` ; enregistre les définitions demandées par un élève dans `vocabulairePersonnel/{uid}` |
| `/api/vocabulaire/personnel` | GET, POST | Vocabulaire personnel élève (mots cliqués) — POST utilisé par NavigKid ; GET prof avec `?studentId=` |
| `/api/navigkid/*` | — | Questionnaires, réponses, activités élève, aide IA recherche |
| `/api/vocabulaire/*` | — | Thèmes, mots, génération/validation exercices IA, suggestions |

### Composants clés
- Éditeurs Tiptap : `WorkEditor` (élève — collage externe bloqué, seul le texte copié
  dans l'espace de travail est recollable via `internal-clipboard.ts`), `RessourceEditor`
  (annotation ressources), `AnnotationEditor` (prof : 3 types textuels + audio + IA),
  `FlipEditor` (recto/verso)
- Brouillons : `CrcDraft` (compte rendu critique), `PlanDraft` (plan drag & drop), `FreeDraft`
- Vocabulaire : `VocabulaireActivity` (diagnostic → apprentissage → évaluation, mots
  difficiles/flashcards), `VocabulaireList`, `VocabulaireExercises`,
  `VocabulaireEvaluation` (mots croisés + syn/ant + composition), `VocabulaireStats`,
  `VocabulaireListReadOnly` (vue prof)
- NavigKid : `QuestionnaireBuilder`, `RechercheResponseViewer`, `RechercheStatsTab`
- Questionnaire de lecture (type lire) : `LectureQuizBuilder` (prof — blocs en
  accordéon drag & drop : QCM / texte court / texte long / **Souligner du texte**
  (extrait ou ressource, soulignage attendu `fluoAttendu`) / bloc informatif (éditeur
  Tiptap) ; icônes 🖼/🎧 à côté de l'énoncé — image, audio avec limite d'écoutes
  (popup fichier/micro) ; gestes de lecture en menu déroulant du bandeau (dynamiques,
  config didactique) ; total de points), `LectureQuizActivity` (élève — worksheet ou
  quiz sans retour arrière, réponses auto-sauvées en JSON dans `travail.content` ;
  lecteur audio limité ; `showCorrection` quand corrigé disponible : QCM ✅/❌,
  réponse idéale, comparaison `FluoCompare`), `LectureQuizReview` (correction — QCM
  auto-comptés, soulignage comparé, écoutes consommées, réponse idéale en encadré)
- Admin : `DidactiquePanel` (UAA + gestes : œil/poubelle/+ — alimente `useDidactique`)
- Fiche élève : `ProfilPanel` (profil 5 onglets partagé élève/prof),
  `EleveProfilModal` (grande popup), `MesElevesSection` (bloc Mes Élèves)
- `DrawTools` (`DrawToolbar` + `DrawCanvas`) : atelier de tracé sur image (6 outils,
  coordonnées en %, porté de romantismesam) — utilisé par les questions à image **et**
  par les images de l'onglet Ressources élève (`travail.ressourceImageShapes`)
- `VocabListEditor` : outil de listes de vocabulaire partagé entre Mes Ressources et
  le verso de la création d'activité vocabulaire (option « ➕ Nouvelle liste… » au recto)
- Création/édition d'activité : verso « 📚 Ajout de contenus » en deux groupes
  (« Ressources pour l'élève » / « Contenus de l'activité ») dans `CreationForm` **et**
  `EditDevoirModal` (refondu recto/verso) ; bouton « 👁 Prévisualiser l'espace élève »
  (enregistre `disponible: false` puis ouvre `/activites/[id]` — un prof y est en aperçu)
- Panels : `AssistancePanel` (onglets Consignes/Ressources/Évaluation/Remarques/Aide
  IA/Recherche — prop `hideTabs` quand un parent gère la navigation), `GrilleTab`
  (3 évaluations : élève, IA, prof)
- Aide IA réécriture : `AiTab` — 4 onglets par catégorie (Orthographe rouge, Ponctuation
  bleue, Syntaxe orange, Lexique brun), bouton d'analyse **dans** chaque onglet, conseils
  « un par un » (défaut, navigation libre ‹ ›) ou « tous » ; état d'interface mémorisé au
  niveau de la page (`AiTabUiState`) ; **synchro bulles** : sur l'onglet Aide IA, seules
  les bulles du conseil affiché restent visibles (pulse), sinon le toggle « Aide IA » de
  l'éditeur décide tout/rien (`aiBubbleFilter` → `updateAllAiDecorations`)
- Dictionnaire élève : `DictionaryPanel` (bloc permanent en tête de l'onglet Ressources :
  toggle + champ + 4 actions), `DictionaryPopup` (popup partagée, portal),
  `DictionaryClickLayer` (mots cliquables dans le panneau latéral, surlignage CSS Custom
  Highlight), clic-mot dans `WorkEditor` (surlignage fluo via `tiptap-dictionary.ts`)
- UI : `WorkspaceRail`, `ResizableSplit`, `JoinClasseModal`, `BulkImportEleveModal`,
  `ClassesDropdown` (menu déroulant multi-sélection à cases — formulaires devoir)

### Hooks
`useAuth` (expose `getAuthHeaders`), `useClasses`, `useStudentClasses`, `useEleves`, `useDevoirs`, `useGrille`,
`useTravail` (auto-save 2,5 s), `useCorrection`, `usePreferences`, `useAudioRecorder`,
`useAiSuggestions`, `useAiGridEvaluation`, `useVocabulaireThemes`, `useVocabulaireWords`,
`useVocabulaireExercises`, `useDictionaryLookup` (cache client partagé du dictionnaire),
`useDidactique` (config UAA/gestes, cache module partagé)

---

## 7. Gotchas opérationnels

> Les gotchas **critiques** (boucles de hooks, redirections, ContentLock, échelle des
> grilles) sont dans `AGENTS.md`. Ici : les pièges opérationnels.

### Pseudo-élément ::highlight non parsé par Turbopack
Le parseur CSS de Turbopack rejette `::highlight(...)` (API CSS Custom Highlight) dans
les fichiers CSS → **build cassé**. **Remède** : injecter la règle en JavaScript
(`document.createElement('style')`) — voir `DictionaryClickLayer.tsx`.

### Cache Turbopack corrompu
**Symptôme** : comportement bizarre en dev, fichiers `.sst` manquants, erreurs 500
inexpliquées. **Remède** : supprimer `.next/` et relancer `npm run dev`
(skill `/nextjs-dev-server` pour le diagnostic complet).

### Line-height inline dans le contenu élève
Le contenu Tiptap élève porte du `style="line-height: X"` inline.
**Symptôme** : le CSS de l'éditeur d'annotation prof est ignoré. **Remède** : `!important`.

### PreferencesContext
Graceful fallback si l'API renvoie une erreur (pas de throw) — ne pas « corriger » ça.

### Suppression d'un élève
Supprime `eleves/{id}` + `classes/{classeId}/eleves/` + `users/{uid}` ; **conserve**
travaux et corrections. Pas de cascade automatique dans Firestore.

### Icône œil
Réservée à « Vue de l'élève » (posture fictive prof) — **jamais** pour la visibilité des
corrections.

### AssistancePanel
`hideTabs={true}` côté élève (le `WorkspaceRail` gère la navigation), défaut `false` côté
prof.

---

## 8. Pointeurs

### Documentation
- [`AGENTS.md`](./AGENTS.md) — règles impératives
- [`harnais/README.md`](./harnais/README.md) — carte du harnais
- [`harnais/memoire/MEMORY.md`](./harnais/memoire/MEMORY.md) — état cross-sessions
- [`roadmap.md`](./roadmap.md) — où va le produit (+ page `/roadmap` dans l'app pour les
  utilisateurs)
- `DEPLOYMENT.md` — guide de déploiement détaillé

### Skills
- `/deploy` — les 3 surfaces de déploiement (app VPS, règles Firestore, extension Chrome)
- `/session-ritual` — rituel de début et fin de session
- `/nextjs-dev-server` — réparer le serveur dev (global)
- `/encrypt` — chiffrement de données sensibles Firestore (global)

### Fichiers clés
- `src/lib/crypto.ts` — chiffrement AES-256-GCM des identités élèves + `hashEmail`
  (HMAC) — **serveur uniquement**, jamais d'import côté client. Champs chiffrés :
  `eleves.nom/prenom/email` (+`emailHash`), `travaux.studentName/studentEmail`
  (+`studentEmailHash`), `users.email/displayName`, `vocabulairePersonnel.studentEmail`.
  Les requêtes d'identification passent par l'empreinte (`queryElevesByEmail` dans
  `src/lib/eleve-lookup.ts`, repli sur l'email en clair pour les documents non migrés).
  Migration : `scripts/encrypt-existing-identities.ts` (sauvegarde JSON dans `backups/`,
  ignoré par git). NavigKid : l'extension n'accède plus à Firestore — `reponses` et
  `recherches` passent par `/api/navigkid/reponse` (POST) et `/api/navigkid/recherches`
  (POST), qui chiffrent `eleveNom`/`eleveEmail`.
- `src/context/AuthContext.tsx` — Provider auth, `getAuthHeaders` centralisé
- `src/lib/api-auth.ts` — `verifyAuth()` côté serveur
- `src/lib/auth-utils.ts` — `getUserRole()`, `isAdmin()`
- `src/lib/firebase/admin.ts` — Firebase Admin (Proxy lazy init)
- `src/lib/firebase/config.ts` — Firebase client
- `src/lib/editor-constants.ts` — FONTS, FONT_SIZES, PAGE_THEMES, LINE_HEIGHT
- `src/lib/classe-utils.ts` — generateClasseId, generateClasseCode
- `src/lib/internal-clipboard.ts` — presse-papiers interne (anti-triche collage élève)
- `src/lib/tiptap-extensions.ts` — LineHeight, Indent, FontSize
- `src/lib/tiptap-annotations.ts` — ContentLock, SpellingMark, SyntaxMark, LexicalMark,
  PunctuationMark
- `src/lib/tiptap-ai-decorations.ts` / `-prof.ts` — décorations IA élève / prof
- `src/middleware.ts` — vide (auth côté client uniquement)

---

## 9. Contexte métier

- **Établissement** : Collège Notre-Dame de Dinant, secondaire, Fédération
  Wallonie-Bruxelles. L'utilisateur principal est prof de **français** et admin de l'app ;
  d'autres profs ont des comptes (isolation par `profId`).
- **Élèves sur Chromebook** : tout ce qui est côté élève doit tourner dans le navigateur
  sous ChromeOS — écrans et claviers d'entrée de gamme.
- **Littératie** : l'app suit les compétences d'« écrilecteur » (écriture + lecture).
  Les grilles ciblent des **UAA** (unités d'acquis d'apprentissage, référentiel FWB, 0-6).
- **Types d'activité** : écrire (rédaction + brouillon), lire, vocabulaire (diagnostic →
  apprentissage → évaluation sur séries lexicales), rechercher (NavigKid : recherche
  guidée sur le web via extension Chrome + questionnaire).
- **Cycle de correction** : l'élève rédige et s'autoévalue → le prof corrige (annotations
  textuelles, audio, précorrection IA) → la correction devient visible pour l'élève
  (`corrigeDisponible` / `visibleParEleve`).
- **Année scolaire** : format `"2025-2026"`, calculée automatiquement ; classes et grilles
  sont annualisées.
