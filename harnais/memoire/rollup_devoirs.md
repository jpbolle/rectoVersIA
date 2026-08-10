# Rollup — Création/édition d'activités (prof)

## État actuel (session du 2026-08-10 — soir)

**Livré, non testé, non déployé** — refonte du formulaire de création en **recto/verso** :

- Renommages : « Créer une nouvelle activité », bouton « Créer l'activité ».
- Onglets « 📋 Description de l'activité » / « 📚 Ajout de ressources » + bouton
  « Retourner » ⟳ (même bouton repris sur le `FlipEditor` élève). Point orange sur
  l'onglet ressources quand il y a du contenu. Maquette validée :
  `harnais/plans/maquette-creation-flip.html`.
- Verso type **écrire** (toutes grilles, pas seulement résumé) : bloc « Ressource.s »
  + « Espace de planification » (champ « Thème ou thèse » + plan hiérarchisé `PlanDraft`
  sans bandeau) + « Production du professeur ». Chaque bloc a un toggle **« Corrigé IA »
  (opt-in, désactivé par défaut, état en info-bulle)**.
- Stockage : `devoirs.corrigeReference` ({ theme, plan, production, planToIA,
  productionToIA }) + `devoirs.ressourcesToIA`. Côté élève, seule la `production` sort,
  et uniquement si `corrigeDisponible` (filtrage serveur) — affichée dans « Remarques du
  prof » (encadré « La proposition du professeur »).
- **Correction IA (`grid-eval`)** : joint au prompt selon les toggles — texte + images
  des ressources (max 3, en pièce jointe Claude), thème + plan du prof (Markdown via
  `planToMarkdown`), production du prof, et le **plan de l'élève**. Jamais de PDF ni de
  lien.
- **RessourcesInput en onglets Image / Lien / Texte** (cumulables) : Image = upload
  compressé navigateur (≤ 700 Ko) vers Firestore `ressourceImages` en base64 (pas de
  Storage, pas de Drive, pas de disque VPS — décision après 2 pivots : Drive puis disque
  abandonnés), vignettes + popup ; Lien = textarea une URL par ligne → puces cliquables ;
  Texte = éditeur riche. Images servies par `/api/ressources/image/[id]` (public, lien
  secret). `OutilsEditor` désormais inutilisé.
- Fix au passage : avertissement Tiptap « Duplicate extension names ['link'] » corrigé
  dans OutilsEditor, WorkEditor, AnnotationEditor (`link: false` dans StarterKit).

## TODOs

- [ ] **Tester** : création complète (recto/verso, toggles, image, liens), correction IA
  d'un résumé avec corrigé, vue élève (images en ligne, proposition du prof).
- [ ] **`EditDevoirModal`** : pas de verso — impossible de modifier corrigé/toggles après
  création (le PATCH serveur les accepte déjà).
- [ ] Ajouter la nouveauté sur la page `/roadmap` (pilotée Firestore, via l'app en admin).
- [ ] Décision en suspens : supprimer `OutilsEditor.tsx` (mort) ?

## Session précédente (2026-08-09)

**Livré, testé et déployé le 2026-08-10** :

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

- [x] **Tester** : création (dropdown classes + choix évaluation), modification d'un
  ancien devoir, tags sur les cards des deux côtés, duplication.
- [ ] À terme : exploiter `evaluation` côté stats/corrections (aujourd'hui purement
  informatif).
