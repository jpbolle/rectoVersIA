# Rollup — module Vocabulaire

## État actuel

Module complet et livré (v3.8) : flip recto (mots) / verso (exercices), phases
diagnostic → apprentissage → évaluation, mots difficiles/flashcards, action bars
harmonisées avec convention de couleurs (vert = génère, amber = navigue), stats prof.

Session 2026-08-08 (**livré, non testé, non déployé**) — apprentissage enrichi :
- Révision espacée complétée par des mots connus jusqu'à 5 (`getSpacedRepetitionWords`).
- **Mots personnels** : 3-5 mots tirés au hasard de `vocabulairePersonnel/{uid}` injectés
  dans la génération (exercices IA 1-2-3 + Définitions client ; exclus de Familles de
  mots, pas de données syn/ant/famille). Liste vide → génération normale.
- **Indice syllabique** sur le texte à trous (ex. 5) : après un échec, la première
  syllabe s'affiche (`getFirstSyllable`, règles françaises locales dans
  `types/vocabulaire.ts`).
- **Demi-point** : trou trouvé avec indice (syllabe ou bouton « i ») → `credit: 0.5`
  sur la tentative ; `getWordCategory` pondère ; pastille bicolore dans les stats.
- ⚠️ Changement de flux : `FillInBlanks` notifie ses résultats **à la fin de
  l'exercice** (tout trouvé ou 3 tentatives), plus à la 1ʳᵉ vérification — un abandon
  en cours d'exercice n'enregistre plus rien.

## TODOs

- [ ] **Tester la session d'apprentissage enrichie** (compte élève avec liste
  personnelle remplie) : injection des mots, indice syllabique, demi-points en stats.
- [ ] **Vérifier le format JSON IA pour `fill_in_blanks_dropdown` et `context_sentences`**
  (exercices générés en mode `diagnostic`). Source possible de bugs silencieux si Claude
  ne respecte pas le format attendu. Test : dérouler un diagnostic complet, surveiller la
  console pour les erreurs de parsing ; ajouter des logs de validation dans
  `src/hooks/useVocabulaireExercises.ts` si besoin.

## Gotchas actifs

- Soumission évaluation élève : ne pas remettre `key={evaluationScores.length}` sur le
  composant (le démontait à chaque saisie — fix de mai 2026).
- Exercice syn/ant : les mots sans synonyme/antonyme sont filtrés à la génération.

## Historique

- 2026-05-04 — fix soumission évaluation, filtrage syn/ant, validation Claude tolérante,
  sections collapsibles stats, vue de revue d'évaluation élève, composant partagé
  `EvalAttemptView`.
- 2026-05-05 — diagnostic intermédiaire fluidifié, action bars de fin de session
  harmonisées, convention de couleurs des boutons.
- 2026-08-06 — migration de ce rollup depuis la mémoire auto Claude Code (retrofit harnais).
