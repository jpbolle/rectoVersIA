'use client';

// Les six sections d'une lecture de cours FLE (plan du 2026-10-08).
//
// Chaque section reçoit son contenu (JSON produit par Claude) et, pour
// celles où l'élève agit, ses réponses et un `onReponse` : la page enregistre
// (PATCH /api/fle/lectures/[id], `reponses` fusionnées par clé). En mode prof
// (`readOnly`), on voit ce que l'élève a fait, rien ne se modifie.
//
// Clés des réponses :
//   ref_p{i}_q{j}  → { choix?: number; texte?: string; exempleVu?: boolean }
//   passerelle     → { texte: string }

import { useState } from 'react';
import { DiagramWorkspace } from '@/components/Diagram/DiagramWorkspace';
import Flashcard from '@/components/Flashcard/Flashcard';
import ExercicesVocabulaire, { TYPES_EXERCICES, TestDeLecture, parlerFrancais } from '@/components/ExercicesVocabulaire/ExercicesVocabulaire';
import type { TypeExercice } from '@/components/ExercicesVocabulaire/ExercicesVocabulaire';
import type {
  AvisResume,
  ContenuGrammaire,
  ContenuPasserelle,
  ContenuReformulation,
  ContenuResume,
  ContenuSaillants,
  ContenuVocabulaire,
  CorrectionPhrases,
  LectureCours,
  QuestionReformulation,
  ResultatExercice,
} from '@/types/lecture-cours';
import { SECTIONS_GENEREES, SECTION_LIBELLES } from '@/types/lecture-cours';
import type { TypeExercice as TypeEx } from '@/components/ExercicesVocabulaire/ExercicesVocabulaire';
import styles from './LectureCoursSections.module.css';

export type Reponses = Record<string, unknown>;

export interface ReponseQuestion {
  choix?: number;
  texte?: string;
  exempleVu?: boolean;
}

export type CleCorrection = 'passerelle' | 'resumeEleve';

interface AvecReponses {
  reponses: Reponses;
  onReponse?: (cle: string, valeur: unknown) => void;
  // Le bouton IA : envoie le texte de l'élève, le verdict revient dans `reponses`
  onCorriger?: (cle: CleCorrection, texte: string) => Promise<void>;
  readOnly?: boolean;
}

