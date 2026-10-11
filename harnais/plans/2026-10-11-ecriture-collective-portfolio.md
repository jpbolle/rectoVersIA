# 2026-10-11 — Portfolio : écriture collective et extrait dans l'éditeur

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-11 et pourquoi.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **ÉCRIT et TESTÉ de bout en bout par JP le 2026-10-11** (copie de groupe : « concluant »).
  Validé le même jour (« plan approuvé … si ok, ces ajouts, go »), avec
  trois ajouts : le **sélecteur de scène** (phase 0), la **passerelle remise → soumission de l'étape**
  (phase 1 bis) et l'**export PDF** de la copie d'écriture (phase 4, approche à trancher).

## Le besoin (JP)

Portfolio « Interpréter Molière! », étape 8 « Adaptation du texte » (atelier d'écriture) :
1. l'élève (le groupe) retrouve **dans l'éditeur** l'extrait que le prof lui a attribué à
   l'étape 4 (« Extrait choisi » — une scène, pas l'œuvre entière), pour le moderniser ;
2. si l'étape est **collective**, le groupe écrit **une seule copie** : « on ne va pas leur
   demander de copier-coller ce que le secrétaire a fait ».

## Ce qui existe déjà (vérifié)

| Brique | Où | Ce qu'elle donne |
|---|---|---|
| Valeur « Extrait choisi » attribuée **au groupe** | `portfolioSuivi/{portfolio}__G-{groupe}` (`valeurs`) | référence `{oeuvreId, sectionId}` — la scène seule |
| Texte de la scène | `/api/portfolio/valeur` → blocs `OeuvreBloc` | `vers` = une réplique, `locuteur` = le personnage ; `texte` = HTML |
| « Afficher dans cette étape » | `etape.affiche: [{valeurId, place: 'travail' \| 'ressources'}]` | aujourd'hui : seulement lu dans l'onglet Ressources de l'activité |
| Groupe accepté de l'élève | `cibleSuivi()` / `groupeDe()` | les uid des membres |
| Portée de l'étape | `etape.portee: 'collective'` | **une étiquette 👥, sans effet** |
| Copie d'écriture | `travaux` (une par élève), `useTravail` (enregistrement 2,5 s), `WorkEditor` (Tiptap, HTML) | aucune notion de groupe ni de verrou |

## Phase 0 — l'élève choisit sa scène dans la bibliothèque (ajout de JP)

- Nouveau type de dépôt **« Scène d'une œuvre »** : le prof choisit l'œuvre (ici l'anthologie
  Molière) ; l'élève choisit **la pièce** puis **la scène** dans deux menus — plus de champ libre.
- Le texte de la scène choisie apparaît dans l'onglet **Ressources** (« Ta scène »).
- Sous le dépôt, un encadré : « 📖 Vérifie dans l'onglet Ressources que c'est bien le bon texte » +
  bouton qui ouvre l'onglet.
- Côté prof, à la validation : la valeur « Extrait choisi » est **pré-remplie** avec la scène de
  l'élève (le prof confirme ou corrige). ⇒ on ne peut plus se tromper de texte.

## Phase 1 — l'extrait dans l'éditeur (valable aussi en individuel)

- **Réglage** : aucun nouveau. Dans la popup de l'étape, « Afficher dans cette étape » →
  **« colonne de travail »** sur une étape-activité d'**écriture** = l'extrait est **posé dans
  l'éditeur**. (Pour l'étape 8, il suffira de cocher « Extrait choisi » → colonne de travail.)
- **Quand** : à la première ouverture, **si la copie est vide** — une seule fois, jamais par-dessus
  ce que l'élève a écrit. Côté serveur, dans `GET /api/travaux/mine`, au moment où la copie naît
  (ou est vide).
- **Forme** : une réplique par paragraphe, **le personnage en petites capitales gras**, puis le
  texte (`<p><strong>SGANARELLE</strong> — …</p>`) ; les blocs `texte` repris tels quels ; images,
  vidéos et sons ignorés. Le titre de la scène en tête.
- L'extrait reste aussi lisible dans l'onglet Ressources (« De ton portfolio »), intact.

## Phase 1 bis — passerelle : remettre l'activité = soumettre l'étape (ajout de JP)

