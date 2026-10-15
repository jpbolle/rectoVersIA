# 2026-10-15 — Gestion des coûts IA (coût par activité, surveillance, alerte)

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-15 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé
- **Demande initiale** (JP, 2026-10-15) : « l'admin doit voir, pour chaque activité qui
  nécessite des appels IA, combien cela coûte. Si montant excessif comme aujourd'hui, le
  script doit déclencher une recherche : serait-il possible d'être connecté à Claude
  Console comme à Hostinger pour que le script analyse les coûts et repère le bug ? »

## Le problème

Incident du 2026-10-14 (détail : `memoire/rollup_vocabulaire.md`) : la limite de dépense
Claude a été atteinte, et toutes les fonctions IA de l'app se sont arrêtées. Il a fallu une
demi-journée d'enquête (console Anthropic, base, journaux PM2) pour trouver la cause : un
thème avec des guillemets cassait toutes les générations de deux activités, et chaque
échec était facturé. 232 échecs identiques sont passés inaperçus pendant 6 jours.

Ce qui manque aujourd'hui :
- **aucune trace des coûts** : seule la lecture de cours FLE note sa consommation. Les
  11 autres routes IA ne laissent rien ; l'onglet admin « Gestion des coûts » le dit
  lui-même (« pas encore comptabilisés en tokens ni en euros ») ;
- **aucune trace des échecs** ailleurs que dans les journaux PM2, que personne ne lit ;
- **aucune alerte** avant celle d'Anthropic, qui arrive quand l'argent est déjà dépensé.

## Ce qu'on sait de la connexion à la console (vérifié dans la doc officielle, 2026-10-15)

- Anthropic propose une **API de coûts** (*Usage and Cost API*) : coût par jour, par modèle,
  par clé API, mis à jour **en 5 minutes environ**. Elle demande une **clé Admin**
  (`sk-ant-admin…`), créée dans la console par un administrateur de l'organisation.
- Elle **n'existe pas pour les comptes individuels**. La capture de JP montre une
  organisation (« Enseignement Catholique Din… », forfait **API Team**) : elle est donc
  disponible. Reste à vérifier que JP a le rôle admin dans cette organisation.
- Elle **ne connaît pas les activités** de l'app : le « coût par activité » ne peut venir
  que de l'app elle-même (étape 1). La console sert de **contrôle** : si elle facture plus
  que ce que l'app a noté, un appel échappe à la trace.
- **Hostinger** : inutile de s'y connecter de l'extérieur. Une fois l'étape 1 faite, les
  échecs sont notés en base par l'app elle-même : plus besoin de lire les journaux PM2.

## Options

### 1. Granularité de la trace

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — une ligne par appel** (`consommationIa`) | date, fonction, modèle, jetons, coût, activité, classe, élève (uid), succès ou erreur + message | quelques milliers d'écritures par mois : négligeable. Permet de retrouver un incident comme celui du 14/10 |
| **B — compteurs par jour** (une ligne par activité et par jour) | totaux seulement | moins d'écritures, mais on perd l'erreur exacte et l'élève concerné : l'enquête redevient manuelle |

**Proposée : A**, avec une purge des lignes de plus de 12 mois (RGPD : uid seulement, aucun nom).

### 2. Ce que fait la surveillance quand un seuil est dépassé

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — bandeau rouge dans l'admin** + rapport d'enquête | visible à la prochaine connexion | gratuit ; on peut ne pas le voir pendant des jours |
| **B — A + e-mail à JP** | alerte immédiate | un envoi d'e-mail automatique (consigne durable : accord explicite requis) |
| **C — A ou B + coupure automatique** de l'IA élève pour l'activité fautive | arrête l'hémorragie seul | une activité peut être coupée en plein cours sur une fausse alerte |

**Proposée : B + C limitée** : coupure de l'activité fautive seulement (pas de toute
l'IA), réactivable en un clic par l'admin.

### 3. « Repérer le bug »

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — enquête par règles** | le script regroupe les échecs par activité et par message (« 232 × `JSON.parse` position 61 sur l'activité X ») | gratuit, déterministe ; c'est exactement ce qui aurait trouvé l'incident du 14/10 en une ligne |
| **B — A + analyse par Claude** | Haiku lit le rapport et propose une hypothèse en français | quelques centimes par alerte ; une hypothèse peut être fausse |

**Proposée : A d'abord**, B plus tard si les rapports bruts restent obscurs.

## Ce qu'on fait (une étape à la fois, chacune vue à l'écran par JP avant la suivante)

1. **Le socle : tracer chaque appel IA.** Toutes les routes passent par le helper commun
   `src/lib/claude.ts`, qui note chaque appel (réussi ou raté) dans `consommationIa`, avec
   son coût calculé selon une table de tarifs. Chaque route garde **son** modèle actuel :
   aucune bascule cachée. Le client (page) transmet l'activité (`devoirId`) quand il la connaît.
   Fichiers : `src/lib/claude.ts`, `src/lib/tarifs-ia.ts` (nouveau), les 14 routes IA,
   les appels côté client qui doivent transmettre l'activité.
2. **La page admin « Gestion des coûts » refaite.** Coût du jour, du mois, par fonction,
   **par activité** (titre, prof, classe, coût, nombre d'appels, **taux d'échec**, coût par
   élève) et par élève dans une activité. Lecture par route serveur (`adminDb`) : aucune
   règle Firestore à ajouter.
   Fichiers : `src/app/admin/page.tsx`, `src/app/api/admin/couts/route.ts` (nouveau).
3. **Le rapprochement avec la console.** La route serveur interroge l'API de coûts
   (clé Admin dans `.env.local` et sur le VPS) et affiche « console : X $, app : Y $ ».
   Un écart signale un appel non tracé.
4. **La surveillance.** Une route `/api/admin/couts/surveillance`, appelée toutes les heures
   par une tâche planifiée du VPS (*cron* : planificateur intégré à Linux, sans dépendance
   ajoutée), applique les seuils. En cas de dépassement : bandeau, rapport d'enquête,
   et selon les options retenues, e-mail et coupure.

## Ce qu'on ne fait pas dans ce chantier

- **Whisper** (transcription audio, OpenAI) : autre fournisseur, autre facture. À ajouter
  ensuite sur le même modèle si JP le souhaite.
- Aucun changement de modèle : la bascule Haiku du 2026-10-15 est faite à part.
- Pas de connexion SSH au VPS, ni d'agent qui irait lire Hostinger de l'extérieur.
- Pas de facturation par prof ou par école.

## Comment on saura que ça marche

- Étape 1 : après une étude de vocabulaire, une ligne apparaît dans la page admin avec son
  coût en dollars.
- Étape 2 : la page montre le coût de chaque activité ; une activité qui échoue en boucle
  saute aux yeux (taux d'échec en rouge).
- Étape 3 : les totaux « console » et « app » du jour sont affichés côte à côte et proches.
- Étape 4 : un seuil volontairement bas déclenche le bandeau et un rapport du type
  « 12 × `JSON.parse` sur l'activité X depuis 10 h ».

## Points à trancher par l'utilisateur (un à la fois)

- [ ] Granularité de la trace : A (une ligne par appel) ou B ?
- [ ] Seuils d'alerte : coût du jour (ex. 2 $), taux d'échec d'une activité (ex. 20 % sur 10 appels), appels par élève et par jour
- [ ] Réaction : bandeau seul, + e-mail, + coupure de l'activité fautive ?
- [ ] Enquête : par règles seulement, ou + analyse par Claude ?
- [ ] Clé Admin : JP a-t-il le rôle admin dans l'organisation pour la créer ?
