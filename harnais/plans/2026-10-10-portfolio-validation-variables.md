# 2026-10-10 — Portfolio : validation du prof, retours, valeurs attribuées, suivi

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-10 et pourquoi.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **validé par JP le 2026-10-10 ; les 4 phases écrites le soir même** (non testées à l'écran).
- **Plans liés** : `2026-09-20-portfolio-apprentissage.md` (parent),
  `2026-10-10-portfolio-depots-multitypes.md` (dépôts texte · lien · image · tableau).

## Ce que JP a dit (2026-10-10, soir)

| Sujet | Réponse de JP |
|---|---|
| La validation bloque-t-elle la suite ? | **Au choix du prof, étape par étape** (« pas toujours le cas ») |
| Valider = attribuer quelque chose ? | Oui, **une valeur réutilisable** dans la suite du portfolio : un **texte** de la bibliothèque (œuvre ou extrait), un **lien**, une **vidéo**, une **page intégrée** (iframe) |
| Pour qui ? | **Propre au groupe** |
| Combien ? | **Plusieurs, chacune nommée** (« Le sketch », « La captation ») |
| Où le prof valide | **Depuis la copie** de l'élève (option A), dans la colonne de travail : un encadré avec boutons d'action, champ commentaire, lien / ressource / iframe, et pour une œuvre un **menu déroulant** « l'œuvre ou ses extraits » (le texte de l'extrait n'est pas affiché là) |
| Ce que voit l'élève | Le retour du prof (validation + commentaire) dans **l'étape en cours, encadré ambre, colonne de gauche** ; dans le **sommaire**, une icône **bulle** (commentaire) et une icône **✓** (validation) |
| Et ensuite | « Il va de soi » : un **tableau d'évolution des portfolios** pour le prof, avec **notifier / écrire** aux élèves en retard ou les **féliciter** (comme le suivi de lecture d'une œuvre : ❤️…) |

## « Soumettre au professeur » (ajout de JP, 2026-10-10)

À **toute étape avec des dépôts ou une activité** (pas aux étapes sans trace, qui gardent « J'ai
fait cette étape »), l'élève — ou un membre du groupe, pour tout le groupe — clique **« Soumettre
au professeur »** quand il a fini.

- **Où** : dans la colonne de travail (gauche), sous les dépôts, dans la **ligne d'action à deux
  traits** du projet — un trait à gauche, le bouton, un trait à droite, sur la même ligne, qui ne
  touche pas les bords de la colonne (`init.md` § conventions, modèle `bottomActions` de
  `VocabulaireActivity.module.css`).
- **Quand** : actif dès que les dépôts obligatoires sont remplis (étape à dépôts) ou que
  l'activité est remise (renvoi). Avant, il est grisé et dit ce qui manque.
- **Effet** : notification au prof (cloche) ; **point** sur l'étape dans le tableau de
  progression ; l'étape devient **« soumise »**.
