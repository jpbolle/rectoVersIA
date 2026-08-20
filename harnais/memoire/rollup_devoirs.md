# Rollup — Création/édition d'activités (prof)

## Session du 2026-08-20 — enregistrement automatique + onglet Interactif

**Livré, `tsc` / `eslint` / `build` passent. Rien testé à l'écran.**

### La popup « Modifier l'activité » s'enregistre toute seule

Symptôme rapporté par JP : « à l'enregistrement du questionnaire, on est
renvoyé à Mes Activités ». Diagnostic : la popup **se fermait** à
l'enregistrement (comportement voulu à l'origine) et le tableau de bord
réapparaissait derrière. Rien de cassé — mais tout un questionnaire composé en
mémoire, qu'un clic sur ✕ emportait.

**Décision de JP** : enregistrement automatique, **tant que l'activité n'est
pas disponible**. Une activité déjà ouverte verrait sinon ses questions arriver
chez les élèves à mesure qu'on les écrit.

- non disponible → écriture 2,5 s après la dernière frappe (même cadence que
  l'espace élève) ; pied « Enregistrement automatique » ; bouton
  **« Fermer la fenêtre »** (qui enregistre une dernière fois avant de fermer) ;
  plus de « Annuler », qui ne pourrait plus rien annuler ;
- disponible → inchangé : « Annuler » · « Enregistrer », rien n'est écrit avant.

Mécanique : une **empreinte JSON de tout ce qui serait enregistré** déclenche
l'écriture — pas une liste de champs à tenir à jour. La première empreinte sert
de point de comparaison, pas de déclencheur (ouvrir sans toucher ne réécrit
rien). `onSave` renvoie désormais un booléen et **ne ferme plus la popup** :
c'est elle qui décide. `silencieux` supprime le message, qui s'afficherait
derrière la fenêtre.

**Pas fait** : le formulaire de **création** n'a rien de tout ça — il faudrait
créer l'activité au premier caractère, ce qui n'est pas anodin.

### Divers

- Nouvel **onglet Interactif** dans les ressources — voir
  `rollup_ressources_interactives.md`.
- Les **étiquettes** d'onglet restent vertes quand elles contiennent quelque
  chose (vert plein = ouvert, vert clair = rempli, gris = vide). Elles
  retombaient au gris dès qu'on changeait d'onglet.
- « 📄 Texte à lire » → « 📄 **Documents à utiliser** » (création et édition).
- Champs longs (texte joint, extrait à souligner, réponse acceptée) : ils
  prennent la hauteur de leur contenu au lieu de défiler à l'intérieur —
  sélectionner un passage y était impossible, le texte filait sous le curseur.


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

## Ajout du 2026-08-11 soir — onglet Vidéo (non testé, non déployé)

4e onglet « Vidéo » dans les ressources (`RessourcesInput`, création **et** édition) :
une URL YouTube par ligne (`ressources.videos: string[]`), aperçu du lecteur côté prof,
lecteur intégré « 🎬 Vidéos » dans l'onglet Ressources élève (`RessourcesTab`) via
`youtube-nocookie.com` (variante sans cookies de pistage). Parsing des URL dans
`src/lib/youtube.ts` (watch, youtu.be, shorts, embed, live) ; URL non reconnue =
alerte côté prof, ignorée côté élève. Aucun changement serveur (ressources passent
telles quelles).

## Session 2026-08-12 — critères masqués par activité
- `devoir.hiddenCriteria` : à la sélection d'une grille (création ET édition),
  popup `HideCriteriaModal` « Masquer certains critères ? » (lien « modifier » sous
  le menu). Le masquage est PAR DEVOIR — jamais dans la grille elle-même (le toggle
  dans GrilleBuilder a été fait puis retiré le même jour, fausse piste).
- Répercuté : GrilleTab (affichage/totaux/75 %), grid-eval IA (filtre + mapping par
  index sur le même tableau), scores élève. Critère masqué mais évalué avant : reste
  visible et compté (pas de score rétroactivement faussé).
- TODO : test + déploiement.
