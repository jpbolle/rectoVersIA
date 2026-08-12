# Rollup — activités de recherche (NavigKid!)

> Session du 2026-08-12. Objectif : rendre lisible l'articulation entre l'app et
> l'extension Chrome. L'activité se joue **dans l'extension** ; la colonne de gauche
> de l'app n'est qu'un miroir, voilé tant que rien n'a été envoyé.

## Décisions de conception (validées par JP)

| Question | Choix |
|---|---|
| Ouverture de l'extension depuis l'app | Relais page → script de contenu → service worker, avec repli par bandeau |
| Corrigé QCM détaillé | Seulement quand `corrigeDisponible` |
| Compteurs (justes / erreurs / à corriger) | **Dès l'envoi**, dans l'onglet Évaluation qui s'ouvre tout seul |
| Popup d'avertissement | **Non fermable**, mais confinée à la colonne 1 — le rail et le panneau de droite restent utilisables |

## Ce qui a été livré

- **Plus de bouton « Remettre le devoir »** sur le type `rechercher` (`WorkTopBar`,
  prop `hideSubmit`). Le statut affiche « Réponses pas encore envoyées ».
- **`POST /api/navigkid/reponse` bascule le travail en `submitted`** (+ `submittedAt`).
  Sans ça, retirer le bouton aurait rendu les activités de recherche invisibles des
  listes prof, du compteur de copies remises, des notifications et du classement de
  `/activites`. Recherche du travail : id généré, puis `studentEmailHash`, puis email
  en clair — même stratégie que `/api/travaux/mine`.
- **`RechercheStartOverlay`** : voile flouté (`backdrop-filter`) + carte
  d'avertissement, ancrés dans `.rechercheBody` (colonne 1 uniquement).
  Le bouton poste un message à la page ; états gérés : panneau ouvert / repli manuel /
  extension introuvable (délai 2,5 s).
- **`RechercheResume`** : bloc en tête de l'onglet Évaluation (bonnes réponses,
  erreurs, à corriger par le prof). L'onglet s'ouvre automatiquement, **une seule
  fois**, à la première détection d'une réponse.
- **Corrigé dans `RechercheResponseViewer`** : ✅/❌ + bonne réponse sur les QCM quand
  le corrigé est disponible ; mention « corrigée par ton professeur » sur les ouvertes.
- **Rechargement de la réponse au retour d'onglet** (`focus` + `visibilitychange`) :
  le voile se lève sans que l'élève recharge la page.

## Faille corrigée (importante)

`GET /api/navigkid/questionnaire` renvoyait les questions **brutes** à l'élève :
`correctes` (indices des bonnes réponses QCM), `reponseAttendue`, `referencesProf`.
Un élève ouvrant la console voyait le corrigé avant de chercher.
⇒ `src/lib/navigkid-server.ts` (même rôle que `lecture-server.ts` pour la lecture) :
filtrage systématique pour le rôle élève, `correctes` renvoyé uniquement si le devoir
parent porte `corrigeDisponible: true`. Le récapitulatif est **calculé sur le serveur**
pour ne jamais faire transiter les bonnes réponses.

Note : l'extension enregistre la réponse QCM sous forme de **texte** de l'option
choisie, pas d'indice — toute comparaison passe par `options[i] === reponse`.

## Extension (3 fichiers touchés)

- `background/index.js` : message `OUVRIR_RECHERCHE` → `chrome.sidePanel.open()`
  appelé **en premier, sans aucun `await` avant** (Chrome n'autorise l'ouverture que
  pendant le geste utilisateur relayé), puis dépôt de `navigkidActiviteADemarrer` dans
  le storage et ouverture d'un onglet Google. En cas de refus : `programmerBandeau()`.
- `content/index.js` : pont `window.postMessage` ↔ extension (canaux
  `rectoversia-navigkid` / `navigkid-extension`) + bandeau de repli.
- `sidebar/app.js` : `ouvrirActiviteDemandee()` après chargement des activités, plus
  un écouteur `chrome.storage.onChanged` pour la course panneau/storage.

## État des tests (2026-08-12)

- [x] Voile + popup + disparition du bouton de remise + colonne de droite utilisable
- [x] Bouton → onglet Google **et panneau latéral ouverts automatiquement**
      (le relais du geste utilisateur fonctionne, le repli n'a pas eu à servir)
- [x] Connexion Google dans le panneau
- [ ] **Boucle complète non testée** : envoi des réponses → voile levé → onglet
      Évaluation avec les compteurs → corrigé QCM une fois `corrigeDisponible`
- [ ] Vue prof (le corrigé ✅/❌ apparaît aussi dans la page de correction)

## TODO

### Prochaine session — 2026-08-13 (plan annoncé par JP)

1. [ ] **Terminer les tests** de la boucle d'envoi : envoi des réponses depuis
       l'extension → voile levé → onglet Évaluation avec les compteurs → corrigé QCM
       une fois `corrigeDisponible` coché. Plus la vue prof (✅/❌ dans la page de
       correction).
2. [ ] **Publier l'extension NavigKid!** sur le Chrome Web Store (diffusion interne
       `cnddinant.be`) : bump de version du `manifest.json` (numéro géré **à la main**
       par JP), zip, envoi. Compter quelques heures de validation.
       ⚠️ **Pendant cette étape, régler le `key`** (voir « Ensuite ») : une fois l'item
       créé, le Store expose sa clé publique dans le tableau de bord développeur. La
       recopier dans le `manifest.json` aligne les deux Macs sur l'identifiant publié.
       Fait après coup, ce travail est à refaire.
3. [ ] **Retravailler la description** de l'extension sur le Chrome Web Store —
       `rechercheNavigChrome/chrome-web-store.md` porte le texte actuel (v1.3), qui ne
       mentionne ni le lancement depuis l'app, ni les aides dictionnaire/traducteur,
       ni la visionneuse PDF.

### Ensuite

- [ ] **Figer l'identifiant de l'extension** (champ `key` du manifeste) — voir le
      gotcha dans `init.md`. À trancher **au moment de la publication** : le Store
      attribue son propre identifiant, dont on peut récupérer la clé publique pour
      aligner les postes de développement et supprimer définitivement les
      `redirect_uri_mismatch`.
- [ ] Noter ici la version publiée sur le Store une fois la diffusion effective.
