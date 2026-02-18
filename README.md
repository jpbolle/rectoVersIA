# Recto-versIA

**Assistant de correction pédagogique avec IA** pour l'enseignement du français.

Application web permettant à un enseignant de corriger des productions écrites d'élèves via des grilles de correction à 6 niveaux, avec assistance IA (précorrection Claude, dictée vocale). Les élèves rédigent, s'autoévaluent et consultent la correction du professeur ou de l'assistant IA.

Développé au Collège Notre-Dame de Dinant (Belgique).

---

## Fonctionnalités

### Espace élève

- **Éditeur de texte riche** (Tiptap) avec polices accessibles (OpenDyslexic, Comic Sans, Arial, Verdana), interligne ajustable, indentation, thèmes de page
- **Brouillon / plan** : trois modes selon le type de travail :
  - *Compte rendu critique (CRC)* : brainstorming en colonnes positifs/négatifs avec arguments, puis plan d'argumentation par drag & drop
  - *Plan hiérarchique* : arbre d'idées principales et secondaires avec indentation
  - *Brouillon libre* : notes en texte riche
- **Annotation des ressources** : surlignage multicolore, soulignement, rature, notes marginales, dictionnaire Wiktionnaire intégré
- **Auto-évaluation** sur grille interactive à 6 niveaux
- **Aide IA à la rédaction** (optionnelle, activable par le prof) : suggestions orthographe, ponctuation, syntaxe, lexique avec décorations inline dans l'éditeur
- **Évaluation IA de la grille** : Claude évalue le texte sur chaque critère avec justification
- **Préférences d'accessibilité** : police, taille, interligne, thème — persistées dans Firestore
- **Consultation des corrections** du professeur (annotations textuelles, audio, grille, commentaires)

### Espace professeur

- **Tableau de bord** : gestion des devoirs (création, édition, duplication, archivage, toggles de disponibilité)
- **Gestion des classes** : CRUD + import Google Classroom
- **Consultation des grilles** de correction (stockées dans Google Sheets)
- **Correction des travaux** :
  - Annotations textuelles : orthographe, syntaxe, lexique (marks colorés)
  - Annotations vocales (enregistrement audio, stockage base64)
  - Annotations sur le brouillon/plan de l'élève (correct/incorrect + audio par item)
  - Grille de correction avec score automatique
  - Commentaire général
  - Visualisation des suggestions IA de réécriture de l'élève (bulles, diff mot-à-mot)
- **Navigation entre travaux** (flèches + menu déroulant)
- **Toggle "Corrigé disponible"** : rend les corrections visibles aux élèves en un clic

### Administration

- Gestion des professeurs (ajout/suppression)
- Support multi-professeurs (emails hors domaine école)

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | CSS Modules |
| Auth | Firebase Authentication (Google OAuth) |
| Base de données | Firebase Firestore |
| Grilles de correction | Google Sheets API (lecture seule) |
| IA | Claude API (Anthropic) — `claude-sonnet-4-5-20250929` |
| Transcription audio | OpenAI Whisper API |
| Éditeur riche | Tiptap 3 + extensions personnalisées |
| Diff texte | `diff` (npm) |

---

## Prérequis

- **Node.js** 18+
- Un projet **Firebase** avec Authentication (Google OAuth) et Firestore activés
- Un **classeur Google Sheets** contenant les grilles de correction (un onglet par grille, 6 niveaux par critère)
- Un compte de service Google avec accès au classeur Sheets
- Une clé API **Anthropic** (Claude) pour l'assistance IA


---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/<votre-repo>/recto-versia.git
cd recto-versia
npm install
```

### 2. Variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (serveur)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Google Sheets (grilles de correction)
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

# Anthropic Claude API
CLAUDE_API_KEY=

# OpenAI Whisper API (optionnel)
OPENAI_API_KEY=
```

### 3. Configuration Firebase

#### Authentification

1. Activer le fournisseur **Google** dans Firebase Console > Authentication
2. Restreindre le domaine autorisé si nécessaire (ex : `@cnddinant.be`)
3. Ajouter les domaines autorisés (localhost + production) dans les paramètres OAuth

#### Firestore

Déployer les règles et index :

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Les fichiers `firestore.rules` et `firestore.indexes.json` sont inclus dans le dépôt.

#### Rôles utilisateur

Par défaut, le rôle est déterminé par l'email :
- L'email admin est hardcodé dans `src/lib/auth-utils.ts` — **à modifier** pour votre propre email
- Les emails ajoutés dans la collection Firestore `professeurs` obtiennent le rôle `prof`
- Tous les autres emails du domaine autorisé obtiennent le rôle `eleve`

### 4. Google Sheets (grilles)

Le classeur Google Sheets doit être partagé en lecture avec le compte de service (`GOOGLE_SERVICE_ACCOUNT_EMAIL`).

Chaque onglet = une grille. Format attendu :
- Ligne 1 : en-têtes
- Colonnes : Critère | Poids | Néant (0%) | Très insuffisant (15%) | Insuffisant (35%) | Suffisant (60%) | Acquis (80%) | Parfaitement acquis (100%)

### 5. Lancer le serveur de développement

```bash
npm run dev
```

L'application est accessible sur [http://localhost:3003](http://localhost:3003).

---

## Déploiement en production

### Build

```bash
npm run build
npm start
```

### Déploiement sur un VPS

Exemple avec PM2 :

```bash
# Sur le serveur
git clone <repo> /app/recto-versia
cd /app/recto-versia
npm install
cp .env.local.example .env.local  # remplir les variables
npm run build
pm2 start npm --name "recto-versia" -- start
```

Pensez à :
- Configurer un reverse proxy (Nginx/Caddy) avec HTTPS
- Ajouter le domaine de production dans les domaines autorisés Firebase Auth
- Vérifier les headers CORS si vous utilisez Firebase Storage

---

## Structure du projet

```
src/
├── app/                    # Pages (App Router)
│   ├── activites/          # Espace élève
│   ├── dashboard/          # Espace prof
│   ├── admin/              # Administration
│   ├── classes/            # Gestion des classes
│   ├── grilles/            # Consultation des grilles
│   ├── archives/           # Devoirs archivés
│   ├── login/              # Page de connexion
│   └── api/                # API Routes (serveur)
├── components/             # Composants React
│   ├── AnnotationEditor/   # Éditeur d'annotations (prof)
│   ├── AssistancePanel/    # Panel latéral (consignes, ressources, grille, IA)
│   ├── DraftEditor/        # Brouillon/plan (CRC, hiérarchique, libre)
│   ├── FlipEditor/         # Conteneur recto (texte) / verso (plan)
│   ├── GrilleTab/          # Grille d'évaluation interactive
│   ├── WorkEditor/         # Éditeur principal élève
│   └── ...
├── context/                # Contextes React (Auth, Preferences)
├── hooks/                  # Hooks personnalisés
├── lib/                    # Utilitaires, Firebase, extensions Tiptap
└── types/                  # Types TypeScript
```

---

## Licence

Ce projet est open source. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
