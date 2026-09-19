# 2026-09-19 — Daspalecte branché sur Recto-versIA (étape 6 du plan FLE)

> ⚠ **Trace datée.** Ce plan détaille l'étape 6 de
> [`2026-09-14-espace-fle.md`](2026-09-14-espace-fle.md). Ce qui existe réellement se lit
> dans `init.md` et `harnais/memoire/rollup_fle.md`.

- **Statut** : validé le 2026-09-19 (option A, adaptée : voir « Décision prise »).
  **Étapes 1 et 2 écrites le 2026-09-19, rien vu à l'écran.**
- **Demande** : « récupérer les stats et les mots cliqués par l'élève via l'extension
  Daspalecte ».

## Ce que l'extension envoie aujourd'hui (relu dans `daspa-extension/`, v2.0.1)

Tout part du service worker (`analytics.js`) : un jeton Google (obtenu par
`launchWebAuthFlow`, client OAuth `474562157268-obol…`) + un lot JSON d'au plus
100 événements, vers `DEFAULT_API_BASE/api/ingest`.

| Événement | Déclenché quand | Contenu utile |
|---|---|---|
| `word` | l'élève clique un mot pour le traduire (page web ou PDF) | mot, traduction, langue maternelle |
| `exercise` | il termine un exercice de vocabulaire | type (7 types), score / total, essais, mots en jeu |
| `reading_test` | il termine un test de lecture | QCM x/y, appariement x/y, %, page lue |
| `comprehension` | il demande « résumer / reformuler » un texte | longueur du texte, langue |
| `capture` | il analyse une capture d'écran | nombre de mots difficiles |
| `ai_call` | chaque appel à Claude | modèle, jetons consommés |

## Deux problèmes relevés à la relecture (absents du plan du 14/09)

1. **L'extension doit être republiée.** L'adresse du serveur est une constante du code
   (`DEFAULT_API_BASE`) : la changer = version **2.0.2** sur le Chrome Web Store, avec son
   délai d'examen. En attendant, on teste **sans republier** : l'extension lit d'abord un
   réglage local (`daspalecteApiBase` dans `chrome.storage.local`).
   L'extension appelle `adresse + /api/ingest` en dur : la route vit donc à **`/api/ingest`**
   (et non `/api/daspalecte/ingest` comme prévu le 14/09), pour que la 2.0.2 n'ait que
   l'adresse à changer et qu'on puisse tester dès maintenant avec l'extension publiée.
2. **Un élève DASPA n'a pas forcément d'`uid` Recto-versIA** (il n'existe qu'après sa
   première connexion), alors que le vocabulaire personnel est rangé par `uid`.

## Décision prise (JP, 2026-09-19)

- **Les mots vont dans les ressources personnelles de l'élève, comme pour NavigKid**
  (`vocabulairePersonnel/{uid}`, page *Mes ressources personnelles*, lien « Mon
  vocabulaire » de l'en-tête FLE). Un mot déjà présent n'est pas dupliqué : il gagne sa
  traduction et un compteur de clics.
- **Élève jamais connecté** : ses mots attendent dans `vocabulaireEnAttente/{empreinte
  d'email}`, versés à sa connexion (`/api/eleves/link`) ou au premier lot reçu une fois
  l'uid connu. (Option écartée : une collection séparée lue en double à l'affichage.)
- **Vue prof : l'onglet Vocabulaire de la fiche élève** (Mes Classes) — carte « Extension
  Daspalecte » en tête : 4 tuiles (mots traduits + clics, séances, exercices, tests de
  lecture), % de réussite aux exercices, moyenne et dernier test de lecture, mots cliqués
  les plus fréquents d'abord (30 visibles, « Afficher les N mots »).

## Ce qui est écrit (2026-09-19)

| Fichier | Rôle |
|---|---|
| `src/app/api/ingest/route.ts` (chemin imposé par l'extension) | point d'entrée ; prof → 200 ignoré ; pas de fiche `eleves` → 403 `unknown_account` |
| `src/lib/daspalecte/verify-google-token.ts`, `schema.ts` | portés de `daspa-app` (contrat inchangé) |
| `src/lib/daspalecte/write.ts` | un lot = une transaction, idempotente ; `tracesDaspalecte/{sessionId}/events`, `resultatsDaspalecte/{eventId}` ; élève désigné par `studentEmailHash` |
| `src/lib/daspalecte/mots.ts` | fusion dans la liste personnelle + file d'attente |
| `src/lib/daspalecte/stats.ts` | stats recalculées à la lecture (requêtes à un champ : aucun index composite) |
| `src/app/api/profil/vocabulaire/route.ts`, `ProfilPanel.tsx`, `profil.module.css` | carte Daspalecte de l'onglet Vocabulaire (prof **et** élève) |
| `src/app/mes-ressources/page.tsx` + CSS | traduction affichée devant la définition |
| `src/app/api/eleves/link/route.ts` | versement de la file d'attente à la connexion |
| `src/lib/profil-stats.ts` | bug corrigé au passage : onglet Vocabulaire d'un élève jamais connecté → `doc('')` levait une erreur |

Toutes les collections neuves sont en **accès serveur uniquement** : aucune règle Firestore.
Aucune donnée d'identité en clair (empreinte d'email ; `studentEmail` chiffré comme dans la
route NavigKid).

## Étape restante

3. **Bascule en production** — `daspa-extension/analytics.js` (`DEFAULT_API_BASE` →
   `https://rectoversia.edukids.pedagokit.be`), `manifest.json`
   (2.0.2) ; variable `ALLOWED_AUDIENCES` (client OAuth de l'extension) dans `.env.local`
   et sur le VPS. Manipulations **à JP**, une étape à la fois. `daspa-app` reste en ligne
   mais ne reçoit plus rien.

## Ce qu'on ne fait pas

- Importer les traces déjà dans `daspa-app` (décision du 14/09 : on repart de zéro).
- Le module complémentaire Docs/Slides (il n'envoie encore rien, même à `daspa-app`).
- Les appels IA (`ai_call`) dans l'onglet Coûts de `/admin` : ils restent au journal.
- Faire bouger le radar CECR à partir de ces traces (le radar reste réglé par le prof).

## Pièges connus pour le test

- L'extension **coupe le suivi pour de bon** après un refus `unknown_account` : si le
  premier essai se fait avec un compte non inscrit, il faudra réactiver (clé
  `daspalecteTrackingBlocked`).
- Tester avec un **compte élève** inscrit dans une classe : un compte prof est ignoré.
- `ALLOWED_AUDIENCES` doit figurer dans `.env.local` pour le test sur la machine locale.
