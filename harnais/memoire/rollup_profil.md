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

## Session 2026-08-12 — vocabulaire, Parler, critères par grille
- Onglet Vocabulaire refondu : cartes de stats par activité + « Vue d'ensemble »
  (séances = activityOpened, temps réel `timeSpentSeconds` — chronométré depuis le
  2026-08-12, historique à « — » —, sessions d'apprentissage, diagnostics initial/
  intermédiaires et évaluations en pastilles ScoreChip, répartition 4 niveaux
  rouge→vert). Vue prof (fiche élève) : stats seules, sans listes de mots.
- « Liste personnelle » retirée du profil → page élève /mes-ressources (header
  « Mes Ressources personnelles »).
- Onglet 🗣️ Parler ajouté (état vide, en attente d'un module oral) + carte dans le
  Général + « Gestes de parole » dans la didactique admin.
- « Tous les critères » (Écrire/Lire) : groupés par grille d'évaluation, mini-courbe
  à points (tooltip précis au survol), détail dépliable = liste + points en grand
  (une seule fois). Carte Vocabulaire du Général : % maîtrisés + barre empilée.
- EmptyState : les mots-clés (`hourglass`, `chart`…) s'affichaient littéralement —
  hourglass = spinner, partout ailleurs de vrais emojis + « Absence de données ».
- TODO : test + déploiement.

---

## Session du 2026-08-15

- **Carte « Rechercher » de la Vue d'ensemble** : elle affichait `3/4` /
  « recherches remises ». Elle dit maintenant le RÉSULTAT —
  `82%` / « réponses 69 % · démarche 94 % · **1/3 recherches** » (corrigées sur
  assignées). Tant que rien n'est corrigé : `—` et « 2/4 remises · pas encore
  corrigées ». La barre prend enfin la couleur du score.
- **`buildRechercheProfil` déplacé dans `profil-stats.ts`** : la tuile et
  l'onglet viennent du MÊME calcul. Les faire diverger était le risque
  principal. Coût : la Vue d'ensemble lit un document questionnaire par
  recherche, là où elle ne lisait que les réponses.
- **Onglet 🪞 Me connaître, élargi** — voir `rollup_lucidite`. Deux sections :
  « Est-ce que je me vois juste ? » (écriture, lecture, recherche) et
  « Mes auto-évaluations ». Séparées volontairement : dans l'une l'élève se
  compare à un résultat chiffré, dans l'autre au regard d'une personne.
- `loadStudentBase` charge désormais `travail.selfEvaluation` et
  `devoir.hiddenCriteria` ; la route réflexive demande aussi les grilles.
