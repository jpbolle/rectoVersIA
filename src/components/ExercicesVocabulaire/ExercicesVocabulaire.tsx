'use client';

// Les exercices de vocabulaire de l'extension Daspalecte, portés dans l'app
// (plan du 2026-10-08, étapes 6 et 7 : les sept exercices et le test de
// lecture). Source : daspa-extension/content.js 2.0.x — `displayExercises`,
// `renderMatching`, `renderFamily`, `renderTags`, `renderReading`,
// `renderCloze`, `renderSentence`, `displayComprehensionTest`.
//
// Le cadre : un exercice à la fois, « Précédent », des points de navigation
// (atteignables : le courant, les réussis, le premier non réussi), « Continuer »
// n'apparaît qu'une fois l'exercice réussi, et l'écran final au trophée.
// Les essais comptent les clics sur « Vérifier ». Le résultat de chaque
// exercice remonte au parent à la PREMIÈRE réussite (`onResultat`).
//
// Ordre final de l'extension : associations, famille, étiquettes, lecture,
// écoute et associe, défi final (texte à trous), phrase avec le vocabulaire.
//
// Écarts assumés avec l'extension : « Régénérer l'exercice » (un nouvel appel
// Claude) devient « Recommencer » ; la voix est `speechSynthesis` (navigateur)
// au lieu de `chrome.tts` ; la traduction au clic passe par /api/fle/traduire.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { ExercicesVocabulaire as Donnees, ResultatExercice } from '@/types/lecture-cours';
import styles from './ExercicesVocabulaire.module.css';

export type TypeExercice = 'matching' | 'family' | 'tags' | 'reading' | 'listening_matching' | 'cloze' | 'sentence';
export const TYPES_EXERCICES: TypeExercice[] = ['matching', 'family', 'tags', 'reading', 'listening_matching', 'cloze', 'sentence'];

interface Exercice {
  type: TypeExercice;
  titre: string;
  consigne: string;
}

interface Props {
  donnees: Donnees;
  // Langue maternelle (code) pour la traduction au clic ; '' = inconnue
  langue: string;
  niveau: string;
  // Résultats déjà enregistrés, par type (clé `vocab_<type>` dans la lecture)
  resultats: Partial<Record<TypeExercice, ResultatExercice>>;
  onResultat?: (type: TypeExercice, resultat: ResultatExercice) => void;
  onFermer: () => void;
  readOnly?: boolean;
}

const SEUIL = 0.7;

function melanger<T>(liste: T[]): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// Voix française du navigateur (chrome.tts dans l'extension)
export function parlerFrancais(texte: string, vitesse = 0.9) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = 'fr-FR';
  u.rate = vitesse;
  window.speechSynthesis.speak(u);
}

// La première syllabe (approximative) d'un mot, pour l'indice du texte à trous
function premiereSyllabe(mot: string): string {
  const m = mot.match(/^[^aeiouyàâäéèêëïîôöùûü]*[aeiouyàâäéèêëïîôöùûü]+[^aeiouyàâäéèêëïîôöùûü]*/i);
  return m ? m[0] : mot.slice(0, Math.min(2, mot.length));
}

// Minuscules, sans accents, lettres seules (famille, lecture)
function normaliserMot(mot: string): string {
  return mot
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9']/g, '');
}

// ── Traduction au clic, avec cache (partagée par les exercices) ──
function useTraduction(langue: string) {
  const { getAuthHeaders } = useAuth();
  const cache = useRef<Map<string, string | null>>(new Map());
  return useCallback(
    async (texte: string): Promise<string | null> => {
      // Sans langue connue, le serveur rend une définition simple en français
      const cle = texte.toLowerCase();
      if (cache.current.has(cle)) return cache.current.get(cle) ?? null;
      try {
        const headers = await getAuthHeaders();
        if (!headers) return null;
        const res = await fetch('/api/fle/traduire', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ texte, langue }),
        });
        const json = await res.json();
        const t = json.success ? (json.data.traduction as string) : null;
        cache.current.set(cle, t);
        return t;
      } catch {
        cache.current.set(cle, null);
        return null;
      }
    },
    [langue, getAuthHeaders]
  );
}

