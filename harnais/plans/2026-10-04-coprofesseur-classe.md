# PLAN — Coprofesseur d'une classe

> **État : ÉCRIT D'UN BLOC le 2026-10-04 (les 5 étapes) — TESTÉ ET VALIDÉ PAR JP le
> 2026-10-04 (« testé et fait »).** Dérogation assumée à la règle « une étape vue avant la suivante » :
> JP a demandé « travaille d'un coup, je vérifierai tout après ». Relu par un agent
> indépendant ; ses 8 constats sont corrigés (voir « Après relecture » en fin de plan).
> Demande de JP : « je me fais remplacer jusqu'à la fin de l'année dans une de mes
> classes ⇒ ajouter un prof de français comme coprofesseur d'une classe, qui ait
> forcément accès à toutes les activités de cette classe ».

## Ce que JP a décidé

- Le partage se fait **par classe**, et le titulaire choisit **le mode** au moment du
  partage (décision du 2026-10-04) :

| Mode | Le coprofesseur peut… |
|---|---|
| **Lecture** | voir la classe, ses élèves, leurs fiches, les activités de la classe et les copies — sans rien toucher |
| **Écriture** | corriger, **publier les corrigés**, **ouvrir / fermer** (et l'échéance), **archiver**, cocher **non rendu** — **pour sa classe uniquement** — et **créer ses propres activités** pour la classe (tranché le 2026-10-04) |

- **Le coprofesseur ne modifie JAMAIS les activités du titulaire** (consignes,
  questionnaire, grille, ressources) — décision du 2026-10-04 : « il ne peut modifier
  les activités que j'ai créées, juste les corriger, les archiver, les classer ».
  Tout ce qu'il fait passe donc par la **session** (activité × sa classe), jamais par
  le document de l'activité.
- Seul le **titulaire** (propriétaire de la classe) partage, change le mode ou retire
  l'accès — comme pour les œuvres.

## Le constat qui dimensionne le chantier

Aujourd'hui, **tout est rangé par propriétaire** (`profId`) et chaque route refait sa
propre comparaison : il n'existe **aucun helper commun** pour les classes, activités ou
copies. Une trentaine de points de contrôle sont concernés (cartographie complète
faite le 2026-10-04). Trois pièges en sortent :

1. **Les activités désignent leurs classes par NOM**, et un nom n'est unique que pour
   un même prof. `syncSessions` et `ensureTravaux` cherchent la classe par
   (`profId` de l'activité, nom) — c'est juste pour le titulaire, il faut juste ne pas
   le casser.
2. **`POST /api/corrections` réécrit la correction avec `profId` = l'appelant.** Si le
   coprofesseur corrige, la correction devient la sienne et **le titulaire reçoit un
   403** en voulant la retoucher à son retour.
3. **Le PATCH d'une activité répercute `disponible`, `corrigeDisponible`, `archive`
   sur TOUTES ses sessions.** Une activité donnée à la 4A (partagée) et à la 4B (pas
   partagée) : le coprofesseur qui la ferme fermerait aussi la 4B.

Et un constat de sécurité, **antérieur à ce chantier** : plusieurs routes ne vérifient
aucun propriétaire — n'importe quel compte prof peut y lire les copies de n'importe
quelle classe (`GET /api/travaux`, `GET /api/travaux/[id]`, `GET /api/corrections?travailId`,
`POST /api/corrections`, `GET /api/ai/grid-eval`, `GET /api/navigkid/reponse` et
`/questionnaire`). Données de mineurs : on les ferme **en même temps**, puisque le
helper d'accès en donne enfin le moyen.

## Modèle

Sur le document `classes/{id}`, calqué sur `oeuvres.partages[]` :

```typescript
partages?: { email: string; nom?: string; mode: 'lecture' | 'edition' }[];
partageEmails?: string[];   // les mêmes emails, à plat — c'est ce champ qu'on interroge
                            // (array-contains), Firestore ne sait pas chercher dans un
                            // tableau d'objets. Index simple automatique, pas de composite.
```

Absent = classe non partagée : **aucune migration**.
Pas de date de fin : la classe est annualisée, et l'accès du remplaçant à l'app se borne
déjà par l'`expiresAt` de son compte (`/admin` › Gestion des membres).

## Un seul helper d'accès — `src/lib/classe-acces.ts`

C'est le cœur du plan : **toutes** les routes passent par lui, plus aucune comparaison
`profId` écrite à la main pour ces collections.

| Fonction | Rôle |
|---|---|
| `accesClasse(classe, auth)` | `'titulaire' \| 'edition' \| 'lecture' \| null` (admin = titulaire) |
| `classesAccessibles(auth)` | mes classes + celles partagées avec moi (`partageEmails array-contains`) |
| `accesDevoir(devoir, auth)` | titulaire de l'activité, ou coprofesseur d'**au moins une** de ses classes — avec la liste de **ces** classes |
| `accesTravail(travail, auth)` | par la **session** de la copie (`travail.sessionId` → classe) : je ne vois que les copies des classes qu'on me partage |

Règle de portée : un coprofesseur ne voit et ne touche **que les sessions, copies et
corrections de la classe partagée**, jamais celles des autres classes de la même
activité.

## Étapes

> Règle du macro-plan : **une étape n'avance pas tant que la précédente n'a pas été vue
> à l'écran par JP.** Pour tester : un second compte prof (le remplaçant, ou un compte de
> test ajouté dans `/admin`).

### Étape 1 — Partager une classe, et la voir partagée
- Helper `classe-acces.ts` + normalisation des partages (minuscules, sans doublon,
  mode `lecture` par défaut, jamais `undefined`).
- `/classes`, côté titulaire : bouton **« Partager »** sur la classe → popup de choix
  dans l'existant (liste des collègues, `GET /api/professeurs/collegues`) + mode
  Lecture / Écriture — **reprise de `OeuvrePartageModal`**. Le collègue reçoit une
  annonce dans sa cloche (`poserAnnonce`, cible `collegue`).
- `/classes`, côté coprofesseur : bloc **« Classes partagées avec moi »** (nom du
  titulaire, mode), détail de la classe, liste des élèves, **fiche élève**
  (`profil-target.ts` passe par `accesClasse`).
- En lecture : aucun bouton d'action (renommer, supprimer, importer, ajouter un élève).

### Étape 2 — Les activités de la classe et leurs copies (lecture)
- `/dashboard` du coprofesseur : un panier **« Activités de mes classes partagées »**,
  séparé des siennes.
- Page des copies `/dashboard/travaux/[devoirId]` : ouverte au coprofesseur, **limitée
  aux sessions de la classe partagée**.
- Page de correction d'une copie : visible, **en lecture seule** en mode Lecture.
- Bloc « Activités » du détail de la classe (`/api/sessions?classeId`) : par la classe,
  plus par `session.profId`.
- **Fermeture des trous existants** (liste ci-dessus) via `accesTravail` / `accesDevoir`.

### Étape 3 — Le mode Écriture
- Corriger : la correction garde le `profId` **du titulaire de l'activité** et note
  qui l'a faite (`correcteurUid`) — le titulaire reprend la main à son retour.
- Archiver et classer **par session** (les bascules de session existent déjà :
  `PATCH /api/sessions/[id]`) — jamais par les bascules globales de l'activité, qui
  toucheraient les autres classes. `PATCH` et `DELETE /api/devoirs/[id]` restent
  **réservés au titulaire**.
- Pas de bouton ✏️ ni de suppression sur les cartes d'activités du titulaire.

### Étape 4 — Le coprofesseur crée SES activités pour la classe
*(tranché le 2026-10-04 : « c'est l'intérêt »)*

Le seul vrai changement de mécanique du chantier. Aujourd'hui, `syncSessions`
(`session-server.ts`) et `ensureTravaux` (`precreate-travaux.ts`) traduisent les NOMS de
classes d'une activité en cherchant « la classe de ce nom **chez l'auteur** de
l'activité ». Une activité du remplaçant ne trouverait donc jamais la classe du
titulaire : ni session, ni copies.

- **Une seule fonction de résolution**, `classesDeLActivite(devoir)` : les classes de ce
  nom **possédées par l'auteur OU partagées avec lui en mode Écriture**. `syncSessions`
  et `ensureTravaux` l'appellent toutes les deux (elles avaient chacune leur copie de la
  même requête). L'email de l'auteur se lit par `adminAuth.getUser(profId)`.
