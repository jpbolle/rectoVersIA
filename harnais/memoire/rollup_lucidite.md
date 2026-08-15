# Lucidité — « est-ce que l'élève se voit juste ? »

> Session du 2026-08-15. **Livré, rien testé à l'écran.**

## L'idée

L'application mesure désormais la même chose — l'écart entre le regard que
l'élève porte sur son travail et le résultat — sur **quatre dispositifs**. Le
calcul diffère à chaque fois, la présentation non.

| Dispositif | Ce que l'élève annonce | Ce qu'on lui oppose | Calcul |
|---|---|---|---|
| **Écriture** | son niveau, critère par critère (grille) | le niveau du prof, même échelle | `src/lib/grille-lucidite.ts` |
| **Lecture** | un smiley d'assurance sous chaque réponse | le score de la question | `src/lib/confiance-scoring.ts` |
| **Recherche** | idem, **dans l'extension NavigKid** | le score de la RÉPONSE (jamais la démarche) | idem |
| **Auto-évaluation** | ses réponses aux questions | celles du prof, mêmes questions | `src/lib/autoeval-scoring.ts` (antérieur) |

## Le degré d'assurance

Trois échelons, seuils fixés par JP le 2026-08-15 (`src/types/confiance.ts`) :

| Smiley | Libellé élève | Réussite attendue |
|---|---|---|
| 😀 | Je suis sûr de ma réponse | ≥ 70 % |
| 😐 | J'ai un doute | 45 – 69 % |
| 😟 | Je sais que c'est faux | < 45 % |

Le troisième échelon dit « je sais que c'est faux » et non « je ne suis pas
content » : JP a choisi de rester sur l'axe de l'ASSURANCE, pour que le calcul
soit homogène. La comparaison passe par des **tranches**, jamais par des points
— un écart en crans se commente avec un élève, un écart en points non.

## Décisions structurantes

- **Facultatif.** Un second clic retire le smiley. Une question sans smiley
  sort du calcul, et le bilan annonce combien ont été laissées de côté.
- **Les smileys disparaissent en mode corrigé** : se prononcer en voyant son
  résultat n'a aucun sens. Le choix déjà posé reste enregistré.
- **Le détail ne montre que les décalages nets** (deux crans). Un cran est une
  nuance, pas une leçon.
- **Les deux blocs du profil restent séparés.** Dans l'auto-évaluation l'élève
  se compare au REGARD DU PROF ; ailleurs à un RÉSULTAT CHIFFRÉ. Les mêler
  donnerait une moyenne qui ne veut rien dire.
- Le total du profil est **pondéré par le nombre de points de comparaison** :
  une activité de dix questions pèse plus qu'une de deux.

## Où ça vit

| Fichier | Rôle |
|---|---|
| `src/types/confiance.ts` | échelle, seuils, `trancheDuScore` |
| `src/lib/confiance-scoring.ts` | écart smiley ↔ score |
| `src/lib/grille-lucidite.ts` | écart auto-évaluation ↔ correction (écriture) |
| `src/components/ConfiancePicker/` | saisie des smileys (lecture) |
| `src/components/LuciditeBilan/` | **présentation partagée** des trois bilans |
| `src/components/ConfianceBilan/` | adaptateur smileys → `LuciditeBilan` |
| `rechercheNavigChrome/.../sidebar/app.js` | `afficherConfiance()` — même geste dans l'extension |
| `/api/profil/reflexif` + `buildAssuranceProfil` | onglet 🪞 Me connaître |

## Réglage par activité

`devoir.autoEvaluation?: boolean` — troisième encadré de la carte de création
et d'édition, sur la ligne « Type d'activité / Grille ».

- **Absent = activé** : les activités antérieures gardent leur comportement.
- Masqué pour le **vocabulaire** (tout y est automatisé) et pour une activité
  d'**auto-évaluation** (elle EST déjà cela).
- Désactivé : plus de smileys (app ET extension), la grille d'écriture devient
  une lecture, aucun bilan, l'activité ne remonte pas dans « Me connaître ».
- L'extension ne lit pas le document devoir : `/api/navigkid/questionnaire`
  lui transmet le réglage.

## TODO

- [ ] **Tout tester** — rien n'a été vu à l'écran.
- [ ] Recharger l'extension dans `chrome://extensions` pour voir les smileys.
- [ ] Vérifier que le bilan de lucidité de la grille n'apparaît pas avant que
      la correction ne soit rendue visible.

---

## Retouches du 2026-08-15 soir

**Vocabulaire** (demande de JP) :

| Où | Avant | Après |
|---|---|---|
| Bandeau, vue prof | Se voit juste | **Se perçoit avec justesse** |
| Bandeau, vue élève | Tu te vois juste | **Tu te perçois avec justesse** |
| Sous-titre, vue prof — lecture / recherche | Ce que tu pensais de tes réponses | **Ce que l'élève pense de ses réponses** |
| Sous-titre, vue prof — écriture | Ton regard sur ton travail, face à celui du professeur | **Le regard de l'élève sur son travail, face au vôtre** |

Les deux sous-titres **tutoyaient le prof comme s'il était l'élève** : le titre
dépend maintenant de `isProfessorView`, des deux côtés (règle des familles).

**`ConfiancePicker`** — le bloc des smileys :
- intitulé « Et toi, tu en penses quoi ? » → « **Et toi, tu en penses quoi, de
  ta réponse ?** » (trop elliptique : l'élève devait deviner de quoi on parlait) ;
- **rangé contre le bord droit**, largeur ajustée à son contenu, **bandeau ambre
  plein** portant l'intitulé en blanc : c'est un retour SUR la réponse qui
  précède, pas une question de plus — et au milieu du gris de la copie, rien ne
  le distinguait.
- Même geste porté dans **l'extension NavigKid** (`.confiance-bloc`), au titre
  de « ce que je fais pour l'un, je le propose à ses frères ».
- La variante **compacte** (récapitulatifs) reste sobre et alignée à gauche —
  sinon les bilans se rempliraient de bandeaux.

**Rappel de ce qui existait déjà et que JP a redécouvert** : côté élève,
`phraseLucidite` lui adresse une phrase calculée sur ses résultats (« tu t'es
cru plus sûr que tu ne l'étais 3 fois… »). Elle est **réservée à l'élève** — le
prof voit les mêmes chiffres sans le message d'encouragement.
