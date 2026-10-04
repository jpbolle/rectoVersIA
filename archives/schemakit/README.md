# SchémaKit — Documentation du projet

> **Nom** : SchémaKit (code : `schemakit`).
> **Statut** : squelette Next.js + harnais installés le 2026-09-11, aucun module livré.
> Ce document est le **cahier des charges de départ** ; l'état courant se lit dans `init.md`.
> Choix tranchés le 2026-09-11 : React Flow, code de classe, CSS Modules (§7).
>
> **⚠️ Précision du 2026-09-13 : SchémaKit est une maquette.** Une fois aboutie, elle sera
> refondue dans **Recto-versIA** (`~/Documents/rectoVersIA`), qui a déjà la connexion, les
> classes, les devoirs et les travaux. Les sections §5.3 (modèle Firestore) et §6
> (authentification) décrivent donc une cible **provisoire**, à relire à la lumière du
> plan `harnais/plans/2026-09-13-outils-utilisateur.md`.

---

## 1. En une phrase

Une application web où les **élèves** schématisent (ligne du temps, carte mentale, carte
conceptuelle) dans le cadre de devoirs donnés par leur **professeur**, qui peut ensuite
consulter chaque travail.

## 2. Pour qui

| Public | Ce qu'il fait | Contrainte |
|---|---|---|
| **Élèves** du Collège Notre-Dame de Dinant | Se connectent, voient leurs devoirs, construisent un schéma, le remettent | **Chromebook** : tout doit tourner dans le navigateur (Chrome), sur un écran d'entrée de gamme, au clavier et au pavé tactile |
| **Professeurs** | Créent des devoirs (consignes + type de schéma), consultent les travaux rendus | Multi-prof dès le départ : chaque prof ne voit que ses devoirs et ses classes |

---

## 3. Fonctionnalités

### 3.1 Version 1 (le minimum qui rend service)

**Côté élève**
- [ ] Connexion par **code de classe + nom** (§6.2).
- [ ] Liste des devoirs du prof, avec état : *à faire · brouillon · remis*.
- [ ] Page « devoir » en **deux colonnes** :
  - **gauche (1/5 de la largeur)** : les instructions du prof ;
  - **droite (4/5 de la largeur)** : l'espace de création du schéma.
- [ ] Trois types de schéma : **ligne du temps**, **carte mentale**, **carte conceptuelle**
  (voir §4). Le type est imposé par le prof dans le devoir.
- [ ] **Sauvegarde automatique** du brouillon (l'élève ne doit jamais perdre son travail
  si le Chromebook se ferme).
- [ ] Bouton **Remettre** : le travail passe en « remis » et devient en lecture seule.

**Côté prof**
- [ ] Connexion Google (§6.2) ; création des **classes** avec leur code.
- [ ] Création / modification d'un devoir : intitulé, consignes, type de schéma, classes
  visées, visible ou non par les élèves.
- [ ] Liste des travaux d'un devoir : qui a remis, qui est en brouillon, qui n'a rien
  commencé.
