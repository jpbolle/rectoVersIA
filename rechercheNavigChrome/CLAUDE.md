# NavigKid! - Instructions Claude

## A FAIRE apres deploiement sur Hostinger

- **Restreindre la cle API Firebase** dans Google Cloud Console > APIs & Services > Credentials :
  limiter aux domaines/apps autorises (domaine Hostinger + ID extension Chrome) pour eviter les abus de quota.

## Debut de session

1. Lire les fichiers du dossier `init/` pour comprendre l'etat de reference du projet :
   - `init/eleve-extension/README.md` et `init/eleve-extension/manifest.json`
   - `init/prof-webapp/README.md`
2. Lire les fichiers sources principaux pour comprendre l'etat actuel :
   - `prof-webapp/src/lib/types.ts` (interfaces Question, Questionnaire)
   - `prof-webapp/src/lib/firebase.ts` (fonctions Firestore)
   - `prof-webapp/src/components/CreateContent.tsx` (formulaire principal)
   - `prof-webapp/src/app/api/generer-questions/route.ts` (prompt Claude)
   - `eleve-extension/manifest.json`
   - `eleve-extension/sidebar/sidebar.html`

## Fin de session

1. Mettre a jour les fichiers `init/` pour refleter les changements de la session :
   - Si de nouvelles fonctionnalites ont ete ajoutees, mettre a jour les README correspondants
   - Si le manifest de l'extension a change, mettre a jour `init/eleve-extension/manifest.json`
   - Si de nouveaux fichiers structurels ont ete crees, les documenter dans les README
2. Mettre a jour ce fichier CLAUDE.md si de nouvelles conventions ou procedures ont ete etablies

## Architecture du projet

- `prof-webapp/` : Next.js 15 App Router, Tailwind CSS v4 avec @theme, Firebase Firestore
- `eleve-extension/` : Extension Chrome Manifest V3 avec side_panel API
- `init/` : Fichiers de reference/template documentant l'etat du projet
- Les deux parties communiquent via Firestore (collection "questionnaires")

## Conventions

- Langue de l'interface : francais
- Nom de l'application : NavigKid!
- Police display : Playfair Display, police body : Inter
- Couleur primaire : #2d6a5a (vert)
- API Claude pour la generation de questions pedagogiques
