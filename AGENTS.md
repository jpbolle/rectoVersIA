# Recto-versIA — Instructions pour les agents IA

> **Source unique des règles impératives du projet.**
> Lu par Cursor (nativement) et par Claude Code (via le symlink `CLAUDE.md` → `AGENTS.md`).
> Carte complète du harnais : [`harnais/README.md`](./harnais/README.md).

## Démarrage de session

Lire `init.md` à la racine : briefing dense — coordonnées techniques, conventions, modèle
de permissions, gotchas, état des modules.

L'**état cross-sessions** (ce qui a changé, TODOs, décisions récentes) vit dans
`harnais/memoire/` — pas dans `init.md`.

Profil de l'utilisateur et consignes durables : dépôt `harnais` (`0-moi/`).

## Vérification avant commit / push (IMPORTANT)

`git push` ne déploie **pas** automatiquement — le déploiement sur le VPS Hostinger est
manuel (skill `/deploy`). Mais le VPS fait `git pull && npm run build` : un push cassé
casse le prochain déploiement.

- Avant tout commit substantiel : `npx tsc --noEmit` doit passer.
- Un hook git `pre-push` (`harnais/hooks/`, activé par
  `git config core.hooksPath harnais/hooks`) bloque le push si la vérification échoue.
  **Ne jamais le contourner** (`--no-verify`) sans accord explicite de l'utilisateur.
- La CI (`.github/workflows/ci.yml`) revérifie après push sur machine neutre.
- Il n'existe **aucune suite de tests** — d'où le caractère non négociable de la
  vérification ci-dessus.
- **Ne jamais pousser sans accord explicite de l'utilisateur.**

## Données personnelles (RGPD)

Le projet stocke des données de **mineurs** (identités, emails, productions écrites,
enregistrements audio). Depuis le 2026-08-10, les **champs d'identité sont chiffrés**
(pseudonymisation AES-256-GCM, `src/lib/crypto.ts`) : nom, prénom, email dans `eleves`,
`travaux`, `users`, `vocabulairePersonnel`, `reponses` et `recherches` NavigKid. Les
requêtes d'identification passent par une empreinte HMAC (`emailHash` /
`studentEmailHash`). Les contenus (productions, audio) restent volontairement en clair.

Règles impératives :
- **Ne jamais chiffrer un champ utilisé dans un `where()` Firestore** — utiliser une
  empreinte (`hashEmail`) comme pour les emails.
- **Ne jamais importer `src/lib/crypto.ts` côté client** (clé + API Node).
- Tout **nouveau** champ d'identité ou donnée sensible passe par le skill `/encrypt`
  (et par une entrée dans `scripts/encrypt-existing-identities.ts` si des données
  existent déjà).
- Lecture/écriture de données élèves : **toujours via les routes serveur** (`adminDb`),
  jamais en accès Firestore direct depuis le client. L'extension NavigKid ne touche
  plus Firestore : elle passe par `/api/navigkid/*`.
- `ENCRYPTION_KEY` (`.env.local`) : **même clé** sur tous les postes et le VPS ; sa
  perte rendrait les identités illisibles — ne jamais la committer ni la régénérer.
- **Aucune donnée personnelle réelle dans `harnais/memoire/`** (versionnée sur GitHub).

## Règles de sécurité Firestore — procédure IMPÉRATIVE

`firestore.rules` est maintenu **à la main** et **découplé du code**. Toute collection
accédée **côté client** doit avoir sa règle, sinon elle est refusée par défaut
(symptôme : `Missing or insufficient permissions`).

**Les deux déploiements sont indépendants** :
- push + `/deploy` → déploie l'application ;
- `firebase deploy --only firestore:rules` → déploie les règles, **manuellement, jamais
  automatiquement**. Idem pour les index : `firebase deploy --only firestore:indexes`.

À chaque modification de règle ou ajout d'une collection lue/écrite côté client :
1. mettre à jour `firestore.rules` ;
2. valider la syntaxe ;
3. **déployer** ;
4. vérifier dans l'application ;
5. **commiter** le fichier.

Une modification de règle n'est jamais terminée tant qu'elle n'est pas **déployée ET
commitée**. Rappel : les routes serveur (`adminDb`) **contournent** les règles — un refus
de permission ne peut venir que d'un accès SDK client.

Avant de créer une API route avec une requête Firestore filtrée : vérifier que les
**index composites** existent (`firestore.indexes.json`).

## Dépendances

Le VPS exécute `npm install` sur `package-lock.json`. Une dépendance ajoutée avec un autre
gestionnaire ne met pas ce fichier à jour → **build de production cassé** alors que tout
fonctionne en local. ⇒ Toujours `npm install <pkg>`. (Et jamais de dépendance nouvelle
sans accord — consigne durable, dépôt `harnais`.)

## Gotchas critiques

### Objets instables dans les dépendances de hooks React
`user` (AuthContext) et `travail` (useTravail) sont des objets **instables** : les mettre
dans les dépendances d'un `useCallback`/`useEffect` déclenche des boucles infinies de
re-render et d'appels API.
**Symptôme** : requêtes en rafale dans l'onglet réseau, app qui rame ou boucle.
**Règle** : pattern `userRef`/`travailRef` (voir `AuthContext.tsx`, `useStudentClasses`,
`useTravail`) pour accéder à l'objet dans les callbacks mémoïsés. `getAuthHeaders` est
centralisé dans `AuthContext.tsx` — ne **jamais** le recréer localement dans un hook.

### Redirections en boucle
Toute page qui fait `router.replace()` doit avoir un state `redirecting` :
`if (redirecting) return;` avant le replace, `if (redirecting) return null;` dans le render.
**Symptôme** : boucle de redirections, page qui clignote.

### ContentLock et minification en production
Les extensions Tiptap utilisent `instanceof AddMarkStep/RemoveMarkStep` — jamais
`constructor.name`, qui est minifié en production.
**Symptôme** : verrouillage du contenu qui fonctionne en dev et casse en prod, sans erreur.

### Échelle d'évaluation figée
Les grilles ont 6 niveaux fixes : Néant (0 %), Très insuffisant (15 %), Insuffisant (35 %),
Suffisant (60 %), Acquis (80 %), Parfaitement acquis (100 %). **Ne jamais modifier
l'échelle** — toutes les corrections existantes en dépendent.

### Appels IA côté serveur uniquement
Claude API et Whisper API : **jamais côté client** (clés exposées). Toujours via les API
Routes. Modèle : `claude-sonnet-4-5-20250929`.

### VPS — jamais de SSH direct
Ne **jamais** tenter de SSH sur le VPS Hostinger : fournir les commandes à l'utilisateur,
qui les exécute dans le terminal web hPanel (skill `/deploy`).

## Mise à jour de `init.md`

`init.md` est un briefing **stable**. Il ne change que si :
- un nouveau module apparaît (route, page, composant majeur) ;
- une convention change ;
- une coordonnée technique change (variable d'environnement, port, identifiant) ;
- un gotcha opérationnel nouveau est découvert ;
- l'état d'un module change.

Il ne contient **pas** le journal session par session (qui vit dans `harnais/memoire/`).

## Conventions

- **Code** (variables, fonctions, composants, fichiers) : anglais
- **Interface utilisateur** : français, **avec les accents** dans les strings user-facing
- **Commentaires** : français
- **Commits** : anglais, format conventionnel (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Numéro de version** : géré manuellement par l'utilisateur — ne **jamais**
  l'incrémenter automatiquement
- Conventions de nommage et de styling détaillées : `init.md` §2
