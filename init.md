# Recto-versIA — Briefing agent

> Briefing dense lu au début de chaque session pour se localiser vite.
> Ce n'est PAS une documentation exhaustive. Ce qui change session par session vit dans
> `harnais/memoire/`.

---

## ⚡ TL;DR

- **Quoi** : assistant de correction pédagogique avec IA — un prof de français corrige des
  productions d'élèves via des grilles à 6 niveaux (précorrection Claude, dictée Whisper) ;
  les élèves rédigent, s'autoévaluent, travaillent le vocabulaire, font des recherches
  guidées (extension Chrome NavigKid) et se prononcent sur leur propre travail
  (auto-évaluation à deux regards). Le prof scénarise son année (Design & scénarisation).
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
| Nouvelle façon d'évaluer une activité | **Grille pour l'écriture, habiletés partout ailleurs** — jamais les deux. La grille n'est exigée que pour `typeTravail === 'ecrire'`, client ET serveur | `usesGrille` dans `CreationForm` / `EditDevoirModal` |
| Nouvel « atelier » (type d'activité) | Liste **fermée** (`ATELIERS`) : chaque atelier est lié à un **dispositif** que l'app sait afficher (`typeTravail`). Un atelier sans dispositif produirait une activité impossible à ouvrir | `src/types/didactique.ts` |
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
  classes: string[];             // noms de classes (["4A", "4B"]) — peut être VIDE
  dateRemise: Timestamp | null;  // FACULTATIVE (null) : une activité se prépare
                                 // avant de connaître ses classes de l'année.
                                 // null et non « champ absent » : orderBy l'exclurait.
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
  typeTravail: 'ecrire' | 'lire' | 'rechercher' | 'vocabulaire' | 'autoevaluation'; // DISPOSITIF
  modePrincipal?: TypeModal;     // compétence en jeu (lire/ecrire/parler/reflexif/lexique)
  atelier?: string;              // type d'activité — id de ATELIERS
  habiletes?: string[] | null;   // null = toutes celles de l'atelier
  evaluation?: 'formatif' | 'certificatif'; // certificatif = compte pour la note (tag sur les cards) ; absent sur les devoirs antérieurs
  hiddenCriteria?: string[];      // ids de critères de la grille masqués pour CE devoir (popup au choix de la grille)
  // disponibleAt / corrigeDisponibleAt : horodatages posés au basculement (notifications)
  questionnaireId?: string;       // ref questionnaires/{id} (type rechercher)
  codeAcces?: string;             // code 6 chars extension Chrome (type rechercher)
  autoEvalQuiz?: AutoEvalQuestionnaire | null; // questionnaire d'auto-évaluation
                                  // (type autoevaluation) — RIEN n'y est filtré
                                  // pour l'élève : ni bonne réponse, ni corrigé
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
  // nonRendu : décision du PROF (jamais automatique) — 'justifie' = pas de note,
  // 'nonJustifie' = cote finale 0 SANS toucher les critères (stats de capacités
  // préservées ; le 0 compte dans les stats du devoir, pas dans le profil).
  // Effets : bloc « Travaux non rendus » élève, corrigé masqué, remise clôturée.
  nonRendu?: 'justifie' | 'nonJustifie' | null;
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
  questionScores?: Record<string, number>; // questionnaire de lecture : points des questions ouvertes
  // Recherche : deux notes par question (clé = index) — la réponse et la
  // démarche, jamais mélangées. Voir src/lib/recherche-scoring.ts.
  rechercheScores?: Record<string, { reponse?, reponseComment?, demarche?, demarcheComment? }>;
  // Auto-évaluation : le REGARD DU PROF, donné aux mêmes questions que l'élève.
  // Ce n'est pas une note — l'écart avec l'élève dit sa lucidité.
  autoEvalProf?: Record<string, { echelon?: string; likert?: number }>;
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
  ateliers?: string[];           // types d'activite ou la grille est proposee (vide = partout)
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
- `scenarisations` : une par cours. `chapitres[].modules[].activites[]` imbriqués —
  accès **serveur uniquement**, donc **aucune règle Firestore**. Une activité de
  module peut être hors application (pas de `devoirId`).
- `configuration/didactique` : UAA + **habiletés** + **méthodes d'enseignement**
  (`methodes`, liste ouverte tenue par l'admin, lue par la colonne Méthode des
  modules). Une habileté =
  `{ id, type (mode principal), geste, label, objets[], uaa[], ateliers[], visible }`.
  Le **geste** n'est pas une entité : c'est le libellé partagé par plusieurs
  habiletés. Importée une fois depuis `scripts/data/ceintures-et-habiletes.csv`
  (63 lignes) — le tableau Google n'est plus la source de vérité.
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
| `/grilles` | prof | Mes Ressources : onglets Grilles + Listes de vocabulaire + **Design & scénarisation didactique** (`ScenarisationPanel`) |
| `/archives` | prof | Devoirs archivés |
| `/admin` | admin | Titre de page = nom de l'onglet actif (`ADMIN_TABS`, source unique dans `Header.tsx`). Header dédié (variant `admin`) en onglets : Vue d'ensemble (stats) / Gestion des membres (professeurs) / Gestion didactique (UAA + habiletés, `DidactiquePanel`) / Gestion des coûts (compteurs d'usage IA — pas de suivi tokens) |
| `/roadmap` | tous | Nouveautés + à venir — **pilotée par Firestore**, éditable par l'admin (drag « À venir » → « Nouveautés » pour marquer fait) |
| `/rgpd` | tous | Données personnelles : quelles données, protection (chiffrement), services IA, droits RGPD — statique, menu avatar |
| `/activites` | élève | 3 blocs : devoirs disponibles / travaux corrigés (correction rendue) / travaux non rendus (cochés par le prof, badge justifié ou « Non fait — 0 ») |
| `/mes-ressources` | élève | Mes ressources personnelles : onglet Liste de vocabulaire (mots dont il a demandé la définition) + onglet À venir (vide) |
| `/activites/[id]` | élève | Rédaction + auto-évaluation + remise (`WorkspaceRail`) |
| `/mes-classes` | élève | Classes + rejoindre une classe |
| `/profil` | élève | Profil d'écrilecteur en 7 onglets (Général / Lire / Écrire / Parler / Rechercher / Vocabulaire / **🪞 Me connaître**), un appel API par onglet chargé à la première ouverture |

### Header
- Prof : Mes Activités → `/dashboard` | Mes Classes → `/classes` | Mes Ressources →
  `/grilles` | Cloche notifications | Avatar menu (l'œil « Vue élève » a été retiré —
  l'aperçu passe par le bouton Prévisualiser des activités)
- Élève : Mes Activités → `/activites` | Mes Classes → `/mes-classes` | Mes Ressources
  personnelles → `/mes-ressources` | Mon Profil → `/profil` | Cloche | Avatar menu
- Cloche (`NotificationBell`, 3 variantes) : notifications calculées à la lecture
  (`/api/notifications`), badge non-lus vs `users.notifsLastSeen`, désactivables
  (prof/admin) via `users.notifsEnabled` — élève : activité ouverte / corrigé dispo ;
  prof : copies remises ; admin : + section Administration (vide)

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
| `/api/profil/{general,lecture,ecriture,recherche,vocabulaire,reflexif}` | GET | Profil élève, un endpoint par onglet — `recherche` renvoie `{ items, habiletes }` — helpers dans `src/lib/profil-stats.ts` ; `?eleveId=` réservé au prof (fiche élève — `src/lib/profil-target.ts` vérifie l'appartenance à ses classes) |
| `/api/scenarisations`, `/api/scenarisations/[id]` | CRUD | Scénarisations didactiques (une par cours) — document unique par scénarisation, chapitres et modules **imbriqués**. Le PUT réécrit tout et pose/efface `devoir.scenarisationRef` (passerelle en retour) |
| `/api/didactique` | GET, PUT | Config didactique (UAA + habiletés) — doc `configuration/didactique`, GET tout connecté, PUT admin ; le GET **normalise** les champs absents des documents anciens (`objets`, `ateliers`) ; hook client `useDidactique` (cache partagé) |
| `/api/auth/role`, `/api/auth/init-user` | GET, POST | Résolution rôle, création doc user |
| `/api/professeurs`, `/api/admin/stats`, `/api/admin/prof-stats/[profId]` | — | Admin (profId = email encodé) |
| `/api/roadmap` | GET, POST | Roadmap Firestore (POST admin) |
| `/api/notifications` | GET, PUT | Notifications calculées à la lecture (aucune collection) ; PUT : `lastSeen` / `enabled` |
| `/api/travaux/status` | GET | Élève : statut `{ status, nonRendu }` de ses travaux par devoir (classement page /activites) |
| `/api/classes/[id]/archive` | GET | Archive ZIP de la classe avant suppression : HTML par élève (nommé + évaluation) + notes.csv par activité + récapitulatif — ZIP maison `src/lib/zip.ts`, zéro dépendance |
| `/api/ai/writing-help`, `/api/ai/grid-eval` | POST / GET+POST | Aide rédaction + évaluation IA grille |
| `/api/dictionary` | GET | Dictionnaire élève : définition/synonymes/antonymes (Wiktionnaire, suivi de flexion) + proxémie (Claude) ; cache Firestore `dictionaryCache` ; enregistre les définitions demandées par un élève dans `vocabulairePersonnel/{uid}` |
| `/api/vocabulaire/personnel` | GET, POST | Vocabulaire personnel élève (mots cliqués) — POST utilisé par NavigKid ; GET prof avec `?studentId=` |
| `/api/navigkid/*` | — | Questionnaires, réponses, activités élève, aide IA recherche. `questionnaire` GET **filtre les éléments de correction** pour un élève (`src/lib/navigkid-server.ts`) ; `reponse` POST **bascule le travail en `submitted`** (l'envoi depuis l'extension EST la remise) et GET renvoie un `resume` calculé serveur |
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
- NavigKid : `QuestionnaireBuilder` (blocs repliables, drag & drop, duplication,
  habiletés et **deux barèmes** par question — réponse / démarche —, icône 📄
  texte joint ; même forme que `LectureQuizBuilder`), `QuestionnairePreviewModal`
  (aperçu du questionnaire tel que l'élève le lit dans l'extension — la page
  élève étant voilée, elle ne peut pas servir d'aperçu),
  `RechercheResponseViewer` (**écran de correction** : une carte par question,
  deux blocs Démarche/Réponse, chacun avec sa **gouttière de correction à
  droite** — ✔ / ? / ✘ + points + remarque ; sous 1150 px la gouttière repasse
  dessous), `RechercheEvaluation` (onglet Évaluation : les deux scores, les
  habiletés, les statistiques — **il n'y a plus d'onglet « Recherche »**),
  `RechercheStatsTab` (replié dans Évaluation),
  `RechercheStartOverlay` (voile flouté + popup **non fermable** sur la colonne 1 tant
  que l'élève n'a pas envoyé ses réponses ; le bouton ouvre Google + le panneau de
  l'extension), `RechercheResume` (compteurs justes/erreurs/à corriger, en tête de
  l'onglet Évaluation qui s'ouvre seul à la première réponse détectée).
  Type `rechercher` : **pas de bouton « Remettre le devoir »** — la remise, c'est
  l'envoi depuis l'extension
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
- **Auto-évaluation** (`typeTravail: 'autoevaluation'`) : `AutoEvalBuilder` (prof, verso —
  emojis compétence/humeur, échelle 1-5, QCM **sans bonne réponse**, textes, bloc info ;
  gestes limités au savoir-être et au réflexif), `AutoEvalActivity` (élève),
  `AutoEvalReview` (**prof : il répond à l'aveugle, la réponse de l'élève se découvre
  question par question**), `AutoEvalEvaluation` (onglet Évaluation : lucidité).
  Aucune note nulle part — voir `harnais/memoire/rollup_autoevaluation.md`
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
- `NotificationBell` : cloche du header (SVG monochrome), badge non-lus, dropdown
- `HideCriteriaModal` : popup « Masquer certains critères ? » à la sélection d'une
  grille (création ET édition d'activité) → `devoir.hiddenCriteria` ; répercuté sur
  `GrilleTab` (affichage, totaux, 75 % auto-éval), l'évaluation IA (`grid-eval` filtre
  et mappe sur les critères actifs) et les scores — un critère masqué mais évalué
  avant masquage reste visible et compté
- Non rendu : toggle dans `GrilleTab` vue prof (justifié / non justifié — note : 0),
  bandeau élève, badge liste prof, colonne Corrigés, stats devoir (0 compté, justifiés
  exclus du taux de remise), bloc « sanctionnés » onglet Général du profil,
  corrigé masqué serveur (`devoirs/[id]` GET), « Remise clôturée » (`WorkTopBar`)
- Profil : onglet 🗣️ Parler (état vide, pas d'endpoint), onglet Vocabulaire refondu
  (cartes stats par activité + Vue d'ensemble — séances, temps [`timeSpentSeconds`,
  chronométré depuis le 2026-08-12], sessions, diagnostics/évaluations en pastilles
  `ScoreChip`, répartition 4 niveaux rouge→vert) ; vue prof sans listes de mots ;
  « Tous les critères » (Écrire/Lire) groupés par grille avec mini-courbe à points
  (tooltip au survol) et détail dépliable ; carte Vocabulaire du Général en barre
  empilée ; `EmptyState` : `icon="hourglass"` = spinner, sinon emoji (jamais de mot-clé)

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

### Les devoirs référencent les classes par NOM
`devoirs.classes` contient des **noms** de classes, pas des ids. Le renommage d'une
classe est propagé aux devoirs du prof (PATCH `/api/classes/[id]`) ; la **suppression**
d'une classe laisse les devoirs orphelins (invisibles pour les élèves, visibles pour le
prof) — d'où la modale d'archive ZIP avant suppression.
**Symptôme historique** : devoir visible côté prof, absent côté élève (incident
forcoGosselies, 2026-08-12).

### Scores par habileté : la somme ne fait jamais le total
Une question portant deux habiletés compte **entièrement dans chacune**, jamais
divisée — sinon elle serait comptée à moitié dans les deux. Le total du
questionnaire, lui, compte chaque question **une seule fois**.
**Ne jamais additionner les lignes par habileté pour en tirer un total.**
La règle est écrite dans `lecture-scoring.ts` et rappelée à l'élève sous le tableau.

### QCM d'un questionnaire de lecture : jamais stockés
Les points des QCM sont **recalculés à chaque lecture** (`correctIndex`), pour
rester justes si le prof corrige le quiz après coup. Seules les questions
ouvertes sont enregistrées (`correction.questionScores`). Une question non notée
est **hors total** — numérateur comme dénominateur.

### Chercher, c'est lire
« Rechercher » n'est **pas** un mode principal : c'est un **atelier**. Une
recherche guidée est un travail de lecture. Le champ `devoir.typeTravail` garde
la valeur `'rechercher'` — c'est le *dispositif*, pas la modalité. Ne pas
« corriger » cette apparente incohérence : elle évite une migration des 35
branchements existants.

### Deux devoirs peuvent porter le même intitulé
La duplication d'activité copie l'intitulé ET le tableau `classes` : côté élève, deux
cartes homonymes peuvent coexister légitimement dans des blocs différents.

### Envoi de fichier : ne jamais passer `getAuthHeaders()` tel quel
`getAuthHeaders()` pose `Content-Type: application/json`. Passé à un `fetch`
dont le corps est un `FormData`, il empêche le navigateur d'écrire son propre
`multipart/form-data; boundary=…` → le serveur ne sait plus lire l'envoi.
**Symptôme** : « erreur d'upload : content-type was not one of
multipart/form-data or application/x-www-form-urlencoded ».
**Remède** : `headers: { Authorization: headers.Authorization }` uniquement
(voir `RessourcesInput`, `LectureQuizBuilder`).

### Pseudo-élément ::highlight non parsé par Turbopack
Le parseur CSS de Turbopack rejette `::highlight(...)` (API CSS Custom Highlight) dans
les fichiers CSS → **build cassé**. **Remède** : injecter la règle en JavaScript
(`document.createElement('style')`) — voir `DictionaryClickLayer.tsx`.

### Extension NavigKid : un identifiant par machine (connexion Google cassée)
L'extension chargée « non empaquetée » n'a pas d'identifiant fixe : Chrome le calcule
depuis le **chemin du dossier**. Or `chrome.identity.getRedirectURL()` construit
l'adresse de retour OAuth à partir de cet identifiant.
**Symptôme** : `Erreur 400 : redirect_uri_mismatch` à la connexion Google dans le
panneau, sur un poste où ça marchait avant (typiquement l'autre Mac).
**Remède immédiat** : relever l'ID dans `chrome://extensions` et ajouter
`https://<ID>.chromiumapp.org/` aux « URI de redirection autorisés » du client OAuth
`380560298164-d78g8d3e…` — console Google Cloud, **projet `recto-versia`** (attention,
le sélecteur de projet retombe facilement sur `essai-27712`).
**Remède durable, non fait** : champ `key` dans le manifeste (à arbitrer avec la
publication Chrome Web Store, qui attribue son propre identifiant).

### Extension NavigKid : `sidePanel.open()` et le geste utilisateur
Chrome n'autorise `chrome.sidePanel.open()` que pendant un geste utilisateur. Le
service worker le reçoit par relais depuis le script de contenu — mais **tout `await`
placé avant l'appel fait perdre le geste**. Dans `background/index.js`, l'ouverture est
donc la première instruction ; l'écriture dans le storage vient après.

### API_BASE de l'extension pointe la production
`sidebar/app.js` contient l'URL de production en dur. Pour tester en local il faut la
basculer sur `http://localhost:3003` **et penser à la remettre avant tout commit**.

### Spinner infini au rechargement d'une page prof
L'`AuthProvider` restaure le rôle depuis un cache `sessionStorage` **avant** que
Firebase ait rendu l'utilisateur : `isAuthenticated` et `role` sont déjà bons alors que
`user` est encore `null`. Une page qui lance son chargement sur ces deux valeurs seules
obtient un jeton nul, sort de son `fetch`, et **ne rejoue jamais l'effet** — l'écran reste
sur son spinner pour toujours.
**Symptôme** : « page blanche qui tourne dans le vide » après un clic sur un lien `<a>`
(rechargement complet) ou un F5, alors que la navigation interne fonctionne.
**Remède** : attendre `user?.uid`, pas seulement `isAuthenticated`, et ne jamais sortir
d'un chargement sans remettre `isLoading` à `false`. Corrigé le 2026-08-15 sur
`/dashboard/travaux/[devoirId]` et `.../[travailId]` — **le motif existe peut-être
ailleurs**.

### Menu déroulant rogné dans un tableau
Un `<table>` crée son propre contexte d'empilement : un menu en `position: absolute`
dans une cellule est **coupé par la ligne suivante**, et aucun `z-index` n'y change rien.
**Remède** : rendre le menu dans un **portail** (`createPortal` vers `document.body`) en
`position: fixed`, avec repositionnement au défilement — voir `TagField` de la
scénarisation.

### Un conteneur ne doit pas porter la couleur de ses en-têtes
Le constructeur de questionnaire de recherche était peint en `--c-bg-element`, la couleur
même de ses bandeaux de question : ceux-ci s'y noyaient et les blocs ne se détachaient
plus. Les constructeurs (lecture, recherche, auto-évaluation) ont un conteneur
**transparent** ; ce sont les cartes qui portent la couleur.

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

### Scripts ponctuels
- `scripts/import-habiletes.ts` — import unique des 63 habiletés depuis
  l'instantané CSV. **Rejouable sans risque** : n'ajoute que ce qui manque.
- `scripts/prefill-ateliers.ts` — pré-coche l'atelier évident selon le mode
  principal. N'ajoute jamais un 2ᵉ atelier, n'en retire aucun.

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
- `src/types/scenarisation.ts` — modèle de la scénarisation (parcours >
  chapitres > modules > activités) et ses calculs : `capacitePeriode`
  (semaines × heures/semaine ÷ durée d'une période), `periodesPlanifiees`,
  `formatDuree`. **Le prof saisit des périodes, jamais des heures.**
- `src/lib/scenarisation-server.ts` — nettoyage avant écriture : le PUT
  réécrit le document entier, tout champ non reconnu est perdu.
- `src/types/didactique.ts` — modèle didactique : `TypeModal` (mode principal),
  `ATELIERS` (liste **fermée**, chaque atelier lié à un dispositif = `typeTravail`),
  `Habilete`, `habiletesPourAtelier`, `ATELIER_PAR_MODE`.
- `src/lib/lecture-scoring.ts` — notation d'un questionnaire de lecture et
  agrégation par habileté. Partagé serveur (profil) et client (onglets Évaluation).
- `src/types/autoevaluation.ts` / `src/lib/autoeval-scoring.ts` — auto-évaluation.
  **Seules les questions ORDONNÉES se comparent** (sentiment de compétence, échelle 1-5) :
  une émotion ne s'évalue pas, un texte ne se place sur aucun axe. L'écart élève/prof
  donne « se voit juste / se sous-estime / se surestime ».
- `src/lib/recherche-scoring.ts` — son pendant pour la recherche : **deux
  volets** (réponses / démarche), QCM recalculés à chaque lecture, note du prof
  prioritaire sur l'automatique, agrégation par habileté, statistiques de
  recherche. Un volet dont le barème vaut 0 n'est pas noté.
- `src/lib/navigkid-server.ts` — filtrage des éléments de correction NavigKid
  (`correctes`, `reponseAttendue`, `referencesProf`) pour le rôle élève + calcul du
  récapitulatif. **Serveur uniquement** — pendant de `lecture-server.ts`. Rappel :
  l'extension enregistre le **texte** de l'option QCM choisie, pas son indice.
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
- **Geste ⊃ habileté** : un **geste cognitif** (geste de lecture, d'écriture, de
  recherche…) **englobe** plusieurs **habiletés**, qui en sont les déclinaisons
  évaluables (« je suis capable de… »). Deux niveaux, jamais deux synonymes :
  la **scénarisation** planifie en **gestes**, la **création d'activité** et la
  **notation** évaluent en **habiletés**. Ne jamais renommer l'un en l'autre.
- **Types d'activité** : écrire (rédaction + brouillon), lire, vocabulaire (diagnostic →
  apprentissage → évaluation sur séries lexicales), rechercher (NavigKid : recherche
  guidée sur le web via extension Chrome + questionnaire).
- **Cycle de correction** : l'élève rédige et s'autoévalue → le prof corrige (annotations
  textuelles, audio, précorrection IA) → la correction devient visible pour l'élève
  (`corrigeDisponible` / `visibleParEleve`).
- **Année scolaire** : format `"2025-2026"`, calculée automatiquement ; classes et grilles
  sont annualisées.
