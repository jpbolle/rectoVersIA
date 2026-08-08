# Rollup — Aide dictionnaire & vocabulaire personnel

## État actuel (session du 2026-08-08)

Livré, **non déployé** (ni VPS ni Chrome Web Store) :

### App Recto-versIA
- Tags UAA sur les cards d'activités (prof + élève), tag « Voc » pour le vocabulaire.
- Toggle bulles IA côté élève (barre d'outils éditeur, label « Aide IA ») ; toggle prof
  relooké (label « Traces », ON = visible).
- **Aide dictionnaire élève** : bloc permanent dans l'onglet Ressources (toggle + champ +
  définition/synonymes/antonymes/proxémie), clic-mot dans l'éditeur (fluo + popup), mots
  cliquables dans le panneau latéral. Source : Wiktionnaire (parsing serveur, suivi de
  flexion) + Claude pour la proxémie ; cache `dictionaryCache`.
  Choix utilisateur : Wiktionnaire retenu contre Dicolink (payant) et CRISCO (interdit
  sans licence — piste email refusée).

### Extension NavigKid (v1.3, manifest non versionné volontairement)
- Popup d'extension : toggles exclusifs Dictionnaire / Traducteur (langues : fr par
  défaut, ar, es, uk), bouton sidebar, bouton PDF.
- Traducteur = comportement daspalecte (bulle BD au-dessus du mot, groupes de mots
  juxtaposés → retraduction contextualisée, seuils ±20px / 25px).
- Visionneuse PDF portée de daspalecte (sans outils IA) : bouton bas-centré sur le
  lecteur natif Chrome, calibration scaleX du text layer, fluo + carte au hover,
  carte de traduction sans titre.
- `host_permissions` élargies à tous les sites (fetch PDF) → ré-approbation probable
  à la mise à jour.

### Vocabulaire personnel
- `vocabulairePersonnel/{uid}` : mots définis par l'élève (app : tracking serveur dans
  `/api/dictionary` ; NavigKid : file `motsDictionnaireEnAttente` vidée par la sidebar
  connectée). Route `/api/vocabulaire/personnel` (POST élève, GET prof `?studentId=`).

## TODOs (repris dans roadmap.md)

- [x] Exercices de vocabulaire : injecter des mots de la liste personnelle dans les
  exercices sur série collective. *(fait le 2026-08-08 — 3-5 mots, voir
  rollup_vocabulaire.md)*
- [ ] Interface de consultation des listes personnelles (prof + élève).
- [ ] RGPD : trancher le chiffrement de `vocabulairePersonnel` (skill `/encrypt`).

## À déployer

1. App → VPS (skill `/deploy`).
2. Extension → re-zip `eleve-extension` + upload Chrome Web Store (permissions élargies).
3. Aucune règle Firestore à déployer (tout passe par adminDb).

## Gotchas découverts

- Turbopack rejette `::highlight()` en CSS → injection JS (voir init.md §7).
- Text layer PDF : ne jamais laisser un sélecteur `.pdf-text-layer span` toucher les
  wrappers injectés (position:absolute les arrache du flux) — utiliser `> span`.
