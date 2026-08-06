# Rollup — module Vocabulaire

## État actuel

Module complet et livré (v3.8) : flip recto (mots) / verso (exercices), phases
diagnostic → apprentissage → évaluation, mots difficiles/flashcards, action bars
harmonisées avec convention de couleurs (vert = génère, amber = navigue), stats prof.

## TODOs

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
