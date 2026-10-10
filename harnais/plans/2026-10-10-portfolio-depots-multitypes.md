# 2026-10-10 — Portfolio : dépôts lien, image, tableau, et plusieurs types par dépôt

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-10 et pourquoi.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **validé par JP le 2026-10-10 (« go »)** ; séances a, b et c écrites le jour même (non testées à l'écran).
- **Plan parent** : `2026-09-20-portfolio-apprentissage.md` — étapes 3 (tableau) et 4
  (image, lien). Ce plan les **avance** et ajoute une demande nouvelle.
- **Demande de JP (2026-10-10)** : « tableau, image et lien : les rendre disponibles ; pour
  le dépôt, pouvoir choisir 2 types en même temps, par exemple texte et lien ».
  Option retenue : **A — un dépôt, plusieurs types** (un seul titre, un seul bloc chez
  l'élève).

## Ce que voit le prof

Dans la popup d'étape, la liste déroulante du dépôt devient une rangée de **cases à
cocher** :

```
1  [Constitution de l'affiche            ]   ☑ Texte  ☐ Lien  ☑ Image  ☐ Tableau  ☐ Groupe   ✕
```

- Au moins une case ; **Groupe** est exclusif (le cocher décoche les autres, et
  inversement) : la déclaration de groupe a son propre circuit d'acceptation.
- **Tableau** coché → une ligne apparaît sous le dépôt : « Colonnes : [Réplique] [Didascalie] [+] ».
  Le prof fixe les colonnes, l'élève ajoute les lignes.

## Ce que voit l'élève

Un seul bloc par dépôt (titre, « obligatoire », état), puis, dans l'ordre fixe
texte → lien → image → tableau, une zone par type coché :

| Type | Zone | Rendu |
|---|---|---|
| Texte | champ qui grandit (inchangé) | — |
| Lien | champ d'adresse | YouTube / Drive → **lecteur intégré** (`videoEmbedUrl`, fait aujourd'hui) ; page autorisée par `src/lib/integration.ts` → intégrée ; sinon **lien cliquable** |
| Image | bouton « Choisir une image » (compressée dans le navigateur, ≤ 700 Ko), aperçu, « Remplacer » / « Retirer » | l'image |
| Tableau | les colonnes du prof, une ligne vide au départ, « + Ajouter une ligne », ✕ par ligne | — |

**Dépôt rempli = toutes ses parties remplies** (texte non vide ET lien collé, etc.).
C'est ce qui coche l'étape dans le sommaire. Un tableau est rempli dès qu'une cellule
l'est.

## Ce que voit le prof dans la copie (`PortfolioLecture`)

Chaque partie déposée : le texte, le lien (cliquable + lecteur si vidéo), l'image, le
tableau en lecture.

## Les données

### La matrice / l'activité (`PortfolioDepot`)

```
type TypeDepot = 'texte' | 'lien' | 'image' | 'tableau' | 'groupe'
PortfolioDepot = { id, libelle, consigne?, exemple?, obligatoire?,
                   types: TypeDepot[],        // ← remplace `type`
                   colonnes?: string[] }      // tableau seulement
```

**Pas de script de migration** : les dépôts existants ont `type: 'texte'` ou
`'groupe'`. Le nettoyage serveur (`depotsPourFirestore`) lit l'ancien `type` et le
convertit en `types: [type]` à chaque lecture et écriture ; le client passe par un petit
utilitaire `typesDuDepot(d)` qui accepte les deux formes.

### Ce que l'élève dépose (`Travail.content.reponses`, inchangé dans sa forme)

| Partie | Clé | Valeur |
|---|---|---|
| texte | `{etapeId}/{depotId}` | le texte — **clé actuelle, les dépôts déjà écrits restent lisibles** |
| lien | `{etapeId}/{depotId}/lien` | l'adresse |
| image | `{etapeId}/{depotId}/image` | l'identifiant de l'image |
| tableau | `{etapeId}/{depotId}/tableau` | les lignes, en JSON (`string[][]`) |

La route `PATCH /api/travaux/[id]` fusionne déjà clé par clé : seule la validation
change (nettoyage d'une adresse, d'un tableau).

### Les images — le point RGPD

Les images d'élèves (affiche, selfie-BD, photo d'une carte mentale) peuvent montrer un
visage : **elles ne vont pas dans `ressourceImages`**, servie par une route publique à
lien secret.

- Nouvelle collection **`portfolioImages`** (base64, comme `ressourceImages`) :
  `{ data, mimeType, devoirId, travailId, eleveUid, createdAt }`. Accès serveur
  uniquement → **aucune règle Firestore à écrire**.
- `POST /api/portfolio/image` : l'élève envoie l'image de SA copie (vérifié côté serveur).
  L'image remplacée est supprimée.
- `GET /api/portfolio/image/[id]` **authentifiée** : l'élève auteur, ou le prof de
  l'activité. Une balise `<img>` ne sait pas envoyer le jeton de connexion : l'écran
  télécharge l'image avec le jeton, puis l'affiche (fichier temporaire du navigateur).
- Contenu = production d'élève → **en clair**, comme les textes et les audios (règle du
  projet) ; seul l'accès est restreint.

## Découpage en trois séances, chacune testable

| Séance | Contenu | Test |
|---|---|---|
| **a** | Modèle `types[]` + cases à cocher côté prof + dépôt **lien** + lecture prof | Créer un dépôt « Texte + Lien » ; côté élève, écrire et coller un lien Drive → lecteur ; l'étape se coche quand les deux sont remplis ; les anciens dépôts texte s'affichent toujours |
| **b** | Dépôt **tableau** (colonnes prof, lignes élève) | Tableau « Réplique / Didascalie », ajouter 3 lignes, recharger → elles restent ; le prof les voit |
| **c** | Dépôt **image** (collection, deux routes, compression) | Déposer une photo de téléphone (4 Mo) → compressée, affichée ; le prof la voit ; un autre élève qui devine l'adresse → refusé |

## Fichiers touchés

- `src/types/portfolio.ts` — `TypeDepot`, `types`, `colonnes`, `typesDuDepot`, libellés
- `src/lib/portfolio-server.ts` — nettoyage (`type` → `types`, colonnes)
- `src/lib/portfolio-etat.ts` — `depotRempli` par partie
- `src/app/api/travaux/[id]/route.ts` — validation des nouvelles clés
- `src/components/Portfolio/EtapePortfolioModal.tsx` — cases à cocher, colonnes
- `src/components/Portfolio/PortfolioActivity.tsx` — zones élève
- `src/components/Portfolio/PortfolioLecture.tsx` — lecture prof
- *(nouveaux)* `PortfolioDepotLien.tsx`, `PortfolioDepotTableau.tsx`,
  `PortfolioDepotImage.tsx`, `src/app/api/portfolio/image/route.ts`,
  `src/app/api/portfolio/image/[id]/route.ts`

**Aucune dépendance ajoutée**, aucune règle Firestore, aucun index composite (lecture
d'une image par son identifiant).

## Hors de ce plan

- La **co-édition** du tableau à plusieurs (étape 3 du plan parent) : ici, le tableau est
  personnel. Il deviendra partagé avec les étapes collectives (étape 2).
- Le dépôt **commentaires** (étape 5).
