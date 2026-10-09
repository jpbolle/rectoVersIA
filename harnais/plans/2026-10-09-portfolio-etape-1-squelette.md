# 2026-10-09 — Portfolio d'apprentissage, étape 1 : le squelette

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-09 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **v2 VALIDÉE par JP le 2026-10-09 (midi) ; étape 1 ÉCRITE le jour même** (1a testée
  et validée, 1b et 1c à voir — état réel dans `harnais/memoire/rollup_portfolio.md`).
  Maquette (2ᵉ et dernière) : `maquette-portfolio-eleve.html`.
- **Plan parent** : `2026-09-20-portfolio-apprentissage.md` (8 étapes, décisions du 20/09)
  et son analyse `2026-09-20-portfolio-analyse-moliere.md`. Ce document précise
  l'étape 1 et intègre les **réponses de JP du 2026-10-09 (midi)**.
- **Consigne n° 1 de JP** : « conserver l'espace de travail tel qu'il est configuré :
  deux colonnes ; colonne 1 à gauche = espace de travail principal ».

## Les réponses de JP (2026-10-09, midi) et ce qu'elles changent

| Question | Réponse | Conséquence |
|---|---|---|
| Où vit le portfolio ? | **La matrice dans Mes Ressources** (récupérable) ; **une fois donnée à une classe, dans Mes Activités** | Deux objets : `portfolios/{id}` (matrice) et une activité `Devoir` qui en est la **copie** pour une classe, avec `portfolioId` pour retrouver la source |
| Verrouillage ? | **Oui, les sections se déverrouillent selon ce qui précède**, mais **le créateur règle, étape par étape, s'il verrouille ou non** | Champ `verrouille` sur l'étape, bascule dans la popup prof. Modèle : VibeCoding (`requireCompletion` par card, `isLocked = !isPassed(précédente)`) |
| Première vue de la colonne 1 ? | **La vue d'ensemble est dans la colonne de DROITE**, onglet « **Sommaire du portfolio** » (l'onglet qui existe déjà sous d'autres noms : Consignes, Sommaire…). **À gauche : le portfolio là où l'apprenant l'avait laissé** | Plus de serpentin en colonne 1. Elle s'ouvre sur la **dernière étape ouverte** (mémorisée dans la copie), à défaut la première non faite |
| Le sommaire ? *(message précédent)* | « Un mix entre liste de tâches et sommaire », cases **cochées automatiquement** | Onglet « Sommaire du portfolio » = `OeuvreSommaire` + cases + cadenas |
| Les équipes ? | **Certaines sections collectives, d'autres individuelles, au choix du créateur** (boutons d'édition). **Les noms du groupe sont listés dans les premières sections, avec acceptation ou refus du prof** | Portée **par étape** (`portee`) ; un dépôt de type **`groupe`** : l'élève déclare ses partenaires, le prof accepte ou refuse, le groupe accepté partage les étapes collectives |

## Le modèle VibeCoding, transposé

JP renvoie à l'app VibeCoding (`github.com/jpbolle/vibecoding`, formation M7). Ce qu'on en
reprend, et comment ça se dit ici :

| VibeCoding | Portfolio RectoVerso |
|---|---|
| Une page = une rangée de **cards** ; la card ouverte déplie son contenu dessous | Une activité = des **étapes** ; l'étape ouverte occupe la **colonne 1** (pas de rangée : le sommaire à droite tient ce rôle, règle n° 1) |
| Card verrouillée tant que la précédente n'est pas « passée » (`isLocked(i) = !isPassed(cards[i-1])`) | `fermee(i)` : l'étape **i** est fermée si l'étape **i-1** porte `verrouille: true` et n'est pas faite |
| « Passée » = terminée si la card compte (`requireCompletion`, questionnaire, défi), simplement ouverte sinon | « Faite » = dépôts obligatoires remplis · activité renvoyée **remise** · étape sans trace **cochée par l'élève** · groupe **accepté** |
| Bascule admin « Marquer comme terminé » par card | Bascule prof « **Verrouille l'étape suivante** » par étape, dans la popup |
| Défi = consigne + tâches à cocher + **preuve** (lien / texte / « achevée ») | Dépôts `texte` (étape 1), `lien`, `image`, `tableau`… (étapes 3-5) ; la case du sommaire = la preuve |
| Onglet « Suivi » du staff : qui en est où, en direct | Vue prof de la copie : toutes les étapes, l'état de chacune (étape 1, lecture seule) |
| Progression fusionnée **clé par clé** (`setDoc merge`) | `Travail.content.reponses[{etapeId}/{depotId}]`, PATCH d'un champ |

