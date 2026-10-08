# 2026-10-09 — « Sondage » : l'auto-évaluation devient un sondage nominatif

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-09 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé (« ok », « go ! ») et ÉCRIT le 2026-10-09, rien vu à l'écran**. Choix par défaut sur les trois points ouverts : carte « Sondage » ; en anonyme au rythme de l'élève le prof ne voit qu'un **compte** (jamais qui a envoyé) ; activités de test en base laissées, lues par repli
- **Demande initiale** (JP, 2026-10-09) : « refondre sondage et auto-évaluation dans
  "Sondage" (non coté) : l'auto-évaluation est une sous-partie de sondage, il n'est pas
  anonyme, là où le sondage peut l'être ; tous deux peuvent se faire au rythme du
  participant ou du prof (c'est au prof de décider quand il construit l'atelier). »
  Ni le sondage ni l'auto-évaluation n'ont jamais été utilisés en classe.

## Le problème

- La popup de choix propose **deux cartes** pour **un seul contenu** : les mêmes
  questions (emojis, échelle 1→5, QCM sans bonne réponse, matrice, textes), le même
  constructeur (`AutoEvalBuilder`), le même dispositif (`autoevaluation`). Seule
  l'enveloppe change : l'auto-évaluation est nominative et au rythme de l'élève, le
  sondage est anonyme et au rythme du prof. Le prof croit choisir entre deux activités
  alors qu'il choisit deux réglages.
- Deux combinaisons sont **impossibles** aujourd'hui : une auto-évaluation jouée en
  classe (nominative, au rythme du prof) et un sondage auquel chacun répond quand il
  veut (anonyme, au rythme de l'élève).
- L'asymétrie avec la lecture : la compétition est un **mode** du questionnaire de
  compréhension, le sondage est une **carte**.

## Options

### 1 — Le modèle

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Une carte « Sondage » et deux réglages sur l'activité** : `devoir.sondage = { anonyme: boolean, rythme: 'participant' \| 'prof' }`. L'ancienne auto-évaluation = nominatif + participant ; l'ancien sondage = anonyme + prof | L'atelier `autoevaluation` disparaît de `ATELIERS` ; `estSondage()` (5 aiguillages) se scinde en `estEnDirect()` (rythme prof) et `estAnonyme()`. Les activités déjà en base se lisent **sans migration** : `atelier: 'autoevaluation'` ⇒ nominatif/participant, `atelier: 'sondage'` sans réglages ⇒ anonyme/prof | Les 4 combinaisons existent ; deux sont neuves (voir option 2 et 3) |
| **B — Garder deux cartes, renommer** | Rien à construire | Ne répond pas à la demande : deux cartes pour un contenu, et les combinaisons manquantes restent manquantes |
| **C — Un réglage `rythme` seulement, anonymat déduit** (prof ⇒ anonyme) | Plus simple | Interdit l'auto-évaluation jouée en classe, que JP veut |

**Retenue : A.** Le dispositif `autoevaluation` (`typeTravail`) **ne change pas de nom** :
c'est un identifiant interne présent dans des dizaines de fichiers et dans toutes les
copies en base ; seul l'atelier affiché change.

### 2 — Nominatif au rythme du prof (auto-évaluation jouée en classe)

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Comme la compétition** : la manche se joue, et « Arrêter » **verse les copies dans `travaux`** (`content` JSON `{type:'autoevaluation', answers}`, `submitted`) | L'aval ne change pas : `AutoEvalReview` (le prof répond à l'aveugle), lucidité, onglet « Me connaître ». La manche garde l'identité par élève — elle l'a déjà (un document par élève, pour refuser deux réponses) | Reprendre le versement de `manche-server.ts` pour des réponses `AutoEvalAnswer` ; le prof voit « X / Y ont répondu » avec les noms |
| **B — Sans versement** : les réponses restent dans la manche | Rien de nouveau serveur | Casse la chaîne lucidité/profil, qui est la raison d'être de l'auto-évaluation |

**Retenue : A.**

