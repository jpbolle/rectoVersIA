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
import { FLUO_COULEURS, FLUO_COULEUR_IDS, fluoHex, generateJetonId } from '@/types/lecture';
import { MATRICE_MODELES } from '@/types/autoevaluation';
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

  const majColonnes = (suivantes: string[]) => {
    // Retirer une colonne décale les indices : le corrigé qui la visait
    // deviendrait faux sans qu'on le voie. On le remet à « aucune réponse ».
    const corrige = lignes.map((_, i) =>
      typeof attendu[i] === 'number' && attendu[i] < suivantes.length ? attendu[i] : -1
    );
    update({ choices: suivantes, matriceCorrect: corrige });
  };

  const majLignes = (suivantes: string[]) =>
    update({
      matriceItems: suivantes,
      matriceCorrect: suivantes.map((_, i) => attendu[i] ?? -1),
    });

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
      </div>

      {lignes.map((item, li) => (
        <div key={li} className={styles.matriceLigne}>
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const suivantes = [...lignes];
              suivantes[li] = e.target.value;
              update({ matriceItems: suivantes });
            }}
            placeholder={`Affirmation ${li + 1}`}
            disabled={disabled}
          />
          <select
            value={attendu[li] ?? -1}
            onChange={(e) => {
              const corrige = lignes.map((_, i) => attendu[i] ?? -1);
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

  /** Retirer un jeton nettoie les paires qui le visaient — sinon le corrigé
      pointe vers un élément disparu, et la question devient insoluble. */
  const nettoyer = (g: LectureJeton[], d: LectureJeton[]) => {
    const idsG = new Set(g.map((j) => j.id));
    const idsD = new Set(d.map((j) => j.id));
    const suivant: Record<string, string> = {};
    Object.entries(paires).forEach(([k, v]) => {
      if (idsG.has(k) && idsD.has(v)) suivant[k] = v;
    });
    return suivant;
  };

  return (
    <div className={styles.apparEditeur}>
      <ListeJetons
        titre="Colonne de gauche"
        aide="Texte, image ou enregistrement : c'est ce que l'élève devra relier."
        jetons={gauche}
        disabled={disabled}
        choisirMedia={choisirMedia}
        onChange={(g) =>
          update({ appariementGauche: g, appariementPaires: nettoyer(g, droite) })
        }
      />

      <ListeJetons
        titre="Colonne de droite"
        aide="Les réponses. Vous pouvez en mettre plus qu'à gauche : les éléments en trop font des intrus."
        jetons={droite}
        disabled={disabled}
        onChange={(d) =>
          update({ appariementDroite: d, appariementPaires: nettoyer(gauche, d) })
        }
      />

      <div className={styles.fieldLabel}>
        Corrigé — que relie-t-on à quoi&nbsp;?
        <span
          className={styles.info}
          title="Deux éléments de gauche peuvent viser la même réponse : deux répliques peuvent être du même personnage."
        >
          i
        </span>
      </div>

      {gauche.length === 0 || droite.length === 0 ? (
        <p className={styles.hint}>Remplissez d&apos;abord les deux colonnes.</p>
      ) : (
        gauche.map((g, i) => (
          <div key={g.id} className={styles.apparPaire}>
            <span className={styles.apparNom}>{nomJeton(g, i)}</span>
            <span className={styles.apparFleche}>→</span>
            <select
              value={paires[g.id] ?? ''}
              onChange={(e) => {
                const suivant = { ...paires };
                if (e.target.value) suivant[g.id] = e.target.value;
                else delete suivant[g.id];
                update({ appariementPaires: suivant });
              }}
              disabled={disabled}
            >
              <option value="">— aucune</option>
              {droite.map((d, j) => (
                <option key={d.id} value={d.id}>
                  {nomJeton(d, j)}
                </option>
              ))}
            </select>
          </div>
        ))
      )}

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

  const majBoites = (suivantes: LectureEnsemble[]) => {
    // Une boîte supprimée laisse ses étiquettes sans destination : on les
    // remet « non affectées » plutôt que de garder un corrigé fantôme.
    const ids = new Set(suivantes.map((b) => b.id));
    const aff: Record<string, string> = {};
    Object.entries(affectations).forEach(([k, v]) => {
      if (ids.has(v)) aff[k] = v;
    });
    update({ ensembles: suivantes, ensembleAffectations: aff });
  };

  return (
    <div className={styles.ensEditeur}>
      <div className={styles.fieldLabel}>
        Les ensembles
        <span className={styles.info} title="Au moins deux : trier dans une seule boîte n'est pas un tri.">
          i
        </span>
      </div>

      {boites.map((b) => (
        <div key={b.id} className={styles.choice}>
          <input
            type="text"
            value={b.titre}
            onChange={(e) =>
              update({
                ensembles: boites.map((x) => (x.id === b.id ? { ...x, titre: e.target.value } : x)),
              })
            }
            placeholder="Nom de l'ensemble"
            disabled={disabled}
          />
          <button
            type="button"
            className={styles.choiceDel}
            onClick={() => majBoites(boites.filter((x) => x.id !== b.id))}
            disabled={disabled}
            title="Supprimer cet ensemble"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.addChoice}
        onClick={() =>
          majBoites([...boites, { id: `e-${Date.now()}-${boites.length}`, titre: '' }])
        }
        disabled={disabled}
      >
        + Ajouter un ensemble
      </button>

      <ListeJetons
        titre="Les étiquettes à ranger"
        jetons={items}
        disabled={disabled}
        choisirMedia={choisirMedia}
        onChange={(suivants) => {
          const ids = new Set(suivants.map((j) => j.id));
          const aff: Record<string, string> = {};
          Object.entries(affectations).forEach(([k, v]) => {
            if (ids.has(k)) aff[k] = v;
          });
          update({ ensembleItems: suivants, ensembleAffectations: aff });
        }}
      />

      <div className={styles.fieldLabel}>Corrigé — dans quel ensemble va chaque étiquette&nbsp;?</div>

      {items.length === 0 || boites.length === 0 ? (
        <p className={styles.hint}>Créez d&apos;abord les ensembles et les étiquettes.</p>
      ) : (
        items.map((j, i) => (
          <div key={j.id} className={styles.apparPaire}>
            <span className={styles.apparNom}>{nomJeton(j, i)}</span>
            <span className={styles.apparFleche}>→</span>
            <select
              value={affectations[j.id] ?? ''}
              onChange={(e) => {
                const suivant = { ...affectations };
                if (e.target.value) suivant[j.id] = e.target.value;
                else delete suivant[j.id];
                update({ ensembleAffectations: suivant });
              }}
              disabled={disabled}
            >
              <option value="">— aucun</option>
              {boites.map((b, bi) => (
                <option key={b.id} value={b.id}>
                  {b.titre || `Ensemble ${bi + 1}`}
                </option>
              ))}
            </select>
          </div>
        ))
      )}
    </div>
  );
}
