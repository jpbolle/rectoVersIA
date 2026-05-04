# Instructions Claude Code — Recto-versIA

## Langue
- **Code** : anglais (variables, fonctions, types)
- **UI** : francais (labels, messages, titres)
- **Commentaires** : francais
- L'utilisateur prefere les accents francais dans les strings user-facing

## Conventions de nommage
- Composants React : PascalCase (`CorrectionGrid`, `WorkEditor`)
- Hooks : `use` + camelCase (`useCorrection`, `useGrille`)
- Types : PascalCase (`Devoir`, `Correction`, `Grille`)
- API Routes : kebab-case (`/api/corrections`, `/api/travaux`)
- IDs Firestore : format specifique `DEV-YYYYMMDD-XXXX`, `TRV-{devoirId}-{studentId}`, `CORR-{travailId}`, `AIGRID-{travailId}`

## Styling
- CSS Modules uniquement (zero framework CSS)
- Design system **Classica** avec tokens CSS `--c-*` dans `globals.css`
- Primary: `#2d6a5a`, Accent: `#d4944c`, Background: `#faf6f0`, Text: `#3d3832`
- Fonts: Playfair Display (titres) + Inter (corps)
- Toujours verifier les styles existants avant d'en creer — pas de styles conflictuels

## Auth — Regles critiques
- **getAuthHeaders** est centralise dans `AuthContext.tsx` — ne JAMAIS recreer localement dans les hooks
- Tous les hooks utilisent `const { getAuthHeaders } = useAuth()`
- **INTERDIT** : ne jamais mettre `user` dans les deps de useCallback/useEffect (objet instable, cause des boucles)
- Utiliser le pattern `userRef` (comme dans AuthContext et useStudentClasses) pour acceder a `user` dans les callbacks memoises
- Middleware (`src/middleware.ts`) : vide — toute l'auth est cote client via Firebase tokens

## Firebase
- Plan Blaze (pay-as-you-go)
- `adminDb` cote serveur (firebase-admin), `firebase` cote client
- API auth pattern : `verifyAuth()` avec Bearer token + `adminAuth.verifyIdToken` (dans `src/lib/api-auth.ts`)
- Avant de creer une API route Firestore, verifier que les index composites existent
- Audio annotations : base64 dans Firestore (pas de Firebase Storage pour l'audio)

## Redirections — Regles critiques
- Toute page qui fait `router.replace()` doit avoir un state `redirecting` pour eviter les boucles
- Pattern : `if (redirecting) return;` avant le `router.replace()`, et `if (redirecting) return null;` dans le render
- Eleve sans classe : redirige vers `/login` depuis TOUTES les pages protegees
- Page `/` : redirige prof → `/dashboard`, eleve → `/login` (login gere la suite)

## Cache Turbopack
- Si comportement bizarre en dev : supprimer `.next/` et relancer `npm run dev`
- Le cache se corrompt parfois (fichiers `.sst` manquants)

## Grilles de correction
- Stockees dans Firestore (collection `grilles`), editables dans l'app via GrilleBuilder
- Chaque grille a un `profId` — isolation multi-prof
- `shared: true` = grille exemple visible par tous (admin seulement)
- Section "Grilles des professeurs" : duplication en lecture seule
- 6 niveaux fixes : Neant (0%), Tres insuffisant (15%), Insuffisant (35%), Suffisant (60%), Acquis (80%), Parfaitement acquis (100%)
- Ne jamais modifier l'echelle

## IA
- Claude API et Whisper API : appels cote serveur uniquement (API Routes)
- Modele : `claude-sonnet-4-5-20250929`

## Deploiement
- VPS Hostinger — ne JAMAIS tenter de SSH directement
- Toujours fournir les commandes a l'utilisateur pour qu'il les execute
- Utiliser le skill `/deploy` pour la procedure complete

## Points d'attention
- Espace de travail eleve (`/activites/[id]`) : utilise `WorkspaceRail` (rail icones droite + panneau redimensionnable). Espace de travail prof (`/dashboard/travaux/[devoirId]/[travailId]`) : conserve `ResizableSplit` + onglets internes — NE PAS uniformiser, les contextes sont differents
- `AssistancePanel` : usage `hideTabs={true}` cote eleve (rail externe), defaut `false` cote prof
- L'icone oeil est reservee a "Vue de l'eleve" (posture fictive prof) — jamais pour la visibilite des corrections
- ContentLock : utilise `instanceof AddMarkStep/RemoveMarkStep` (pas `constructor.name` qui casse en production)
- Student Tiptap content a du `style="line-height: X"` inline → utiliser `!important` dans le CSS de l'annotation editor
- PreferencesContext : graceful fallback si API renvoie erreur (pas de throw)
- Suppression eleve : supprime `eleves/{id}` + `classes/{classeId}/eleves/` + `users/{uid}`, conserve travaux et corrections

## Session de travail
- Lire `INIT.md` en debut de session pour le contexte projet complet
- Mettre a jour `INIT.md` en fin de session si des changements structurels ont ete faits
- Mettre a jour `memory/MEMORY.md` pour les infos cross-sessions (TODOs, deployment)