L'atelier d'écriture a déjà « Remettre ma copie ». Ouverte depuis un portfolio, la remise **soumet
aussi l'étape** au prof (même effet que « Soumettre au professeur » : notification « à valider ») —
plus de second clic dans le portfolio.

## Phase 2 — la copie de groupe, la main tourne

**Quand** : l'étape-activité est **collective** ET l'élève a un groupe **accepté** de 2 élèves ou
plus. Sinon (pas de groupe, groupe en attente, travail seul) : copie individuelle, comme aujourd'hui.

**Où vit le texte** — proposition : **copies miroirs**.
- Un document neuf `ecrituresGroupe/{activité}__G-{groupe}` : le texte commun, **qui a la main**
  (uid + prénom), jusqu'à quand, un numéro de version.
- Chaque membre **garde sa copie** dans `travaux` ; le serveur y **recopie** le texte commun à chaque
  enregistrement. Pourquoi : la correction, l'onglet Corrigé, le tableau d'évolution, l'état de
  l'étape, le profil lisent tous la copie individuelle — on n'y touche pas.
- Accès **serveur uniquement** (`adminDb`) : **aucune règle Firestore** à écrire.

**La main** :
- Personne n'a la main → le premier qui clique dans l'éditeur la prend (pas de bouton à chercher).
- Celui qui a la main écrit ; enregistrement toutes les **1,5 s** de pause ; chaque enregistrement
  prolonge la main.
- Elle se libère **seule après 60 s sans frappe** (onglet fermé, élève parti), ou par
  **« Je rends la main »**.
- Les autres : éditeur **en lecture**, texte **rafraîchi toutes les 3 s**.
- Prise de main **atomique** (transaction Firestore) : deux élèves qui cliquent ensemble → un seul
  l'obtient, l'autre reste en lecture. **Jamais d'écrasement.**

**La pastille** (JP) — en-tête de la colonne de gauche (« Mon travail » devient « Notre travail ») :
- `✍️ Léa est en train d'écrire…` (ambre) chez les autres ;
- `✍️ Tu as la main · Je rends la main` chez celui qui écrit ;
- `👥 Personne n'écrit — clique dans le texte pour prendre la main` quand elle est libre.

**Remettre** : un membre remet → **toutes les copies du groupe** passent « remises » (la popup de
confirmation le dit : « pour tout le groupe »). L'étape du portfolio se coche pour tous (le suivi est
déjà commun au groupe).

## Phase 3 — le prof corrige une fois

- Les copies du groupe portent la marque du groupe. Ce que le prof fait sur **l'une** — corriger,
  annoter, « Rendre comme corrigé », « Renvoyer pour réécriture », verrouiller — est **reporté sur les
  autres** (la correction `CORR-…` est dupliquée sur chaque copie : même texte, mêmes annotations).
- Dans la copie, une ligne « 👥 Copie du groupe : Léa, Tom, Inès ».
- Tableau d'évolution : les cases des membres mènent à la même copie corrigée.

## Phase 4 — export PDF de la copie d'écriture (ajout de JP, général)

Un bouton « Télécharger en PDF » dans l'atelier d'écriture (pour les répétitions). **Approche à
trancher avec JP** (impression du navigateur sans dépendance, ou bibliothèque PDF).

## Coûts et risques

| Point | Évaluation |
|---|---|
| Dépendance nouvelle | **Aucune** |
| Charge | 1 lecture Firestore par élève toutes les 3 s pendant l'étape — négligeable pour une classe |
| Règles / index Firestore | aucune règle ; un index composite peut-être (à vérifier à l'écriture) |
| Ce qui ne marche pas | deux élèves qui écrivent **en même temps** dans le même texte — c'est le principe de l'option A |
| Rupture | aucune : une étape non collective, ou un élève sans groupe accepté, garde la copie individuelle |
| Taille | phase 1 petite ; phase 2 la plus grosse (serveur + éditeur) ; phase 3 moyenne |

## Ordre

Prévu : par séries, avec un test entre chacune. **Changé par JP le 2026-10-11** : tout écrit d'un coup
(recréer un portfolio à chaque test est trop lourd), puis test de bout en bout avec LF07. PDF : impression
navigateur (choix de JP).
