<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SchémaKit — Instructions pour les agents IA

> **Source unique des règles impératives du projet.**
> Lu par Cursor (nativement) et par Claude Code (via le symlink `CLAUDE.md` → `AGENTS.md`).
> Carte complète du harnais : [`harnais/README.md`](./harnais/README.md).
> Le bloc « nextjs-agent-rules » ci-dessus est écrit par `next dev` : le laisser tel quel.

## Démarrage de session

Lire `init.md` à la racine : briefing dense — coordonnées techniques, conventions, modèle
de permissions, gotchas, état des modules.

L'**état cross-sessions** (ce qui a changé, TODOs, décisions récentes) vit dans
`harnais/memoire/` — pas dans `init.md`.

Profil de l'utilisateur et consignes durables : dépôt `harnais` (`0-moi/`).

## Vérification avant commit / push (IMPORTANT)

Le déploiement de l'application est **manuel** (skill `/deploiement`) ; `git push` ne
déploie pas. Mais le serveur fait `git pull && npm run build` : un push cassé casse le
prochain déploiement.

- Avant tout commit substantiel : `npx tsc --noEmit` doit passer.
- Un hook git `pre-push` (`harnais/hooks/`, activé par
  `git config core.hooksPath harnais/hooks`) bloque le push si la vérification échoue.
  **Ne jamais le contourner** (`--no-verify`) sans accord explicite de l'utilisateur.
- La CI (`.github/workflows/ci.yml`) revérifie après push sur machine neutre.
- Il n'existe **aucune suite de tests** — d'où le caractère non négociable de la
  vérification ci-dessus.
- **Ne jamais commiter ni pousser** : le commit et le push sont faits par l'utilisateur.

## Données personnelles (RGPD)

Le projet stocke des données de **mineurs** : prénom et nom des élèves, et leurs
productions (schémas). Les élèves n'ont pas d'email dans l'application (connexion par
code de classe).

- Base Firestore en **région européenne** — choix irréversible fait à la création.
- **Aucune donnée personnelle réelle** dans la mémoire (`harnais/memoire/`), dans les
  exemples de code, ni dans les commits.
- Le chiffrement applicatif des identités n'est **pas** activé (décision à reprendre
  avant une mise en service au-delà des classes de l'utilisateur — voir `roadmap.md`).

## Règles Firestore — procédure IMPÉRATIVE

`firestore.rules` est maintenu **à la main** et **découplé du code**. Toute collection
accédée **côté client** doit avoir sa règle, sinon elle est refusée par défaut.

**Les deux déploiements sont indépendants** :
- déploiement de l'application → manuel, sur le serveur (skill `/deploiement`) ;
- `firebase deploy --only firestore:rules` → déploie les règles, **manuellement, jamais
  automatiquement**, et **jamais sans accord explicite** de l'utilisateur.

À chaque modification de règle ou ajout d'une collection lue/écrite côté client :
1. mettre à jour `firestore.rules` ;
2. valider la syntaxe ;
3. **déployer** ;
4. vérifier dans l'application ;
5. **commiter** le fichier (par l'utilisateur).

Une modification de règle n'est jamais terminée tant qu'elle n'est pas **déployée ET
commitée**.

**Concordance interface ↔ route ↔ règle** : tout rôle auquel l'interface expose une action
doit être autorisé par la route serveur **et** par la règle.

## Dépendances

**Ne jamais ajouter une dépendance sans demander.** Le serveur exécute `npm ci` sur
`package-lock.json` : toujours installer avec `npm install <pkg>`, jamais avec un autre
gestionnaire, sinon le build de production casse.

## Gotchas critiques

### Le compte élève est anonyme : il vit dans le navigateur
Les élèves se connectent par **code de classe + nom** via Firebase Auth en mode anonyme.
L'identifiant (`uid`) est stocké dans le navigateur : vider le stockage, changer de
Chromebook ou de profil Chrome = **nouveau uid**.
**Symptôme** : un élève « a perdu son travail » alors qu'il est en base.
**Règle** : le travail est rattaché au document **élève** (`students/{id}`), jamais
directement au `uid`. Le `uid` n'est qu'un **lien** vers l'élève, réassociable en
rentrant à nouveau code + nom. Ne jamais requêter les travaux par `uid`.

## Mise à jour de `init.md`

`init.md` est un briefing **stable**. Il ne change que si :
- un nouveau module apparaît (route, page, éditeur) ;
- une convention change ;
- une coordonnée technique change (variable d'environnement, région, identifiant projet) ;
- un gotcha opérationnel nouveau est découvert ;
- l'état d'un module passe de « placeholder » à « livré » ou l'inverse.

Il ne contient **pas** le journal session par session (qui vit dans `harnais/memoire/`).

## Conventions

- **Code** (variables, fonctions, composants, fichiers) : anglais
- **Interface utilisateur** : français — **tutoiement** des élèves, tutoiement collégial
  des profs
- **Commentaires** : français
- **Commits** : anglais, format conventionnel (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Affichage des personnes** : `Nom Prénom`
- **Numéro de version** : géré manuellement par l'utilisateur — ne **jamais**
  l'incrémenter automatiquement
- **Styles** : CSS Modules uniquement, aucun framework CSS
- **Jamais** `prompt()` / `confirm()` / `alert()` : popup de l'application
- **Format de schéma** : le type `Diagram` (`src/types/diagram.ts`) est **le nôtre**, pas
  celui de React Flow. On convertit à l'entrée et à la sortie de l'éditeur ; en base, on
  n'écrit que notre format.
