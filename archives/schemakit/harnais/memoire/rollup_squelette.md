# Rollup — squelette du projet

## État actuel
- 2026-09-13 (soir) : **ligne du temps à étages livrée** (formulaire ; glisser à venir),
  Markdown et transformations des 4 types. Vérifié : tsc, lint, captures, 34 tests jetables
  (dates, empilement, Markdown, frise ↔ arbre ↔ carte).
- 2026-09-13 (suite) : mémoire des positions de la carte conceptuelle à travers les arbres
  (`Diagram.layouts.conceptmap`, aussi dans le Markdown « avec positions ») ; barre flottante
  sur les liens (mot, épaisseur, style, couleur, supprimer) ; bouton « Outils… » sur toutes
  les barres flottantes → onglet Outils. Plan ligne du temps écrit, en attente de 3 réponses.
- Chantier « outils » livré le 2026-09-13 : accueil « Mes schémas » (localStorage),
  `/atelier/[id]` avec enregistrement automatique, volet du bas à onglets (Outils · Markdown ·
  À placer), styles traits/encadrés, quadrillage, tags glissables, export PNG/PDF.
  Vérifié : tsc, lint, `npm run build`, captures headless, 21 tests jetables (styles dans
  le Markdown, tags à travers les transformations, réduction du tag déposé).
- Éditeur d'arbre (carte mentale + organigramme numéroté) et transformations livrés le
  2026-09-13 : sélecteur de type sur `/atelier`. Vérifié par captures headless et 21 tests
  jetables (Markdown des arbres, numérotation, disposition, boucle, liens perdus).
- Éditeur de carte conceptuelle **visible** sur `http://localhost:3000/atelier` : boîtes
  éditables en place, liens avec mot de liaison, barre d'outils à boutons, volet Markdown
  (export / import). Vérifié par capture d'écran headless en 1366×768 et par 10 tests
  d'aller-retour Markdown (script jetable, non versionné).
- Projet Next.js créé (TypeScript, App Router, `src/`, ESLint, sans Tailwind), harnais
  taille L installé, dépendances `firebase`, `firebase-admin`, `@xyflow/react`.
- Aucun projet Firebase encore créé, aucun `.env.local`, aucune page métier.

## Décisions
- 2026-09-13 — Chantier outils : stockage **local** (pas de Firebase pour la maquette),
  dépendance **html-to-image** acceptée, palette fermée **+ bouton « + »** vers un sélecteur
  libre ; PDF via l'impression du navigateur.
- 2026-09-13 — **SchémaKit est une maquette**, à refondre ensuite dans Recto-versIA
  (`~/Documents/rectoVersIA`). Hypothèses confirmées par JP après test : numérotation
  (racine sans numéro, enfants 1, 2, 3…) et disposition automatique maison.
- 2026-09-11 — Éditeur : **React Flow** ; élèves : **code de classe** (auth anonyme) ;
  styles : **CSS Modules** ; nom : **SchémaKit**. Motifs dans `roadmap.md` § Écarté.
- 2026-09-11 — Hypothèse non confirmée : profs par **Google OAuth**, hébergement **VPS**.

## TODOs
- [x] JP a testé `/atelier` (2026-09-13) : validé.
- [x] JP a testé les outils (tags, export, couleurs, enregistrement) le 2026-09-13.
- [x] JP a testé la frise, la mémoire des positions et les barres flottantes (2026-09-13 soir) : validé.
- [ ] Frise, second temps : **glisser** un événement (changer sa date, son étage) ; étirement de l'axe si besoin.
- [ ] Retirer `firebase` / `firebase-admin` (inutilisés) avant la refonte Recto-versIA.
- [ ] `firebase` et `firebase-admin` sont installés mais inutilisés : les retirer avant la refonte (ou dès que JP le décide).
- [ ] Avertissement React Flow en console dev (« styles non chargés ») alors que `style.css` est importé : à vérifier dans un vrai navigateur, probablement le chargement différé du CSS en dev.
- [ ] Tester au clavier : Tab (idée enfant) et Entrée (idée sœur) dans l'éditeur d'arbre — non vérifiable en headless.
- [ ] Deux éditeurs partagent la même forme de nœud éditable : envisager un composant commun quand la ligne du temps arrivera (troisième occurrence).
- [ ] Créer le projet Firebase (région Europe), activer Auth anonyme + Google, Firestore.
- [ ] Remplir `.env.local` (noms des variables dans `init.md` §1).
- [ ] Écrire `firestore.rules` initial (refus global + règles `users`, `students`, `works`).
- [ ] Définir la palette au premier écran.

## Historique
- 2026-09-13 (clôture) — Session terminée : 4 types livrés et testés par JP. Rien n'est commité (JP commite lui-même).
- 2026-09-13 (soir) — Ligne du temps à étages, Markdown + transformations 4 types.
- 2026-09-13 (suite) — Positions retrouvées au retour vers la carte conceptuelle ; barre flottante des liens ; plan ligne du temps.
- 2026-09-13 (soir) — Outils : volet à onglets, styles, tags à placer, quadrillage, export, accueil local.
- 2026-09-13 — Éditeur d'arbre (TreeEditor, disposition maison), Markdown des arbres, transformations entre les trois types, sélecteur de type sur `/atelier`.
- 2026-09-12 — Plan validé (React Flow, option B nœuds/liens personnalisés, M3 Markdown avec positions en commentaire, 4e type hiérarchisé) ; éditeur de carte conceptuelle + page `/atelier` + Markdown livrés.
- 2026-09-11 — Création : cahier des charges (`README.md`), harnais, squelette Next.js.
