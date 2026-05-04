# Claude Code — Agent Teams (Teammates)

Fonctionnalité **expérimentale** pour coordonner plusieurs sessions Claude Code en parallèle.

## Prérequis

- Claude Code **v2.1.32+** (`claude --version`)
- Activé dans `~/.claude/settings.json` :

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Démarrage

Demander en langage naturel à Claude de créer une équipe :

> "Crée une équipe de 3 teammates : un pour le frontend, un pour le backend, un pour les tests."

Claude va :
1. Créer l'équipe
2. Spawner les teammates selon la description
3. Coordonner le travail avec une liste de tâches partagée
4. Synthétiser les résultats

## Modes d'affichage

### In-process (par défaut, fonctionne partout)

Tous les teammates dans le même terminal.

- **Shift+Down** : naviguer entre teammates
- **Enter** : voir la session d'un teammate
- **Escape** : interrompre
- **Ctrl+T** : afficher la liste de tâches

### Split panes (nécessite tmux ou iTerm2)

Chaque teammate a son propre panneau. Cliquer dans un panneau pour interagir.

Config dans settings.json :
```json
{
  "teammateMode": "tmux"
}
```

Ou en CLI :
```bash
claude --teammate-mode tmux
```

## Contrôler l'équipe

### Composer l'équipe
```
Crée une équipe de 4 teammates pour refactorer ces modules en parallèle.
Utilise Sonnet pour chaque teammate.
```

### Exiger l'approbation du plan
```
Spawne un teammate architecte pour refactorer le module d'auth.
Exige l'approbation du plan avant tout changement.
```

### Parler à un teammate
- In-process : Shift+Down pour naviguer, puis taper le message
- Split panes : cliquer dans le panneau

### Arrêter un teammate
```
Demande au teammate researcher de s'arrêter
```

### Nettoyer l'équipe
```
Clean up the team
```

## Utiliser des subagent definitions comme teammates

```
Spawne un teammate utilisant le type d'agent security-reviewer pour auditer le module auth.
```

Cela réutilise les outils et le modèle du subagent.

## Architecture

- **Team lead** : session principale qui coordonne
- **Teammates** : instances Claude séparées
- **Task list** : tâches partagées (`~/.claude/tasks/{team-name}/`)
- **Mailbox** : système de messagerie inter-agents

Config : `~/.claude/teams/{team-name}/config.json`

## Bonnes pratiques

- **3-5 teammates** est optimal
- Chaque teammate doit travailler sur des **fichiers différents** (pas d'édition concurrente)
- Viser **5-6 tâches par teammate**
- Dire au lead d'attendre avant d'implémenter lui-même
- Commencer par des tâches de recherche/review avant du code complexe

## Cas d'usage

**Idéal pour :**
- Revue de code parallèle avec différents focus
- Investigation de bugs avec hypothèses concurrentes
- Nouvelles features multi-couches (frontend, backend, tests)
- Modules indépendants à développer en parallèle

**Pas idéal pour :**
- Tâches séquentielles
- Éditions du même fichier
- Tâches simples (utiliser des subagents classiques)

## Limitations connues

- Pas de reprise de session avec `/resume` ou `/rewind`
- Complétion de tâches parfois en retard
- Arrêt lent (le teammate finit sa requête en cours)
- Une seule équipe par session
- Pas d'équipes imbriquées
- Split panes nécessite tmux ou iTerm2
