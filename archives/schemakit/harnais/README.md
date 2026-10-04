# Le harnais de SchémaKit

> Comment ce projet est outillé pour être développé par des agents IA sur la durée, sans
> perte de contexte entre les sessions et sans casser la production.
> À lire par toute personne — ou tout agent — qui rejoint le projet.
>
> Né de la matrice `harnais` v1.2.0, taille **L**, le 2026-09-11.

## Le problème

Un agent IA démarre chaque session amnésique. Sans harnais, il redécouvre le projet à
chaque fois, ignore les pièges déjà payés, et peut livrer en production sans filet.
Le harnais est l'ensemble des fichiers, rituels et garde-fous qui transforment cette
amnésie en continuité.

## Carte des fichiers

| Fichier | Rôle | Pourquoi là |
|---|---|---|
| `AGENTS.md` | Règles impératives | Lu **nativement par Cursor** ; doit être à la racine |
| `CLAUDE.md` | **Symlink → `AGENTS.md`** | Claude Code charge `CLAUDE.md` ; le symlink garantit zéro divergence entre les deux outils |
| `init.md` | Briefing technique dense | Racine, lu au début de chaque session |
| `README.md` | Cahier des charges de départ | Racine ; les options écartées y sont argumentées |
| `roadmap.md` | Intention : maintenant, ensuite, écarté | Racine |
| `harnais/README.md` | **Ce document** | `harnais/` regroupe ce qui n'a pas d'emplacement imposé |
| `harnais/memoire/` | État cross-sessions (index + rollups) | Dans le dépôt : survit aux renommages, se synchronise entre machines |
| `harnais/plans/` | Plans validés des chantiers structurels (`_gabarit.md` à copier) | Trace datée, jamais mise à jour après livraison |
| `harnais/hooks/pre-push` | Bloque le push si `npx tsc --noEmit` échoue | Activé par `git config core.hooksPath harnais/hooks` |
| `.github/workflows/ci.yml` | Re-vérification après push sur machine neutre | Emplacement imposé par GitHub |
| `.claude/skills/` | Procédures répétables | Emplacement imposé par Claude Code |
| `.claude/settings.json` | Allowlist de permissions, versionnée | Emplacement imposé par Claude Code |

## La mémoire

`harnais/memoire/` — dans le dépôt, donc versionnée et synchronisée entre machines.

- **`MEMORY.md`** : l'index, chargé à chaque session. **Une ligne par entrée, jamais de
  contenu.**
- **`rollup_<module>.md`** : l'état consolidé par module — état actuel, gotchas actifs,
  TODOs, historique (une ligne datée par session).
- **`archive/`** : journaux bruts des anciennes sessions.

⚠️ **Aucune donnée personnelle réelle** dans la mémoire : elle est dans le dépôt.

## Les rituels

- **`/session-ritual`** (début) : lire `AGENTS.md` → `init.md` → mémoire → `git status` →
  résumé court.
- **`/session-ritual`** (fin) : vérification → mise à jour du rollup → `init.md` si
  structurel → rappels conditionnels → proposer le déploiement.
- **`/deploiement`** : les **2** surfaces de déploiement **indépendantes** (application,
  règles Firestore). En oublier une = production incohérente.

## Les garde-fous

Il n'existe aucune suite de tests — la vérification `npx tsc --noEmit` est donc la
principale barrière automatique, appliquée deux fois :

1. **Hook `pre-push`** (local, quelques secondes) — bloque avant que le code parte.
2. **CI** (après push) — attrape le « ça marchait chez moi » : fichier non commité,
   dépendance absente du lockfile.

⚠️ **`git config core.hooksPath harnais/hooks` n'est pas versionnable** : à refaire sur
**chaque machine**. Vérifier : `git config core.hooksPath` doit renvoyer `harnais/hooks`.

## Installation sur un nouveau poste

```bash
git clone <URL du dépôt> && cd schemakit
npm ci
git config core.hooksPath harnais/hooks     # garde-fou pre-push — OBLIGATOIRE
# créer .env.local — demander les valeurs ; liste des variables : init.md §1
npm run dev
```

- **Claude Code** : rien d'autre à faire — `CLAUDE.md`, `.claude/skills/` et
  `.claude/settings.json` sont pris en compte automatiquement.
- **Cursor** : rien d'autre à faire — `AGENTS.md` est lu nativement.

## Entretien

- **Une info, un seul foyer.** Règle impérative (`AGENTS.md`) ? architecture stable
  (`init.md`) ? actualité de session (mémoire) ? procédure répétable (skill) ?
  Jamais aux deux endroits.
- `AGENTS.md` ne grossit que pour une **règle non négociable** nouvelle.
- Un nouveau skill se justifie à partir de la **deuxième** exécution d'une procédure.
- **Ne jamais contourner le pre-push** sans accord explicite.
- Une amélioration qui vaudrait pour d'autres projets **remonte dans le dépôt `harnais`**.
