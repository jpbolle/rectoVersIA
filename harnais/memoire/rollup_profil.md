# Rollup — Profil d'écrilecteur (élève)

## État actuel (session du 2026-08-10)

Refonte complète en **5 onglets** : Général / Lire / Écrire / Rechercher / Vocabulaire.
**Livré, tsc OK, non testé avec un compte élève, non déployé.**

- **Cause de la lenteur historique** : l'ancienne route `/api/profil` (supprimée)
  rechargeait, à chaque visite, tous les travaux + corrections de la classe pour chaque
  devoir (centaines de lectures Firestore) avant d'afficher quoi que ce soit.
- **Architecture retenue** (choix JP) : un appel API par onglet, chargé à la première
  ouverture de l'onglet. Seuls `lecture`/`ecriture` paient les stats de classe ;
  `general` ne lit que les données de l'élève.
- Helpers serveur partagés : `src/lib/profil-stats.ts` (loadStudentBase, loadClassStats,
  buildSectionStats, buildDevoirStats, mergeWordMastery, buildVocabulaireProfil).
- Onglet **Vocabulaire** : bloc « Maîtrise lexicale » (3 colonnes Inconnus / Fragiles /
  Connus par série du prof + groupe « Mots personnels », mots triés du moins au plus
  connu, dégradé rouge→vert niveaux 0-5, infobulle tentatives·réussites) + bloc
  « Liste personnelle » (mot, définition, date). Niveau : `wordLevel()` — 0 jamais
  testé, 1 aucune réussite, 2-3 fragile, 4 connu, 5 ≥ 4 réussites.
- Onglet **Rechercher** : une carte par recherche NavigKid (remise ou non, questions
  répondues, sites consultés, passages surlignés). **Pas de note** : aucune correction
  (IA ou prof) n'est stockée pour les recherches à ce jour (`NavigKidCorrectionIA`
  est un type mort).
- La source (App vs NavigKid) des mots personnels n'est **pas stockée** → pas de badge
  d'origine dans la liste personnelle.
- Maquette validée : `harnais/plans/maquette-profil-onglets.html`.

## TODOs

- [ ] **Tester avec un compte élève réel** (corrections visibles + activités
  vocabulaire) — le compte prof ne voit que des états vides.
- [ ] Déployer (`/deploy`) après le test.
- [ ] Vue **prof** des listes personnelles et résultats par élève — session ultérieure
  (voir [[rollup_dictionnaire]]).

## Décisions

- 2026-08-10 — pas de chiffrement de `vocabulairePersonnel` (mots non sensibles,
  l'email y est déjà chiffré) — décision JP.
- 2026-08-10 — architecture « un appel par onglet » préférée à l'optimisation de
  l'appel unique et au cache serveur.
