'use client';

// ─── Éditeurs des types de questions ajoutés le 2026-08-16 ───
//
// Sortis du constructeur : `LectureQuizBuilder.tsx` faisait déjà 899 lignes
// avant eux, et sept éditeurs de plus l'auraient rendu illisible.
//
// Chacun reçoit la même signature (`q`, `update`, `disabled`) et ne connaît
// que sa propre forme. Le constructeur, lui, garde ce qui vaut pour TOUTES
// les questions : l'énoncé, le barème, les habiletés, l'image, l'audio.
//
// ⚠️ Ce que ces éditeurs saisissent est le CORRIGÉ. Il ne part jamais chez
// l'élève : `lectureQuizForEleve` (src/lib/lecture-server.ts) le retire tant
// que la correction n'est pas rendue. Ajouter ici un champ de corrigé sans
// l'ajouter là-bas, c'est livrer la réponse — la fuite a déjà eu lieu une
// fois sur les QCM de recherche.

import type {
  LectureAnnotationCible,
  LectureEnsemble,
  LectureJeton,
  LectureQuestion,
  LectureQuestionImage,
} from '@/types/lecture';
import {
  FLUO_COULEURS,
  FLUO_COULEUR_IDS,
  fluoHex,
  generateJetonId,
  matriceColonnes,
} from '@/types/lecture';
import { MATRICE_MODELES } from '@/types/autoevaluation';
import { focaliserChamp, insererLigneMatrice } from '@/lib/choix-liste';
import { FluoExtrait } from '@/components/LectureQuizActivity/LectureQuizActivity';
import styles from './LectureQuizBuilder.module.css';

export interface EditeurProps {
  q: LectureQuestion;
  update: (partial: Partial<LectureQuestion>) => void;
  disabled?: boolean;
  /**
   * Ouvre le sélecteur de fichier et pose le média obtenu où le rappel le dit.
   * Fourni par le constructeur, qui tient la chaîne d'upload (compression →
   * /api/ressources/upload → ressourceImages). Absent = pas d'upload possible
   * (le prof n'est pas authentifié) : on n'affiche alors pas les boutons.
   */
  choisirMedia?: (genre: 'image' | 'audio', poser: (media: LectureQuestionImage) => void) => void;
}

// ════════════════════════════════════════════════════════════════
// Briques communes
// ════════════════════════════════════════════════════════════════

