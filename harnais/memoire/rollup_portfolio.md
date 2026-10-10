# Portfolio d'apprentissage — rollup du chantier

> Chantier 3 du macro-plan. Plans : `harnais/plans/2026-09-20-portfolio-apprentissage.md`
> (8 étapes, décisions du 20/09), `2026-09-20-portfolio-analyse-moliere.md` (analyse),
> **`2026-10-09-portfolio-etape-1-squelette.md`** (étape 1, v2 validée) et la maquette
> `maquette-portfolio-eleve.html` (v2, 4 vues).

## 2026-10-11 — retouches après test de JP

- Popup d'étape : le choix **Des dépôts / Une activité** est remonté juste sous Section / Titre ;
  bug corrigé : le sélecteur (`.seg`, `overflow: hidden`) était écrasé à 0 px quand il est posé
  directement dans le corps flex de la popup → `flex-shrink: 0`.
- Serpentin : écarts **étirés** pour que la rangée prenne toute la largeur (`--serp-ecart-x`,
  même écart pour toutes les rangées).
- Encadrés du portfolio : **flèches ◀ ▶ retirées** (JP), seul le glisser-déposer réordonne —
  ⚠ inopérant au doigt (écran tactile). La séquence FLE garde ses flèches.
- **Encadré du serpentin rééquilibré** : icône de NATURE en tête (🎯 activité · 📥 dépôts ·
  🎭 hors de l'app — trois icônes seulement, JP), numéro vert (la règle `.encadreEtape .numero`
  ne s'appliquait pas : autre feuille CSS), pied à filet avec poignée ⋯ (glisser) à gauche et ✕ à
  droite, pastilles de 20 px, hauteur minimale commune.
- **Tâche finale = CIBLE** au bout du serpentin (`Serpentin.fin`) : disque à anneaux ambre/crème
  de 200 px (largeur d'un encadré), devant le trait (`z-index`, l'enveloppe `display: contents`
  échappe à `.rangee > *`). Passée par `tacheFinale` depuis l'atelier, la création et la popup
  de modification.
- **Rien n'a encore été vu à l'écran pour les phases 1-4 du plan validation-variables** : test
  complet à faire (scénario dans la section du 2026-10-10 nuit).

## 2026-10-10 (nuit) — validation, valeurs attribuées, progression ÉCRITES (« fais tout, je teste demain »)

Plan **`2026-10-10-portfolio-validation-variables.md`** validé, les 4 phases écrites d'un coup.
`tsc`, lint, **`npm run build` OK** ; logique des états testée sur données factices ; **rien vu à l'écran**.
- **Soumettre au professeur** (toute étape à dépôts ou activité) : ligne d'action à deux traits
  dans la colonne 1 ; actif quand l'étape est prête ; notifie le prof (cloche, `etiquette`
  « 🗂️ Portfolio — à valider », sans nom d'élève). Étape **faite = soumise** (+ validée si bloquante).
  ⚠ Changement de règle : une étape à dépôts remplis n'est plus « faite » tant qu'elle n'est pas soumise.
- **Retour du prof** (`PortfolioRetourProf`, dans la copie) : ✓ / ✗, 😀 😐 🙁, commentaire, valeurs.
  Un retour sans soumission vaut soumission. Élève : **encadré ambre** en tête de l'étape ; sommaire
  ✓ / ✗ / 💬. Refus → « à reprendre » → resoumission → « à revoir ».
- **Popup d'étape** : « La suite attend ma validation » (ferme la suite comme `verrouille`) ;
  « En validant, j'attribue : nom + genre » (œuvre · lien · vidéo · page intégrée) ; « Afficher dans
  cette étape » les valeurs des étapes précédentes, colonne de travail ou onglet Ressources.
- **Valeurs** : œuvre = référence (scène ou œuvre entière, menu des scènes), texte servi par
  `/api/portfolio/valeur` après contrôle de l'attribution ; lien / vidéo / iframe validés serveur.
- **Activités renvoyées** : le lien porte `?portfolio=&etape=` ; l'onglet Ressources de l'activité
  montre « De ton portfolio » (`PortfolioValeursActivite`).
- **Tableau d'évolution** (page des travaux de l'activité, au-dessus des statistiques) : ● à valider,
  ✓, ✗, ✎, ◔, retard encadré rouge ; clic → la copie ; ❤️ / 💔 bleu-gris / 💬 par la cloche.
- Même jour : 💔 du **suivi de lecture** passé en bleu-gris (filtre CSS) — demande de JP.

## 2026-10-10 (soir) — premier test de JP (matrice Molière) → retouches ÉCRITES, non vues

- **Atelier** : consignes générales et ressources du portfolio derrière une **case à cocher**
  (décocher vide le champ, recocher le rend dans la séance).
