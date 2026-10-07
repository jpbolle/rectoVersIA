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

Session 2026-08-09 (retours de test JP, **livré non déployé**) :
- Exercice 1 (texte + définitions) : popup de définition **en portal** (position fixe,
  z-index 10000, passe devant les entêtes ; sous le mot si trop haut ; max 360 px) —
  corrige aussi le double affichage quand un mot apparaissait deux fois.
- Exercice 5 (texte à trous) : indice = **2 premières lettres** (`slice(0, 2)`),
  affiché **uniquement après une vérification** et seulement sur les trous faux ou
  vides. Bouton « i » supprimé, `getFirstSyllable` supprimé de `types/vocabulaire.ts`.
  Demi-point conservé : trou trouvé à partir de la 2ᵉ vérification → `credit: 0.5`.

Session 2026-10-07 (**testé et validé par JP le jour même, non déployé**) — import de listes
dans `VocabListEditor` (bouton « ⤓ Importer », panneau en ligne comme le panneau IA,
pas de popup) :
- Onglet **Liste de mots** : un mot par ligne (puces/numéros retirés) ; des lignes
  collées depuis un tableur (tabulations) sont lues dans l'ordre du modèle.
- Onglet **Google Sheets** : méthode KitSchool — Sheet **public**, le serveur lit
  l'export CSV (`/api/vocabulaire/import`, `src/lib/sheet-url.ts`, `src/lib/csv.ts`,
  aucune dépendance). Colonnes reconnues par en-tête (seul « Terme » obligatoire).
  Un Sheet privé renvoie du HTML (401) → message « partagez en public » (pas
  « colonne manquante » comme dans KitSchool).
- **Modèle** : Sheets « Modèle — Import liste de vocabulaire (Recto-versIA) » créé
  dans le Drive de JP (id `1mW2_YHOQVZQ5GHgXsD-GbaqmbrSSuCgcXOLB8M-Qk7E`), bouton
  « Copier le modèle » en `/copy`. **Doit être rendu public**, sinon le bouton échoue.
- Doublons ignorés. Deux aides IA **cochées avant l'import** (demande de JP : dans le
  panneau, pas en étape séparée), lancées dans la foulée du clic « Importer » :
  « Compléter les champs vides » des mots importés (cochée par défaut ; action
  `enrich` par lots de 15, ne remplit que les cases vides) puis « Enrichir la liste »
  (= panneau IA existant, validé par JP).

Même session — **sauvegarde automatique** de `VocabListEditor` (choix de JP) :
déclenchée par un signalement (un collègue a perdu une liste : les mots n'étaient
enregistrés qu'avec le bouton « Sauvegarder », sans avertissement en quittant).
- Enregistrement 1,5 s après la dernière modification (nouvel essai à 5 s après un
  échec), une requête à la fois ; indicateur « Enregistrement… / Enregistré ✓ /
  ⚠ Non enregistré » à la place du bouton « Sauvegarder » (supprimé).
- Au départ (changement de liste, fermeture, navigation dans l'app), ce qui attendait
  le délai est enregistré immédiatement. Fermer l'onglet du navigateur dans les 1,5 s
  peut encore perdre la dernière frappe (accepté).
- ⚠ Gotcha : la page Mes Ressources **réutilise le même composant** quand on change de
  liste → le tableau est vidé au changement d'`id`, sinon la sauvegarde automatique
  écrirait les mots de l'ancienne liste dans la nouvelle.

## TODOs

- [ ] **Tester la sauvegarde automatique** : modifier puis changer de liste aussitôt
  (les mots doivent rester sur la bonne liste), fermer l'éditeur, recharger la page.

- [ ] **Rendre public le Sheet modèle** (Partager → « Tous les utilisateurs disposant
  du lien », Lecteur) — sinon « Copier le modèle » échoue chez les autres profs.
- [ ] Idée en attente de décision de JP : bouton « ✨ Compléter les champs vides » dans
  la barre du tableau (aujourd'hui la complétion n'existe qu'à l'import).

- [ ] **Finir de tester la session d'apprentissage** : injection des mots personnels,
  demi-points en stats (les ex. 1 et 5 ont été testés le 2026-08-09, corrections faites).
- [ ] **Vérifier le format JSON IA pour `fill_in_blanks_dropdown` et `context_sentences`**
  (exercices générés en mode `diagnostic`). Source possible de bugs silencieux si Claude
  ne respecte pas le format attendu. Test : dérouler un diagnostic complet, surveiller la
  console pour les erreurs de parsing ; ajouter des logs de validation dans
  `src/hooks/useVocabulaireExercises.ts` si besoin.

## Diagnostic « bloqué » (2026-10-04) — pas un bug, corrections déclinées

Signalé : des élèves « refont sans arrêt le diagnostic ». La copie d'eleve07 montrait
4 exercices sur 5 validés à chaque passage : le bouton « Début de l'apprentissage »
n'apparaît que quand les 5 le sont. **L'élève avait oublié de valider un exercice**
(confirmé par JP). Le texte à trous de l'IA est bien formé (vérifié par 3 appels réels).
Proposé puis **abandonné par JP** (« laissons tomber ») : points de navigation distincts
fait / à faire, ligne « il reste : Exercice X », reprise du diagnostic après
rechargement. Ne pas reproposer sans nouvelle demande.

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
