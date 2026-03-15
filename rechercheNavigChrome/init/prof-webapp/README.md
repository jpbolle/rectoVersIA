# NavigKid! - Prof Webapp

Interface web Next.js 15 (App Router) pour le professeur.

## Stack technique
- Next.js 15, Tailwind CSS v4 (@theme), TypeScript
- Firebase Firestore (modular SDK)
- API Claude (Anthropic) pour la génération de questions
- Polices : Playfair Display (titres), Inter (corps)

## Fonctionnalités implémentées
- Créer un questionnaire : titre, thèmes (tags), consignes, questions (texte libre ou QCM)
- Modifier un questionnaire existant (mode édition via ?edit=id)
- Génération IA de questions via Claude API (prompt pédagogique détaillé)
- QCM avec marquage des bonnes réponses (liseré vert, multi-réponses)
- Réorganisation des questions (monter/descendre)
- Points par question avec total automatique
- Corrigé & références par question (réponse attendue + URLs de référence)
- Authentification professeur (AuthProvider, restreint par email via NEXT_PUBLIC_PROF_EMAILS)
- Page résultats (/results?id=) : réponses par élève
- Page analyse (/analyse?id=) : statistiques, mots-clés, domaines, scores
- **Page élève (/eleve)** : interface web reproduisant l'extension Chrome
  - Authentification élève email/password ou Google
  - Saisie code d'accès 6 caractères
  - Navigation questionnaire (prev/next, dots)
  - Saisie manuelle : mots-clés, sites (pertinence + fiabilité 1-5), passages (couleur + source)
  - QCM (radio buttons) et texte libre (textarea)
  - Persistence session via localStorage
  - Soumission Firestore (même format que l'extension)

## Fonctionnalités à implémenter
- Règles de sécurité Firestore
- Index composite Firestore

## Architecture des routes (route groups)
- `app/(prof)/` : pages prof (/, /create, /results, /analyse) — AuthProvider + Header
- `app/eleve/` : page élève — layout séparé sans Header
- `app/api/` : API routes (generer-questions, corriger)
- `app/layout.tsx` : shell minimal (html, body, fonts, CSS)

## Structure principale
- src/components/CreateContent.tsx : formulaire principal de création/édition
- src/components/Header.tsx : en-tête NavigKid!
- src/components/AuthProvider.tsx : contexte d'authentification (filtrage par email prof)
- src/components/HomeContent.tsx : liste des questionnaires
- src/components/ResultsContent.tsx : résultats par élève
- src/components/AnalyseContent.tsx : analytics
- src/components/eleve/ : composants interface élève (EleveApp, EleveAuth, EleveCode, EleveQuestionnaire, MotCleForm, SiteForm, PassageForm)
- src/lib/types.ts : interfaces Question, Questionnaire, QuestionData, etc.
- src/lib/firebase.ts : fonctions Firestore prof
- src/lib/firebase-eleve.ts : fonctions Firestore élève (signUp, signIn, getQuestionnaireByCode, submitReponse, submitRecherche)
- src/app/api/generer-questions/route.ts : endpoint Claude API
- src/app/globals.css : thème et styles globaux

## Variables d'environnement (.env.local)
- NEXT_PUBLIC_FIREBASE_* : config Firebase
- NEXT_PUBLIC_PROF_EMAILS : emails des profs autorisés (séparés par virgules)
- ANTHROPIC_API_KEY : clé API Claude (server-side)

Connexion à Firestore pour stocker questionnaires et réponses.
Interaction avec l'extension Chrome via Firestore (collection "questionnaires").