- **Serpentin** (partagé avec la séquence FLE !) : virages **arrondis**, écart de 56 px entre
  rangées, rangées de hauteur égale (grille `1fr`), chaque rangée après la première ouvre sur un
  emplacement vide sous le dernier « + ». **Glisser-déposer** natif (`onDeplacer`) : lâcher sur un
  « + » insère, sur un encadré prend sa place. Pas de badge IA sur les encadrés.
- **Le « + » ouvre directement la popup d'étape** ; dans la popup, « Ce que l'élève fait » :
  **Des dépôts** | **Une activité de Mes Activités** (liste filtrable, « Changer », « ➕ Créer une
  nouvelle activité » → l'atelier prend la page et pose l'activité dans l'étape en gardant ses
  réglages). Plus de popup « trois choix ».
- **Objectifs** : puces (pas de cases) dans l'éditeur ; **consigne d'étape = liste de tâches**
  (`ConsignesEditor`) cochée par l'élève, `PortfolioContenuEleve.taches` (clé `cleTache(etapeId,
  texte de la ligne)`), compteur « 2 / 5 ». Les tâches n'entrent PAS dans « étape faite ».
- Point **g** (retour du prof sur un dépôt) : plan à faire, questions en cours.

## 2026-10-10 (suite) — séances b et c ÉCRITES (« fais tout d'un coup », JP testera après)

- **Tableau** : `PortfolioDepot.colonnes` (prof, ≤ 8, vides filtrées, repli `['Réponse']`), lignes
  ajoutées par l'élève (≤ 60), JSON `string[][]` dans `…/tableau`, relu et borné par le PATCH.
  Personnel (pas de co-édition). `PortfolioDepotTableau`.
- **Image** : collection `portfolioImages`, `POST /api/portfolio/image` (élève, copie non remise,
  ≤ 700 Ko, écrit la clé `…/image` dans la copie par transaction, supprime l'ancienne),
  `GET|DELETE /api/portfolio/image/[id]` (lecture : élève auteur ou `accesTravail`). Le PATCH
  refuse un id d'image qui n'appartient pas à cette copie. Affichage par `fetch` + jeton →
  `createObjectURL` (`PortfolioDepotImage`).
- `tsc`, lint et **`npm run build` OK**. Rien vu à l'écran.
- ⚠ Comme les `travaux`, les images ne sont **pas** supprimées quand une activité ou un élève est
  supprimé (aucune cascade n'existe dans le projet aujourd'hui).

### Scénario de test (séances a, b, c)
1. Prof : dépôt « Texte + Lien » ; dépôt « Tableau » (colonnes Réplique / Didascalie) ; dépôt « Image ».
2. Élève : texte + lien Drive → lecteur ; l'étape ne se coche qu'avec les deux. Tableau : 3 lignes,
   recharger → elles restent. Image : photo de téléphone (> 700 Ko) → compressée, affichée,
   « Remplacer », « Retirer ».
3. Prof : la copie montre texte, lecteur, tableau, image. Un ancien dépôt texte s'affiche toujours.

## 2026-10-10 — dépôts multi-types, séance a ÉCRITE (pas encore vue par JP)

Plan **`2026-10-10-portfolio-depots-multitypes.md`** validé (« go »). JP a choisi
l'option **A : un dépôt, plusieurs types** (texte + lien dans un seul bloc).
- **Modèle** : `PortfolioDepot.types: TypeDepot[]` (`texte | lien | image | tableau | groupe`)
  remplace `type`. **Toujours lire par `typesDuDepot(d)`** (accepte l'ancienne forme ; le
  serveur convertit à chaque passage). `groupe` exclusif. Pas de migration.
- **Clés élève** : `clePartie(etapeId, depotId, type)` — texte = clé historique
  `{etapeId}/{depotId}`, les autres `…/{type}`. Dépôt **rempli = toutes ses parties** (un
  lien compte s'il passe `lienValide`, partagé écran + serveur : jamais `javascript:`).
- **Prof** : rangée de pastilles « L'élève dépose : Texte · Lien · Image · Tableau · Groupe »
  (`TYPES_DEPOT_DISPONIBLES` = texte, lien, groupe ; image et tableau « bientôt » →
  séances b et c).
- **Élève / lecture prof** : `PortfolioDepotLien` (YouTube/Drive → lecteur, liste blanche
  d'intégration → cadre, sinon lien cliquable).
- Même jour : pictogrammes IA de JP (`public/ia-statut/`, composant `IaPicto`), intitulés
  « Généré par l'IA / Aide de l'IA / Non-recours à l'IA », choix « Celui de l'activité »
  retiré ; vidéos Drive acceptées dans les ressources (`videoEmbedUrl`).

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