- [ ] Ouverture d'un travail : le schéma de l'élève, en lecture seule, avec les consignes
  à côté (même mise en page que l'élève).

### 3.2 Plus tard (pas en v1 — noter les idées ici plutôt que de les coder)

| Idée | Pourquoi pas maintenant |
|---|---|
| Commentaires ou note du prof sur un schéma | La v1 doit d'abord prouver que l'espace de création est agréable. |
| ~~Export du schéma en image (PNG/PDF)~~ | **Livré le 2026-09-13** (`html-to-image` + impression). |
| Images dans les schémas | Demande Firebase Storage (stockage de fichiers) et des règles en plus. |
| Schéma « modèle » fourni par le prof (l'élève complète) | Belle idée pédagogique, à faire une fois le format de données stable. |
| Travail à plusieurs sur un même schéma (temps réel) | Complexité élevée, pas demandé. |

---

## 4. Les trois types de schéma

Les trois se ressemblent (des boîtes et des traits) mais n'obéissent pas aux mêmes
règles. Les nommer précisément évite de construire un outil « fourre-tout » qui ne fait
bien aucun des trois.

| Type | Forme | Ce que l'élève manipule | Ce qui le distingue |
|---|---|---|---|
| **Ligne du temps** | Un axe horizontal, des événements placés dessus | Événements (titre, date ou période, courte description), éventuellement des **périodes** (bandes colorées) | La **position est calculée à partir de la date**, pas placée à la main. Zoom sur l'axe. |
| **Carte mentale** (*mind map*) | Un **arbre** : une idée centrale, des branches, des sous-branches | Nœuds (texte court, couleur), hiérarchie parent → enfant | Un nœud a **un seul parent**. Les liens ne portent pas de texte. Disposition radiale ou en éventail, souvent automatique. |
| **Carte conceptuelle** | Un **graphe** : des concepts reliés par des liens **étiquetés** | Concepts (boîtes), liens avec un **mot de liaison** (« provoque », « fait partie de »…), placement libre | Un concept peut être relié à **plusieurs** autres, dans tous les sens. C'est le mot de liaison qui fait la valeur pédagogique. |

**Conséquence pour le code** : un seul format de données commun (nœuds + liens, voir
§5.3), mais **trois éditeurs** avec leurs propres règles (l'éditeur de carte mentale
interdit un second parent, celui de ligne du temps impose une date).

---

## 5. Architecture technique

### 5.1 Stack

| Brique | Choix | Remarque |
|---|---|---|
| Framework | **Next.js** (App Router) + React + TypeScript | Même base que Recto-versIA et KitSchool. |
| Authentification | **Firebase Auth** | Élèves : anonyme + code de classe ; profs : Google (§6.2). |
| Base de données | **Firestore** (base NoSQL de Firebase, documents organisés en collections) | Région **Europe** obligatoire à la création — choix irréversible (données de mineurs). |
| Accès serveur à la base | **SDK admin** dans les routes API de Next.js | Contourne les règles de sécurité : à réserver aux opérations qui en ont besoin. |
| Styles | **CSS Modules** (un fichier CSS par composant) | Aucun framework CSS. |
| Éditeur de schéma | **React Flow** (`@xyflow/react`) | Tranché le 2026-09-11 (§7.1). |
| Hébergement | *À trancher* (§7) | VPS Hostinger (comme Recto-versIA) ou Firebase App Hosting. |

### 5.2 Arborescence prévue

```
src/
  app/
    (auth)/login/            page de connexion
    eleve/                   interface élève
      devoirs/               liste des devoirs
      devoirs/[id]/          page devoir : consignes (1/5) + éditeur (4/5)
    prof/                    interface prof
      devoirs/               liste + création
      devoirs/[id]/          travaux rendus pour ce devoir
      devoirs/[id]/[workId]/ un travail, en lecture seule
    api/                     routes serveur (SDK admin)
  components/
    diagram/                 les trois éditeurs + composants communs
      TimelineEditor.tsx
      MindMapEditor.tsx
      ConceptMapEditor.tsx
    layout/                  colonnes, en-têtes
  lib/
    firebase.ts              SDK client (initialisation paresseuse, cf. §8)
    firebase-admin.ts        SDK admin (serveur uniquement)
    auth.ts                  résolution du rôle
  types/
    diagram.ts               format de données commun (§5.3)
    assignment.ts, work.ts
firestore.rules              règles de sécurité — déployées À LA MAIN
```

### 5.3 Modèle de données (Firestore)

Noms de collections et de champs en **anglais** (convention code), textes d'interface en
français.

**`users/{uid}`** — un document par compte, indexé par l'identifiant Firebase Auth.
```typescript
interface User {
  role: 'student' | 'teacher';
  studentId?: string;           // élève : lien vers students/{id}
  email?: string;               // prof uniquement (compte Google)
  createdAt: Timestamp;
}
```

**`classes/{id}`** — une classe d'un prof, avec son **code** d'accès.
```typescript
interface Class {
  name: string;                 // "4A"
  code: string;                 // 6 caractères, généré, unique
  teacherId: string;
  schoolYear: string;           // "2026-2027"
}
```

**`students/{id}`** — un élève d'une classe. C'est **ce document** qui porte l'identité,
pas le compte Firebase : un élève peut avoir plusieurs `uid` (plusieurs navigateurs).
```typescript
interface Student {
  classId: string;
  lastName: string;
  firstName: string;
  uids: string[];               // comptes anonymes rattachés
}
```

**`assignments/{id}`** — un devoir créé par un prof.
```typescript
interface Assignment {
  title: string;
  instructions: string;         // consignes (texte riche ou Markdown — à trancher)
  diagramType: 'timeline' | 'mindmap' | 'conceptmap';
  classIds: string[];           // classes visées (["4A", "4B"])
  teacherId: string;            // uid du prof — isolation multi-prof
  published: boolean;           // visible par les élèves
  dueDate: Timestamp | null;    // échéance FACULTATIVE (convention Recto-versIA)
  schoolYear: string;
  createdAt: Timestamp;
}
```

**`works/{assignmentId}_{studentId}`** — le travail d'un élève pour un devoir.
L'identifiant composé garantit **un seul travail par élève et par devoir** (pas de
doublon si l'élève reclique).
```typescript
interface Work {
  assignmentId: string;
  studentId: string;
  studentName: string;          // dénormalisé pour la liste prof
  status: 'draft' | 'submitted';
  diagram: Diagram;             // le schéma lui-même (ci-dessous)
  updatedAt: Timestamp;
  submittedAt: Timestamp | null;
}
```

**Format commun d'un schéma** — stocké **dans** le document `works` (pas de
sous-collection) : un schéma d'élève reste petit (quelques dizaines de Ko), bien sous la
limite de 1 Mo par document Firestore.
```typescript
interface Diagram {
  type: 'timeline' | 'mindmap' | 'hierarchy' | 'conceptmap';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

interface DiagramNode {
  id: string;
  label: string;
  x: number; y: number;         // position (calculée pour la ligne du temps)
  color?: string;
  // spécifique à un type :
  date?: string;                // timeline : "1815" ou "1815-06-18"
  endDate?: string;             // timeline : période
  parentId?: string;            // mindmap : un seul parent
}

interface DiagramEdge {
  id: string;
  source: string;               // id du nœud de départ
  target: string;               // id du nœud d'arrivée
  label?: string;               // conceptmap : le mot de liaison
}
```

> Ce format est **indépendant de la bibliothèque de dessin** : si on change de
> bibliothèque plus tard, les schémas déjà en base restent lisibles. C'est la raison
> d'être d'un format à nous plutôt que celui, natif, de la bibliothèque.

### 5.4 Le Markdown : format d'échange et de transformation

Exigence posée le 2026-09-12 : tout schéma est **exportable et importable en
Markdown**, et ce texte sert de pivot pour **transformer** un schéma en un autre type
quand la structure le permet.

- Le JSON `Diagram` reste le format **stocké** ; le Markdown est une **vue** générée à la
  demande, et une **entrée** acceptée pour reconstruire un schéma.
- Positions et couleurs peuvent voyager dans un commentaire de fin de ligne
  (`<!-- x:120 y:80 couleur:vert -->`) : présentes, l'aller-retour est sans perte ;
  absentes, la disposition est automatique.
- Carte mentale et schéma hiérarchisé partagent le **même** Markdown (liste imbriquée) :
  ils ne diffèrent que par la disposition. Carte conceptuelle : sections *Concepts* et
  *Liens* (`- A → mot de liaison → B`). Ligne du temps : `- 1815 : événement`,
  `- 1830..1831 : période`.
- La grammaire complète et le tableau des transformations possibles sont dans le plan
  `harnais/plans/2026-09-12-editeur-carte-conceptuelle.md`.

---

## 6. Authentification et permissions

### 6.1 Rôles

Deux rôles : `student` et `teacher`. Pas d'`admin` distinct : un prof dont l'email figure
dans `ADMIN_EMAILS` (variable d'environnement) peut ajouter d'autres profs dans `teachers/`.

**Source des rôles** : le document `users/{uid}`, lu par l'interface, les routes serveur
et les règles Firestore. Jamais de rôle déduit en cherchant un document par email.

### 6.2 Mécanisme de connexion — **tranché le 2026-09-11 : code de classe**

| Public | Mécanisme | Déroulé |
|---|---|---|
| **Élèves** | **Code de classe + nom** | L'élève entre le code donné par le prof, choisit ou saisit son nom → Firebase Auth crée un compte **anonyme** ; son `uid` est ajouté à `students/{id}.uids`. |
| **Profs** | **Google OAuth** (n'importe quel compte Google) *(hypothèse à confirmer)* | Reconnu si son email est dans `teachers/` ou `ADMIN_EMAILS`. |

**Pourquoi le code de classe** : l'application doit aussi servir en **formation hors
Collège** ; le compte Google de l'école n'y existe pas. Les autres options (Google école,
email + mot de passe) sont notées dans `roadmap.md` § Écarté.

**Ce que ça implique** — à assumer, pas à découvrir :
- **Identité déclarative** : un élève peut choisir le nom d'un autre. Accepté pour un
  usage en classe sous le regard du prof ; le prof voit la liste et peut fusionner ou
  supprimer.
- **Le compte anonyme vit dans le navigateur** : autre Chromebook, autre profil Chrome ou
  stockage vidé = nouveau `uid`. L'élève rentre à nouveau code + nom et **retrouve** son
  travail, parce que le travail est rattaché à `students/{id}` et non au `uid`.
  Règle de code : **ne jamais requêter les travaux par `uid`**.
- Un `uid` inconnu (aucun `users/{uid}`) = écran de saisie du code, jamais une page vide.

### 6.3 Les trois couches de permissions

Invariant à respecter : **interface ⊆ route serveur ⊆ règle Firestore** (un rôle que
l'interface autorise doit l'être aussi par la route et par la règle).

| Couche | Ici |
|---|---|
| **Interface** | Pages `/eleve/*` et `/prof/*`, garde sur le rôle |
| **Route serveur** | Vérification du jeton Firebase (`verifyIdToken`) dans chaque route `/api/*` |
| **Règles Firestore** | `firestore.rules` : un élève ne lit que les devoirs publiés de sa classe et n'écrit que le document `works` de **son** `studentId` (vérifié via `users/{uid}.studentId`) ; un prof ne lit que les classes, devoirs et travaux portant son `teacherId` |

Trois symptômes, trois couches : `Missing or insufficient permissions` en console →
règle ; 401/403 sur `/api/...` → route ; rien ne se passe → garde d'interface.

---

## 7. Choix techniques — tranchés le 2026-09-11

### 7.1 L'éditeur de schéma — **React Flow retenu**

| Option | Ce que c'est | Ligne du temps | Carte mentale | Carte conceptuelle | Coût / risque |
|---|---|---|---|---|---|
| **A — React Flow** (`@xyflow/react`) | Bibliothèque React de **nœuds et liens** : on dessine les nœuds soi-même en React, elle gère le glisser-déposer, le zoom, les connexions | ⚠️ À construire : positions calculées, axe dessiné à la main | ✅ Naturel (nœuds + liens) ; disposition automatique via une petite bibliothèque d'arbre (`d3-hierarchy` ou `dagre`) | ✅ Naturel : liens étiquetés natifs | Une dépendance principale, très répandue, bien documentée. Format de données proche du nôtre. **Le plus cohérent avec les trois types.** |
| **B — tldraw** | Un **tableau blanc complet** (formes libres, texte, flèches, dessin à main levée) intégrable en React | ⚠️ Rien de spécifique : l'élève dessine une ligne | ⚠️ Pas de hiérarchie : ce sont des formes libres | ⚠️ Flèches avec texte possibles, mais aucune contrainte | Très riche, mais **trop libre** : impossible d'imposer les règles d'un type de schéma. Licence à vérifier (filigrane sans clé). |
| **C — Excalidraw** | Tableau blanc « style croquis à la main » | idem B | idem B | idem B | Même limite que B, esthétique marquée. |
| **D — Fait maison** (SVG + React) | On code tout : nœuds, liens, glisser-déposer, zoom | ✅ Total contrôle | ✅ | ✅ | **Aucune dépendance**, mais plusieurs soirées rien que pour le glisser-déposer et le zoom, avant la moindre fonctionnalité pédagogique. |

**Retenu : A (React Flow)**. C'est la seule option qui donne à la fois des
liens étiquetés (carte conceptuelle), une structure de graphe qu'on peut contraindre en
arbre (carte mentale), et une base solide pour dessiner une ligne du temps par-dessus.
Dépendance `@xyflow/react` ajoutée avec l'accord de JP.

### 7.2 Les autres choix

| Sujet | Options | Décision |
|---|---|---|
| **Styles** | CSS Modules (Recto-versIA) · Tailwind | **CSS Modules** — tranché. |
| **Hébergement** | VPS Hostinger (PM2, déploiement manuel) · Firebase App Hosting (`git push` = mise en production) | *À confirmer* — VPS pressenti : même procédure que Recto-versIA, le push ne déploie pas. |
| **Consignes du prof** | Texte simple · Markdown · éditeur riche (Tiptap comme Recto-versIA) | *À confirmer* — Markdown proposé en v1 (aucune dépendance lourde). |
| **Données personnelles** | Chiffrer nom/prénom comme Recto-versIA · les laisser en clair | **En clair** pour le prototype (prénom + nom, sans email) ; à reprendre avant usage élargi (`roadmap.md`). |

---

## 8. Contraintes et pièges connus

Tirés du dépôt `harnais` (`2-ecole/`) — les pièges qui ont déjà coûté cher sur d'autres
projets.

- **Règles Firestore découplées du code.** `git push` déploie l'app, pas les règles.
  Toute nouvelle collection lue côté client sans règle = `Missing or insufficient
  permissions` en production alors que tout marche en local. Procédure : écrire la règle
  → valider → **déployer** (`firebase deploy --only firestore:rules`) → vérifier →
  commiter.
- **Données de mineurs (RGPD).** Nom, prénom, email et productions d'élèves. Base en
  **région européenne** (irréversible). Le chiffrement applicatif (§7.2) est à décider
  avant toute mise en service au-delà du test.
- **Chromebook.** Écran ~1366×768, pavé tactile, pas de clic droit intuitif. L'éditeur
  doit être utilisable **sans clic droit, sans molette** (boutons zoom visibles,
  ajout de nœud par bouton ou touche). À tester sur un vrai Chromebook avant de
  déclarer une fonction terminée.
- **Sauvegarde automatique.** Écrire en base à chaque frappe coûte cher et sature
  Firestore ; écrire trop rarement perd du travail. Règle : sauvegarde **différée**
  (quelques secondes après la dernière modification) + indicateur visible
  « Enregistré / Enregistrement… ».
- **Idempotence.** Un seul document `works` par élève et par devoir, grâce à
  l'identifiant composé `{assignmentId}_{studentId}` (§5.3). Jamais de création avec
  identifiant automatique sur une action utilisateur.
- **SDK admin et `undefined`.** Une écriture contenant un champ `undefined` est rejetée.
  Omettre la clé plutôt que la mettre à `undefined`.
- **Initialisation paresseuse du SDK client** (`getAuth()` appelé à l'usage, pas au
  chargement) : sinon le build échoue quand les variables d'environnement manquent.
- **Version.** Numéro géré à la main par JP, jamais incrémenté par un agent.

---

## 9. Variables d'environnement (noms seulement, jamais les valeurs)

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Configuration du SDK client (clé API, projet, etc.) |
| `FIREBASE_ADMIN_*` | Compte de service du SDK admin (clé privée : restaurer les `\n`) |
| `ADMIN_EMAILS` | Liste des profs administrateurs |
| `ENCRYPTION_KEY` | Seulement si le chiffrement est activé un jour (`roadmap.md`) |

---

## 10. Glossaire

| Terme | Explication |
|---|---|
| **App Router** | Le système de pages de Next.js basé sur le dossier `app/` : un dossier = une adresse. |
| **Firestore** | Base de données de Firebase : des *documents* (fiches) rangés dans des *collections* (tiroirs). |
| **SDK client / SDK admin** | Deux façons de parler à Firebase : depuis le navigateur (soumis aux règles de sécurité) ou depuis le serveur (les contourne). |
| **Règles Firestore** | Le fichier qui dit qui a le droit de lire ou d'écrire quoi. Déployé à part du code. |
| **uid** | Identifiant unique d'un compte Firebase Auth. |
| **Nœud / lien** (*node / edge*) | Une boîte du schéma / un trait entre deux boîtes. |
| **Graphe / arbre** | Un graphe relie librement ; un arbre impose un seul parent par nœud. |
| **Dénormaliser** | Recopier une donnée (ex. le nom de l'élève) dans un autre document pour éviter une seconde lecture. |
| **Idempotent** | Une action qu'on peut répéter sans créer de doublon. |
| **Sauvegarde différée** (*debounce*) | Attendre que l'utilisateur ait fini de taper avant d'enregistrer. |

---

## 11. Prochaines étapes

1. ~~Trancher les choix~~ — fait le 2026-09-11 (reste : hébergement, format des consignes).
2. ~~Installer le harnais et le squelette Next.js~~ — fait le 2026-09-11.
3. Créer le projet **Firebase** (région Europe), activer Auth anonyme + Google et
   Firestore, remplir `.env.local`.
4. Brancher l'authentification : écran code de classe (élève), connexion Google (prof).
5. Construire la page devoir (deux colonnes) avec la **carte conceptuelle** d'abord, puis
   dériver la carte mentale et la ligne du temps.

Le détail vivant de ces étapes est dans `roadmap.md` et `harnais/memoire/`.