/** Édition d'une liste de jetons — appariement, remise en ordre, ensembles. */
function ListeJetons({
  titre,
  aide,
  jetons,
  onChange,
  disabled,
  choisirMedia,
  numeroter,
}: {
  titre: string;
  aide?: string;
  jetons: LectureJeton[];
  onChange: (jetons: LectureJeton[]) => void;
  disabled?: boolean;
  choisirMedia?: EditeurProps['choisirMedia'];
  /** Remise en ordre : le rang saisi EST la bonne réponse, il doit se voir. */
  numeroter?: boolean;
}) {
  const majJeton = (id: string, partial: Partial<LectureJeton>) =>
    onChange(jetons.map((j) => (j.id === id ? { ...j, ...partial } : j)));

  const ajouter = (kind: LectureJeton['kind']) => {
    const nouveau: LectureJeton = { id: generateJetonId(), kind, texte: '' };
    if (kind === 'texte') return onChange([...jetons, nouveau]);
    // Image et audio : on ne crée le jeton qu'une fois le fichier déposé,
    // sinon la liste se remplit de jetons vides que le serveur rejettera.
    choisirMedia?.(kind, (media) => onChange([...jetons, { ...nouveau, media }]));
  };

  const deplacer = (index: number, sens: -1 | 1) => {
    const cible = index + sens;
    if (cible < 0 || cible >= jetons.length) return;
    const copie = [...jetons];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    onChange(copie);
  };

  return (
    <div className={styles.jetonBloc}>
      <div className={styles.fieldLabel}>
        {titre}
        {aide && (
          <span className={styles.info} title={aide}>
            i
          </span>
        )}
      </div>

      {jetons.length === 0 && (
        <p className={styles.hint}>Aucun élément pour l&apos;instant.</p>
      )}

      {jetons.map((j, i) => (
        <div key={j.id} className={styles.jetonLigne}>
          {numeroter && <span className={styles.jetonRang}>{i + 1}</span>}

          {j.kind === 'texte' ? (
            <input
              type="text"
              value={j.texte ?? ''}
              onChange={(e) => majJeton(j.id, { texte: e.target.value })}
              placeholder="Texte de l'élément"
              disabled={disabled}
            />
          ) : (
            <div className={styles.jetonMedia}>
              {j.kind === 'image' && j.media ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={j.media.url} alt="" />
              ) : j.media ? (
                <audio controls preload="none" src={j.media.url} />
              ) : null}
              <input
                type="text"
                value={j.texte ?? ''}
                onChange={(e) => majJeton(j.id, { texte: e.target.value })}
                placeholder="Légende (facultative)"
                disabled={disabled}
              />
            </div>
          )}

          <div className={styles.jetonOutils}>
            <button
              type="button"
              onClick={() => deplacer(i, -1)}
              disabled={disabled || i === 0}
              title="Monter"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => deplacer(i, 1)}
              disabled={disabled || i === jetons.length - 1}
              title="Descendre"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(jetons.filter((x) => x.id !== j.id))}
              disabled={disabled}
              title="Supprimer"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <div className={styles.jetonAjout}>
        <button type="button" className={styles.addChoice} onClick={() => ajouter('texte')} disabled={disabled}>
          + Texte
        </button>
        {choisirMedia && (
          <>
            <button type="button" className={styles.addChoice} onClick={() => ajouter('image')} disabled={disabled}>
              + Image
            </button>
            <button type="button" className={styles.addChoice} onClick={() => ajouter('audio')} disabled={disabled}>
              + Audio
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Nom lisible d'un jeton dans les menus de corrigé. */
function nomJeton(j: LectureJeton, i: number): string {
  if (j.texte?.trim()) return j.texte.trim().slice(0, 50);
  return j.kind === 'image' ? `Image ${i + 1}` : j.kind === 'audio' ? `Audio ${i + 1}` : `Élément ${i + 1}`;
}

// ════════════════════════════════════════════════════════════════
// MATRICE
// ════════════════════════════════════════════════════════════════

export function EditeurMatrice({ q, update, disabled }: EditeurProps) {
  const colonnes = q.choices ?? [];
  const lignes = q.matriceItems ?? [];
  const attendu = q.matriceCorrect ?? [];

  const multiple = !!q.matriceMultiple;

  const majColonnes = (suivantes: string[]) => {
    // Retirer une colonne décale les indices : le corrigé qui la visait
    // deviendrait faux sans qu'on le voie. On ne garde donc que les colonnes
    // qui existent encore, et une ligne qui n'en garde aucune redevient « pas
    // de bonne réponse ».
    const corrige = lignes.map((_, i) => {
      const gardees = matriceColonnes(attendu[i]).filter((c: number) => c < suivantes.length);
      return multiple ? gardees : (gardees[0] ?? -1);
    });
    update({ choices: suivantes, matriceCorrect: corrige });
  };

  const majLignes = (suivantes: string[]) =>
    update({
      matriceItems: suivantes,
      matriceCorrect: suivantes.map((_, i) => attendu[i] ?? (multiple ? [] : -1)),
    });

  // Coche ou décoche une colonne attendue sur une ligne
  const basculer = (li: number, colonne: number) => {
    const corrige: (number | number[])[] = lignes.map((_, i) => attendu[i] ?? (multiple ? [] : -1));
    const deja = matriceColonnes(corrige[li]);
    corrige[li] = deja.includes(colonne)
      ? deja.filter((c) => c !== colonne)
      : [...deja, colonne].sort((a, b) => a - b);
    update({ matriceCorrect: corrige });
  };

  return (
    <div className={styles.matriceEditeur}>
      <div className={styles.fieldLabel}>
        Réponses partagées (les colonnes)
        <span
          className={styles.info}
          title="Toutes les lignes de la matrice se répondent avec ces mêmes réponses. C'est tout l'intérêt du type : ne pas les réécrire à chaque affirmation."
        >
          i
        </span>
        {/* Comme le `multiple` du QCM classique. Le basculement CONVERTIT le
            corrigé déjà saisi au lieu de le jeter : le prof ne recommence pas
            son encodage parce qu'il a changé d'avis. */}
        <label className={styles.matriceMultiple}>
          <input
            type="checkbox"
            checked={multiple}
            disabled={disabled}
            onChange={(e) => {
              const vers = e.target.checked;
              update({
                matriceMultiple: vers,
                matriceCorrect: lignes.map((_, i) => {
                  const cols = matriceColonnes(attendu[i]);
                  return vers ? cols : (cols[0] ?? -1);
                }),
              });
            }}
          />
          Plusieurs réponses par ligne
        </label>
      </div>

      <div className={styles.modeleRow}>
        {MATRICE_MODELES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={styles.addChoice}
            onClick={() => majColonnes(m.colonnes)}
            disabled={disabled}
            title={m.colonnes.join(' · ')}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={styles.choices}>
        {colonnes.map((c, ci) => (
          <div key={ci} className={styles.choice}>
            <input
              type="text"
              value={c}
              onChange={(e) => {
                const suivantes = [...colonnes];
                suivantes[ci] = e.target.value;
                update({ choices: suivantes });
              }}
              placeholder={`Colonne ${ci + 1}`}
              disabled={disabled}
            />
            {colonnes.length > 2 && (
              <button
                type="button"
                className={styles.choiceDel}
                onClick={() => majColonnes(colonnes.filter((_, i) => i !== ci))}
                disabled={disabled}
                title="Supprimer cette colonne"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className={styles.addChoice}
          onClick={() => majColonnes([...colonnes, ''])}
          disabled={disabled}
        >
          + Ajouter une colonne
        </button>
      </div>

      <div className={styles.fieldLabel} style={{ marginTop: 12 }}>
        Les affirmations (les lignes)
        <span
          className={styles.info}
          title="Laissez « — » dans la colonne attendue pour qu'une ligne ne compte pas dans le barème : elle est alors posée pour elle-même, sans bonne réponse."
        >
          i
        </span>
        {/* Les LIGNES se mélangent pour chaque élève ; les colonnes jamais —
            elles forment une échelle (Vrai/Faux, Toujours→Jamais) qu'un
            désordre rendrait illisible. */}
        <label className={styles.matriceMultiple}>
          <input
            type="checkbox"
            checked={q.pasDeMelange === true}
            disabled={disabled}
            onChange={(e) => update({ pasDeMelange: e.target.checked })}
          />
          Garder cet ordre (ne pas mélanger)
        </label>
      </div>

      {lignes.map((item, li) => (
        <div key={li} className={styles.matriceLigne}>
          <input
            type="text"
            value={item}
            data-champ={`${q.id}-ligne-${li}`}
            onChange={(e) => {
              const suivantes = [...lignes];
              suivantes[li] = e.target.value;
              update({ matriceItems: suivantes });
            }}
            // Entrée ouvre l'affirmation suivante et y va : on saisit ses dix
            // items d'affilée sans viser « + Ajouter une affirmation ».
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              update(insererLigneMatrice(lignes, li, attendu, multiple));
              focaliserChamp(`${q.id}-ligne-${li + 1}`);
            }}
            placeholder={`Affirmation ${li + 1}`}
            disabled={disabled}
          />
          {/* Réponse simple : un menu suffit. Réponses multiples : des cases,
              parce qu'un menu ne sait pas en porter deux. */}
          {multiple ? (
            <span className={styles.matriceCases}>
              {colonnes.map((c, ci) => (
                <label key={ci} className={styles.matriceCase} title={c || `Colonne ${ci + 1}`}>
                  <input
                    type="checkbox"
                    checked={matriceColonnes(attendu[li]).includes(ci)}
                    onChange={() => basculer(li, ci)}
                    disabled={disabled}
                  />
                  {c || `C${ci + 1}`}
                </label>
              ))}
            </span>
          ) : (
            <select
              value={matriceColonnes(attendu[li])[0] ?? -1}
              onChange={(e) => {
                const corrige: (number | number[])[] = lignes.map((_, i) => attendu[i] ?? -1);
                corrige[li] = Number(e.target.value);
                update({ matriceCorrect: corrige });
              }}
              disabled={disabled}
              title="Colonne attendue"
            >
              <option value={-1}>— pas de bonne réponse</option>
              {colonnes.map((c, ci) => (
                <option key={ci} value={ci}>
                  {c || `Colonne ${ci + 1}`}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className={styles.choiceDel}
            onClick={() => majLignes(lignes.filter((_, i) => i !== li))}
            disabled={disabled}
            title="Supprimer cette ligne"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.addChoice}
        onClick={() => majLignes([...lignes, ''])}
        disabled={disabled}
      >
        + Ajouter une affirmation
      </button>

      <p className={styles.hint}>
        Barème partiel&nbsp;: 3 lignes justes sur 4 rapportent 75&nbsp;% des points.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// FLUORAGE PAR CATÉGORIES
// ════════════════════════════════════════════════════════════════

export function EditeurFluoCategories({ q, update, disabled }: EditeurProps) {
  const cats = q.fluoCategories ?? [];
  const attendu = q.fluoAttenduParCategorie ?? {};

  const ajouter = () => {
    const couleur = FLUO_COULEUR_IDS[cats.length % FLUO_COULEUR_IDS.length];
    update({
      fluoCategories: [...cats, { id: `cat-${Date.now()}-${cats.length}`, label: '', couleur }],
    });
  };

  const supprimer = (id: string) => {
    const suivant = { ...attendu };
    delete suivant[id];
    update({
      fluoCategories: cats.filter((c) => c.id !== id),
      fluoAttenduParCategorie: suivant,
    });
  };

  return (
    <div className={styles.fluoCatEditeur}>
      <div className={styles.fieldLabel}>
        Catégories de marquage
        <span
          className={styles.info}
          title="« Le sujet en rouge, le verbe en vert. » Sans catégorie, la question garde le soulignage à une seule couleur — les questionnaires déjà écrits ne changent pas."
        >
          i
        </span>
      </div>

      {cats.length === 0 && (
        <p className={styles.hint}>
          Aucune catégorie&nbsp;: l&apos;élève soulignera d&apos;une seule couleur, et vous
          corrigerez vous-même. Ajoutez-en pour un marquage en couleurs, corrigé
          automatiquement.
        </p>
      )}

      {cats.map((c) => (
        <div key={c.id} className={styles.fluoCatLigne}>
          <span className={styles.fluoPastille} style={{ background: fluoHex(c.couleur) }} />
          <input
            type="text"
            value={c.label}
            onChange={(e) =>
              update({
                fluoCategories: cats.map((x) =>
                  x.id === c.id ? { ...x, label: e.target.value } : x
                ),
              })
            }
            placeholder="Nom de la catégorie (ex. : le sujet)"
            disabled={disabled}
          />
          <select
            value={c.couleur}
            onChange={(e) =>
              update({
                fluoCategories: cats.map((x) =>
                  x.id === c.id ? { ...x, couleur: e.target.value } : x
                ),
              })
            }
            disabled={disabled}
          >
            {FLUO_COULEUR_IDS.map((id) => (
              <option key={id} value={id}>
                {FLUO_COULEURS[id].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.choiceDel}
            onClick={() => supprimer(c.id)}
            disabled={disabled}
            title="Supprimer cette catégorie"
          >
            ✕
          </button>
        </div>
      ))}

      <button type="button" className={styles.addChoice} onClick={ajouter} disabled={disabled}>
        + Ajouter une catégorie
      </button>

      {/* Le marquage attendu, catégorie par catégorie : le même geste que
          l'élève fera, avec le même composant — un aperçu qui ment sur le
          geste ne sert à rien. */}
      {cats.length > 0 && (q.fluoTexte ?? '').trim() && (
        <div className={styles.fluoAttenduZone}>
          <div className={styles.fieldLabel}>Marquage attendu — cliquez les mots</div>
          {cats.map((c) => (
            <div key={c.id} className={styles.fluoCatAttendu}>
              <div className={styles.fluoCatTitre}>
                <span className={styles.fluoPastille} style={{ background: fluoHex(c.couleur) }} />
                {c.label || 'Catégorie sans nom'}
              </div>
              <FluoExtrait
                texte={q.fluoTexte ?? ''}
                fluoWords={attendu[c.id] ?? []}
                onChange={
                  disabled
                    ? undefined
                    : (mots) => {
                        // Un mot n'appartient qu'à UNE catégorie : le poser
                        // ici le retire des autres, sinon la correction
                        // compterait deux fois le même mot.
                        const suivant: Record<string, number[]> = {};
                        Object.entries(attendu).forEach(([k, v]) => {
                          suivant[k] = k === c.id ? v : v.filter((m) => !mots.includes(m));
                        });
                        suivant[c.id] = mots;
                        update({ fluoAttenduParCategorie: suivant });
                      }
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// APPARIEMENT
// ════════════════════════════════════════════════════════════════

export function EditeurAppariement({ q, update, disabled, choisirMedia }: EditeurProps) {
  const gauche = q.appariementGauche ?? [];
  const droite = q.appariementDroite ?? [];
  const paires = q.appariementPaires ?? {};

  // ── Ce que le prof voit : DES PAIRES ──
  // Le modèle, lui, ne change pas : deux colonnes et un corrigé. On le lit
  // ligne à ligne à l'ouverture, on le recompose à chaque frappe. Les
  // appariements encodés avec l'ancienne forme (deux colonnes saisies
  // séparément) se rouvrent donc tels quels.
  const vises = new Set(Object.values(paires));
  const intrus = droite.filter((d) => !vises.has(d.id));
  const lignes = gauche.map((g) => ({
    g,
    reponse: droite.find((d) => d.id === paires[g.id])?.texte ?? '',
  }));

  const cle = (t: string) => t.trim().toLowerCase();

  /**
   * Paires + intrus → les trois champs du modèle.
   *
   * Deux lignes qui portent LA MÊME réponse partagent le même jeton de droite
   * (« deux répliques du même personnage ») : une seule pastille s'affiche à
   * l'élève, et les deux traits y arrivent. Le jeton déjà en base est réutilisé
   * quand son texte n'a pas changé — son identifiant voyage dans les réponses
   * déjà remises.
   */
  const recomposer = (
    suivantes: { g: LectureJeton; reponse: string }[],
    suivantsIntrus: LectureJeton[]
  ) => {
    const idsIntrus = new Set(suivantsIntrus.map((j) => j.id));
    const parCle = new Map<string, LectureJeton>();
    const droiteOut: LectureJeton[] = [];
    const pairesOut: Record<string, string> = {};

    for (const l of suivantes) {
      const texte = l.reponse.trim();
      if (!texte) continue;              // ligne sans réponse : pas de lien
      const k = cle(texte);
      let jd = parCle.get(k);
      if (!jd) {
        const ancien = droite.find((d) => !idsIntrus.has(d.id) && cle(d.texte ?? '') === k);
        jd = ancien
          ? { ...ancien, texte }
          : { id: generateJetonId(), kind: 'texte' as const, texte };
        parCle.set(k, jd);
        droiteOut.push(jd);
      }
      pairesOut[l.g.id] = jd.id;
    }

    update({
      appariementGauche: suivantes.map((l) => l.g),
      appariementDroite: [...droiteOut, ...suivantsIntrus],
      appariementPaires: pairesOut,
    });
  };

  const majLigne = (i: number, partial: Partial<{ g: LectureJeton; reponse: string }>) =>
    recomposer(
      lignes.map((l, k) => (k === i ? { ...l, ...partial } : l)),
      intrus
    );

  const ajouter = (kind: LectureJeton['kind']) => {
    const nouveau: LectureJeton = { id: generateJetonId(), kind, texte: '' };
    if (kind === 'texte') {
      recomposer([...lignes, { g: nouveau, reponse: '' }], intrus);
      focaliserChamp(`${q.id}-apparG-${lignes.length}`);
      return;
    }
    // Image et audio : le jeton n'existe qu'une fois le fichier déposé.
    choisirMedia?.(kind, (media) =>
      recomposer([...lignes, { g: { ...nouveau, media }, reponse: '' }], intrus)
    );
  };

  const deplacer = (i: number, sens: -1 | 1) => {
    const cible = i + sens;
    if (cible < 0 || cible >= lignes.length) return;
    const copie = [...lignes];
    [copie[i], copie[cible]] = [copie[cible], copie[i]];
    recomposer(copie, intrus);
  };

  return (
    <div className={styles.apparEditeur}>
      <div className={styles.fieldLabel}>
        Les paires — l’élément, puis sa réponse
        <span
          className={styles.info}
          title="Une ligne = un lien. L'élève, lui, reçoit les réponses MÉLANGÉES, dans un ordre propre à chacun — l'ordre de saisie ne lui donne donc rien. Deux lignes qui portent la même réponse partagent la même pastille : deux répliques peuvent être du même personnage."
        >
          i
        </span>
      </div>

      {lignes.length === 0 && (
        <p className={styles.hint}>Aucune paire pour l&apos;instant.</p>
      )}

      {lignes.map((l, i) => (
        <div key={l.g.id} className={styles.apparLigne}>
          <span className={styles.jetonRang}>{i + 1}</span>

          {l.g.kind === 'texte' ? (
            <input
              type="text"
              value={l.g.texte ?? ''}
              data-champ={`${q.id}-apparG-${i}`}
              onChange={(e) => majLigne(i, { g: { ...l.g, texte: e.target.value } })}
              // Entrée passe au champ de la réponse : on écrit une paire d'un
              // trait, sans lâcher le clavier.
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                focaliserChamp(`${q.id}-apparD-${i}`);
              }}
              placeholder="Ce que l’élève doit relier"
              disabled={disabled}
            />
          ) : (
            <div className={styles.jetonMedia}>
              {l.g.kind === 'image' && l.g.media ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={l.g.media.url} alt="" />
              ) : l.g.media ? (
                <audio controls preload="none" src={l.g.media.url} />
              ) : null}
              <input
                type="text"
                value={l.g.texte ?? ''}
                data-champ={`${q.id}-apparG-${i}`}
                onChange={(e) => majLigne(i, { g: { ...l.g, texte: e.target.value } })}
                placeholder="Légende (facultative)"
                disabled={disabled}
              />
            </div>
          )}

          <span className={styles.apparFleche}>→</span>

          <input
            type="text"
            value={l.reponse}
            data-champ={`${q.id}-apparD-${i}`}
            onChange={(e) => majLigne(i, { reponse: e.target.value })}
            // Entrée ouvre la paire suivante et va sur son premier champ.
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const suivantes = [...lignes];
              suivantes.splice(i + 1, 0, {
                g: { id: generateJetonId(), kind: 'texte', texte: '' },
                reponse: '',
              });
              recomposer(suivantes, intrus);
              focaliserChamp(`${q.id}-apparG-${i + 1}`);
            }}
            placeholder="Sa réponse"
            disabled={disabled}
          />

          <div className={styles.jetonOutils}>
            <button type="button" onClick={() => deplacer(i, -1)} disabled={disabled || i === 0} title="Monter">
              ↑
            </button>
            <button
              type="button"
              onClick={() => deplacer(i, 1)}
              disabled={disabled || i === lignes.length - 1}
              title="Descendre"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => recomposer(lignes.filter((_, k) => k !== i), intrus)}
              disabled={disabled}
              title="Supprimer cette paire"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <div className={styles.jetonAjout}>
        <button type="button" className={styles.addChoice} onClick={() => ajouter('texte')} disabled={disabled}>
          + Paire
        </button>
        {choisirMedia && (
          <>
            <button type="button" className={styles.addChoice} onClick={() => ajouter('image')} disabled={disabled}>
              + Paire avec image
            </button>
            <button type="button" className={styles.addChoice} onClick={() => ajouter('audio')} disabled={disabled}>
              + Paire avec audio
            </button>
          </>
        )}
      </div>

      {/* ── LES INTRUS ──
          Des réponses qui ne vont avec rien. Sans elles, le dernier lien se
          trouve par élimination : autant de réponses que de questions, il ne
          reste qu'une pastille libre. */}
      <ListeJetons
        titre="Réponses en trop (intrus)"
        aide="Elles s'affichent avec les autres, mélangées, mais ne sont la réponse de rien. Facultatif."
        jetons={intrus}
        disabled={disabled}
        onChange={(suivantsIntrus) => recomposer(lignes, suivantsIntrus)}
      />

      <p className={styles.hint}>
        Barème partiel&nbsp;: 4 liens justes sur 6 rapportent deux tiers des points.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REMISE EN ORDRE
// ════════════════════════════════════════════════════════════════

export function EditeurOrdre({ q, update, disabled, choisirMedia }: EditeurProps) {
  return (
    <div>
      <ListeJetons
        titre="Les éléments, DANS LE BON ORDRE"
        aide="Saisissez-les dans l'ordre attendu : c'est votre saisie qui fait le corrigé. L'élève, lui, les reçoit mélangés — le mélange est fait par le serveur, avec une graine stable pour qu'il retrouve son travail en place s'il revient sur sa copie."
        jetons={q.ordreItems ?? []}
        onChange={(ordreItems) => update({ ordreItems })}
        disabled={disabled}
        choisirMedia={choisirMedia}
        numeroter
      />
      <p className={styles.hint}>
        Barème partiel&nbsp;: on compte les éléments qui tombent à la bonne place,
        pas «&nbsp;toute la suite est exacte&nbsp;» — un seul décalage n&apos;annule
        pas tout.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// IMAGE À ANNOTER
// ════════════════════════════════════════════════════════════════

export function EditeurImageAnnotee({ q, update, disabled }: EditeurProps) {
  const cibles = q.annotations ?? [];

  const poserPoint = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    update({
      annotations: [
        ...cibles,
        {
          id: `a-${Date.now()}-${cibles.length}`,
          label: '',
          x,
          y,
          // Le côté se devine du clic : un point à gauche de l'image appelle
          // une case à gauche. Le prof peut toujours le changer.
          cote: x < 50 ? 'gauche' : 'droite',
        },
      ],
    });
  };

  const maj = (id: string, partial: Partial<LectureAnnotationCible>) =>
    update({ annotations: cibles.map((c) => (c.id === id ? { ...c, ...partial } : c)) });

  if (!q.image) {
    return (
      <p className={styles.hint}>
        Joignez d&apos;abord une image à la question (bouton «&nbsp;Image&nbsp;» ci-dessus)&nbsp;:
        c&apos;est elle que l&apos;élève annotera.
      </p>
    );
  }

  return (
    <div className={styles.annotEditeur}>
      <div className={styles.fieldLabel}>
        Points à annoter — cliquez sur l&apos;image pour en poser un
        <span
          className={styles.info}
          title="Chaque point reçoit une case de dépôt, à gauche ou à droite de l'image, reliée à lui par un trait. L'élève tire les étiquettes de la réserve vers les cases."
        >
          i
        </span>
      </div>

      <div className={styles.annotToile} onClick={poserPoint}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={q.image.url} alt="" />
        {cibles.map((c, i) => (
          <span key={c.id} className={styles.annotPoint} style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            {i + 1}
          </span>
        ))}
      </div>

      {cibles.length === 0 && (
        <p className={styles.hint}>Aucun point posé. Cliquez sur l&apos;image.</p>
      )}

      {cibles.map((c, i) => (
        <div key={c.id} className={styles.annotLigne}>
          <span className={styles.jetonRang}>{i + 1}</span>
          <input
            type="text"
            value={c.label}
            onChange={(e) => maj(c.id, { label: e.target.value })}
            placeholder="Étiquette attendue à cet endroit"
            disabled={disabled}
          />
          <select
            value={c.cote}
            onChange={(e) => maj(c.id, { cote: e.target.value as 'gauche' | 'droite' })}
            disabled={disabled}
            title="De quel côté placer la case"
          >
            <option value="gauche">← Case à gauche</option>
            <option value="droite">Case à droite →</option>
          </select>
          <button
            type="button"
            className={styles.choiceDel}
            onClick={() => update({ annotations: cibles.filter((x) => x.id !== c.id) })}
            disabled={disabled}
            title="Supprimer ce point"
          >
            ✕
          </button>
        </div>
      ))}

      <div className={styles.fieldLabel} style={{ marginTop: 10 }}>
        Réserve d&apos;étiquettes
      </div>
      <div className={styles.modeRow}>
        <label className={styles.modeOpt}>
          <input
            type="radio"
            checked={(q.annotationsReserve ?? 'bas') === 'bas'}
            onChange={() => update({ annotationsReserve: 'bas' })}
            disabled={disabled}
          />
          Sous l&apos;image
        </label>
        <label className={styles.modeOpt}>
          <input
            type="radio"
            checked={q.annotationsReserve === 'haut'}
            onChange={() => update({ annotationsReserve: 'haut' })}
            disabled={disabled}
          />
          Au-dessus de l&apos;image
        </label>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ENSEMBLES
// ════════════════════════════════════════════════════════════════

export function EditeurEnsembles({ q, update, disabled, choisirMedia }: EditeurProps) {
  const boites = q.ensembles ?? [];
  const items = q.ensembleItems ?? [];
  const affectations = q.ensembleAffectations ?? {};

  // ── Chaque ensemble porte SES étiquettes ──
  // Le modèle ne change pas : une liste d'étiquettes à plat et un corrigé qui
  // dit où va chacune. Mais le prof n'a plus trois étapes à enchaîner (nommer
  // les boîtes, taper les étiquettes, les apparier) : il remplit une boîte,
  // puis l'autre, et le corrigé s'écrit tout seul.
  const itemsDe = (bid: string) => items.filter((j) => affectations[j.id] === bid);
  const orphelines = items.filter((j) => !affectations[j.id]);

  const majBoite = (bid: string, suivants: LectureJeton[]) => {
    const restants = new Set(suivants.map((j) => j.id));
    const aff: Record<string, string> = {};
    Object.entries(affectations).forEach(([k, v]) => {
      // Une étiquette retirée de sa boîte perd son affectation
      if (v === bid && !restants.has(k)) return;
      aff[k] = v;
    });
    suivants.forEach((j) => {
      aff[j.id] = bid;
    });
    update({
      ensembleItems: [...items.filter((j) => affectations[j.id] !== bid), ...suivants],
      ensembleAffectations: aff,
    });
  };

  /** Supprimer une boîte emporte ses étiquettes : à l'écran elles sont DEDANS. */
  const supprimerBoite = (bid: string) => {
    const aff: Record<string, string> = {};
    Object.entries(affectations).forEach(([k, v]) => {
      if (v !== bid) aff[k] = v;
    });
    update({
      ensembles: boites.filter((b) => b.id !== bid),
      ensembleItems: items.filter((j) => affectations[j.id] !== bid),
      ensembleAffectations: aff,
    });
  };

  return (
    <div className={styles.ensEditeur}>
      <div className={styles.fieldLabel}>
        Les ensembles
        <span
          className={styles.info}
          title="Au moins deux : trier dans une seule boîte n'est pas un tri. Remplissez chaque ensemble avec ce qui lui appartient — l'élève, lui, reçoit toutes les étiquettes MÉLANGÉES, dans un ordre propre à chacun."
        >
          i
        </span>
      </div>

      {boites.map((b, bi) => (
        <div key={b.id} className={styles.ensBoite}>
          <div className={styles.ensBoiteEntete}>
            <input
              type="text"
              value={b.titre}
              onChange={(e) =>
                update({
                  ensembles: boites.map((x) => (x.id === b.id ? { ...x, titre: e.target.value } : x)),
                })
              }
              placeholder={`Nom de l’ensemble ${bi + 1}`}
              disabled={disabled}
            />
            <button
              type="button"
              className={styles.choiceDel}
              onClick={() => supprimerBoite(b.id)}
              disabled={disabled}
              title="Supprimer cet ensemble et ses étiquettes"
            >
              ✕
            </button>
          </div>

          <ListeJetons
            titre="Ce qui appartient à cet ensemble"
            jetons={itemsDe(b.id)}
            disabled={disabled}
            choisirMedia={choisirMedia}
            onChange={(suivants) => majBoite(b.id, suivants)}
          />
        </div>
      ))}

      <button
        type="button"
        className={styles.addChoice}
        onClick={() =>
          update({
            ensembles: [...boites, { id: `e-${Date.now()}-${boites.length}`, titre: '' }],
          })
        }
        disabled={disabled}
      >
        + Ajouter un ensemble
      </button>

      {/* ── Rattrapage ──
          Les questions encodées avant ce jour pouvaient laisser une étiquette
          sans ensemble : elle n'appartient à aucune boîte, donc à aucun bloc
          ci-dessus. Sans ce rappel elle disparaîtrait de l'écran tout en
          restant en base. Le bloc n'apparaît que s'il y en a. */}
      {orphelines.length > 0 && (
        <>
          <div className={styles.fieldLabel} style={{ marginTop: 12 }}>
            Étiquettes sans ensemble — à ranger
          </div>
          {orphelines.map((j, i) => (
            <div key={j.id} className={styles.apparPaire}>
              <span className={styles.apparNom}>{nomJeton(j, i)}</span>
              <span className={styles.apparFleche}>→</span>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  update({
                    ensembleAffectations: { ...affectations, [j.id]: e.target.value },
                  });
                }}
                disabled={disabled}
              >
                <option value="">— choisir un ensemble</option>
                {boites.map((b, bi) => (
                  <option key={b.id} value={b.id}>
                    {b.titre || `Ensemble ${bi + 1}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.choiceDel}
                onClick={() => update({ ensembleItems: items.filter((x) => x.id !== j.id) })}
                disabled={disabled}
                title="Supprimer cette étiquette"
              >
                ✕
              </button>
            </div>
          ))}
        </>
      )}

      <p className={styles.hint}>
        Barème partiel&nbsp;: on compte les étiquettes tombées dans le bon ensemble.
      </p>
    </div>
  );
}