## Règle n° 1 — l'espace de travail reste tel quel

```
┌ WorkTopBar ──────────────────────────────────────────────────────────┐
│ ← Mes activités · Portfolio · Interpréter Molière !                  │
├──────────────────────────────────────────┬──────────────────┬────────┤
│ COLONNE 1 — l'étape où l'élève en était  │ COLONNE 2 panneau│  rail  │
│ en-tête #98ADC4 : section + titre        │ Sommaire du      │ 56 px  │
│ échéance · IA · portée (perso/collectif) │  portfolio :     │  📋    │
│ objectifs · consigne                     │  sections,       │  📁    │
│ dépôts / renvoi / sans trace / groupe    │  ☑ cases auto,   │  📊    │
│ ← précédente        suivante → (🔒 ?)    │  🔒 cadenas      │        │
└──────────────────────────────────────────┴──────────────────┴────────┘
```

### Les onglets du rail pour un portfolio

| Onglet | Contenu | État |
|---|---|---|
| **Sommaire du portfolio** 📋 | l'onglet « Consignes » renommé pour ce dispositif (comme « Consignes et navigation » pour une œuvre). Consignes générales en tête (texte), puis **sections repliables**, une ligne par étape : **case** (auto) · titre · échéance · 🔒 si fermée · 👥 si collective. Clic = j'y vais (si ouverte) | **nouveau** `PortfolioSommaire` |
| Ressources 📁 | ressources du portfolio + bloc en tête : ressources de l'étape ouverte | existant + un bloc |
| Évaluation 📊 | « Le portfolio est évalué dans son ensemble » (grille à l'étape 7) | existant, texte d'attente |

## Le modèle

### La matrice — `portfolios/{PFO-…}` (nouveau, Mes Ressources › onglet « Portfolios »)

```ts
export interface PortfolioMatrice {
  id: string; profId: string; titre: string; description?: string;
  tacheFinale?: string;           // « Mettre en scène un extrait de Molière… »
  consignes?: string;             // consignes générales (texte)
  ressources?: DevoirRessource | null;
  etapes: PortfolioEtape[];
  createdAt; updatedAt;
}
```

- Page `/grilles` (Mes Ressources prof) gagne un onglet **Portfolios** : cartes des matrices
  (`ActiviteRessourceCard`), « Créer un portfolio », clic = l'atelier du serpentin.
- Bouton **« Utiliser pour une classe »** sur la carte → `CreationForm` pré-rempli
  (atelier `portfolio`, étapes **copiées**, `portfolioId` = la matrice). L'activité est
  ensuite indépendante : on peut l'adapter pour la 4C sans toucher la matrice.
- Depuis la popup « Choix de l'activité » → « Portfolio » : choisir une matrice ou partir
  de zéro (l'activité créée de zéro peut être **enregistrée comme matrice** d'un bouton).

### L'étape — `PortfolioEtape` (`src/types/portfolio.ts`, nouveau)

On **ne charge pas** `SequenceFleEtape` : les deux objets divergent trop (verrou, portée,
dépôts, groupe). Le **serpentin** (`SequenceFleBuilder`) est généralisé pour accepter l'un
ou l'autre ; la séquence FLE ne change pas.

```ts
export type NaturePortfolioEtape = 'etape' | 'activite';   // propre, ou renvoi vers Mes Activités

export interface PortfolioEtape {
  id: string;                       // ETP-…
  nature: NaturePortfolioEtape;
  devoirId?: string;                // renvoi ; titre/atelier recopiés comme en FLE
  section?: string;                 // « 1. Premiers préparatifs » — étiquette de regroupement
  titre: string;
  objectifs?: string[];
  consigne?: string;
  echeance?: string | null;         // ISO ; libellé « Échéance »
  ia?: 'libre' | 'partielle' | 'aucune';   // absent = devoir.accesIA
  portee?: 'personnelle' | 'collective';   // absent = personnelle
  verrouille?: boolean;             // true = l'étape SUIVANTE reste fermée tant que celle-ci n'est pas faite
  ressources?: DevoirRessource | null;
  depots?: PortfolioDepot[];        // vide ou absent = étape sans trace (cochée à la main)
}

export interface PortfolioDepot {
  id: string; libelle: string; consigne?: string; exemple?: string; obligatoire?: boolean;
  type: 'texte' | 'groupe';         // étape 1 ; 'tableau' | 'image' | 'lien' | 'commentaires' aux étapes 3-5
}
```

**Le dépôt `groupe`** (demande de JP) : l'élève choisit ses partenaires parmi les élèves de
la classe (liste filtrable, `ElevesChoix` en version élève), l'étape affiche « En attente
du professeur » ; le prof, dans la copie, **accepte ou refuse** (bouton + motif). Accepté,
le groupe devient une **équipe** du portfolio ; refusé, l'élève recompose. Tant qu'aucun
groupe n'est accepté, les étapes collectives se comportent en personnelles. Une déclaration
par groupe suffit : un partenaire listé voit la demande chez lui et la **confirme** (ou la
décline) — évite quatre déclarations divergentes.

### Ce que l'élève dépose — `Travail.content` (JSON) + `portfoliosEquipe`

```ts
export interface PortfolioContenuEleve {
  type: 'portfolio';
  reponses: Record<string, string>;   // `${etapeId}/${depotId}` → texte (dépôts personnels)
  cochees: string[];                  // étapes sans trace cochées à la main
  derniereEtape?: string;             // là où l'élève en était (colonne 1 à l'ouverture)
}
```

- Une copie `TRV-{devoirId}-{studentId}` par élève, inchangée dans sa forme.
- Les dépôts des **étapes collectives** vivent dans `portfoliosEquipe/{PFE-{devoirId}-{equipeId}}`
  (plan du 20/09) ; **étape 2 du chantier**, l'étape 1 ne fait que poser `portee`.
- Écriture **champ par champ** dès l'étape 1 (`PATCH /api/travaux/[id]`, fusion serveur).

### L'activité (`Devoir`) et l'atelier

- `ATELIERS` : atelier **`portfolio`**, dispositif `sequence`, dans la popup (après la
  conceptualisation). `estPortfolio(devoir)` = `atelier === 'portfolio'`.
- `Devoir.portfolio?: { portfolioId?: string; tacheFinale?: string; etapes: PortfolioEtape[] }`.
- ⚠ Tableau de bord : exclure l'atelier `sequence-fle`, **pas** le dispositif `sequence`.

### L'état d'une étape (calcul partagé client/serveur, `src/lib/portfolio-etat.ts`)

```
faite(etape)      = renvoi → copie de l'activité `submitted`
                    dépôts → tous les dépôts obligatoires non vides (groupe → accepté)
                    sans trace → cochée à la main
fermee(i)         = i > 0 && etapes[i-1].verrouille && !faite(etapes[i-1])
                    (le prof et l'aperçu voient tout ouvert)
```

## Côté prof

- **Construire** : l'atelier du serpentin (`SequenceAtelier` généralisé) depuis la carte de
  la matrice (Mes Ressources) ou de l'activité (tableau de bord). Le « + » propose *une
  étape du portfolio* ou *une activité existante*. Clic sur une étape → popup « Étape du
  portfolio » (maquette, vue 3) : section · titre · objectifs · consigne · échéance · IA ·
  **portée** (personnelle / collective) · **« Verrouille l'étape suivante »** · dépôts ·
  ressources.
- **Lire une copie** : colonne 1 = toutes les étapes dépliées avec leur état ; les demandes
  de **groupe** à accepter / refuser en tête. Rail inchangé.

## Fichiers touchés (étape 1)

| Fichier | Quoi |
|---|---|
| `src/types/portfolio.ts` *(nouveau)* | `PortfolioMatrice`, `PortfolioEtape`, `PortfolioDepot`, `PortfolioContenuEleve`, `estPortfolio` |
| `src/lib/portfolio-etat.ts` *(nouveau)* | `faite`, `fermee`, `sommaire()` — pur, testable |
| `src/lib/portfolio-server.ts` *(nouveau)* | matrices (`portfolios`), nettoyage, copie vers une activité |
| `src/app/api/portfolios/route.ts`, `[id]/route.ts` *(nouveaux)* | CRUD des matrices (prof) |
| `src/app/api/devoirs/route.ts`, `[id]/route.ts` | champ `portfolio` ; `ouvertParSequence` étendu aux renvois d'un portfolio |
| `src/app/api/devoirs/[id]/parcours-portfolio/route.ts` *(nouveau)* | ce que l'élève reçoit : étapes filtrées, états, renvois résolus |
| `src/app/api/travaux/[id]/route.ts` | PATCH d'un champ (`reponses.{clé}`, `cochees`, `derniereEtape`), demande de groupe ; **accept/refus** côté prof |
| `src/types/didactique.ts`, `AtelierPicto.tsx` | atelier `portfolio` |
| `src/components/Portfolio/` *(nouveau)* | `PortfolioActivity` (colonne 1), `PortfolioEtape`, `PortfolioDepotTexte`, `PortfolioDepotGroupe`, `PortfolioSommaire` (rail), `PortfolioLecture` (prof), `EtapePortfolioModal` |
| `src/components/SequenceFleBuilder/` | accepte les étapes de portfolio (icônes 🔒 / 👥, « + » à deux choix) |
| `src/app/grilles/page.tsx` + `PortfolioPanel` *(nouveau)* | onglet **Portfolios** de Mes Ressources |
| `src/app/activites/[id]/page.tsx` | branche `estPortfolio` **dans** l'espace à deux colonnes ; onglet `consignes` → `PortfolioSommaire` ; bloc ressources de l'étape |
| `src/components/AssistancePanel/` | libellé « Sommaire du portfolio », rendu du sommaire |
| `src/app/dashboard/page.tsx` | exclure `sequence-fle` et non le dispositif ; carte → atelier |
| `dashboard/travaux/[devoirId]/[travailId]/page.tsx` | branche portfolio en lecture + acceptation des groupes |

Aucune dépendance nouvelle. Aucune règle Firestore (tout passe par `adminDb`).

## Découpage en séances (étape 1 du chantier)

| Séance | Contenu | Ce que JP voit |
|---|---|---|
| **1a** | Types, matrice (Mes Ressources › Portfolios), atelier dans la popup, popup d'étape, copie vers une activité | Il construit la matrice Molière, la donne à la 4C |
| **1b** | Écran élève : colonne 1 (étape, dépôts texte, renvois, sans trace), sommaire cochable, verrou, dernière étape mémorisée | Il la remplit en élève |
| **1c** | Dépôt `groupe` + acceptation prof ; lecture de la copie côté prof | Il déclare un groupe, l'accepte en prof |

Les étapes collectives partagées (`portfoliosEquipe`), la co-édition, les autres dépôts,
la coévaluation et la grille restent les étapes 2 à 7 du plan parent.

## Ce qui reste ouvert (non bloquant)

- **Reverser l'activité dans la matrice** (« enregistrer comme matrice ») : plus tard.
- **Un groupe par portfolio ou par section ?** Molière : un seul groupe (la scène). Étape 1 :
  un groupe par élève et par portfolio.
