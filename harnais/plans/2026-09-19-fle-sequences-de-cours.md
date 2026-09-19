# PLAN — Modules FLE › « Séquences de cours » : le serpentin en atelier

> Statut : ✅ **VALIDÉ (« go ») et ÉCRIT le 2026-09-19 — étapes 1 à 3, rien vu à l'écran.**
> `tsc`, lint des fichiers touchés et `npm run build` passent.
> Suite de [`2026-09-19-fle-theorie-et-activites.md`](2026-09-19-fle-theorie-et-activites.md).
>
> **Puis, même jour — cartes harmonisées** (demande JP : « vérifier que le css/design des
> cards dans les ressources sont similaires ») : activités et séquences FLE passent sur
> `ActiviteRessourceCard` (styles d'`OeuvreCard`, sans interrupteurs ; 👁 corrigé visible
> pour une activité, pastille Ouverte/Fermée pour une séquence) ; questionnaires de lecture
> réalignés (grille 260/16, icône 32, titre vert 700, boutons 40 × 36 centrés, 🗑️ rouge) ;
> la carte « + » de tous les onglets récents = `CreateOeuvreCard libelle`. `iconeAtelier`
> déplacé dans `src/types/sequence-fle.ts`.

### Ce qui a été écrit

- `RessourcesFlePanel` : troisième bouton **🧭 Séquences de cours**, `?section=sequences`.
- `SequencesFlePanel` : cartes des activités `typeTravail: 'sequence'` (actives / archivées),
  « + Créer une séquence » → `CreationForm atelierInitial="sequence-fle"` ; après création,
  l'atelier s'ouvre aussitôt. `DevoirCard onOuvrir` remplace la navigation vers les copies.
- `SequenceAtelier` : barre (← Séquences de cours · intitulé · état ✓ Enregistré /
  Modifications… / ⚠ · ✏️ Réglages), classes, `ElevesChoix`, `SequenceFleBuilder`.
  Enregistrement automatique : PATCH `{ sequenceFle, eleves }` différé de 800 ms, envoi
  forcé au retour, avant les réglages et au démontage ; une charge qui échoue est gardée.
  Après la popup ✏️ Réglages : `refetch` puis l'atelier est **remonté** (clé `version`) sur
  la séquence relue — elle a pu toucher au parcours.
- Encadrés : `SequenceFleBuilder onOuvrirEtape` rend le titre cliquable. Théorie →
  `ModuleFleEditor` pleine page (`libelleRetour="← Retour à la séquence"`, lecture seule
  si `profId` ≠ uid) ; activité → `EditDevoirModal`. Les titres affichés sont
  **superposés** depuis la liste des activités et les points relus (`modulesFrais`) —
  aucun effet de resynchronisation ; l'étape enregistre le titre frais à la prochaine
  modification du parcours.

## Demande de JP (2026-09-19)

« Dans ressources, un 3e onglet, assez logique, "Séquences de cours" qui reprend les
activités "Séquence FLE" : dedans, c'est le serpentin avec ces points théoriques et ces
activités qui renvoient aux ressources théorie. »

## Points tranchés

1. Les séquences restent **aux deux endroits** : Mes Activités garde leur carte (ouverture
   aux élèves, classes, échéance — c'est ce que la classe reçoit) ; Modules FLE › Séquences
   de cours est l'**atelier** où on les compose.
2. Clic sur un encadré du serpentin : la ressource s'ouvre **sur place**, avec
   « ← Retour à la séquence » ; le serpentin relit alors les titres modifiés.

## Ce qu'on fait

**Mes Ressources › Modules FLE** : la bascule passe à trois — **Points de théorie ·
Activités · Séquences de cours**, `?section=sequences` compris.

**`SequencesFlePanel`** (neuf) :
- Liste : les activités `typeTravail: 'sequence'` du prof, en `DevoirCard` (mêmes bascules
  qu'au tableau de bord). Carte « + Créer une séquence » → `CreationForm` dans la page,
  **atelier « Séquence FLE » présélectionné** (nouvelle prop `atelierInitial`). Archivées
  à part.
- **Clic sur une carte = ouvrir l'atelier de la séquence** (et non les copies : une
  séquence n'en a pas) — `DevoirCard` gagne une prop `onOuvrir` qui remplace la
  navigation.
- **L'atelier, pleine page** : barre « ← Séquences de cours » · intitulé · classes ·
  menu **Élèves concernés** (`ElevesChoix`, qui fournit aussi les élèves aux restrictions
  par étape) · ✏️ réglages (la popup habituelle) · état d'enregistrement. Dessous, le
  **serpentin en grand** (`SequenceFleBuilder`), enregistré **automatiquement** (PATCH
  `sequenceFle`, différé ~800 ms, comme la popup ✏️).
- **Encadrés cliquables** (`SequenceFleBuilder` gagne `onOuvrirEtape`) : point de théorie →
  `ModuleFleEditor` pleine page (lecture seule si le point est d'un collègue) ; activité →
  sa popup ✏️ (`EditDevoirModal`). Au retour : titre et type de l'étape relus.

Rien ne change côté élève ni côté serveur.

## Étapes

1. Bascule à trois + `SequencesFlePanel` (liste, création, carte → atelier).
2. L'atelier : serpentin en grand, élèves concernés, enregistrement automatique.
3. Encadrés cliquables + retour à la séquence.
