# Le harnais de Recto-versIA

> Comment ce projet est outillé pour être développé par des agents IA sur la durée, sans
> perte de contexte entre les sessions et sans casser la production.
> À lire par toute personne — ou tout agent — qui rejoint le projet.
>
> Né de la matrice `harnais` v1.2.0, taille **L**, le 2026-08-06 (retrofit d'un projet
> existant : l'ancien `CLAUDE.md` a été fusionné dans `AGENTS.md`, l'ancien `INIT.md`
> restructuré en `init.md`).

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
| `roadmap.md` | Où va le produit | Racine, à côté de la page `/roadmap` de l'app (version utilisateurs) |
| `harnais/README.md` | **Ce document** | `harnais/` regroupe ce qui n'a pas d'emplacement imposé |
| `harnais/memoire/` | État cross-sessions (index + rollups) | Dans le dépôt : survit aux renommages, se synchronise entre les deux Macs |
| `harnais/plans/` | Plans validés et **maquettes** des chantiers structurels | Gabarit : `_gabarit.md`. ⚠ Voir « Le ménage » ci-dessous : une maquette dont la fonctionnalité est livrée et validée **se supprime** |
| `harnais/hooks/pre-push` | Bloque le push si `npx tsc --noEmit` échoue | Activé par `git config core.hooksPath harnais/hooks` |
| `.github/workflows/ci.yml` | Re-vérification après push sur machine neutre | Emplacement imposé par GitHub |
| `.claude/skills/` | Procédures répétables (`deploy`, `session-ritual`) | Emplacement imposé par Claude Code |
| `.claude/settings.json` | Allowlist de permissions, versionnée | Emplacement imposé par Claude Code |

> La plupart des emplacements sont imposés par les outils. `harnais/` contient ce qui est
> libre, et **ce README sert de carte** vers tout le reste.

## La mémoire

`harnais/memoire/` — dans le dépôt, donc versionnée et synchronisée entre machines.

- **`MEMORY.md`** : l'index, chargé à chaque session. **Une ligne par entrée, jamais de
  contenu.** S'il grossit, les sessions démarrent avec un contexte tronqué.
- **`rollup_<module>.md`** : l'état consolidé par module — état actuel, gotchas actifs,
  TODOs, historique (une ligne datée par session).
- **`archive/`** : journaux bruts des anciennes sessions, pour l'archéologie d'une décision.

⚠️ **Aucune donnée personnelle réelle** dans la mémoire : elle est dans le dépôt.

## Les rituels

- **`/session-ritual`** (début) : lire `AGENTS.md` → `init.md` → mémoire → `git status` →
  résumé court.
- **`/session-ritual`** (fin) : vérification → mise à jour du rollup → `init.md` si
  structurel → **ménage** → rappels conditionnels → proposer le déploiement.
- **`/deploy`** : les **3 surfaces de déploiement indépendantes** — app sur VPS (manuel),
  règles/index Firestore (manuel), extension Chrome NavigKid (manuel).
  En oublier une = production incohérente.

## Le ménage

Un harnais qui accumule devient un harnais qu'on ne lit plus. **En fin de session**,
l'agent passe en revue ce qui a servi et propose ce qui peut partir — il ne
supprime jamais de lui-même :

| Quoi | Ça part quand | Ça reste quand |
|---|---|---|
| **Maquettes** (`harnais/plans/maquette-*.html`) | La fonctionnalité est **livrée ET validée** à l'écran | Elle sert de **référence tenue à jour** avec le code — dire alors lequel des deux fait foi |
| **Scripts temporaires**, fichiers de travail | Toujours | — |
| **Plans** (`harnais/plans/*.md`) | **Jamais** | Toujours : c'est une **trace datée** |
| **Scripts** d'import ou de migration (`scripts/*.ts`) | **Jamais sans accord explicite** | Par défaut : c'est la trace de ce qui a été fait en base |

Un **plan** dit ce qu'on a décidé et pourquoi — c'est justement l'alternative écartée
qu'on cherche à retrouver six semaines plus tard. Il vieillit bien **à condition d'être
lu pour ce qu'il est** : chaque plan porte donc, en tête, sa date et la mention qu'il
décrit une intention à un moment donné, **peut-être dépassée depuis**. Ce qui existe
réellement se lit dans `init.md` et dans la mémoire, jamais dans un plan.

Une **maquette**, elle, montre un état de l'écran : elle vieillit mal, parce que l'écran
a continué d'évoluer. À la session suivante, un agent la lit comme l'intention en vigueur,
« corrige » le code vers elle, et défait ce qui avait été validé. **Une maquette périmée
est pire qu'aucune maquette.**

## Les garde-fous

Il n'existe **aucune suite de tests** — la vérification `npx tsc --noEmit` est donc la
principale barrière automatique, appliquée deux fois :

1. **Hook `pre-push`** (local, quelques secondes) — bloque avant que le code parte.
   Fonctionne quel que soit l'outil qui pousse.
2. **CI** (après push) — attrape le « ça marchait chez moi » : fichier non commité,
   dépendance absente du lockfile.

⚠️ **`git config core.hooksPath harnais/hooks` n'est pas versionnable** : à refaire sur
**chaque machine**. Sans ça le hook est présent mais inactif, et rien ne le signale.
Vérifier : `git config core.hooksPath` doit renvoyer `harnais/hooks`.
État : ☑ fait sur le MacBook Pro (2026-08-06) ; ☐ à faire sur le Mac Studio.

## Installation sur un nouveau poste

```bash
git clone https://github.com/jpbolle/rectoVersIA && cd rectoVersIA
npm install
git config core.hooksPath harnais/hooks     # garde-fou pre-push — OBLIGATOIRE
# créer .env.local — demander les valeurs ; liste des variables : init.md §1
npm run dev                                 # port 3003
```

- **Claude Code** : rien d'autre à faire — `CLAUDE.md`, `.claude/skills/` et
  `.claude/settings.json` sont pris en compte automatiquement.
- **Cursor** : rien d'autre à faire — `AGENTS.md` est lu nativement.

## Entretien

- **Une info, un seul foyer.** Règle impérative (`AGENTS.md`) ? architecture stable
  (`init.md`) ? actualité de session (mémoire) ? procédure répétable (skill) ?
  Jamais aux deux endroits.
- `AGENTS.md` ne grossit que pour une **règle non négociable** nouvelle.
- Un nouveau skill se justifie à partir de la **deuxième** exécution d'une procédure aux
  étapes oubliables.
- **Ne jamais contourner le pre-push** sans accord explicite.
- Ce README est mis à jour quand une **pièce du harnais** change, pas au fil des sessions.
- Une amélioration qui vaudrait pour d'autres projets **remonte dans le dépôt `harnais`**.
