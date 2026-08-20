# Rollup — Contenus interactifs dans les ressources d'une activité

> Session du 2026-08-20. Demande de JP : pouvoir joindre aux ressources d'une
> activité (a) une page tierce embarquée, comme dans « Lecture d'une œuvre »,
> (b) ses propres petites animations HTML/CSS/JS.
> **Livré, `tsc` / `eslint` / `build` passent. Rien testé à l'écran.**

## Un cinquième onglet : « Interactif »

`RessourcesInput` — à côté de Image · Lien · Texte · Vidéo.

| Nature | Qui peut | Contrôle |
|---|---|---|
| **Adresse** — Genially, TimelineJS, StoryMaps, LearningApps, Padlet… | tous les profs | liste blanche de domaines + HTTPS |
| **Code** — animation HTML/CSS/JS du professeur | **administrateur seul** | 100 000 caractères max |

Coller le bloc `<iframe …>` du bouton « Intégrer » suffit : `urlDepuisIntegration`
en extrait le `src`, `proportionsDepuisIntegration` la largeur et le ratio.
Réglages de taille **identiques à ceux de l'œuvre** (largeur plafond, case
« conserver les proportions », hauteur) — c'est le même objet, il doit se régler
pareil.

Une **ligne vierge est toujours présente en bas de la liste** : elle est tenue
localement tant qu'elle est vide (sinon la pastille « ressource présente »
s'allumerait pour un formulaire jamais rempli, et le serveur — qui écarte les
entrées vides — l'effacerait au premier enregistrement).

## LA décision : deux bacs à sable, pas un

| | `sandbox` | Pourquoi |
|---|---|---|
| Page **tierce** (iframe `src`) | `allow-scripts allow-same-origin allow-popups allow-forms allow-presentation` | `allow-same-origin` y désigne **son** origine à elle, pas la nôtre. Sans lui, la plupart des exerciseurs ne tournent pas. |
| Animation **maison** (`srcdoc`) | `allow-scripts` **seul** | En `srcdoc`, l'origine est celle du parent : `allow-same-origin` rendrait à l'animation l'accès à la session Firebase de l'élève et à nos routes en son nom. |

⚠️ **Ne jamais uniformiser ces deux valeurs.** C'est la même balise, ce n'est pas
le même risque.

## « ↗ Ouvrir en grand »

Route publique `GET /api/ressources/interactif/[devoirId]/[id]`, sur le modèle
de `/api/ressources/image/[id]` : un onglet ouvert par l'élève ne peut pas plus
envoyer d'en-tête d'authentification qu'une balise `<img>`.

L'en-tête **`Content-Security-Policy: sandbox allow-scripts`** place la page dans
une **origine opaque** bien qu'elle soit servie par notre domaine. C'est
l'équivalent, pour un document servi, du `sandbox` de l'iframe.
`window.open` + `document.write`, ou un lien `blob:`, auraient au contraire donné
l'origine de l'application — c'est pour ça que cette route existe.

## Zoom

Boutons − / % / + sous chaque animation (7 crans, 50 % → 200 %). On ne peut rien
piloter **dans** le cadre (le bac à sable coupe tout accès, et c'est voulu) :
on élargit la fenêtre interne (`100 / z` %) puis on la ramène à la taille du
cadre (`scale(z)`). Une infographie responsive se réorganise donc au lieu de
grossir — c'est le comportement d'un vrai redimensionnement. Rien n'est
enregistré : réglage de confort.

## Fichiers

- `src/lib/integration.ts` — **nouveau** : les quatre fonctions d'intégration
  sorties de `src/types/oeuvre.ts` (qui les réexporte, rien n'est cassé) +
  `TAILLE_MAX_CODE`. Module **partagé** : jamais dans un fichier `-server`,
  il est importé côté client.
- `src/lib/ressources-server.ts` — **nouveau** : `sanitizeRessources`. **Le seul
  contrôle qui compte** — liste blanche, plafond de taille, réserve à l'admin.
  Appelé par `POST /api/devoirs` et `PATCH /api/devoirs/[id]`. Toute nouvelle
  route qui écrit `devoirs.ressources` doit y passer.
- `src/app/api/ressources/interactif/[devoirId]/[id]/route.ts` — **nouveau**.
- `src/types/devoir.ts` — `RessourceInteractif`, `DevoirRessource.interactifs`.
- `RessourcesInput` (saisie) · `RessourcesTab` (élève).

## Reste à faire

- Tout tester depuis un compte élève.
- Ajouter des domaines à `DOMAINES_INTEGRATION` au fil des besoins de JP.
- Le champ **Code** ne détecte pas encore un `<iframe>` collé par erreur
  (il faudrait basculer sur « Adresse ») — proposé, pas retenu.
