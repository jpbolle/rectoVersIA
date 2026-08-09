# Rollup — Création/édition d'activités (prof)

## État actuel (session du 2026-08-09)

**Livré, non testé, non déployé** :

- **Sélection des classes en menu déroulant à cases** : nouveau composant réutilisable
  `ClassesDropdown` (bouton avec résumé « 4A, 4B » + compteur, panneau à cocher,
  fermeture au clic extérieur). Utilisé dans `CreationForm` et `EditDevoirModal`
  (remplace la grille de cases).
- **Nouveau champ `evaluation`** sur `devoirs` : `'formatif'` (entraînement) ou
  `'certificatif'` (compte pour la note). Défaut : formatif (création ET fallback
  serveur). Sélecteur dans les deux formulaires, ligne 1 de la création.
  - Tag sur les cards prof **et** élève (`DevoirCard`) : Certificatif en amber,
    Formatif en gris discret. Les devoirs antérieurs n'ont pas le champ → pas de tag
    (il apparaît à la première modification).
  - La duplication reprend le type d'évaluation de l'original.
  - Aucune règle Firestore à déployer (devoirs accédés via routes serveur uniquement).

## TODOs

- [ ] **Tester** : création (dropdown classes + choix évaluation), modification d'un
  ancien devoir, tags sur les cards des deux côtés, duplication.
- [ ] À terme : exploiter `evaluation` côté stats/corrections (aujourd'hui purement
  informatif).