// Le verdict de Claude sur un texte libre, phrase par phrase (passerelle)
function TableauCorrection({ correction }: { correction: CorrectionPhrases }) {
  return (
    <div className={styles.verdictBloc}>
      {correction.commentaire && <p className={styles.verdictCommentaire}>💬 {correction.commentaire}</p>}
      {correction.phrases.length > 0 && (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Ta phrase</th>
              <th>Grammaire et lexique</th>
              <th>La même idée, bien dite</th>
            </tr>
          </thead>
          <tbody>
            {correction.phrases.map((p, i) => (
              <tr key={i}>
                <td>{p.phrase}</td>
                <td>{p.remarques}</td>
                <td className={styles.tableauBon}>{p.reformulation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Le bouton IA et son état (en cours, erreur)
function BoutonIA({
  libelle,
  enCours,
  disabled,
  onClick,
}: {
  libelle: string;
  enCours: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.btnIA} disabled={disabled || enCours} onClick={onClick}>
      {enCours ? '✨ Claude relit…' : `✨ ${libelle}`}
    </button>
  );
}

export function Paragraphes({ texte }: { texte: string }) {
  return (
    <>
      {texte
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l, i) => (
          <p key={i} className={styles.ligne}>
            {l}
          </p>
        ))}
    </>
  );
}

// ── 1. Le cours en bref ──
export function SectionResume({ contenu }: { contenu: ContenuResume }) {
  return <Paragraphes texte={contenu.texte} />;
}

// ── 2. Les points importants ──
export function SectionSaillants({ contenu }: { contenu: ContenuSaillants }) {
  return (
    <ol className={styles.points}>
      {contenu.points.map((p, i) => (
        <li key={i} className={styles.point}>
          {p.texte}
        </li>
      ))}
    </ol>
  );
}

// ── 3. Le vocabulaire : des fiches à retourner, puis les exercices Daspalecte ──
export function SectionVocabulaire({
  contenu,
  langue,
  niveau,
  reponses,
  onReponse,
  readOnly,
}: { contenu: ContenuVocabulaire; langue: string; niveau: string } & AvecReponses) {
  // Recto = le mot (d'abord), ou la traduction (« à l'envers »)
  const [motDabord, setMotDabord] = useState(true);
  const [ouvert, setOuvert] = useState<'' | 'exercices' | 'test'>('');
  const resultatTest = reponses.vocab_test as ResultatExercice | undefined;

  const resultats: Partial<Record<TypeExercice, ResultatExercice>> = {};
  TYPES_EXERCICES.forEach((t) => {
    const r = reponses[`vocab_${t}`] as ResultatExercice | undefined;
    if (r) resultats[t] = r;
  });
  const nbFaits = Object.keys(resultats).length;

  return (
    <div className={styles.vocabulaire}>
      <div className={styles.fichesBarre}>
        <span className={styles.fichesTitre}>Les fiches — clique pour retourner</span>
        <span className={styles.fichesOrdre}>
          <button type="button" className={`${styles.fichesOrdreBtn} ${motDabord ? styles.fichesOrdreActif : ''}`} onClick={() => setMotDabord(true)}>
            Mot d’abord
          </button>
          <button type="button" className={`${styles.fichesOrdreBtn} ${!motDabord ? styles.fichesOrdreActif : ''}`} onClick={() => setMotDabord(false)}>
            Traduction d’abord
          </button>
        </span>
      </div>
      <div className={styles.fiches}>
        {contenu.mots.map((m, i) => {
          const faceMot = (
            <>
              <span className={styles.ficheMot}>{m.mot}</span>
              {/* Pas un <button> : la fiche entière en est déjà un (HTML interdit
                  l'imbrication). Un span cliquable, qui n'alerte pas la carte. */}
              <span
                role="button"
                tabIndex={0}
                className={styles.ficheEcouter}
                onClick={(e) => {
                  e.stopPropagation();
                  parlerFrancais(m.mot);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    parlerFrancais(m.mot);
                  }
                }}
                aria-label={`Écouter ${m.mot}`}
              >
                🔊
              </span>
            </>
          );
          const faceSens = (
            <>
              {m.traduction && <span className={styles.ficheTraduction}>{m.traduction}</span>}
              <span className={styles.ficheDef}>{m.definitionSimple}</span>
              {m.exemple && <span className={styles.ficheExemple}>« {m.exemple} »</span>}
            </>
          );
          return (
            <Flashcard
              key={`${i}-${motDabord}`}
              recto={motDabord ? faceMot : faceSens}
              verso={motDabord ? faceSens : faceMot}
              ariaLabel={`Retourner la fiche ${m.mot}`}
            />
          );
        })}
      </div>

      {contenu.exercices && (
        <div className={styles.exercices}>
          {ouvert === 'exercices' ? (
            <ExercicesVocabulaire
              donnees={contenu.exercices}
              langue={langue}
              niveau={niveau}
              resultats={resultats}
              readOnly={readOnly}
              onResultat={onReponse ? (type, r) => onReponse(`vocab_${type}`, r) : undefined}
              onFermer={() => setOuvert('')}
            />
          ) : ouvert === 'test' && contenu.exercices.test?.questions?.length ? (
            <TestDeLecture
              questions={contenu.exercices.test.questions}
              pairs={contenu.exercices.matching?.pairs ?? []}
              resultat={resultatTest}
              readOnly={readOnly}
              onResultat={onReponse ? (r) => onReponse('vocab_test', r) : undefined}
              onFermer={() => setOuvert('')}
            />
          ) : (
            <div className={styles.exercicesBoutons}>
              <button type="button" className={styles.exercicesBtn} onClick={() => setOuvert('exercices')}>
                🎮 {readOnly ? 'Voir les exercices' : nbFaits === 0 ? 'Faire les exercices' : 'Reprendre les exercices'}
                {nbFaits > 0 && <span className={styles.exercicesCompte}>{nbFaits}/{TYPES_EXERCICES.length} réussis</span>}
              </button>
              {contenu.exercices.test?.questions?.length ? (
                <button type="button" className={`${styles.exercicesBtn} ${styles.exercicesBtnSecondaire}`} onClick={() => setOuvert('test')}>
                  📝 Test de lecture
                  {resultatTest && (
                    <span className={styles.exercicesCompte}>
                      {Math.round((resultatTest.score / Math.max(1, resultatTest.total)) * 100)} %
                    </span>
                  )}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 4. Le cours partie par partie, avec ses questions ──
function cleQuestion(p: number, q: number): string {
  return `ref_p${p}_q${q}`;
}

function estJuste(q: QuestionReformulation, r: ReponseQuestion | undefined): boolean | null {
  if (!r || r.choix === undefined) return null;
  if (q.type === 'ouverte') return null;
  return r.choix === q.bonne;
}

function Question({
  question,
  reponse,
  onReponse,
  readOnly,
}: {
  question: QuestionReformulation;
  reponse: ReponseQuestion | undefined;
  onReponse?: (valeur: ReponseQuestion) => void;
  readOnly?: boolean;
}) {
  const juste = estJuste(question, reponse);
  const repondu = reponse?.choix !== undefined;
  const choix = question.type === 'vrai-faux' ? ['Vrai', 'Faux'] : question.choix ?? [];

  return (
    <li className={styles.question}>
      <span className={styles.questionEnonce}>{question.enonce}</span>
      {question.aide && <span className={styles.questionAide}>{question.aide}</span>}

      {question.type !== 'ouverte' ? (
        <>
          <div className={styles.choix}>
            {choix.map((c, i) => {
              const choisi = reponse?.choix === i;
              const classe = repondu
                ? i === question.bonne
                  ? styles.choixJuste
                  : choisi
                    ? styles.choixFaux
                    : ''
                : '';
              return (
                <button
                  key={i}
                  type="button"
                  className={`${styles.choixBtn} ${classe}`}
                  disabled={repondu || readOnly || !onReponse}
                  onClick={() => onReponse?.({ ...(reponse ?? {}), choix: i })}
                >
                  {c}
                </button>
              );
            })}
          </div>
          {juste !== null && (
            <span className={`${styles.verdict} ${juste ? styles.verdictJuste : styles.verdictFaux}`}>
              {juste ? '✔ Bravo, c’est juste.' : '✘ Ce n’est pas ça — la bonne réponse est en vert.'}
            </span>
          )}
          {readOnly && !repondu && <span className={styles.enregistre}>Pas encore répondu.</span>}
        </>
      ) : (
        <>
          <textarea
            className={styles.reponseLibre}
            rows={2}
            value={reponse?.texte ?? ''}
            placeholder={readOnly ? 'Pas encore répondu.' : 'Écris ta réponse ici…'}
            disabled={readOnly || !onReponse}
            onChange={(e) => onReponse?.({ ...(reponse ?? {}), texte: e.target.value })}
          />
          {question.exempleReponse &&
            (reponse?.exempleVu || readOnly ? (
              <p className={styles.exemple}>💡 Exemple de réponse : {question.exempleReponse}</p>
            ) : (
              <button
                type="button"
                className={styles.lienExemple}
                disabled={!(reponse?.texte ?? '').trim()}
                title={!(reponse?.texte ?? '').trim() ? 'Écris d’abord ta réponse' : undefined}
                onClick={() => onReponse?.({ ...(reponse ?? {}), exempleVu: true })}
              >
                Voir un exemple de réponse
              </button>
            ))}
        </>
      )}
    </li>
  );
}

// Une question est « répondue » : un choix posé (fermée) ou un texte écrit (ouverte)
function questionRepondue(q: QuestionReformulation, r: ReponseQuestion | undefined): boolean {
  if (!r) return false;
  return q.type === 'ouverte' ? !!(r.texte ?? '').trim() : r.choix !== undefined;
}

export function SectionReformulation({
  contenu,
  reponses,
  onReponse,
  readOnly,
}: { contenu: ContenuReformulation } & AvecReponses) {
  // La suite du texte reste FLOUE tant que les questions de la partie
  // précédente n'ont pas toutes une réponse (demande JP, 2026-10-08) : on lit,
  // on répond, puis on continue. Le prof voit tout.
  const partieRepondue = (i: number) =>
    contenu.parties[i].questions.every((q, j) => questionRepondue(q, reponses[cleQuestion(i, j)] as ReponseQuestion | undefined));

  return (
    <div className={styles.parties}>
      {contenu.parties.map((p, i) => {
        const debloquee = readOnly || i === 0 || partieRepondue(i - 1);
        if (!debloquee) {
          return (
            <section key={i} className={styles.partieFloue} aria-hidden="true">
              <div className={styles.partieFlouContenu}>
                <h3 className={styles.partieTitre}>
                  <span className={styles.partieNumero}>{i + 1}</span> {p.titre}
                </h3>
                <Paragraphes texte={p.texte} />
              </div>
              <div className={styles.partieVerrou}>
                🔒 Réponds aux questions de la partie {i} pour lire la suite.
              </div>
            </section>
          );
        }
        const fermees = p.questions.filter((q) => q.type !== 'ouverte');
        const justes = fermees.filter((q) => {
          const j = p.questions.indexOf(q);
          return estJuste(q, reponses[cleQuestion(i, j)] as ReponseQuestion | undefined) === true;
        }).length;
        const repondues = fermees.filter((q) => {
          const j = p.questions.indexOf(q);
          return (reponses[cleQuestion(i, j)] as ReponseQuestion | undefined)?.choix !== undefined;
        }).length;
        return (
          <section key={i}>
            <h3 className={styles.partieTitre}>
              <span className={styles.partieNumero}>{i + 1}</span> {p.titre}
              {fermees.length > 0 && repondues > 0 && (
                <span className={styles.partieScore}>
                  {justes}/{fermees.length}
                </span>
              )}
            </h3>
            <Paragraphes texte={p.texte} />
            <ul className={styles.questions}>
              {p.questions.map((q, j) => (
                <Question
                  key={j}
                  question={q}
                  reponse={reponses[cleQuestion(i, j)] as ReponseQuestion | undefined}
                  onReponse={onReponse ? (v) => onReponse(cleQuestion(i, j), v) : undefined}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ── 5. Des phrases à la loupe ──
function noop() {}

function Arbre({ phrase }: { phrase: ContenuGrammaire['phrases'][number] }) {
  const [ouvert, setOuvert] = useState(false);
  if (!phrase.arbre) return null;
  return (
    <>
      <button type="button" className={styles.arbreToggle} onClick={() => setOuvert((o) => !o)}>
        {ouvert ? '▾ Cacher le schéma' : '▸ Voir la phrase en schéma'}
      </button>
      {ouvert && (
        <div className={styles.arbre}>
          <DiagramWorkspace diagram={phrase.arbre} onChange={noop} readOnly embedded lockType />
        </div>
      )}
    </>
  );
}

export function SectionGrammaire({ contenu }: { contenu: ContenuGrammaire }) {
  return (
    <div className={styles.phrases}>
      {contenu.phrases.map((ph, i) => (
        <section key={i}>
          <p className={styles.phraseTexte}>« {ph.phrase} »</p>
          <ul className={styles.segments}>
            {ph.segments.map((s, j) => (
              <li key={j} className={styles.segment}>
                <span className={styles.segmentTexte}>{s.texte}</span>
                <span className={styles.segmentFonction}>{s.fonction}</span>
                <span className={styles.segmentExplication}>{s.explication}</span>
              </li>
            ))}
          </ul>
          <p className={styles.phraseExplication}>{ph.explication}</p>
          <Arbre phrase={ph} />
        </section>
      ))}
    </div>
  );
}

// ── 6. Et dans mon pays ? ──
export function SectionPasserelle({
  contenu,
  reponses,
  onReponse,
  onCorriger,
  readOnly,
}: { contenu: ContenuPasserelle } & AvecReponses) {
  const reponse = (reponses.passerelle as { texte?: string } | undefined)?.texte ?? '';
  const correction = reponses.passerelle_correction as CorrectionPhrases | undefined;
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const corriger = async () => {
    if (!onCorriger) return;
    setEnCours(true);
    setErreur(null);
    try {
      await onCorriger('passerelle', reponse);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Correction impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className={styles.passerelle}>
      {contenu.pays && <p className={styles.pays}>🌍 Vu depuis : {contenu.pays}</p>}
      <Paragraphes texte={contenu.intro} />
      {contenu.paralleles.map((p, i) => (
        <section key={i}>
          <h3 className={styles.paralleleTitre}>{p.titre}</h3>
          <Paragraphes texte={p.texte} />
        </section>
      ))}
      {contenu.question && (
        <>
          <p className={styles.passerelleQuestion}>💬 {contenu.question}</p>
          <textarea
            className={styles.reponseLibre}
            rows={4}
            value={reponse}
            placeholder={readOnly ? 'Pas encore répondu.' : 'Raconte ce que tu sais, dans tes mots…'}
            disabled={readOnly || !onReponse}
            onChange={(e) => onReponse?.('passerelle', { texte: e.target.value })}
          />
          {!readOnly && onCorriger && (
            <div className={styles.actionsIA}>
              <BoutonIA libelle="Corriger mes phrases" enCours={enCours} disabled={reponse.trim().length < 10} onClick={corriger} />
              {erreur && <span className={styles.echecIA}>{erreur}</span>}
            </div>
          )}
          {correction && <TableauCorrection correction={correction} />}
        </>
      )}
    </div>
  );
}

// ── 7. Mon résumé : l'élève écrit, Claude compare au cours ──
const LIBELLE_AVIS: Record<AvisResume['avis'], { texte: string; classe: string }> = {
  positif: { texte: '👍 Avis positif', classe: 'avisPositif' },
  mitige: { texte: '🤔 Avis mitigé', classe: 'avisMitige' },
  negatif: { texte: '👎 À reprendre', classe: 'avisNegatif' },
};

export function SectionResumeEleve({ reponses, onReponse, onCorriger, readOnly }: AvecReponses) {
  const texte = (reponses.resume_eleve as { texte?: string } | undefined)?.texte ?? '';
  const avis = reponses.resume_eleve_avis as AvisResume | undefined;
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const demander = async () => {
    if (!onCorriger) return;
    setEnCours(true);
    setErreur(null);
    try {
      await onCorriger('resumeEleve', texte);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Avis impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className={styles.resumeEleve}>
      <p className={styles.ligne}>
        Écris, dans tes mots, ce que tu as compris du cours : les idées importantes, dans l’ordre. Puis
        demande l’avis de Claude : il compare ton résumé au cours.
      </p>
      <textarea
        className={styles.reponseLibre}
        rows={8}
        value={texte}
        placeholder={readOnly ? 'Pas encore écrit.' : 'Le cours parle de… D’abord… Ensuite…'}
        disabled={readOnly || !onReponse}
        onChange={(e) => onReponse?.('resume_eleve', { texte: e.target.value })}
      />
      {!readOnly && onCorriger && (
        <div className={styles.actionsIA}>
          <BoutonIA libelle="Demander l’avis de Claude" enCours={enCours} disabled={texte.trim().length < 10} onClick={demander} />
          {erreur && <span className={styles.echecIA}>{erreur}</span>}
        </div>
      )}
      {avis && <AvisResumeBloc avis={avis} />}
    </div>
  );
}

export function AvisResumeBloc({ avis }: { avis: AvisResume }) {
  const lib = LIBELLE_AVIS[avis.avis];
  return (
    <div className={styles.verdictBloc}>
      <span className={`${styles.avisBadge} ${styles[lib.classe]}`}>{lib.texte}</span>
      {avis.commentaire && <p className={styles.verdictCommentaire}>{avis.commentaire}</p>}
      <div className={styles.idees}>
        <div>
          <h4 className={styles.ideesTitre}>✅ Idées repérées</h4>
          {avis.ideesVues.length ? (
            <ul className={styles.ideesListe}>
              {avis.ideesVues.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.ideesVide}>Aucune.</p>
          )}
        </div>
        <div>
          <h4 className={styles.ideesTitre}>❌ Idées manquantes</h4>
          {avis.ideesManquantes.length ? (
            <ul className={styles.ideesListe}>
              {avis.ideesManquantes.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.ideesVide}>Aucune : tout l’essentiel y est.</p>
          )}
        </div>
      </div>
      {avis.phrases.length > 0 ? (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Phrase problématique</th>
              <th>Ce qui ne va pas</th>
              <th>Des exemples de bonne phrase</th>
            </tr>
          </thead>
          <tbody>
            {avis.phrases.map((p, i) => (
              <tr key={i}>
                <td>{p.phrase}</td>
                <td>{p.probleme}</td>
                <td className={styles.tableauBon}>
                  {p.exemples.map((e, k) => (
                    <div key={k}>{e}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.ideesVide}>Aucune phrase problématique.</p>
      )}
    </div>
  );
}

// ── « J'ai lu » : les sections de lecture pure se terminent d'un clic ──
export function BoutonLu({
  cle,
  libelle = 'J’ai lu, je continue',
  bloque,
  reponses,
  onReponse,
  readOnly,
}: { cle: string; libelle?: string; bloque?: string | null } & AvecReponses) {
  const lu = !!(reponses[`lu_${cle}`] as { at?: string } | undefined)?.at;
  if (readOnly) return lu ? <p className={styles.luFait}>✓ L’élève a marqué cette section comme faite.</p> : null;
  return (
    <div className={`${styles.actionsIA} ${styles.actionsDroite}`}>
      {lu ? (
        <span className={styles.luFait}>✓ Fait — la section suivante est ouverte.</span>
      ) : (
        <>
          {bloque && <span className={styles.luBloque}>{bloque}</span>}
          <button
            type="button"
            className={styles.btnIA}
            disabled={!!bloque}
            onClick={() => onReponse?.(`lu_${cle}`, { at: new Date().toISOString() })}
          >
            ✓ {libelle}
          </button>
        </>
      )}
    </div>
  );
}

// Ce qui empêche encore de cliquer « je continue » dans une section de travail :
// tout ce qui est vérifiable l'est par le script, jamais sur parole (JP, 2026-10-08)
export function raisonBlocage(cle: string, lecture: LectureCours): string | null {
  const r = lecture.reponses;
  if (cle === 'vocabulaire') {
    const contenu = lecture.sections.vocabulaire.contenu as ContenuVocabulaire | null;
    if (!contenu?.exercices) return null;
    const types: TypeEx[] = ['matching', 'family', 'tags', 'reading', 'listening_matching', 'cloze', 'sentence'];
    const manquants = types.filter((t) => !r[`vocab_${t}`]).length;
    const testAFaire = !!contenu.exercices.test?.questions?.length && !r.vocab_test;
    if (manquants > 0) return `Réussis d’abord les 7 exercices (il en reste ${manquants}).`;
    if (testAFaire) return 'Fais d’abord le test de lecture.';
    return null;
  }
  if (cle === 'reformulation') {
    const contenu = lecture.sections.reformulation.contenu as ContenuReformulation | null;
    if (!contenu) return null;
    const tout = contenu.parties.every((p, i) =>
      p.questions.every((q, j) => questionRepondue(q, r[cleQuestion(i, j)] as ReponseQuestion | undefined))
    );
    return tout ? null : 'Réponds d’abord à toutes les questions.';
  }
  if (cle === 'passerelle') {
    const texte = (r.passerelle as { texte?: string } | undefined)?.texte?.trim();
    if (!texte) return 'Écris d’abord ta réponse.';
    return r.passerelle_correction ? null : 'Fais d’abord corriger tes phrases.';
  }
  return null;
}

// Une section est FAITE quand l'élève a cliqué son bouton « je continue »
// (demande JP, 2026-10-08 : le bouton dans chaque section, à droite). Dans
// « partie par partie » et « et dans mon pays ? », le bouton ne s'active qu'une
// fois le travail accompli (`raisonBlocage`). « Mon résumé » : l'avis demandé.
export function sectionFaite(cle: string, lecture: LectureCours): boolean {
  const r = lecture.reponses;
  if (cle === 'resumeEleve') return !!r.resume_eleve_avis;
  return !!(r[`lu_${cle}`] as { at?: string } | undefined)?.at;
}

// ── Vue prof : l'ÉVALUATION — tout ce que l'élève a fait, en chiffres et en retours ──
const LIBELLES_EXERCICES: Record<TypeEx | 'test', string> = {
  matching: 'Associations',
  family: 'Famille de mots',
  tags: 'Étiquettes',
  reading: 'Lecture à voix haute',
  listening_matching: 'Écoute et associe',
  cloze: 'Défi final',
  sentence: 'Phrase avec le vocabulaire',
  test: 'Test de lecture',
};

export function EvaluationLecture({ lecture }: { lecture: LectureCours }) {
  const r = lecture.reponses;
  const pretes = SECTIONS_GENEREES.filter((c) => lecture.sections[c].statut === 'prete').length;

  // Les questions de la reformulation
  const reformulation = lecture.sections.reformulation.contenu as ContenuReformulation | null;
  const parties = (reformulation?.parties ?? []).map((p, i) => {
    const fermees = p.questions.map((q, j) => ({ q, rep: r[cleQuestion(i, j)] as ReponseQuestion | undefined })).filter(({ q }) => q.type !== 'ouverte');
    const ouvertes = p.questions.map((q, j) => ({ q, rep: r[cleQuestion(i, j)] as ReponseQuestion | undefined })).filter(({ q }) => q.type === 'ouverte');
    return {
      titre: p.titre,
      repondues: fermees.filter(({ rep }) => rep?.choix !== undefined).length,
      justes: fermees.filter(({ q, rep }) => estJuste(q, rep) === true).length,
      total: fermees.length,
      ouvertes: ouvertes.filter(({ rep }) => (rep?.texte ?? '').trim()).length,
      ouvertesTotal: ouvertes.length,
    };
  });
  const totalJustes = parties.reduce((n, p) => n + p.justes, 0);
  const totalFermees = parties.reduce((n, p) => n + p.total, 0);

  // Les exercices de vocabulaire et le test
  const exercices = (Object.keys(LIBELLES_EXERCICES) as (TypeEx | 'test')[])
    .map((t) => ({ type: t, resultat: r[`vocab_${t}`] as ResultatExercice | undefined }))
    .filter((e) => e.resultat);

  const correction = r.passerelle_correction as CorrectionPhrases | undefined;
  const passerelleTexte = (r.passerelle as { texte?: string } | undefined)?.texte ?? '';
  const avis = r.resume_eleve_avis as AvisResume | undefined;
  const resumeTexte = (r.resume_eleve as { texte?: string } | undefined)?.texte ?? '';

  return (
    <div className={styles.evaluation}>
      <div className={styles.evalTuiles}>
        <div className={styles.evalTuile}>
          <span className={styles.evalChiffre}>{pretes}/{SECTIONS_GENEREES.length}</span>
          <span className={styles.evalLibelle}>sections générées</span>
        </div>
        <div className={styles.evalTuile}>
          <span className={styles.evalChiffre}>{totalFermees ? `${totalJustes}/${totalFermees}` : '—'}</span>
          <span className={styles.evalLibelle}>questions justes</span>
        </div>
        <div className={styles.evalTuile}>
          <span className={styles.evalChiffre}>{exercices.filter((e) => e.type !== 'test').length}/7</span>
          <span className={styles.evalLibelle}>exercices réussis</span>
        </div>
        <div className={styles.evalTuile}>
          <span className={styles.evalChiffre}>{avis ? LIBELLE_AVIS[avis.avis].texte.split(' ')[0] : '—'}</span>
          <span className={styles.evalLibelle}>résumé</span>
        </div>
      </div>

      <h4 className={styles.evalTitre}>{SECTION_LIBELLES.reformulation.picto} Compréhension, partie par partie</h4>
      {parties.length === 0 ? (
        <p className={styles.ideesVide}>Section pas encore générée.</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Partie</th>
              <th>Questions fermées</th>
              <th>Questions ouvertes</th>
            </tr>
          </thead>
          <tbody>
            {parties.map((p, i) => (
              <tr key={i}>
                <td>{p.titre}</td>
                <td>{p.total ? `${p.justes} juste${p.justes > 1 ? 's' : ''} / ${p.repondues} répondue${p.repondues > 1 ? 's' : ''} / ${p.total}` : '—'}</td>
                <td>{p.ouvertesTotal ? `${p.ouvertes}/${p.ouvertesTotal} écrite${p.ouvertes > 1 ? 's' : ''}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4 className={styles.evalTitre}>{SECTION_LIBELLES.vocabulaire.picto} Vocabulaire</h4>
      {exercices.length === 0 ? (
        <p className={styles.ideesVide}>Aucun exercice fait.</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Exercice</th>
              <th>Score</th>
              <th>Essais</th>
            </tr>
          </thead>
          <tbody>
            {exercices.map((e) => (
              <tr key={e.type}>
                <td>{LIBELLES_EXERCICES[e.type]}</td>
                <td>
                  {e.resultat!.score}/{e.resultat!.total}
                  {e.type === 'test' ? ` (${Math.round((e.resultat!.score / Math.max(1, e.resultat!.total)) * 100)} %)` : ''}
                </td>
                <td>{e.resultat!.essais}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4 className={styles.evalTitre}>{SECTION_LIBELLES.passerelle.picto} Et dans mon pays ?</h4>
      {passerelleTexte ? (
        <>
          <blockquote className={styles.evalCitation}>{passerelleTexte}</blockquote>
          {correction ? <TableauCorrection correction={correction} /> : <p className={styles.ideesVide}>Pas de correction demandée.</p>}
        </>
      ) : (
        <p className={styles.ideesVide}>Pas de réponse.</p>
      )}

      <h4 className={styles.evalTitre}>{SECTION_LIBELLES.resumeEleve.picto} Mon résumé</h4>
      {resumeTexte ? (
        <>
          <blockquote className={styles.evalCitation}>{resumeTexte}</blockquote>
          {avis ? <AvisResumeBloc avis={avis} /> : <p className={styles.ideesVide}>Pas d’avis demandé.</p>}
        </>
      ) : (
        <p className={styles.ideesVide}>Pas de résumé.</p>
      )}
    </div>
  );
}
