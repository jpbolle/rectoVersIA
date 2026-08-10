# Rollup — Aide IA à la réécriture (panneau élève)

## État actuel (session du 2026-08-09)

Refonte complète du panneau `AiTab`, **livrée, testée, déployée le 2026-08-10** :

- **4 onglets permanents** par catégorie : libellé complet + symbole dans une pastille
  ronde + compteur de conseils restants (✓ vert quand terminé). Couleurs : Orthographe
  rouge, **Ponctuation bleue** (`#1e88e5`, changée du gris — trop proche du Lexique),
  Syntaxe orange, Lexique brun. Même bleu appliqué aux bulles « P » de l'éditeur
  (élève + prof, `tiptap-ai-decorations*.ts`).
- **Bouton d'analyse déplacé dans chaque onglet** (vert primaire = « génère du contenu
  IA ») — visible tant que l'analyse n'a pas été lancée (toujours 1 analyse max par
  catégorie et par travail).
- **Conseils « un par un »** (défaut) : un seul conseil affiché, navigation **libre**
  ‹ › + pastilles cliquables (pas besoin de cliquer « Corrigé »), compteur
  « Conseil X sur N », conseils traités repliés dans « Déjà pris en compte », 🎉 en fin
  de catégorie. Toggle « Un par un | Tous » dans le panneau.
- **Synchro bulles éditeur** : sur l'onglet Aide IA, seules les bulles du conseil
  affiché restent visibles (avec pulse) quel que soit le toggle « Aide IA » de la barre
  d'outils ; hors de l'onglet, le toggle décide tout/rien. Mécanisme : `AiTab` remonte
  les ids affichés (`onDisplayedConseilsChange`) → page calcule `aiBubbleFilter` →
  `WorkEditor` → `updateAllAiDecorations(…, onlyIds)`.
- **Mémorisation** : l'état d'interface (onglet actif, mode, conseil courant par
  catégorie) vit au niveau de la page (`AiTabUiState`) et survit aux allers-retours
  entre onglets du rail. Perdu au rechargement de la page (accepté).
- Clic sur une bulle du texte → ouvre l'onglet Aide IA sur ce conseil (comportement
  existant conservé ; un highlight périmé n'écrase pas la position mémorisée au retour).

## À tester

- [x] Vérifier la synchro bulles dans les 3 cas : masqué hors onglet, affiché hors
  onglet, sur l'onglet (bulle unique qui suit la navigation ‹ ›).

## Gotchas

- `AiTab` est démonté à chaque sortie de l'onglet du rail — tout état à conserver doit
  remonter au niveau de la page (pattern `AiTabUiState`).
