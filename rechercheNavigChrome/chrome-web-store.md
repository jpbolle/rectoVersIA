# NavigKid! — Chrome Web Store Listing

## Nom
NavigKid!

## Version
1.3

## Resume (132 caracteres max)
Extension de recherche guidee pour les eleves. Questionnaires, surlignage de sources et aide IA integres a Recto-versIA.

## Description detaillee

NavigKid! est une extension Chrome conçue pour accompagner les élèves dans leurs activités de recherche sur le web. Elle s'intègre à la plateforme pédagogique Recto-versIA utilisée en classe.

**Fonctionnalités principales :**

• Connexion sécurisée avec n'importe quel compte Google
• Liste des activités de recherche assignées par le professeur
• Questionnaire interactif avec questions ouvertes et QCM
• Surlignage et sélection de passages sur les pages web visitées
• Enregistrement automatique des sources consultées
• Aide IA conditionnelle (activable par le professeur) : vérification de sources, suggestions de mots-clés, aide à la reformulation
• Sauvegarde automatique de la progression

**Comment ça fonctionne :**
1. L'élève se connecte avec son compte Google
2. Il sélectionne une activité de recherche assignée par son professeur
3. Il navigue sur le web pour répondre aux questions
4. Il surligne les passages pertinents directement sur les pages web
5. Ses réponses et sources sont envoyées au professeur via Recto-versIA

**À noter :**
Cette extension fonctionne exclusivement avec la plateforme Recto-versIA (https://rectoversia.edukids.pedagokit.be). Un compte élève actif et une activité de recherche assignée par un professeur sont nécessaires.

Développée pour le Collège Notre-Dame de Dinant (Belgique).

## Categorie
Education

## Langue
Français

## Visibilite
Non repertorie (Unlisted) — accessible uniquement par lien direct

## Site web
https://rectoversia.edukids.pedagokit.be

---

## Objectif unique
NavigKid! accompagne les élèves dans leurs activités de recherche sur le web dans le cadre scolaire. L'extension affiche un questionnaire assigné par le professeur dans un panneau latéral. L'élève navigue sur le web, surligne des passages pertinents sur les pages visitées, et répond aux questions. Ses réponses et sources sont transmises au professeur via la plateforme Recto-versIA.

## Justification des permissions

### storage
Sauvegarder localement la progression de l'élève (réponses, question courante, identifiant) pour éviter la perte de données si le panneau latéral est fermé accidentellement.

### activeTab
Accéder à la page web active pour permettre à l'élève de surligner et sélectionner des passages de texte comme sources pour ses réponses de recherche.

### scripting
Injecter le script de surlignage sur les pages web visitées afin que l'élève puisse sélectionner des passages pertinents directement sur la page.

### sidePanel
Afficher le questionnaire de recherche dans un panneau latéral de Chrome, permettant à l'élève de consulter les questions et répondre tout en naviguant sur le web.

### identity
Authentifier l'utilisateur via Google OAuth avec n'importe quel compte Google, pour identifier ses réponses et les transmettre au professeur.

### Autorisation d'acces a l'hote
L'extension communique avec l'API de la plateforme pédagogique Recto-versIA (rectoversia.edukids.pedagokit.be) pour récupérer les questionnaires assignés, envoyer les réponses de l'élève et accéder à l'aide IA. Le content script s'exécute sur toutes les pages pour permettre le surlignage de passages sur n'importe quel site web visité lors de la recherche.

## Code distant
Oui — L'extension charge les bibliothèques Firebase (firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js) depuis les CDN Google (gstatic.com) pour l'authentification et la communication avec la base de données Firestore.

---

## Consommation des donnees (cases a cocher)
- [x] Informations permettant d'identifier personnellement l'utilisateur (email Google)
- [ ] Information sur la sante
- [ ] Informations financieres et de paiement
- [x] Informations d'authentification (token OAuth Google)
- [ ] Communications personnelles
- [ ] Localisation
- [x] Historique Web (URLs des pages visitees pendant la recherche)
- [ ] Activite de l'utilisateur
- [x] Contenu du site Web (passages surlignes par l'eleve)

### Certifications
- [x] Je ne vends ni ne transfere les donnees des utilisateurs a des tiers
- [x] Je n'utilise ni ne transfere les donnees a des fins sans rapport avec la fonctionnalite de base
- [x] Je n'utilise ni ne transfere les donnees pour determiner la solvabilite ou a des fins de pret

## URL regles de confidentialite
https://sparkling-boursin-db6.notion.site/Politique-de-confidentialit-NavigKid-324bfbee5a19800bbb6cc0540e2c87c8

---

## Politique de confidentialite (contenu complet)

NavigKid! collecte uniquement les données nécessaires au fonctionnement pédagogique :
- Adresse email Google (authentification)
- Réponses aux questionnaires de recherche
- URL et passages surlignés sur les pages visitées (uniquement pendant une activité active)

Les données sont stockées dans Firebase (Google Cloud) et accessibles uniquement par l'élève et son professeur. Aucune donnée n'est vendue ni partagée avec des tiers. Les données sont conservées pour la durée de l'année scolaire.

Contact : jeanphilippe.bolle@cnddinant.be