- ⚠ `ensureTravaux` est aujourd'hui appelé avec **l'uid de l'appelant** (`travaux/route.ts`),
  pas avec l'auteur de l'activité : à corriger au passage.
- **Homonymie** : si le remplaçant a déjà une classe « 4A » à lui, la « 4A » partagée
  serait indiscernable par le nom. Le menu des classes du formulaire de création
  (`ClassesDropdown`) l'affiche alors **grisée, avec l'explication** — pas de devinette.
- Côté élève : **rien à changer**, l'élève voit déjà les activités par nom de classe.
- **Le titulaire voit les activités du remplaçant** sur sa classe (à son retour, c'est
  tout l'objet) : il corrige, publie, ouvre/ferme, archive pour sa classe — mais, par
  symétrie avec la règle de JP, **ne modifie pas** une activité qu'il n'a pas créée.
  *(Confirmé par JP le 2026-10-04.)*
- Le formulaire de création propose la classe partagée **en mode Écriture seulement**.

### Étape 5 — Le reste de la vie de la classe
- Notifications de remise pour le coprofesseur (`/api/notifications`).
- Compétition et sondage en direct pilotés par le coprofesseur (`accesManche`,
  `ouvrirManche`).
- **Certifications de la classe** *(tranché le 2026-10-04 : oui)* — en mode Écriture, le
  coprofesseur **saisit les notes** des certifications qui visent la classe partagée,
  **sans voir ni modifier la scénarisation** du titulaire. Aujourd'hui tout part de
  `scenarisations where profId == uid` (`certifications/classe`, `certifications/notes`,
  `certification-server.ts`) : la recherche se fera par **le titulaire de la classe**
  quand l'appelant en est coprofesseur. La note garde le `profId` du titulaire (même
  règle que les corrections), la popup `CertificationNotesModal` est réutilisée telle
  quelle depuis le bloc « Certifications » du détail de la classe. En mode Lecture : les
  notes se voient, ne se saisissent pas.

