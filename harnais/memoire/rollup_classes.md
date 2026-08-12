# Rollup — Mes Classes : bloc Mes Élèves + fiche élève

## État actuel (session du 2026-08-11 soir)

**Livré, non testé, non déployé.**

- **Bloc « Mes Élèves »** (`MesElevesSection`, page /classes sous Mes Classes) : tous
  les élèves du prof (GET `/api/eleves` sans paramètre, déjà existant), tri par nom,
  badge classe, filtre **Actifs / Archivés** (élève archivé = sa classe est archivée),
  champ de recherche.
- **Fiche de l'élève** (`EleveProfilModal`) : grande popup (~1100 px) ouverte au clic
  sur un élève — depuis Mes Élèves **et** depuis les cartes élèves du détail d'une
  classe (`ClasseDetailForm`, prop `onOpenFiche` ; ✏️/🗑 en stopPropagation). Contenu =
  profil d'écrilecteur complet, 5 onglets.
- **Refactor** : la page /profil est devenue une coquille autour de
  `ProfilPanel` (composant partagé, prop `eleveId?`) — zéro changement visuel élève.
  Le CSS reste dans `src/app/profil/profil.module.css` (importé par le composant).
- **API** : les 5 routes `/api/profil/*` acceptent `?eleveId=` via
  `src/lib/profil-target.ts` — rôle prof exigé + vérification que la classe de
  l'élève appartient au prof, email déchiffré serveur. Élève jamais connecté
  (pas de `firebaseUid`) → fiche vide, comportement attendu. Les corrections
  restent filtrées `visibleParEleve` (le prof voit ce que l'élève voit).

## TODOs

- [ ] Tester : filtre actifs/archivés, recherche, fiche depuis les deux entrées,
  les 5 onglets avec un élève ayant des corrections visibles.
- [ ] Déployer (aucune règle Firestore à toucher).

## Session 2026-08-12 — renommage propagé + archive ZIP
- Renommage de classe propagé aux devoirs (ils référencent les classes par NOM).
- Suppression : modale avec archive ZIP (travaux HTML nommés/évalués + CSV notes
  par grille + récapitulatif) — voir rollup_remise.md.
