# Recto-versIA — Contexte Projet

## 1. Identite

| Champ | Valeur |
|-------|--------|
| **Nom** | Recto-versIA — Assistant de correction pedagogique avec IA |
| **Version** | 3.0 (mars 2026) |
| **Domaine** | EdTech — correction de productions ecrites d'eleves |
| **Ecole** | College Notre-Dame de Dinant (Belgique) |
| **Utilisateur principal** | Jean-Philippe Bolle (professeur) |

Application web : un enseignant corrige des productions d'eleves via des grilles a 6 niveaux, avec assistance IA (precorrection Claude, dictee vocale Whisper). Les eleves redigent, s'autoevaluent et consultent la correction du professeur.

---

## 2. Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| Styling | CSS Modules + design system Classica (tokens `--c-*`) |
| Auth | Firebase Authentication (Google OAuth) |
| Base de donnees | Firebase Firestore (Plan Blaze) |
| Grilles | Google Sheets API (lecture seule) |
| IA | Claude API (`claude-sonnet-4-5-20250929`) — API Routes serveur |
| Audio | OpenAI Whisper API — API Routes serveur |
| Editeur riche | Tiptap 3 + extensions custom (LineHeight, Indent, ContentLock, annotations) |
| Diff texte | `diff` (npm) — diff mot-a-mot |
| Hosting | VPS Hostinger — PM2 + Nginx |

---

## 3. Authentification et roles

| Email | Role |
|-------|------|
| `jeanphilippe.bolle@cnddinant.be` | `prof` + admin |
| Email dans collection `professeurs` | `prof` |
| Tout autre compte Google | `eleve` |

- Tout non-prof est `eleve` automatiquement (`getUserRole()` dans `src/lib/auth-utils.ts`)
- Auth cote client via Firebase tokens (pas de cookie session)
- Middleware vide — toute la logique auth est cote client
- `verifyAuth()` cote serveur dans `src/lib/api-auth.ts`
- Nouvel eleve : login → popup "Rejoindre une classe" (3 tentatives max)
- Eleve sans classe : redirige vers `/login` depuis toutes les pages

### Codes de classe
- Format `AB1-CD2-EF3` (alphabet reduit sans 0/O/1/I/L)
- Genere a la creation de classe
- API : `GET /api/classes/by-code?code=XXX`, `POST /api/classes/join`

---

## 4. Modele de donnees (Firestore)

### `devoirs`
```typescript
interface Devoir {
  id: string;                    // DEV-YYYYMMDD-XXXX
  classes: string[];             // noms de classes (["4A", "4B"])
  dateRemise: Timestamp;
  grille: string;                // nom de la grille Google Sheets
  intitule: string;
  consignes: string;
  ressources: DevoirRessource | null;
  accesIA: boolean;              // eleve peut utiliser IA
  disponible: boolean;           // visible par eleves
  archive: boolean;
  corrige: boolean;              // classe comme corrige
  corrigeDisponible: boolean;    // corrections visibles par eleves
  profId: string;
  anneeScolaire: string;         // "2025-2026" (calcul auto)
  createdAt: Timestamp;
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
}
```

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
  audioAnnotations?: AudioAnnotation[];
  draftAnnotations?: Record<string, DraftItemAnnotation>;
  visibleParEleve: boolean;
  status: 'draft' | 'finalized';
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

### `classes`
```typescript
interface Classe {
  id: string;
  nom: string;                   // "4A"
  code: string;                  // "AB1-CD2-EF3"
  profId: string;
  anneeScolaire: string;
  archive: boolean;
}
```

### `eleves`
```typescript
interface Eleve {
  id: string;
  classeId: string;
  nom: string;
  prenom: string;
  email: string;
  firebaseUid?: string;
}
```

### `professeurs`, `users/{uid}`, `aiGridEvaluations`
- `professeurs` : doc ID = email, gere par admin via `/admin`
- `users/{uid}` : profil + preferences editeur (`font`, `fontSize`, `lineHeight`, `theme`)
- `aiGridEvaluations` : ID = `AIGRID-{travailId}`, evaluation IA par critere

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
- 6 niveaux fixes (0/15/35/60/80/100%)
- Chaque prof ne voit que ses grilles + grilles partagees (shared)
- Section "Grilles des professeurs" : duplication lecture seule