## Questions ouvertes (à poser une à la fois)

1. ~~Modifier une activité donnée à plusieurs classes~~ — **tranché le 2026-10-04 :
   jamais**, il ne modifie aucune activité du titulaire.
1 bis. ~~Périmètre du mode Écriture~~ — **tranché le 2026-10-04** : corriger, publier
   les corrigés, ouvrir / fermer, archiver, non rendu — tout par la session de sa classe.
   ⚠ `nonRendu` s'écrit sur la COPIE (`PUT /api/travaux/[id]`) : `accesTravail` en mode
   `edition` suffit, la copie appartient forcément à la classe partagée.
2. ~~Créer des activités~~ — **tranché le 2026-10-04 : oui** (étape 4).
3. ~~Certifications~~ — **tranché le 2026-10-04 : oui** (étape 5).

**Toutes les questions sont tranchées.**

## Hors périmètre

- `firestore.rules` : aucune collection concernée n'est lue côté client (tout passe par
  `adminDb`) → **aucune règle à déployer**. (Constat en passant : les règles actuelles
  donnent à tout prof lecture/écriture sur `classes`, `eleves` et `devoirs` côté client —
  à resserrer un jour, sans urgence puisque aucun écran ne s'en sert.)
- Les homonymes de classes entre profs différents côté élève (problème déjà présent,
  non aggravé).

## Après relecture (2026-10-04)

Ce qui a changé par rapport au plan, à connaître avant de toucher au code :

- **Être l'auteur ne suffit plus.** Un remplaçant qui a créé une activité pour la classe
  du titulaire perd l'accès à ses copies le jour où le titulaire le retire (ou le repasse
  en lecture) : `droitDeLAuteur` dans `classe-acces.ts`. Même borne pour les bascules
  globales de l'activité (`PATCH /api/devoirs/[id]` ne descend plus que sur les sessions
  que l'auteur contrôle encore), les parties en direct, les notifications.
- **`aEuDesCoprofs`** sur la classe : posé au premier partage, jamais retiré. C'est lui
  qui garde au titulaire, après le départ du remplaçant, le panier des activités de
  celui-ci — et qui fait descendre un **renommage** de classe sur elles.
- **Le mode Lecture se décide par COPIE** (`monAcces` de `GET /api/travaux/[id]`) et
  par session (`monAcces` de `GET /api/sessions`) — une même activité peut viser une
  classe partagée en écriture et une autre en lecture.
- **Homonymes** : deux classes partagées du même nom (deux titulaires) ne sont
  rattachées à aucune activité ; le formulaire les grise.

## Limites connues (non traitées)

- Une ANCIENNE activité de l'auteur qui vise une classe qu'il a **supprimée** se
  rattacherait à une classe partagée homonyme. Cas rare ; à surveiller.
- `GET /api/grilles/{nom}` cherche la grille par nom sans préférer celle de l'auteur :
  si le remplaçant a une grille du même nom que la tienne, il peut charger la sienne en
  corrigeant ton activité (problème antérieur, pas aggravé).
- Un coprofesseur n'envoie pas de « mot » aux élèves de la classe (`estMonEleve`).

## Scénario de test (à dérouler par JP)

Il faut **deux comptes prof** : le tien et celui du remplaçant (ou un compte de test
ajouté dans `/admin` › Gestion des membres).
1. Mes Classes › 👥 sur la classe → choisir le collègue, mode **Lecture** → Enregistrer.
2. Côté collègue : cloche (annonce), Mes Classes › « Classes partagées avec moi », détail
   de la classe (bandeau, aucun bouton de gestion), fiche d'un élève, bloc Activités.
3. Côté collègue : tableau de bord › « 👥 Activités de mes classes partagées » → page des
   copies (bandeau, bascule « Corrigé visible » grisée) → une copie (badge « Lecture
   seule », rien ne s'enregistre).
4. Repasser le collègue en **Écriture** : il corrige, publie, ouvre/ferme et archive via
   « Ouvrir, publier, archiver pour ma classe », saisit une note de certification.
5. Côté collègue : créer une activité en cochant ta classe (« — classe de … ») ; un élève
   de ta classe la voit ; toi, tu la vois dans ton panier partagé et tu la corriges.
6. Retirer le collègue : il ne voit plus rien de ta classe, même sur son activité ; toi,
   tu gardes son activité dans ton panier.
