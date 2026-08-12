# Rollup — remise, travaux non rendus, archive de classe

> Livré le 2026-08-12 (session « admin/didactique + notifications + non rendu »).

## Travaux non rendus (décision du prof, jamais automatique)
- `travail.nonRendu : 'justifie' | 'nonJustifie' | null` — toggle dans l'onglet grille
  de l'espace de correction (justifié = pas de note ; non justifié = cote finale 0
  **sans** toucher les critères → stats de capacités préservées).
- Élève : 3ᵉ bloc « Travaux non rendus » sur /activites (badge), bandeau dans l'onglet
  Évaluation, corrigé masqué côté serveur, bouton « Remettre le devoir » remplacé par
  « 🔒 Remise clôturée » dès que la correction est rendue.
- Prof : badge sur la liste des travaux, colonne Corrigés, stats du devoir (0 compté
  comme échec ; justifiés exclus du taux de remise). Profil (Général) : bloc
  « ⚠ Travaux non faits, non justifiés » (élève + fiche prof) — hors statistiques.
- Testé de bout en bout avec élève 007 le 2026-08-12 ✅ (une vraie chasse au fantôme :
  la cause des symptômes était un devoir dupliqué homonyme + une classe renommée).

## Classes : renommage propagé + archive avant suppression
- Les devoirs référencent les classes par **nom** → le renommage est désormais propagé
  aux devoirs du prof (PATCH classes). Incident forcoGosselies documenté dans init.md.
- Suppression de classe : modale avec bouton « 📦 Télécharger l'archive (ZIP) » —
  HTML par élève (nommé, évaluation par critère, commentaire) + notes.csv par activité
  + recapitulatif.csv. ZIP maison (`src/lib/zip.ts`, STORE sans compression, testé) —
  aucune dépendance ajoutée. La suppression reste non-cascade sur les devoirs.

## TODO
- [ ] Test du bouton d'archive sur une classe réelle (contenu du zip dans le Finder)
- [ ] Éventuel verrou serveur sur la remise quand la correction est rendue (5 lignes,
      proposé mais non demandé)
- [ ] Déploiement VPS (avec tout le reste de la session)
