# NavigKid! - Extension Élève

Extension Chrome pour l'élève.

Fonctionnalités :
- Sidebar en iframe : interface pour faire des recherches, collecter des liens, répondre aux questions
- Aide IA : suggestions de mots-clés, analyse des liens, feedback en temps réel
- Popup d'extension (`popup/`) : ouverte au clic sur l'icône (remplace l'ouverture directe
  de la sidebar). Contient deux toggles exclusifs et un bouton :
  - **Dictionnaire** : clic sur un mot de la page → surlignage fluo + bulle de définition
    (Wiktionnaire, parsing dans `background/index.js`, suivi de flexion vers le mot de base)
  - **Traducteur** : clic sur un mot → bulle de traduction (endpoint gratuit Google Translate,
    mécanisme repris de Daspalecte), 11 langues, sélecteur sous le toggle
  - **Ouvrir ma recherche NavigKid!** : ouvre la sidebar actuelle
- État des aides dans `chrome.storage.local` (`navigkidAide`, `navigkidLangue`),
  synchronisé entre onglets ; surlignage via l'API CSS Custom Highlight (`::highlight(navigkid-mot)`)
- Traducteur : bulle BD verte au-dessus du mot (comportement Daspalecte) — persistante,
  re-clic sur le mot pour la retirer, nettoyage à la désactivation
- Visionneuse PDF (`pdfviewer/` + `lib/pdf.min.mjs`, portée de Daspalecte sans les outils
  IA) : bouton « Lire ce PDF avec NavigKid! » dans la popup quand l'onglet actif est un PDF ;
  couche de texte cliquable → dictionnaire et traducteur y fonctionnent.
  `host_permissions` élargies à `https://*/*` + `http://*/*` (fetch des PDF par pdf.js)

Connexion à Firestore pour récupérer les questionnaires et stocker les réponses.
Déploiement prévu sur Chrome Web Store.
Interaction avec la webapp prof via Firestore.