- **Étape faite = soumise** (et, si « la suite attend ma validation », **validée**).
- **Après un refus (✗)** : l'étape repasse « à reprendre » ; l'élève corrige et **soumet à
  nouveau** → **« à revoir »** chez le prof (remplace la règle « dès qu'il modifie »).

Cycle d'une étape : à faire → en cours → **soumise** → **validée ✓** ou **à reprendre ✗** →
(nouvelle soumission) → **à revoir** → validée…

## Les notions

- **Retour du prof sur une étape** : `decision` (`valide` | `refuse`), une **appréciation**
  facultative (😀 😐 🙁), un **commentaire** facultatif, la date — et la date de la dernière
  modification de l'élève, pour savoir si l'étape est **« à revoir »** après un refus. Un retour par étape et par groupe (ou par élève sans
  groupe).
- **Valeur attribuée** (« variable ») : déclarée par le prof **dans l'étape qui la donne**
  (nom + genre), remplie **à la validation** pour chaque groupe. Genres : `oeuvre` (une œuvre
  entière ou un extrait), `lien`, `video` (YouTube / Drive), `integration` (page de la liste
  blanche, Genially…).
- **Affichage d'une valeur** : déclaré dans **les étapes suivantes** : « Afficher : ☐ Le sketch
  ☐ La captation », et pour chacune **où** : colonne de travail (au-dessus des dépôts) ou onglet
  Ressources (colonne de droite).

## Ce que voit le prof

**Popup d'étape**, nouveau bloc « Validation » :

```
☐ Je valide cette étape
    ☐ La suite attend ma validation          (l'étape suivante reste fermée jusque-là)
    Cette validation attribue :  [Le sketch      ] [Texte de la bibliothèque ▾]  ✕
                                 + une valeur
```

et, dès qu'une étape **précédente** attribue des valeurs, un bloc « Afficher dans cette étape » :

```
☑ Le sketch      [Colonne de travail ▾]
☐ La captation
```

**Copie d'un élève** (page de correction, `PortfolioLecture`) : sous chaque étape à valider,
l'encadré de validation (pour un groupe, il vaut pour tous ses membres — le rappeler) :

```
[✓ Valider]  [✗ Refuser]   😀 😐 🙁
Commentaire : [____________________________________]
Le sketch : [Les Fourberies de Scapin ▾] [Acte II, scène 7 ▾]     (œuvre)
La captation : [https://drive.google.com/…         ]              (lien / vidéo / iframe)
```

## Ce que voit l'élève

- **Étape en cours, colonne de gauche** : un **encadré ambre** « Retour du professeur » —
  ✓ validé / ✗ à reprendre, l'appréciation, le commentaire.
- **Sommaire du portfolio** (colonne de droite) : sur la ligne de l'étape, 💬 si commentaire,
  ✓ si validée.
- **Valeurs affichées** : le texte de l'œuvre (rendu comme dans la liseuse), le lien cliquable,
  la vidéo en lecteur, la page intégrée — là où le prof l'a demandé.
- **Étape « la suite attend ma validation »** : faite seulement quand le prof a validé ; le
  message de verrou le dit (« Il manque : la validation du professeur »).

## Les données

| Où | Quoi |
|---|---|
| `PortfolioEtape.validation?` | `{ active, bloquante, attribue: [{ id, nom, genre }] }` |
| `PortfolioEtape.affiche?` | `[{ variableId, place: 'travail' \| 'ressources' }]` |
| **`portfolioSuivi/{devoirId}-{groupeId ou uid}`** *(nouveau, serveur seulement)* | `soumissions: { [etapeId]: { date, parUid, n } }` (n = nombre de soumissions), `retours: { [etapeId]: { decision, appreciation?, commentaire?, date } }`, `valeurs: { [variableId]: { genre, oeuvreId?, sectionId?, url?, titre } }` |

Un document **par groupe** : une seule vérité pour tous ses membres, comme les dépôts d'équipe
prévus au plan parent. Accès serveur uniquement → **aucune règle Firestore**. Index : lecture
par identifiant composé, **aucun index composite**.

**Le texte d'une œuvre n'est jamais recopié** : la valeur garde la référence (`oeuvreId`,
`sectionId`) et le texte est servi par une **route qui vérifie que l'élève y a droit** (la
valeur est attribuée à son groupe). Aujourd'hui, un extrait choisi dans la bibliothèque est une
copie de texte sans origine — ce n'est pas réutilisable ici.

## Découpage

| Phase | Contenu | Visible à la fin |
|---|---|---|
| **1** | **Soumettre au professeur** (bouton, notification) + retour du prof : réglage « Je valide » / « la suite attend », encadré de validation dans la copie, encadré ambre chez l'élève, 💬 et ✓ dans le sommaire, verrou | L'élève soumet ; le prof est notifié, valide ou refuse ; l'élève voit le retour ; l'étape suivante s'ouvre |
| **2** | Valeurs attribuées : déclaration dans l'étape, choix à la validation (œuvre / extrait, lien, vidéo, iframe), affichage dans les étapes suivantes (colonne de travail ou Ressources) | Attribuer « Le sketch » ; il apparaît dans l'étape 5 du groupe, et seulement du sien |
| **3** | Les **activités renvoyées** reçoivent les valeurs (un questionnaire de compréhension, un atelier d'écriture montrent le sketch du groupe) : le serveur retrouve, à l'ouverture de l'activité, le portfolio qui y renvoie et les valeurs du groupe ; affichage dans l'onglet Ressources | Ouvrir le questionnaire depuis le portfolio : le sketch est dans Ressources |
| **4** | **Tableau d'évolution** : classe × étapes (fait · en retard · à valider · validé), validation depuis la case, **notifier** un retard, **féliciter** (❤️) — par les notifications nominatives de l'app, comme le suivi de lecture | Toute la classe d'un coup ; une relance arrive dans la cloche de l'élève |

## Points à trancher (un à la fois)

1. ~~Un « extrait » = une scène (section) de l'œuvre ?~~ **Oui (JP, option A)** : le menu
   propose « Œuvre entière / chaque scène ». Pas de nouvel objet « extrait ».
2. ~~Écrire un e-mail aux élèves ?~~ **La cloche seulement, pour l'instant (JP, option A)**.
   L'e-mail viendra plus tard (service d'envoi à choisir). JP : le 💔 du rappel ressemblait
   trop au ❤️ → **même dessin, autre couleur** (bleu-gris), fait dans `OeuvreSuivi` le
   2026-10-10 et à reprendre dans le tableau du portfolio.
3. ~~Smileys ?~~ **✓ Valider / ✗ Refuser**, plus une **appréciation à trois niveaux 😀 😐 🙁**
   (facultative) — JP.
4. ~~Que fait un refus ?~~ **Option A (JP)** : l'étape repasse **« à reprendre »** (plus cochée,
   étiquette orange, commentaire dans l'encadré ambre). Dès que l'élève modifie un dépôt, elle
   devient **« à revoir »** et remonte chez le prof. Une étape bloquante garde la suite fermée
   jusqu'à la validation.

## Hors de ce plan

Co-édition des dépôts d'équipe, grille d'évaluation sur le portfolio entier (étapes 2-3 et 7
du plan parent).