---

## 5. API Routes

| Route | Methodes | Description |
|-------|----------|-------------|
| `/api/devoirs` | GET, POST | Lister / creer devoirs |
| `/api/devoirs/[id]` | GET, PATCH, DELETE | Detail / modifier / supprimer |
| `/api/devoirs/upload` | POST | Upload fichiers (Firebase Storage) |
| `/api/travaux` | GET, POST | Lister / creer travaux. GET prof declenche `ensureTravaux()` |
| `/api/travaux/[id]` | GET, PATCH | Detail / modifier travail |
| `/api/travaux/mine` | GET | Travail de l'eleve connecte |
| `/api/corrections` | GET, POST | Corrections. GET supporte `?devoirId=X` |
| `/api/corrections/[id]` | PATCH | Modifier correction |
| `/api/classes` | GET, POST | Lister / creer classes |
| `/api/classes/[id]` | GET, PATCH, DELETE | Detail / modifier / supprimer |
| `/api/classes/student` | GET | Classes de l'eleve (par firebaseUid/email) |
| `/api/classes/join` | POST | Rejoindre une classe par code |
| `/api/classes/by-code` | GET | Lookup classe par code |
| `/api/eleves` | GET, POST | Lister / creer eleves |
| `/api/eleves/[id]` | GET, PATCH, DELETE | Detail / modifier / supprimer (cascade: eleves + sous-collection + users) |
| `/api/eleves/bulk` | POST | Import en masse (max 500) |
| `/api/eleves/link` | POST | Lier eleve a UID Firebase |
| `/api/grilles` | GET, POST | Lister (mes grilles + shared + autres profs) / creer |
| `/api/grilles/[name]` | GET, PATCH, DELETE | Detail / modifier / supprimer grille |
| `/api/preferences` | GET, PUT | Preferences editeur |
| `/api/auth/role` | GET | Resolution role |
| `/api/auth/init-user` | POST | Creation doc utilisateur |
| `/api/professeurs` | GET, POST, DELETE | CRUD professeurs (admin, supporte expiresAt) |
| `/api/admin/stats` | GET | Stats globales (admin) |
| `/api/ai/writing-help` | POST | Aide redaction IA |
| `/api/ai/grid-eval` | GET, POST | Evaluation IA grille |

---

## 6. Pages et navigation

| Route | Acces | Description |
|-------|-------|-------------|
| `/` | tous | Redirection : prof → `/dashboard`, eleve → `/login` |
| `/login` | public | Connexion Google + modal join classe |
| `/dashboard` | prof | Devoirs (actuels / corriges / archives) + creation |
| `/dashboard/travaux/[devoirId]` | prof | Travaux par devoir (3 colonnes) |
| `/dashboard/travaux/[devoirId]/[travailId]` | prof | Correction + annotations |
| `/classes` | prof | Gestion classes et eleves |
| `/grilles` | prof | Consultation grilles |
| `/archives` | prof | Devoirs archives |
| `/admin` | admin | Gestion professeurs + stats |
| `/roadmap` | tous | Nouveautes + fonctionnalites a venir |
| `/activites` | eleve | Devoirs disponibles |
| `/activites/[id]` | eleve | Redaction + auto-evaluation + remise |
| `/mes-classes` | eleve | Classes + rejoindre une classe |
| `/profil` | eleve | Profil d'ecrilecteur (stats) |

### Header prof
Mes Activités → `/dashboard` | Mes Classes → `/classes` | Mes Grilles → `/grilles` | Vue eleve (oeil) → `/activites` | Avatar menu

### Header eleve
Mes Activites → `/activites` | Mes Classes → `/mes-classes` | Mon Profil → `/profil` | Avatar menu

---

## 7. Composants cles

### Editeurs Tiptap
- `WorkEditor` — editeur principal eleve (polices accessibles, interligne, indentation)
- `RessourceEditor` — annotation ressources (surlignage, rature, notes, dictionnaire)
- `AnnotationEditor` — annotations prof (3 types textuels + audio + suggestions IA)
- `FlipEditor` — recto (texte) / verso (brouillon) avec onglets

