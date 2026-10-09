# Portfolio d'apprentissage — rollup du chantier

> Chantier 3 du macro-plan. Plans : `harnais/plans/2026-09-20-portfolio-apprentissage.md`
> (8 étapes, décisions du 20/09), `2026-09-20-portfolio-analyse-moliere.md` (analyse),
> **`2026-10-09-portfolio-etape-1-squelette.md`** (étape 1, v2 validée) et la maquette
> `maquette-portfolio-eleve.html` (v2, 4 vues).

## 2026-10-09 — étape 1 ÉCRITE EN ENTIER (séances 1a, 1b, 1c) ; 1a VALIDÉE par JP, 1b et 1c PAS VUES

JP a validé le plan v2 et les deux maquettes à midi (« elles me plaisent toutes 2 »),
testé la **séance 1a** (matrice, serpentin, popup d'étape, « Utiliser pour une classe »,
popup « Choix de l'activité ») : « testé avec succès : 1, 2, 3, 4 : ok ». Puis « fais tout
car je testerai seulement demain » → **1b et 1c écrites sans être vues**, `tsc` + lint OK,
**rien de commité, rien de déployé**.

### Décisions de JP (midi)
- **Matrice dans Mes Ressources** (onglet **Portfolios**), **activité = copie** de la
  matrice pour une classe (`portfolioId` garde la source, jamais resynchronisé).
- **Verrouillage réglable par le créateur, étape par étape** (« Verrouille l'étape
  suivante ») — mécanisme repris de VibeCoding (`requireCompletion` / `isLocked`).
- **Vue d'ensemble à DROITE** (onglet « Sommaire du portfolio », à la place des consignes :
  sommaire **et** liste de tâches, cases cochées automatiquement) ; **à gauche, l'étape où
  l'élève en était**. Pas de serpentin côté élève.
- **Sections collectives ou individuelles au choix du créateur** (portée par étape) ;
  **groupe déclaré par l'élève dans les premières sections, accepté ou refusé par le prof**.
- Les activités existantes (conceptualisation, sondage, questionnaire, œuvre…) entrent
  dans le portfolio comme **renvois** ; le « + » du serpentin propose aussi **créer une
  activité sur place** (atelier de la matrice seulement).

### Choix technique (agent, à connaître)
Dispositif **propre `portfolio`** (`TypeTravail`/`Dispositif`), pas `sequence` comme prévu
le 20/09 : tout ce qui teste `estSequenceFle` (sortie pleine page de la page élève,
exclusion du tableau de bord, filtres) aurait pris le portfolio pour une séquence FLE. Le
**serpentin est partagé** : mécanisme extrait dans `SequenceFleBuilder/Serpentin.tsx`
(mesure des rangées, aller-retour, « + ») — la séquence FLE l'utilise aussi.

### Ce qui existe
- **Types** `src/types/portfolio.ts` : `PortfolioEtape` (nature `etape` | `activite`, section,
  objectifs, consigne, échéance, `ia` 3 états, `portee`, `verrouille`, `ressources`, `depots`),
  `PortfolioDepot` (`texte` | `groupe`), `PortfolioContenu` (`Devoir.portfolio`),
  `PortfolioMatrice`, `PortfolioContenuEleve` (`Travail.content` JSON : `reponses`
  `{etapeId}/{depotId}`, `cochees`, `derniereEtape`), `GroupeVue`…
- **Serveur** : `portfolio-server.ts` (nettoyage), `portfolio-etat.ts` (**pur** : `faite`,
  `fermee`, `indexDepart`, `cequiManque`, `enRetard`), `portfolio-groupe-server.ts` (noms
  déchiffrés serveur, « Prénom N. » chez l'élève, complet chez le prof).
- **Routes** : `/api/portfolios` (+`[id]`) CRUD des matrices ; `/api/devoirs/[id]/parcours-portfolio`
  (élève : renvois résolus + états ; prof : `?eleve=uid`) ; `/api/portfolio/groupe` (GET/POST/PATCH) ;
  `PATCH /api/travaux/[id]` accepte `portfolio: {reponses, cochees, derniereEtape}` **fusionné
  champ par champ** côté serveur (`useTravail.patchPortfolio`, optimiste).
  `ouvertParSequence` vaut aussi pour les renvois d'un portfolio (`typeTravail in [sequence, portfolio]`).
- **Prof** : Mes Ressources › **Portfolios** (`PortfolioPanel`, cartes, créer, dupliquer,
  archiver, « Utiliser pour une classe » → `CreationForm portfolioInitial`) ;
  `PortfolioAtelier` (fiche + ressources + serpentin, autosave 800 ms, « créer une activité »
  prend la page) ; `PortfolioBuilder` (« + » à 3 choix) ; `EtapePortfolioModal` (tous les
  réglages + ressources de l'étape) ; popup « Choix de l'activité » → carte Portfolio, verso
  « Partir d'un portfolio de Mes Ressources » ; `EditDevoirModal` verso ; page de correction →
  `PortfolioLecture` (toutes les étapes, textes, états, **groupe à accepter / refuser** avec motif).
- **Élève** (`/activites/[id]`, **dans** l'espace à 2 colonnes) : `usePortfolioEleve` (parcours,
  contenu, étape courante mémorisée, frappe différée 800 ms, groupe) ; `PortfolioActivity`
  (colonne 1 : étape, dépôts texte, renvoi « Ouvrir l'activité », sans trace cochable,
  message de verrou) ; `PortfolioSommaire` (rail, onglet « Sommaire du portfolio ») ;
  `PortfolioDepotGroupe` (déclaration, confirmation des partenaires, statut) ;
  `PortfolioRessourcesEtape` (ressources de l'étape en tête de l'onglet Ressources).
  Pas de bouton « Remettre » (grille sur le portfolio entier = étape 7).

### Scénario de test (1b, 1c — à faire voir à JP)
1. Élève : ouvrir le portfolio → l'étape de départ ; déposer un texte, recharger → il reste ;
   « ✓ déposé » ; sommaire à droite : case cochée quand les dépôts obligatoires sont remplis.
2. Renvoi : « Ouvrir l'activité », remettre, revenir → case cochée (rechargée au focus).
3. Étape sans dépôt : « J'ai fait cette étape » (élève coche lui-même).
4. Verrou : étape « Verrouille la suivante » non faite → suivante 🔒 (sommaire, flèches), message
   « il manque… ».
5. Groupe : dépôt « Groupe » → l'élève tape les premières lettres, ajoute des partenaires,
   « Déclarer mon groupe » ; un partenaire connecté voit « Je confirme / Je décline » ; prof
   dans la copie : « Accepter le groupe » / « Refuser… » + motif ; l'étape se coche à
   l'acceptation.
6. Prof : ouvrir la copie → toutes les étapes avec leur état, textes déposés.
⚠ Un camarade sans fiche `firebaseUid` (jamais connecté) apparaît dans la liste mais ne
pourra confirmer qu'après sa première connexion ; l'acceptation du prof vaut confirmation.

### Reste (étapes 2 à 8 du plan parent)
Étapes **collectives partagées** (`portfoliosEquipe`), co-édition, dépôts tableau / image /
lien / commentaires, coévaluation, **grille sur le portfolio entier**, portfolio ouvert.
Petit : « enregistrer l'activité comme matrice » ; un groupe par section (Molière : un seul).