### 3 — Anonyme au rythme du participant (sondage asynchrone)

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Une manche « libre »** : même collection `manches`, phase `libre` (toutes les questions ouvertes, pas de chrono) ; l'élève répond sur `AutoEvalActivity` et envoie en une fois sur `/api/sondage/reponse` ; **rien dans `travaux`**, rien au profil | Le contrat d'anonymat existant tient : le serveur sait qui a répondu (un document par élève, pour refuser deux envois), **ne le sert jamais** ; le prof voit un compte, pas des noms. Statistiques = `SondageRepartition`, déjà écrit | Une phase de plus dans `sondage-server.ts` ; la carte d'activité ne montre ni copies ni corrigé |
| **B — Interdire la combinaison** en v1 | Rien | JP a dit « tous deux peuvent se faire au rythme du participant » |
| **C — Nouvelle collection** | — | Un deuxième lieu pour la même chose |

**Retenue : A.**

## Ce qu'on fait

1. **Types et liste** — `src/types/didactique.ts` (carte « Sondage », retrait de la carte
   auto-évaluation, `estEnDirect` / `estAnonyme` / `reglagesSondage(devoir)` avec repli sur
   l'ancien `atelier`), `src/types/devoir.ts` (`sondage?: { anonyme; rythme }`), description de
   la carte : « Des questions sans bonne réponse : auto-évaluation nominative ou sondage
   anonyme, au rythme de chacun ou de la classe. »
2. **Constructeur** — `AutoEvalBuilder` : deux commutateurs en tête (Nominatif / Anonyme ·
   Au rythme de l'élève / Au rythme du prof) ; le chrono par question n'apparaît qu'au
   rythme du prof, « obligatoire » qu'au rythme de l'élève ; mode didactique par défaut
   `reflexif` si nominatif, `parler` si anonyme. `CreationForm` / `EditDevoirModal` passent
   les réglages.
3. **Aiguillages** — `/activites/[id]`, `DevoirCard`, `/api/devoirs` et `/api/devoirs/[id]`
   (anti-fuite des questions **seulement** au rythme du prof), page prof `/sondage/[sessionId]`
   ouverte depuis la carte quand rythme prof.
4. **Serveur** — `sondage-server.ts` : versement dans `travaux` à l'arrêt quand nominatif
   (option 2A) ; phase `libre` + réponse en une fois quand anonyme/participant (option 3A).
5. **Évaluation** — nominatif : `AutoEvalReview` / `AutoEvalEvaluation` inchangés ; anonyme :
   l'onglet Statistiques du pilote (`SondageRepartition`) sert aussi à la manche libre.
6. **Trace** — `init.md` (atelier, modèle), `rollup_sondage.md`, `rollup_autoevaluation.md`.

## Ce qu'on ne fait pas dans ce chantier

- Pas de groupes de discussion (décision du 2026-09-08 maintenue).
- Pas de nouveau type de question ; pas de rapprochement avec le questionnaire de
  compréhension (analyse du 2026-10-09 : famille distincte, coté contre non coté).
- Pas de migration des activités existantes : lecture rétrocompatible.
- Pas de renommage du dispositif `autoevaluation` dans le code ni en base.

## Comment on saura que ça marche

- La popup montre **huit** cartes ; « Sondage » ouvre le constructeur avec les deux
  commutateurs.
- Nominatif + élève : le parcours actuel de l'auto-évaluation, inchangé à l'écran.
- Anonyme + prof : le parcours actuel du sondage en direct, inchangé.
- Nominatif + prof : la partie se joue, « Arrêter » fait apparaître les copies dans la
  page des copies, le prof répond à l'aveugle comme d'habitude.
- Anonyme + élève : l'élève répond quand il veut ; la carte prof montre « N réponses »,
  l'onglet Statistiques la répartition, et **aucun nom nulle part**.

## Points à trancher par l'utilisateur

- [ ] Le nom de la carte : « Sondage » tel quel, ou « Sondage / auto-évaluation » ?
- [ ] En anonyme au rythme de l'élève, le prof voit-il **qui a déjà répondu** (sans la
      réponse) pour relancer les retardataires, ou seulement un compte ? (Un compte
      seul protège mieux l'anonymat ; la liste est plus pratique.)
- [ ] Les activités de test déjà en base (atelier `autoevaluation`) restent lisibles par
      repli — faut-il quand même les supprimer pour repartir propre ?
