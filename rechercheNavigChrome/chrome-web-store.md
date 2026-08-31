# NavigKid! — Chrome Web Store Listing

## Nom
NavigKid!

## Version
1.4

## Résumé (132 caractères max)
Recherche guidée pour les élèves : questionnaire, surlignage des sources, dictionnaire et aide IA, intégrés à Recto-versIA.

## Description detaillee

NavigKid! est une extension Chrome conçue pour accompagner les élèves dans leurs activités de recherche sur le web. Elle s'intègre à la plateforme pédagogique Recto-versIA utilisée en classe.

**Fonctionnalités principales :**

• Connexion sécurisée avec n'importe quel compte Google
• Liste des activités de recherche assignées par le professeur
• Lancement d'une activité directement depuis Recto-versIA : l'élève clique dans l'application, le panneau latéral s'ouvre sur la bonne recherche
• Questionnaire interactif avec questions ouvertes et QCM
• Surlignage et sélection de passages sur les pages web visitées
• Enregistrement automatique des sources consultées
• Aides de lecture activables d'un clic dans la fenêtre de l'extension : dictionnaire (définition du mot cliqué) ou traducteur (dans la langue choisie)
• Visionneuse PDF intégrée, avec le dictionnaire actif par défaut : les documents PDF rencontrés pendant la recherche se lisent et s'annotent comme une page web
• Aide IA conditionnelle (activable par le professeur) : vérification de sources, suggestions de mots-clés, aide à la reformulation
• Retour vers Recto-versIA depuis le panneau, une fois la recherche envoyée
• Sauvegarde automatique de la progression

**Comment ça fonctionne :**
1. L'élève se connecte avec son compte Google
2. Il choisit une activité assignée par son professeur — depuis le panneau, ou d'un clic dans Recto-versIA
3. Il navigue sur le web pour répondre aux questions
4. Il surligne les passages pertinents directement sur les pages web, et s'appuie au besoin sur le dictionnaire ou le traducteur
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
> Champ limité à **1000 caractères**, sans formatage. Texte ci-dessous = 995
> caractères, à coller tel quel. Toute réécriture doit être remesurée.

L'extension communique avec l'API de Recto-versIA (rectoversia.edukids.pedagokit.be) pour récupérer les questionnaires, envoyer les réponses et accéder à l'aide IA.

Le script de contenu s'exécute sur toutes les pages parce que l'objet de l'extension est la recherche documentaire : on ne peut pas savoir à l'avance sur quels sites l'élève cherchera.

Sur geste de l'élève : surligner des passages comme sources ; afficher la définition ou la traduction du mot cliqué ; sur les pages de Recto-versIA uniquement, ouvrir le panneau sur la bonne activité.

Automatiquement, et uniquement pendant qu'une activité est ouverte dans le panneau : consigner la démarche de recherche (requête Google, adresse et titre des pages ouvertes depuis les résultats, temps passé), que le professeur évalue.

Le dictionnaire interroge fr.wiktionary.org et le traducteur translate.googleapis.com, avec le seul mot cliqué : aucun identifiant ni donnée d'élève ne les accompagne.

Hors activité, rien n'est consigné.

## Code distant
Non — Tout le code exécuté est contenu dans le paquet. Les deux bibliothèques Firebase
utilisées (firebase-app-compat.js, firebase-auth-compat.js, uniquement pour
l'authentification Google) sont embarquées dans `sidebar/lib/`, de même que la
visionneuse PDF (`lib/pdf.min.mjs`). Rien n'est chargé depuis un CDN, aucun script
n'est évalué à la volée. L'extension n'échange que des **données** avec l'API de
Recto-versIA.

---

## Consommation des donnees (cases a cocher)
- [x] Informations permettant d'identifier personnellement l'utilisateur (email Google)
- [ ] Information sur la sante
- [ ] Informations financieres et de paiement
- [x] Informations d'authentification (token OAuth Google)
- [ ] Communications personnelles
- [ ] Localisation
- [x] Historique Web (URLs des pages visitees pendant la recherche)
- [x] Activite de l'utilisateur — clics sur les liens de resultats Google, interceptes
      dans content/index.js pour noter quelle source l'eleve a ouverte
- [x] Contenu du site Web (passages surlignes par l'eleve)

### Certifications
- [x] Je ne vends ni ne transfere les donnees des utilisateurs a des tiers
- [x] Je n'utilise ni ne transfere les donnees a des fins sans rapport avec la fonctionnalite de base
- [x] Je n'utilise ni ne transfere les donnees pour determiner la solvabilite ou a des fins de pret

## URL regles de confidentialite
https://www.pedagokit.be/politiques-de-confidentialité-extensions-et-apps/navigkid

> L'ancienne adresse Notion est abandonnée. Le texte à publier sur cette page vit dans
> `politique-confidentialite-navigkid.md`, à côté de ce fichier — les deux doivent dire
> la même chose que les déclarations ci-dessus.

---

## Politique de confidentialite (résumé — texte complet dans le fichier voisin)

> Le texte publié fait foi : `politique-confidentialite-navigkid.md`.
> Ce qui suit en est le résumé, gardé ici pour que la fiche se lise d'un bloc.

NavigKid! collecte uniquement les données nécessaires au fonctionnement pédagogique, et
**uniquement pendant qu'une activité de recherche est ouverte dans le panneau latéral** :
- Adresse email Google (authentification)
- Réponses aux questionnaires de recherche
- Passages surlignés par l'élève sur les pages visitées
- Démarche de recherche : requêtes tapées dans Google, adresse et titre des pages
  ouvertes depuis les résultats, temps passé sur chacune — c'est ce que le professeur
  évalue sous le nom de « démarche », à côté des réponses elles-mêmes
- Mots cliqués lorsque l'élève active le dictionnaire ou le traducteur

Hors activité, ou panneau fermé, rien n'est collecté.

Les données sont stockées dans Firebase (Google Cloud) et accessibles uniquement par
l'élève et son professeur. Elles ne sont ni vendues, ni cédées, ni exploitées à des fins
publicitaires, et sont conservées pour la durée de l'année scolaire.

**Services tiers interrogés.** Deux aides facultatives, que l'élève active lui-même,
consultent un service extérieur :
- le **dictionnaire** interroge le Wiktionnaire francophone (fr.wiktionary.org,
  Fondation Wikimedia) ;
- le **traducteur** interroge Google Traduction (translate.googleapis.com).

Seul le mot cliqué leur est transmis — ou, pour le traducteur, le petit groupe de mots
cliqués côte à côte. Aucun identifiant, aucun nom, aucune adresse email, aucune réponse
d'élève ne les accompagne : ces services reçoivent un mot, et rien qui permette de savoir
qui l'a cliqué. Les aides sont désactivées par défaut.

Contact : jeanphilippe.bolle@cnddinant.be

> ⚠️ Ce texte doit être **recopié dans la page Notion** citée plus haut : c'est elle que
> Google lit, pas ce fichier. Les deux doivent dire la même chose.