### Brouillons
- `CrcDraft` — compte rendu critique (brainstorming + plan drag & drop)
- `PlanDraft` — plan hierarchique
- `FreeDraft` — brouillon libre

### Panels
- `AssistancePanel` — panel lateral avec onglets (Consignes, Ressources, Grille, Remarques, Aide IA)
- `GrilleTab` — grille interactive avec 3 evaluations (eleve, IA, prof)

### UI
- `ResizableSplit` — panneau redimensionnable (divider draggable)
- `JoinClasseModal` — 9 cases input pour code classe
- `BulkImportEleveModal` — import en masse CSV/texte

---

## 8. Hooks

| Hook | Description |
|------|-------------|
| `useAuth` | Auth depuis AuthContext |
| `useClasses` | CRUD classes prof |
| `useStudentClasses` | Classes eleve + joinClasse() |
| `useEleves(classeId)` | CRUD eleves + bulkCreate |
| `useDevoirs` | CRUD devoirs + toggles |
| `useGrille(name)` | Contenu grille |
| `useTravail` | CRUD travail + auto-save 2.5s |
| `useCorrection` | CRUD correction + auto-save + score |
| `usePreferences` | Preferences editeur |
| `useAudioRecorder` | MediaRecorder pour annotations vocales |
| `useAiSuggestions` | Suggestions IA redaction |
| `useAiGridEvaluation` | Evaluation IA grille |

---

## 9. Fichiers cles

- `src/context/AuthContext.tsx` — Provider auth, getAuthHeaders centralise
- `src/lib/api-auth.ts` — verifyAuth() cote serveur
- `src/lib/auth-utils.ts` — getUserRole(), isAdmin()
- `src/lib/firebase/admin.ts` — Firebase Admin (Proxy lazy init)
- `src/lib/firebase/config.ts` — Firebase client
- `src/lib/editor-constants.ts` — FONTS, FONT_SIZES, PAGE_THEMES, LINE_HEIGHT
- `src/lib/classe-utils.ts` — generateClasseId, generateClasseCode
- `src/lib/tiptap-extensions.ts` — LineHeight, Indent, FontSize
- `src/lib/tiptap-annotations.ts` — ContentLock, SpellingMark, SyntaxMark, LexicalMark
- `src/lib/tiptap-ai-decorations.ts` — Decorations IA eleve
- `src/lib/tiptap-ai-decorations-prof.ts` — Decorations IA prof
- `src/middleware.ts` — Vide (auth cote client uniquement)

---

## 10. Roadmap

### Fait (v3.0)
- [x] **Multi-professeurs** : isolation par profId (devoirs, classes, grilles, corrections)
- [x] **Acces temporaire** : 1 jour / 1 semaine avec expiration auto
- [x] **Grilles partagees** : exemples admin + duplication entre profs
- [x] **Stats admin** : vue d'ensemble de l'app
- [x] **Page roadmap** : accessible a tous via menu avatar

### Priorite haute
1. **Integration NavigKid** : recherche guidee web dans Recto-versIA (questionnaires, suivi, correction IA)
2. **Avis critique entre pairs (CRC)** : l'eleve lit/redige un avis sur le CRC d'un autre eleve. Attribution aleatoire et anonyme

### Priorite moyenne
3. **Grille de metacognition** : ecart auto-evaluation / correction prof, evolution du texte
4. **Finalisation correction** : versioning, verrouillage apres envoi
5. **Commentaires prof ameliores** : assistance IA + dictee vocale
6. **Immersive Reader** : Microsoft Azure, synthese vocale, decoupage syllabique

### Priorite basse
7. **Chiffrement donnees eleves** : RGPD, refonte couche d'acces
8. **Ecart visuel prof/eleve** : comparaison detaillee dans la grille

---

## 11. Variables d'environnement

```
CLAUDE_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_SHEETS_ID=1ZHrq0FGe...
FIREBASE_* (client + admin)
```