// ═══ 1 & 5. Associations (texte, ou écoute) ═══
function Associations({
  pairs,
  audio,
  onReussi,
}: {
  pairs: { fr: string; tr: string }[];
  audio: boolean;
  onReussi: (score: number, total: number) => void;
}) {
  const gauche = useMemo(() => melanger(pairs), [pairs]);
  const droite = useMemo(() => melanger(pairs), [pairs]);
  const [selFr, setSelFr] = useState<string | null>(null);
  const [selTr, setSelTr] = useState<string | null>(null);
  const [trouvees, setTrouvees] = useState<Set<string>>(() => new Set());
  const [erreur, setErreur] = useState<{ fr: string; tr: string } | null>(null);
  const [lignes, setLignes] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  const cadre = useRef<HTMLDivElement>(null);
  const refsFr = useRef<Map<string, HTMLButtonElement>>(new Map());
  const refsTr = useRef<Map<string, HTMLButtonElement>>(new Map());
  const signale = useRef(false);

  // Une paire : la clé est le mot français des deux côtés
  const tenter = (fr: string | null, tr: string | null) => {
    if (!fr || !tr) return;
    if (fr === tr) {
      setTrouvees((prev) => new Set(prev).add(fr));
    } else {
      setErreur({ fr, tr });
      setTimeout(() => setErreur(null), 500);
    }
    setSelFr(null);
    setSelTr(null);
  };

  const choisirFr = (fr: string) => {
    if (trouvees.has(fr)) return;
    if (audio) parlerFrancais(fr);
    setSelFr(fr);
    tenter(fr, selTr);
  };
  const choisirTr = (fr: string) => {
    if (trouvees.has(fr)) return;
    setSelTr(fr);
    tenter(selFr, fr);
  };

  // Les traits entre paires trouvées, recalculés à chaque trouvaille et au redimensionnement
  useLayoutEffect(() => {
    const dessiner = () => {
      const c = cadre.current?.getBoundingClientRect();
      if (!c) return;
      setLignes(
        [...trouvees].flatMap((fr) => {
          const a = refsFr.current.get(fr)?.getBoundingClientRect();
          const b = refsTr.current.get(fr)?.getBoundingClientRect();
          if (!a || !b) return [];
          return [{ x1: a.right - c.left, y1: a.top + a.height / 2 - c.top, x2: b.left - c.left, y2: b.top + b.height / 2 - c.top }];
        })
      );
    };
    dessiner();
    window.addEventListener('resize', dessiner);
    return () => window.removeEventListener('resize', dessiner);
  }, [trouvees]);

  useEffect(() => {
    if (trouvees.size === pairs.length && pairs.length > 0 && !signale.current) {
      signale.current = true;
      onReussi(pairs.length, pairs.length);
    }
  }, [trouvees, pairs.length, onReussi]);

  const classe = (fr: string, cote: 'fr' | 'tr', selectionne: boolean) =>
    `${styles.item} ${trouvees.has(fr) ? styles.itemTrouve : ''} ${selectionne ? styles.itemSelection : ''} ${
      erreur && (cote === 'fr' ? erreur.fr === fr : erreur.tr === fr) ? styles.itemErreur : ''
    }`;

  return (
    <div className={styles.associations} ref={cadre}>
      <div className={styles.colonne}>
        {gauche.map((p, i) => (
          <button
            key={`fr-${p.fr}`}
            type="button"
            ref={(el) => {
              if (el) refsFr.current.set(p.fr, el);
            }}
            className={classe(p.fr, 'fr', selFr === p.fr)}
            onClick={() => choisirFr(p.fr)}
            aria-label={audio ? `Écouter le mot ${i + 1}` : p.fr}
          >
            {audio ? (
              <>
                <span aria-hidden="true">🔊</span> Mot {i + 1}
              </>
            ) : (
              p.fr
            )}
          </button>
        ))}
      </div>
      <svg className={styles.traits} aria-hidden="true">
        {lignes.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </svg>
      <div className={styles.colonne}>
        {droite.map((p) => (
          <button
            key={`tr-${p.fr}`}
            type="button"
            ref={(el) => {
              if (el) refsTr.current.set(p.fr, el);
            }}
            className={classe(p.fr, 'tr', selTr === p.fr)}
            onClick={() => choisirTr(p.fr)}
          >
            {p.tr}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══ 2. Famille de mots ═══
function FamilleDeMots({
  items,
  traduire,
  onVerifier,
  onReussi,
}: {
  items: { mainWord: string; related: string[] }[];
  traduire: (t: string) => Promise<string | null>;
  onVerifier: () => void;
  onReussi: (score: number, total: number) => void;
}) {
  const [retournees, setRetournees] = useState<Set<number>>(() => new Set());
  const [dejaVues, setDejaVues] = useState<Set<number>>(() => new Set());
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<Record<string, boolean> | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [bulle, setBulle] = useState<{ cle: string; texte: string } | null>(null);
  const [reussi, setReussi] = useState(false);

  const retourner = (idx: number) => {
    setRetournees((prev) => new Set(prev).add(idx));
    setDejaVues((prev) => new Set(prev).add(idx));
  };
  const revoir = (idx: number) =>
    setRetournees((prev) => {
      const n = new Set(prev);
      n.delete(idx);
      return n;
    });

  const survol = async (cle: string, mot: string) => {
    const t = await traduire(mot);
    if (t) setBulle({ cle, texte: t });
  };

  const verifier = () => {
    onVerifier();
    const v: Record<string, boolean> = {};
    let total = 0;
    let justes = 0;
    items.forEach((it, idx) => {
      const attendus = it.related.map(normaliserMot);
      it.related.forEach((_, j) => {
        total++;
        const cle = `${idx}_${j}`;
        const val = saisies[cle] ? normaliserMot(saisies[cle]) : '';
        const k = val ? attendus.indexOf(val) : -1;
        if (k !== -1) {
          justes++;
          attendus.splice(k, 1); // un même mot ne compte qu'une fois
          v[cle] = true;
        } else {
          v[cle] = false;
        }
      });
    });
    setVerdict(v);
    // Formatif : deux mots retrouvés suffisent (ou tous s'il y en a moins)
    const requis = Math.min(2, total);
    if (justes >= requis) {
      setMessage({ ok: true, texte: `Bravo ! ${justes} / ${total} mots retrouvés — pas grave pour le reste, tu peux continuer.` });
      setReussi(true);
      onReussi(justes, total);
    } else {
      setMessage({ ok: false, texte: `${justes} / ${total} mots retrouvés — trouve au moins ${requis} mots pour continuer. Corrige tes réponses et vérifie à nouveau.` });
    }
  };

  const toutesVues = dejaVues.size === items.length;

  return (
    <div className={styles.famille}>
      <div className={styles.familles}>
        {items.map((it, idx) => {
          const verso = retournees.has(idx);
          return (
            <div key={idx} className={`${styles.familleCarte} ${verso ? styles.familleVerso : ''}`}>
              {!verso ? (
                <button type="button" className={styles.familleRecto} onClick={() => retourner(idx)} aria-label="Retourner la carte pour tester mes connaissances">
                  <span className={styles.familleMot}>{it.mainWord}</span>
                  <span className={styles.familleLies}>
                    {it.related.map((m, j) => {
                      const cle = `${idx}_${j}`;
                      return (
                        <span
                          key={cle}
                          className={styles.familleLie}
                          onMouseEnter={() => survol(cle, m)}
                          onMouseLeave={() => setBulle((b) => (b?.cle === cle ? null : b))}
                        >
                          {m}
                          {bulle?.cle === cle && <span className={styles.bulle}>{bulle.texte}</span>}
                        </span>
                      );
                    })}
                  </span>
                </button>
              ) : (
                <div className={styles.familleDos} onClick={(e) => (e.target as HTMLElement).tagName !== 'INPUT' && !reussi && revoir(idx)}>
                  <span className={styles.familleMot}>{it.mainWord}</span>
                  <span className={styles.familleChamps}>
                    {it.related.map((_, j) => {
                      const cle = `${idx}_${j}`;
                      return (
                        <input
                          key={cle}
                          type="text"
                          className={`${styles.familleChamp} ${verdict ? (verdict[cle] ? styles.champJuste : styles.champFaux) : ''}`}
                          placeholder={`Mot lié ${j + 1}`}
                          autoComplete="off"
                          value={saisies[cle] ?? ''}
                          readOnly={reussi}
                          onChange={(e) => setSaisies((s) => ({ ...s, [cle]: e.target.value }))}
                        />
                      );
                    })}
                  </span>
                  <span className={styles.familleAide}>clique la carte pour revoir le recto</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!toutesVues && (
        <p className={styles.indication}>
          Clique sur chaque carte pour la retourner et tester tes connaissances, puis clique sur « Vérifier ». Tu peux revoir le recto à tout moment.
        </p>
      )}
      {message && <p className={message.ok ? styles.succes : styles.echec}>{message.texte}</p>}
      {toutesVues && !reussi && (
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimaire} onClick={verifier}>
            Vérifier
          </button>
        </div>
      )}
    </div>
  );
}

// ═══ 3. Étiquettes (glisser-déposer, ou clic puis clic) ═══
function Etiquettes({
  items,
  onVerifier,
  onReussi,
}: {
  items: { sentence: string; word: string }[];
  onVerifier: () => void;
  onReussi: (score: number, total: number) => void;
}) {
  const [reserve, setReserve] = useState<string[]>(() => melanger(items.map((i) => i.word)));
  const [reponses, setReponses] = useState<Record<number, string>>({});
  const [armee, setArmee] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Record<number, boolean> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reussi, setReussi] = useState(false);

  const placer = (idx: number, mot: string) => {
    const ancien = reponses[idx];
    setReponses((prev) => ({ ...prev, [idx]: mot }));
    setReserve((r) => [...r.filter((m) => m !== mot), ...(ancien ? [ancien] : [])]);
    setArmee(null);
    setVerdict(null);
  };

  const retirer = (idx: number) => {
    const mot = reponses[idx];
    if (!mot) return;
    setReponses((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setReserve((r) => [...r, mot]);
    setVerdict(null);
  };

  const surZone = (idx: number) => {
    if (armee) placer(idx, armee);
    else retirer(idx);
  };

  const deposer = (idx: number, e: DragEvent) => {
    e.preventDefault();
    const mot = e.dataTransfer.getData('text/plain');
    if (mot && reserve.includes(mot)) placer(idx, mot);
  };

  const verifier = () => {
    onVerifier();
    const v: Record<number, boolean> = {};
    let justes = 0;
    items.forEach((it, idx) => {
      v[idx] = reponses[idx] === it.word;
      if (v[idx]) justes++;
    });
    setVerdict(v);
    const taux = items.length ? justes / items.length : 1;
    if (taux >= SEUIL) {
      setMessage(null);
      setReussi(true);
      onReussi(justes, items.length);
    } else {
      setMessage(`${Math.round(taux * 100)} % de bonnes réponses — il faut au moins 70 % pour continuer.`);
      setTimeout(() => setVerdict((cur) => (cur ? Object.fromEntries(Object.entries(cur).filter(([, ok]) => ok)) : cur)), 2000);
    }
  };

  const recommencer = () => {
    setReserve(melanger(items.map((i) => i.word)));
    setReponses({});
    setVerdict(null);
    setMessage(null);
  };

  return (
    <div className={styles.etiquettes}>
      <ol className={styles.phrases}>
        {items.map((it, idx) => {
          const [avant, apres] = it.sentence.split('___');
          const zoneClasse = `${styles.zone} ${reponses[idx] ? styles.zoneRemplie : ''} ${
            verdict && verdict[idx] === true ? styles.zoneJuste : verdict && verdict[idx] === false ? styles.zoneFausse : ''
          }`;
          return (
            <li key={idx} className={styles.phrase}>
              <span className={styles.puce}>{idx + 1}</span>
              <span>
                {avant}
                <button
                  type="button"
                  className={zoneClasse}
                  onClick={() => !reussi && surZone(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => !reussi && deposer(idx, e)}
                  aria-label="Zone à compléter"
                >
                  {reponses[idx] ?? '…'}
                </button>
                {apres ?? ''}
              </span>
            </li>
          );
        })}
      </ol>
      <div className={styles.reserve}>
        {reserve.map((mot) => (
          <button
            key={mot}
            type="button"
            draggable={!reussi}
            className={`${styles.etiquette} ${armee === mot ? styles.etiquetteArmee : ''}`}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', mot)}
            onClick={() => setArmee((a) => (a === mot ? null : mot))}
            aria-label={`Étiquette : ${mot}`}
          >
            {mot}
          </button>
        ))}
      </div>
      {message && (
        <div className={styles.resultat}>
          <p className={styles.echec}>{message}</p>
          <button type="button" className={styles.btnSecondaire} onClick={recommencer}>
            ↺ Recommencer
          </button>
        </div>
      )}
      {!reussi && (
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimaire} onClick={verifier} disabled={Object.keys(reponses).length === 0}>
            Vérifier
          </button>
        </div>
      )}
    </div>
  );
}

// ═══ 4. Lecture à voix haute ═══
// a) lecture silencieuse, mot cliquable = traduction ; b) après 20 s, un 🔊 par
// phrase (voix du navigateur, surbrillance mot à mot par minuterie estimée,
// rattrapée par les évènements de limite de mot quand la voix les donne) ;
// c) toutes les phrases écoutées → « Enregistrer ma lecture » (reconnaissance
// vocale) → alignement mot à mot, X / N mots bien reconnus.

interface MotLecture {
  texte: string;
  parle: boolean; // hors parenthèses
  debutParle?: number; // position dans le texte envoyé à la voix
  pauseApresMs: number;
}

function decouperPhrases(texte: string): string[] {
  const m = texte.match(/[^.!?…]+[.!?…]+(\s+|$)|[^.!?…]+$/g) || [texte];
  return m.map((s) => s.trim()).filter(Boolean);
}

// Les mots d'une phrase, avec ce qui les sépare, et leur position dans le texte lu
function motsDe(phrase: string): { morceaux: { texte: string; mot: MotLecture | null }[]; mots: MotLecture[] } {
  const parentheses: [number, number][] = [];
  const re = /\([^)]*\)/g;
  let pm: RegExpExecArray | null;
  while ((pm = re.exec(phrase)) !== null) parentheses.push([pm.index, pm.index + pm[0].length]);
  const dansParentheses = (i: number) => parentheses.some(([a, b]) => i >= a && i < b);

  const morceaux: { texte: string; mot: MotLecture | null }[] = [];
  const mots: MotLecture[] = [];
  const rm = /[\p{L}\p{M}'’-]+/gu;
  let dernier = 0;
  let m: RegExpExecArray | null;
  while ((m = rm.exec(phrase)) !== null) {
    if (m.index > dernier) morceaux.push({ texte: phrase.slice(dernier, m.index), mot: null });
    const mot: MotLecture = { texte: m[0], parle: !dansParentheses(m.index), pauseApresMs: 0 };
    morceaux.push({ texte: m[0], mot });
    mots.push(mot);
    dernier = m.index + m[0].length;
  }
  if (dernier < phrase.length) morceaux.push({ texte: phrase.slice(dernier), mot: null });

  // Positions dans le texte réellement lu (parenthèses retirées) et pauses de ponctuation
  const texteLu = phrase.replace(/\([^)]*\)/g, ' ');
  const parles = mots.filter((w) => w.parle);
  const positions: { debut: number; fin: number }[] = [];
  const rp = /[\p{L}\p{M}'’-]+/gu;
  while ((m = rp.exec(texteLu)) !== null) positions.push({ debut: m.index, fin: m.index + m[0].length });
  parles.forEach((w, i) => {
    const p = positions[i];
    if (!p) return;
    w.debutParle = p.debut;
    const suivant = positions[i + 1]?.debut ?? texteLu.length;
    const entre = texteLu.slice(p.fin, suivant);
    w.pauseApresMs = /[.!?…]/.test(entre) ? 450 : /[,;:]/.test(entre) ? 200 : 0;
  });
  return { morceaux, mots };
}

// Plus longue sous-séquence commune entre le texte et ce qui a été reconnu
function aligner(reference: string[], reconnusMots: string[]): boolean[] {
  const ref = reference.map(normaliserMot);
  const rec = reconnusMots.map(normaliserMot);
  const m = ref.length;
  const n = rec.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = ref[i - 1] && ref[i - 1] === rec[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const ok = new Array<boolean>(m).fill(false);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (ref[i - 1] && ref[i - 1] === rec[j - 1]) {
      ok[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return ok;
}

type Reco = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function LectureAVoixHaute({
  texte,
  traduire,
  onReussi,
}: {
  texte: string;
  traduire: (t: string) => Promise<string | null>;
  onReussi: (score: number, total: number) => void;
}) {
  const phrases = useMemo(() => decouperPhrases(texte).map((p) => ({ texte: p, ...motsDe(p) })), [texte]);
  const [bulle, setBulle] = useState<{ cle: string; texte: string } | null>(null);
  const [outilsVisibles, setOutilsVisibles] = useState(false);
  const [vitesse, setVitesse] = useState(0.85);
  const [enLecture, setEnLecture] = useState<number | null>(null);
  const [enPause, setEnPause] = useState(false);
  const [motActif, setMotActif] = useState<{ phrase: number; mot: number } | null>(null);
  const [ecoutees, setEcoutees] = useState<Set<number>>(() => new Set());
  const [enregistrement, setEnregistrement] = useState(false);
  const [retour, setRetour] = useState<string | null>(null);
  const [reconnus, setReconnus] = useState<boolean[] | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finMinuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexParle = useRef(-1);
  const pauseRef = useRef(false);
  const vitesseRef = useRef(vitesse);
  const reconnaissance = useRef<Reco | null>(null);
  const signale = useRef(false);

  // b) Les outils d'écoute se révèlent après 20 s de lecture silencieuse
  useEffect(() => {
    const t = setTimeout(() => setOutilsVisibles(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const nettoyerMinuteries = () => {
    if (minuterie.current) clearTimeout(minuterie.current);
    if (finMinuterie.current) clearTimeout(finMinuterie.current);
    minuterie.current = null;
    finMinuterie.current = null;
  };

  const arreter = useCallback(() => {
    nettoyerMinuteries();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setEnLecture(null);
    setEnPause(false);
    setMotActif(null);
  }, []);

  useEffect(
    () => () => {
      arreter();
      reconnaissance.current?.stop();
    },
    [arreter]
  );

  const dureeMot = (mot: string) => {
    const base = 60000 / (175 * vitesseRef.current);
    return base * Math.max(0.6, Math.min(2, mot.length / 5));
  };

  const lirePhrase = (idx: number) => {
    arreter();
    const phrase = phrases[idx];
    const parles = phrase.mots.filter((w) => w.parle);
    if (!('speechSynthesis' in window) || parles.length === 0) return;
    setEnLecture(idx);
    indexParle.current = -1;
    pauseRef.current = false;

    const terminer = () => {
      nettoyerMinuteries();
      setEnLecture((cur) => (cur === idx ? null : cur));
      setMotActif(null);
      setEcoutees((prev) => new Set(prev).add(idx));
    };
    const allumer = (i: number) => {
      indexParle.current = i;
      const mot = parles[i];
      setMotActif({ phrase: idx, mot: phrase.mots.indexOf(mot) });
      if (i >= parles.length - 1) {
        // Filet : certaines voix ne signalent jamais la fin
        if (finMinuterie.current) clearTimeout(finMinuterie.current);
        finMinuterie.current = setTimeout(terminer, dureeMot(mot.texte) + 900);
      }
    };
    // Minuterie estimée (mots/minute), rattrapée par les limites de mot de la voix
    const suivant = () => {
      if (pauseRef.current) {
        minuterie.current = setTimeout(suivant, 150);
        return;
      }
      const i = indexParle.current + 1;
      if (i >= parles.length) return;
      allumer(i);
      if (i >= parles.length - 1) return;
      const pause = parles[i].pauseApresMs / vitesseRef.current;
      minuterie.current = setTimeout(suivant, dureeMot(parles[i + 1].texte) + pause);
    };

    const u = new SpeechSynthesisUtterance(phrase.texte.replace(/\([^)]*\)/g, ' '));
    u.lang = 'fr-FR';
    u.rate = vitesseRef.current;
    u.onboundary = (e) => {
      if (e.name !== 'word') return;
      let i = parles.findIndex((w) => w.debutParle !== undefined && w.debutParle > e.charIndex);
      i = i === -1 ? parles.length - 1 : Math.max(0, i - 1);
      if (i > indexParle.current) allumer(i); // jamais en arrière
    };
    u.onend = terminer;
    u.onerror = terminer;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    suivant();
  };

  const basculerPause = () => {
    if (enPause) {
      window.speechSynthesis.resume();
      pauseRef.current = false;
      setEnPause(false);
    } else {
      window.speechSynthesis.pause();
      pauseRef.current = true;
      setEnPause(true);
    }
  };

  const changerVitesse = (sens: number) => {
    const v = Math.max(0.5, Math.min(1.5, Math.round((vitesse + sens * 0.15) * 100) / 100));
    setVitesse(v);
    vitesseRef.current = v;
    if (enLecture !== null) lirePhrase(enLecture);
  };

  const cliquerMot = async (cle: string, mot: string) => {
    if (bulle?.cle === cle) {
      setBulle(null);
      return;
    }
    const t = await traduire(mot);
    if (t) setBulle({ cle, texte: t });
  };

  // c) L'enregistrement : reconnaissance vocale du navigateur, puis alignement
  const enregistrer = () => {
    if (enregistrement) {
      reconnaissance.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Reco; webkitSpeechRecognition?: new () => Reco };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setRetour('La reconnaissance vocale n’est pas disponible sur ce navigateur.');
      return;
    }
    arreter();
    const reco = new Ctor();
    reco.lang = 'fr-FR';
    reco.continuous = true;
    reco.interimResults = false;
    let transcription = '';
    reco.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcription += e.results[i][0].transcript + ' ';
      }
    };
    reco.onerror = (e) => {
      setRetour(e.error === 'not-allowed' ? 'Micro refusé — autorise l’accès au micro pour utiliser cette fonction.' : 'Erreur de reconnaissance vocale, réessaie.');
    };
    reco.onend = () => {
      setEnregistrement(false);
      reconnaissance.current = null;
      if (transcription.trim()) {
        const reference = phrases.flatMap((p) => p.mots.filter((m) => m.parle).map((m) => m.texte));
        const alignes = aligner(reference, transcription.trim().split(/\s+/));
        setReconnus(alignes);
        setRetour(`${alignes.filter(Boolean).length} / ${reference.length} mots bien reconnus`);
      }
      // L'élève s'est enregistré : l'exercice est fait, quel que soit le résultat
      if (!signale.current) {
        signale.current = true;
        onReussi(1, 1);
      }
    };
    reconnaissance.current = reco;
    setEnregistrement(true);
    setRetour(null);
    setReconnus(null);
    reco.start();
  };

  // Index global (sur tout le texte) des mots parlés, pour colorer après l'enregistrement
  let compteurGlobal = -1;
  const toutesEcoutees = ecoutees.size === phrases.length;

  return (
    <div className={styles.lecture}>
      <div className={styles.lectureTexte}>
        {phrases.map((p, pi) => (
          <div key={pi} className={styles.lecturePhrase}>
            <button
              type="button"
              className={`${styles.lecturePlay} ${ecoutees.has(pi) ? styles.lecturePlayFait : ''}`}
              style={{ visibility: outilsVisibles ? 'visible' : 'hidden' }}
              onClick={() => (enLecture === pi ? basculerPause() : lirePhrase(pi))}
              aria-label="Écouter cette phrase"
            >
              {enLecture === pi ? (enPause ? '▶' : '⏸') : '🔊'}
            </button>
            <span>
              {p.morceaux.map((mc, mi) => {
                if (!mc.mot) return <span key={mi}>{mc.texte}</span>;
                const indexMot = p.mots.indexOf(mc.mot);
                const cle = `${pi}_${indexMot}`;
                const global = mc.mot.parle ? ++compteurGlobal : -1;
                const actif = motActif?.phrase === pi && motActif.mot === indexMot;
                const etat = reconnus && global >= 0 ? (reconnus[global] ? styles.motJuste : styles.motFaux) : '';
                return (
                  <span
                    key={mi}
                    className={`${styles.motLecture} ${mc.mot.parle ? '' : styles.motTraduction} ${actif ? styles.motActif : ''} ${etat}`}
                    onClick={() => mc.mot?.parle && cliquerMot(cle, mc.texte)}
                  >
                    {mc.texte}
                    {bulle?.cle === cle && <span className={styles.bulle}>{bulle.texte}</span>}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>

      {outilsVisibles && (
        <div className={styles.lectureOutils}>
          <span>🔊 Clique sur une phrase pour l’écouter</span>
          <span className={styles.vitesse}>
            <button type="button" onClick={() => changerVitesse(-1)} title="Ralentir">
              🐢
            </button>
            <span>{vitesse.toFixed(2)}x</span>
            <button type="button" onClick={() => changerVitesse(1)} title="Accélérer">
              🐇
            </button>
          </span>
        </div>
      )}

      {toutesEcoutees && (
        <div className={styles.actions}>
          <button type="button" className={`${styles.btnSecondaire} ${enregistrement ? styles.enregistre : ''}`} onClick={enregistrer}>
            {enregistrement ? '⏹ Arrêter l’enregistrement' : '🎤 Enregistrer ma lecture'}
          </button>
        </div>
      )}
      {retour && <p className={styles.indication}>{retour}</p>}
    </div>
  );
}

// ═══ 6. Texte à trous (défi final) ═══
function TexteATrous({
  items,
  onVerifier,
  onReussi,
}: {
  items: { text: string; answer: string }[];
  onVerifier: () => void;
  onReussi: (score: number, total: number) => void;
}) {
  const [saisies, setSaisies] = useState<Record<number, string>>({});
  const [verdict, setVerdict] = useState<Record<number, boolean> | null>(null);
  const [verrouillees, setVerrouillees] = useState<Set<number>>(() => new Set());
  const [indices, setIndices] = useState<Set<number>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [reussi, setReussi] = useState(false);

  const verifier = () => {
    onVerifier();
    const v: Record<number, boolean> = {};
    let justes = 0;
    items.forEach((it, idx) => {
      v[idx] = (saisies[idx] ?? '').trim().toLowerCase() === it.answer.toLowerCase();
      if (v[idx]) justes++;
    });
    setVerdict(v);
    const taux = items.length ? justes / items.length : 1;
    if (taux >= SEUIL) {
      setMessage(null);
      setReussi(true);
      onReussi(justes, items.length);
    } else {
      setMessage(`${Math.round(taux * 100)} % de bonnes réponses — il faut au moins 70 % pour continuer.`);
      setTimeout(() => setVerdict((cur) => (cur ? Object.fromEntries(Object.entries(cur).filter(([, ok]) => ok)) : cur)), 2000);
    }
  };

  // Les bonnes réponses restent verrouillées, les mauvaises reçoivent l'indice
  const recommencerAvecIndice = () => {
    if (!verdict) return;
    const bonnes = new Set<number>();
    const fausses = new Set<number>();
    items.forEach((_, idx) => (verdict[idx] ? bonnes : fausses).add(idx));
    setVerrouillees(bonnes);
    setIndices(fausses);
    setSaisies((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => bonnes.has(Number(k)))));
    setVerdict(null);
    setMessage(null);
  };

  return (
    <div className={styles.trous}>
      <ol className={styles.phrases}>
        {items.map((it, idx) => {
          const [avant, apres] = it.text.split('___');
          const classe = `${styles.champ} ${
            verrouillees.has(idx) || (verdict && verdict[idx] === true) ? styles.champJuste : verdict && verdict[idx] === false ? styles.champFaux : ''
          }`;
          return (
            <li key={idx} className={styles.phrase}>
              <span className={styles.puce}>{idx + 1}</span>
              <span>
                {avant}
                <input
                  type="text"
                  className={classe}
                  value={saisies[idx] ?? ''}
                  readOnly={verrouillees.has(idx) || reussi}
                  autoComplete="off"
                  placeholder={indices.has(idx) ? `${premiereSyllabe(it.answer)}…` : ''}
                  onChange={(e) => setSaisies((s) => ({ ...s, [idx]: e.target.value }))}
                  aria-label={`Mot manquant ${idx + 1}`}
                />
                {apres ?? ''}
              </span>
            </li>
          );
        })}
      </ol>
      {message && (
        <div className={styles.resultat}>
          <p className={styles.echec}>{message}</p>
          <button type="button" className={styles.btnSecondaire} onClick={recommencerAvecIndice}>
            💡 Recommencer avec indice
          </button>
        </div>
      )}
      {!reussi && (
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimaire} onClick={verifier}>
            Vérifier
          </button>
        </div>
      )}
    </div>
  );
}

// ═══ 7. Phrase avec le vocabulaire (vérifiée par Claude) ═══
function cleMot(s: string): string {
  let w = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (w.length > 3 && /[sx]$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
  return w;
}

// Même mot de vocabulaire si même radical d'au moins 4 lettres (« critique » → « critiqua »)
function memeMot(a: string, b: string): boolean {
  const ka = cleMot(a);
  const kb = cleMot(b);
  if (ka === kb) return true;
  let i = 0;
  while (i < ka.length && i < kb.length && ka[i] === kb[i]) i++;
  return i >= 4;
}

interface VerdictPhrase {
  sentenceValid: boolean;
  sentenceFeedback: string;
  correctedSentence: string | null;
  wordsFeedback: { word: string; correct: boolean; explanation: string }[];
}

function PhraseAvecVocabulaire({
  mots,
  niveau,
  onVerifier,
  onReussi,
}: {
  mots: string[];
  niveau: string;
  onVerifier: () => void;
  onReussi: (score: number, total: number) => void;
}) {
  const { getAuthHeaders } = useAuth();
  const requis = Math.max(1, Math.ceil(mots.length / 2));
  const [phrase, setPhrase] = useState('');
  const [enVerification, setEnVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictPhrase | null>(null);
  const [reussi, setReussi] = useState(false);

  const motsPhrase = (phrase.match(/[\p{L}\p{M}'’-]+/gu) ?? []).map(cleMot);
  const utilises = mots.filter((m) => motsPhrase.some((pm) => memeMot(pm, m)));

  const verifier = async () => {
    onVerifier();
    if (!phrase.trim()) {
      setMessage('Écris une phrase avant de vérifier.');
      return;
    }
    if (utilises.length < requis) {
      setMessage(`Tu utilises ${utilises.length} mot${utilises.length > 1 ? 's' : ''} sur ${mots.length} — il en faut au moins ${requis}. Continue !`);
      return;
    }
    setMessage(null);
    setEnVerification(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error();
      const res = await fetch('/api/fle/verifier-phrase', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: phrase.trim(), mots: utilises, niveau }),
      });
      const json = await res.json();
      if (!json.success) throw new Error();
      const v = json.data as VerdictPhrase;
      setVerdict(v);
      if (v.sentenceValid && v.wordsFeedback.every((w) => w.correct)) {
        setReussi(true);
        onReussi(1, 1);
      }
    } catch {
      setMessage('Impossible de vérifier ta phrase pour le moment, réessaie.');
    } finally {
      setEnVerification(false);
    }
  };

  return (
    <div className={styles.phraseLibre}>
      <div className={styles.reserve}>
        {mots.map((m) => (
          <span key={m} className={`${styles.etiquette} ${utilises.includes(m) ? styles.etiquetteUtilisee : ''}`}>
            {m}
          </span>
        ))}
      </div>
      <textarea
        className={styles.phraseChamp}
        rows={3}
        value={phrase}
        placeholder="Écris ta phrase ici…"
        readOnly={reussi}
        onChange={(e) => {
          setPhrase(e.target.value);
          setVerdict(null);
        }}
      />
      <p className={styles.indication}>
        {utilises.length} / {mots.length} mots utilisés (il en faut au moins {requis})
      </p>
      {message && <p className={styles.echec}>{message}</p>}
      {verdict && (
        <div className={styles.verdict}>
          {verdict.wordsFeedback.length > 0 && (
            <ul className={styles.verdictMots}>
              {verdict.wordsFeedback.map((w, i) => (
                <li key={i} className={w.correct ? styles.succes : styles.echec}>
                  <strong>{w.word}</strong> {w.correct ? '✅' : '❌'}
                  {w.explanation ? ` — ${w.explanation}` : ''}
                </li>
              ))}
            </ul>
          )}
          <p className={verdict.sentenceValid ? styles.succes : styles.echec}>
            {verdict.sentenceFeedback || (verdict.sentenceValid ? 'Bravo, ta phrase est correcte !' : 'Ta phrase contient une erreur.')}
          </p>
          {!verdict.sentenceValid && verdict.correctedSentence && <p className={styles.corrigee}>✏️ {verdict.correctedSentence}</p>}
        </div>
      )}
      {!reussi && (
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimaire} onClick={verifier} disabled={enVerification}>
            {enVerification ? 'Vérification…' : 'Vérifier'}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══ Le test de lecture (QCM + appariement, deux pages, score en %) ═══
const COULEURS_PAIRES = ['#2d6a5a', '#d4944c', '#c4862e', '#2d8a4e', '#b44040', '#7a5fa0', '#c4a022', '#1a8a6e'];

export function TestDeLecture({
  questions,
  pairs,
  resultat,
  onResultat,
  onFermer,
  readOnly,
}: {
  questions: { question: string; options: string[]; correct: number }[];
  pairs: { fr: string; tr: string }[];
  resultat?: ResultatExercice;
  onResultat?: (r: ResultatExercice) => void;
  onFermer: () => void;
  readOnly?: boolean;
}) {
  const [page, setPage] = useState<1 | 2 | 'resultats'>(1);
  const [reponses, setReponses] = useState<Record<number, number>>({});
  const gauche = useMemo(() => melanger(pairs), [pairs]);
  const droite = useMemo(() => melanger(pairs), [pairs]);
  const [selFr, setSelFr] = useState<string | null>(null);
  const [selTr, setSelTr] = useState<string | null>(null);
  // mot français choisi → mot français de la traduction choisie (la clé d'une traduction est son fr)
  const [paires, setPaires] = useState<Map<string, string>>(() => new Map());
  const [couleurs, setCouleurs] = useState<Map<string, string>>(() => new Map());
  const compteurCouleur = useRef(0);
  const [score, setScore] = useState<{ qcm: number; app: number } | null>(null);

  const [lignes, setLignes] = useState<{ x1: number; y1: number; x2: number; y2: number; c: string }[]>([]);
  const cadre = useRef<HTMLDivElement>(null);
  const refsFr = useRef<Map<string, HTMLButtonElement>>(new Map());
  const refsTr = useRef<Map<string, HTMLButtonElement>>(new Map());

  const former = (fr: string | null, tr: string | null) => {
    if (!fr || !tr) return;
    const c = COULEURS_PAIRES[compteurCouleur.current++ % COULEURS_PAIRES.length];
    setPaires((p) => new Map(p).set(fr, tr));
    setCouleurs((m) => new Map(m).set(fr, c));
    setSelFr(null);
    setSelTr(null);
  };
  const frDeTr = (tr: string) => [...paires.entries()].find(([, t]) => t === tr)?.[0];
  const defaire = (fr: string) => {
    setPaires((p) => {
      const n = new Map(p);
      n.delete(fr);
      return n;
    });
  };

  useLayoutEffect(() => {
    const c = cadre.current?.getBoundingClientRect();
    if (!c) return;
    setLignes(
      [...paires.entries()].flatMap(([fr, tr]) => {
        const a = refsFr.current.get(fr)?.getBoundingClientRect();
        const b = refsTr.current.get(tr)?.getBoundingClientRect();
        if (!a || !b) return [];
        return [{ x1: a.right - c.left, y1: a.top + a.height / 2 - c.top, x2: b.left - c.left, y2: b.top + b.height / 2 - c.top, c: couleurs.get(fr) ?? '#4a7ba7' }];
      })
    );
  }, [paires, couleurs, page]);

  const soumettre = () => {
    const qcm = questions.filter((q, i) => reponses[i] === q.correct).length;
    const app = [...paires.entries()].filter(([fr, tr]) => fr === tr).length;
    setScore({ qcm, app });
    setPage('resultats');
    onResultat?.({ score: qcm + app, total: questions.length + pairs.length, essais: 1, at: new Date().toISOString() });
  };

  const total = questions.length + pairs.length;
  const pct = score ? Math.round(((score.qcm + score.app) / Math.max(1, total)) * 100) : 0;

  if (readOnly) {
    return (
      <div className={styles.cadre}>
        <div className={styles.entete}>
          <h3 className={styles.titre}>Test de lecture</h3>
          <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className={styles.corps}>
          <p className={styles.lectureSeule}>
            {resultat ? `Score : ${resultat.score} / ${resultat.total} (${Math.round((resultat.score / Math.max(1, resultat.total)) * 100)} %).` : 'Pas encore fait.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <span className={styles.compteur}>{page === 'resultats' ? 'Résultats' : `${page} / 2`}</span>
        <h3 className={styles.titre}>Test de lecture</h3>
        <p className={styles.consigne}>{page === 1 ? 'Questions de compréhension' : page === 2 ? 'Exercice d’appariement' : ''}</p>
        <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer le test">
          ✕
        </button>
      </div>
      <div className={styles.corps}>
        {(page === 1 || page === 'resultats') && (
          <ol className={styles.qcm}>
            {questions.map((q, qi) => (
              <li key={qi} className={styles.qcmQuestion}>
                <span className={styles.qcmEnonce}>
                  <span className={styles.puce}>{qi + 1}</span> {q.question}
                </span>
                <span className={styles.qcmOptions}>
                  {q.options.map((opt, oi) => {
                    const etat = page === 'resultats' ? (oi === q.correct ? styles.optionJuste : reponses[qi] === oi ? styles.optionFausse : '') : '';
                    return (
                      <label key={oi} className={`${styles.option} ${etat}`}>
                        <input
                          type="radio"
                          name={`test-q-${qi}`}
                          checked={reponses[qi] === oi}
                          disabled={page === 'resultats'}
                          onChange={() => setReponses((r) => ({ ...r, [qi]: oi }))}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
        {(page === 2 || page === 'resultats') && (
          <div className={styles.associations} ref={cadre}>
            <div className={styles.colonne}>
              {gauche.map((p) => {
                const apparie = paires.has(p.fr);
                const c = couleurs.get(p.fr);
                const etat = page === 'resultats' ? (paires.get(p.fr) === p.fr ? styles.itemTrouve : styles.itemErreur) : '';
                return (
                  <button
                    key={`fr-${p.fr}`}
                    type="button"
                    ref={(el) => {
                      if (el) refsFr.current.set(p.fr, el);
                    }}
                    className={`${styles.item} ${selFr === p.fr ? styles.itemSelection : ''} ${etat}`}
                    style={apparie && page !== 'resultats' ? { borderColor: c, color: c, background: `${c}15` } : undefined}
                    disabled={page === 'resultats'}
                    onClick={() => {
                      if (apparie) return defaire(p.fr);
                      setSelFr(p.fr);
                      former(p.fr, selTr);
                    }}
                  >
                    {p.fr}
                  </button>
                );
              })}
            </div>
            <svg className={styles.traits} aria-hidden="true">
              {lignes.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} style={{ stroke: l.c }} />
              ))}
            </svg>
            <div className={styles.colonne}>
              {droite.map((p) => {
                const fr = frDeTr(p.fr);
                const apparie = fr !== undefined;
                const c = fr ? couleurs.get(fr) : undefined;
                const etat = page === 'resultats' ? (fr === p.fr ? styles.itemTrouve : styles.itemErreur) : '';
                return (
                  <button
                    key={`tr-${p.fr}`}
                    type="button"
                    ref={(el) => {
                      if (el) refsTr.current.set(p.fr, el);
                    }}
                    className={`${styles.item} ${selTr === p.fr ? styles.itemSelection : ''} ${etat}`}
                    style={apparie && page !== 'resultats' ? { borderColor: c, color: c, background: `${c}15` } : undefined}
                    disabled={page === 'resultats'}
                    onClick={() => {
                      if (apparie && fr) return defaire(fr);
                      setSelTr(p.fr);
                      former(selFr, p.fr);
                    }}
                  >
                    {p.tr}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {page === 'resultats' && score && (
          <div className={styles.scoreBloc}>
            <div className={`${styles.scoreCercle} ${pct >= 70 ? styles.scoreBon : pct >= 50 ? styles.scoreMoyen : styles.scoreFaible}`}>{pct}%</div>
            <div className={styles.scoreDetails}>
              <p>
                QCM : {score.qcm} / {questions.length}
              </p>
              <p>
                Appariement : {score.app} / {pairs.length}
              </p>
              <p>
                <strong>
                  Total : {score.qcm + score.app} / {total}
                </strong>
              </p>
            </div>
          </div>
        )}
      </div>
      <div className={styles.pied}>
        <div>
          {page === 2 && (
            <button type="button" className={styles.btnSecondaire} onClick={() => setPage(1)}>
              ← Précédent
            </button>
          )}
        </div>
        <div />
        <div>
          {page === 1 && (
            <button type="button" className={styles.btnPrimaire} onClick={() => setPage(2)}>
              Suivant →
            </button>
          )}
          {page === 2 && (
            <button type="button" className={styles.btnPrimaire} onClick={soumettre}>
              Soumettre le test
            </button>
          )}
          {page === 'resultats' && (
            <button type="button" className={styles.btnPrimaire} onClick={onFermer}>
              Fermer le test
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ Le cadre des sept exercices ═══
export default function ExercicesVocabulaire({ donnees, langue, niveau, resultats, onResultat, onFermer, readOnly }: Props) {
  const traduire = useTraduction(langue);
  const motsListe = useMemo(() => donnees.matching?.pairs?.map((p) => p.fr) ?? [], [donnees]);

  const exercices = useMemo<Exercice[]>(() => {
    const liste: Exercice[] = [];
    if (donnees.matching?.pairs?.length) liste.push({ type: 'matching', titre: 'Associations', consigne: 'Clique un mot français, puis sa traduction.' });
    if (donnees.family?.items?.length) liste.push({ type: 'family', titre: 'Famille de mots', consigne: 'Retourne chaque carte et retrouve les mots de la même famille.' });
    if (donnees.tags?.items?.length) liste.push({ type: 'tags', titre: 'Étiquettes', consigne: 'Glisse chaque étiquette dans la bonne phrase (ou clique l’étiquette, puis la case).' });
    if (donnees.reading?.text) liste.push({ type: 'reading', titre: 'Lecture', consigne: 'Lis le texte en silence (clique un mot pour sa traduction). Ensuite, écoute chaque phrase, puis enregistre ta lecture.' });
    if (donnees.matching?.pairs?.length) liste.push({ type: 'listening_matching', titre: 'Écoute et associe', consigne: 'Écoute chaque mot français (🔊) et relie-le à sa traduction.' });
    if (donnees.cloze?.items?.length) liste.push({ type: 'cloze', titre: 'Défi final', consigne: 'Écris le mot qui manque dans chaque phrase.' });
    if (motsListe.length) {
      const requis = Math.max(1, Math.ceil(motsListe.length / 2));
      liste.push({
        type: 'sentence',
        titre: 'Phrase avec le vocabulaire',
        consigne: `Écris une phrase en français qui utilise au moins ${requis} mot${requis > 1 ? 's' : ''} parmi les ${motsListe.length} appris (soit la moitié).`,
      });
    }
    return liste;
  }, [donnees, motsListe]);

  const [etape, setEtape] = useState(0);
  const [reussis, setReussis] = useState<Set<number>>(() => new Set(exercices.map((e, i) => (resultats[e.type] ? i : -1)).filter((i) => i >= 0)));
  const [fini, setFini] = useState(false);
  const essais = useRef<Record<number, number>>({});

  if (exercices.length === 0) return null;

  const courant = exercices[etape];
  const maxReussi = reussis.size ? Math.max(...reussis) : -1;

  const marquerReussi = (idx: number, score: number, total: number) => {
    if (reussis.has(idx)) return;
    setReussis((prev) => new Set(prev).add(idx));
    onResultat?.(exercices[idx].type, { score, total, essais: essais.current[idx] || 1, at: new Date().toISOString() });
  };

  const aller = (idx: number) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    if (idx >= exercices.length) {
      setFini(true);
      return;
    }
    setEtape(idx);
  };

  if (fini) {
    return (
      <div className={styles.cadre}>
        <div className={styles.fin}>
          <div className={styles.trophee} aria-hidden="true">
            🏆
          </div>
          <h3 className={styles.finTitre}>Félicitations !</h3>
          <p>Tu as terminé tous les exercices.</p>
          <button type="button" className={styles.btnPrimaire} onClick={onFermer}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  const compterEssai = () => {
    essais.current[etape] = (essais.current[etape] || 0) + 1;
  };
  const reussir = (s: number, t: number) => marquerReussi(etape, s, t);

  const rendre = () => {
    if (readOnly) {
      const r = resultats[courant.type];
      return <p className={styles.lectureSeule}>{r ? `Réussi : ${r.score}/${r.total} en ${r.essais} essai${r.essais > 1 ? 's' : ''}.` : 'Pas encore fait.'}</p>;
    }
    switch (courant.type) {
      case 'matching':
      case 'listening_matching':
        return <Associations pairs={donnees.matching!.pairs} audio={courant.type === 'listening_matching'} onReussi={reussir} />;
      case 'family':
        return <FamilleDeMots items={donnees.family!.items} traduire={traduire} onVerifier={compterEssai} onReussi={reussir} />;
      case 'tags':
        return <Etiquettes items={donnees.tags!.items} onVerifier={compterEssai} onReussi={reussir} />;
      case 'reading':
        return <LectureAVoixHaute texte={donnees.reading!.text} traduire={traduire} onReussi={reussir} />;
      case 'cloze':
        return <TexteATrous items={donnees.cloze!.items} onVerifier={compterEssai} onReussi={reussir} />;
      case 'sentence':
        return <PhraseAvecVocabulaire mots={motsListe} niveau={niveau} onVerifier={compterEssai} onReussi={reussir} />;
    }
  };

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <span className={styles.compteur}>
          Exercice {etape + 1} / {exercices.length}
        </span>
        <h3 className={styles.titre}>{courant.titre}</h3>
        <p className={styles.consigne}>{courant.consigne}</p>
        <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer les exercices">
          ✕
        </button>
      </div>

      <div className={styles.corps} key={`${courant.type}-${etape}`}>
        {rendre()}
      </div>

      <div className={styles.pied}>
        <button type="button" className={styles.btnSecondaire} disabled={etape === 0} onClick={() => aller(etape - 1)}>
          ← Précédent
        </button>
        <div className={styles.points} role="tablist">
          {exercices.map((e, idx) => {
            const atteignable = idx === etape || reussis.has(idx) || idx === maxReussi + 1;
            return (
              <button
                key={e.type}
                type="button"
                className={`${styles.point} ${idx === etape ? styles.pointActif : ''} ${reussis.has(idx) ? styles.pointReussi : ''}`}
                disabled={!atteignable}
                onClick={() => atteignable && aller(idx)}
                aria-label={`Exercice ${idx + 1}${reussis.has(idx) ? ' (terminé)' : ''}`}
              />
            );
          })}
        </div>
        <div>
          {(reussis.has(etape) || readOnly) && (
            <button type="button" className={styles.btnPrimaire} onClick={() => aller(etape + 1)}>
              Continuer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
