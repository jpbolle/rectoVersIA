'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  CrosswordExercise,
  SynonymAntonymTextExercise,
  EvaluationCompositionExercise,
  EvaluationScore,
  EvaluationCompositionValidation,
  EvaluationAttempt,
} from '@/types/vocabulaire';
import { removeAccents } from '@/types/vocabulaire';
import { useAuth } from '@/hooks/useAuth';
import styles from './VocabulaireEvaluation.module.css';

// ══════════════════════════════════════════════════════════
// Types internes
// ══════════════════════════════════════════════════════════

interface VocabulaireEvaluationProps {
  crossword: CrosswordExercise;
  synonymAntonymText: SynonymAntonymTextExercise;
  composition: EvaluationCompositionExercise;
  onSubmitAttempt: (attempt: EvaluationAttempt) => void;
  onBackToLearning: () => void;
}

// ══════════════════════════════════════════════════════════
// Sous-composant : Grille de mots croises
// ══════════════════════════════════════════════════════════

function CrosswordGrid({
  exercise,
  answers,
  onAnswerChange,
  corrections,
}: {
  exercise: CrosswordExercise;
  answers: Record<string, string>;
  onAnswerChange: (key: string, value: string) => void;
  corrections: Record<string, 'correct' | 'incorrect'> | null;
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Le mot actif : position + direction choisie
  const [activeWord, setActiveWord] = useState<{ position: number; orientation: 'across' | 'down' } | null>(null);

  // Construire les structures de la grille
  const whiteCells = new Set<string>();
  // Cle composite "position-orientation" pour eviter les ecrasements quand 2 mots partagent un numero
  const wordByKey = new Map<string, typeof exercise.words[0]>();
  // Une cellule peut etre le depart de plusieurs mots (H et V)
  const cellToWords = new Map<string, typeof exercise.words[0][]>();
  // Set des cellules du mot actif (pour le surlignage)
  const activeCellKeys = new Set<string>();

  for (const word of exercise.words) {
    for (let i = 0; i < word.answer.length; i++) {
      const row = word.orientation === 'down' ? word.starty + i : word.starty;
      const col = word.orientation === 'across' ? word.startx + i : word.startx;
      whiteCells.add(`${row}-${col}`);
    }
    wordByKey.set(`${word.position}-${word.orientation}`, word);
    const startKey = `${word.starty}-${word.startx}`;
    const existing = cellToWords.get(startKey) || [];
    existing.push(word);
    cellToWords.set(startKey, existing);
  }

  // Calculer les cellules du mot actif
  if (activeWord) {
    const word = wordByKey.get(`${activeWord.position}-${activeWord.orientation}`);
    if (word) {
      for (let i = 0; i < word.answer.length; i++) {
        const row = word.orientation === 'down' ? word.starty + i : word.starty;
        const col = word.orientation === 'across' ? word.startx + i : word.startx;
        activeCellKeys.add(`${row}-${col}`);
      }
    }
  }

  // Trouver la cellule suivante dans la direction du mot actif
  const getNextInDirection = (row: number, col: number, dir: 'across' | 'down', delta: 1 | -1): string | null => {
    if (dir === 'across') {
      const nextCol = col + delta;
      const key = `${row}-${nextCol}`;
      if (activeCellKeys.has(key)) return key;
    } else {
      const nextRow = row + delta;
      const key = `${nextRow}-${col}`;
      if (activeCellKeys.has(key)) return key;
    }
    return null;
  };

  // Direction active (par defaut droite si pas de mot actif)
  const dir = activeWord?.orientation || 'across';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key === 'Backspace' && !answers[`${row}-${col}`]) {
      e.preventDefault();
      const prev = getNextInDirection(row, col, dir, -1);
      if (prev) inputRefs.current[prev]?.focus();
    }
    if (e.key === 'ArrowRight') {
      const next = `${row}-${col + 1}`;
      if (whiteCells.has(next)) inputRefs.current[next]?.focus();
    }
    if (e.key === 'ArrowLeft') {
      const prev = `${row}-${col - 1}`;
      if (whiteCells.has(prev)) inputRefs.current[prev]?.focus();
    }
    if (e.key === 'ArrowDown') {
      const next = `${row + 1}-${col}`;
      if (whiteCells.has(next)) inputRefs.current[next]?.focus();
    }
    if (e.key === 'ArrowUp') {
      const prev = `${row - 1}-${col}`;
      if (whiteCells.has(prev)) inputRefs.current[prev]?.focus();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>, row: number, col: number) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    const letter = val.slice(-1);
    onAnswerChange(`${row}-${col}`, letter);

    if (letter) {
      // Avancer dans la direction du mot actif
      const next = getNextInDirection(row, col, dir, 1);
      if (next) setTimeout(() => inputRefs.current[next]?.focus(), 0);
    }
  };

  // Selectionner un mot (clic case numerotee ou clic definition)
  const selectWord = (position: number, orientation: 'across' | 'down') => {
    setActiveWord({ position, orientation });
  };

  // Focus par frappe clavier : ne pas changer de mot si on est dans le mot actif
  const handleCellFocus = (row: number, col: number) => {
    const key = `${row}-${col}`;

    // Si on est deja dans le mot actif, ne rien changer
    if (activeWord && activeCellKeys.has(key)) return;

    // Cellule de depart d'un ou plusieurs mots → selectionner le premier
    const wordsAtCell = cellToWords.get(key);
    if (wordsAtCell && wordsAtCell.length > 0) {
      selectWord(wordsAtCell[0].position, wordsAtCell[0].orientation);
      return;
    }

    // Cellule qui fait partie d'un autre mot
    for (const word of exercise.words) {
      for (let i = 0; i < word.answer.length; i++) {
        const wr = word.orientation === 'down' ? word.starty + i : word.starty;
        const wc = word.orientation === 'across' ? word.startx + i : word.startx;
        if (wr === row && wc === col) {
          selectWord(word.position, word.orientation);
          return;
        }
      }
    }
  };

  // Clic explicite : sur une case numerotee, basculer entre les mots (H/V)
  const handleCellClick = (row: number, col: number) => {
    const key = `${row}-${col}`;
    const wordsAtCell = cellToWords.get(key);

    if (wordsAtCell && wordsAtCell.length > 1) {
      // Croisement : basculer vers le NEXT mot (toggle H/V)
      const currentIdx = activeWord
        ? wordsAtCell.findIndex((w) => w.position === activeWord.position)
        : -1;
      const nextIdx = (currentIdx + 1) % wordsAtCell.length;
      selectWord(wordsAtCell[nextIdx].position, wordsAtCell[nextIdx].orientation);
    } else if (wordsAtCell && wordsAtCell.length === 1) {
      selectWord(wordsAtCell[0].position, wordsAtCell[0].orientation);
    }
    // Si pas de mot qui demarre ici, handleCellFocus s'en charge via onFocus
  };

  // Definitions a afficher (tous les mots qui partent de la case active)
  const activeWordObj = activeWord ? wordByKey.get(`${activeWord.position}-${activeWord.orientation}`) : null;
  const activeStartKey = activeWordObj ? `${activeWordObj.starty}-${activeWordObj.startx}` : null;
  const cluesAtActiveCell = activeStartKey ? (cellToWords.get(activeStartKey) || []) : [];

  return (
    <div className={styles.crosswordContainer}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>
        Clique sur une case numérotée pour voir sa définition. Choisis la direction (→ ou ↓) puis tape les lettres.
      </p>

      <div className={styles.crosswordLayout}>
        {/* Grille */}
        <div
          className={styles.crosswordGrid}
          style={{
            gridTemplateColumns: `repeat(${exercise.gridCols}, 32px)`,
            gridTemplateRows: `repeat(${exercise.gridRows}, 32px)`,
          }}
        >
          {Array.from({ length: exercise.gridRows }, (_, r) =>
            Array.from({ length: exercise.gridCols }, (_, c) => {
              const row = r + 1;
              const col = c + 1;
              const key = `${row}-${col}`;
              const isWhite = whiteCells.has(key);
              const wordsHere = cellToWords.get(key);
              const hasNumber = wordsHere && wordsHere.length > 0;

              if (!isWhite) {
                return <div key={key} className={`${styles.crosswordCell} ${styles.cellBlack}`} />;
              }

              let cellStyle: React.CSSProperties = {};
              if (corrections) {
                if (corrections[key] === 'correct') cellStyle.background = '#d4edda';
                else if (corrections[key] === 'incorrect') cellStyle.background = '#f8d7da';
              } else if (activeCellKeys.has(key)) {
                cellStyle.background = '#e8f4fd';
              }

              // Afficher le plus petit numero des mots partant de cette case
              const displayNumber = hasNumber
                ? Math.min(...wordsHere.map((w) => w.position))
                : undefined;

              return (
                <div
                  key={key}
                  className={`${styles.crosswordCell} ${styles.cellWhite} ${hasNumber ? styles.cellNumbered : ''}`}
                  style={cellStyle}
                  onClick={() => handleCellClick(row, col)}
                >
                  {displayNumber && <span className={styles.cellNumber}>{displayNumber}</span>}
                  <input
                    ref={(el) => { inputRefs.current[key] = el; }}
                    type="text"
                    maxLength={2}
                    className={styles.cellInput}
                    value={answers[key] || ''}
                    onChange={(e) => handleInput(e, row, col)}
                    onKeyDown={(e) => handleKeyDown(e, row, col)}
                    onFocus={() => handleCellFocus(row, col)}
                    disabled={corrections !== null}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Panneau definitions a droite */}
        <div className={styles.crosswordCluePanel}>
          {cluesAtActiveCell.length > 0 ? (
            <div className={styles.activeClue}>
              {cluesAtActiveCell.map((word) => {
                const isSelected = activeWord?.position === word.position && activeWord?.orientation === word.orientation;
                return (
                  <div
                    key={`${word.position}-${word.orientation}`}
                    className={`${styles.activeClueItem} ${isSelected ? styles.activeClueItemSelected : ''}`}
                    onClick={() => selectWord(word.position, word.orientation)}
                  >
                    <div className={styles.activeClueHeader}>
                      <span className={styles.activeClueNumber}>{word.position}</span>
                      <span className={styles.activeClueDir}>
                        {word.orientation === 'across' ? '→ Horizontal' : '↓ Vertical'}
                      </span>
                    </div>
                    <p className={styles.activeClueText}>{word.clue}</p>
                  </div>
                );
              })}
            </div>
          ) : activeWordObj ? (
            <div className={styles.activeClue}>
              <div className={styles.activeClueItem}>
                <div className={styles.activeClueHeader}>
                  <span className={styles.activeClueNumber}>{activeWordObj.position}</span>
                  <span className={styles.activeClueDir}>
                    {activeWordObj.orientation === 'across' ? '→ Horizontal' : '↓ Vertical'}
                  </span>
                </div>
                <p className={styles.activeClueText}>{activeWordObj.clue}</p>
              </div>
            </div>
          ) : (
            <div className={styles.cluePlaceholder}>
              Clique sur une case numérotée pour voir la définition
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Sous-composant : Texte synonymes/antonymes
// ══════════════════════════════════════════════════════════

function SynonymAntonymText({
  exercise,
  answers,
  onAnswerChange,
  corrections,
}: {
  exercise: SynonymAntonymTextExercise;
  answers: Record<string, string>;
  onAnswerChange: (word: string, value: string) => void;
  corrections: Record<string, { correct: boolean; expected: string }> | null;
}) {
  const [activeWord, setActiveWord] = useState<string | null>(null);

  // Parser le texte avec les balises {syn:mot} et {ant:mot}
  const renderText = () => {
    const parts: React.ReactNode[] = [];
    const regex = /\{(syn|ant):([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(exercise.text)) !== null) {
      // Texte avant la balise
      if (match.index > lastIndex) {
        parts.push(<span key={`t-${lastIndex}`}>{exercise.text.slice(lastIndex, match.index)}</span>);
      }

      const type = match[1] as 'syn' | 'ant';
      const word = match[2];
      const replacement = exercise.replacements.find((r) => r.original === word);
      const isSyn = type === 'syn';
      const answer = answers[word] || '';
      const isActive = activeWord === word;

      if (corrections) {
        // Mode correction
        const corr = corrections[word];
        parts.push(
          <span key={`w-${word}`}>
            <span className={`${styles.synAntWord} ${isSyn ? styles.synAntWordSyn : styles.synAntWordAnt}`}>
              {word}
            </span>
            {' → '}
            <span className={corr?.correct ? styles.correctionCorrect : styles.correctionIncorrect}>
              {answer || '(vide)'}
            </span>
            {!corr?.correct && (
              <span className={styles.correctionExpected}> ({corr?.expected})</span>
            )}
          </span>
        );
      } else if (isActive) {
        // Mode saisie
        parts.push(
          <span key={`w-${word}`}>
            <span className={`${styles.synAntWord} ${isSyn ? styles.synAntWordSyn : styles.synAntWordAnt} ${styles.synAntWordAnswered}`}>
              {word}
            </span>
            {' → '}
            <input
              type="text"
              className={`${styles.synAntInput} ${isSyn ? styles.synAntInputSyn : styles.synAntInputAnt}`}
              value={answer}
              onChange={(e) => onAnswerChange(word, e.target.value)}
              onBlur={() => setActiveWord(null)}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveWord(null); }}
              autoFocus
              placeholder={isSyn ? 'synonyme...' : 'antonyme...'}
            />
          </span>
        );
      } else if (answer) {
        // Repondu, afficher la reponse
        parts.push(
          <span key={`w-${word}`}>
            <span
              className={`${styles.synAntWord} ${isSyn ? styles.synAntWordSyn : styles.synAntWordAnt} ${styles.synAntWordAnswered}`}
              onClick={() => setActiveWord(word)}
              title="Cliquer pour modifier"
            >
              {word}
            </span>
            {' → '}
            <span
              className={`${styles.synAntWord} ${isSyn ? styles.synAntWordSyn : styles.synAntWordAnt}`}
              onClick={() => setActiveWord(word)}
              style={{ cursor: 'pointer' }}
            >
              {answer}
            </span>
          </span>
        );
      } else {
        // Pas encore repondu
        parts.push(
          <span
            key={`w-${word}`}
            className={`${styles.synAntWord} ${isSyn ? styles.synAntWordSyn : styles.synAntWordAnt}`}
            onClick={() => setActiveWord(word)}
            title={isSyn ? 'Remplacer par un synonyme' : 'Remplacer par un antonyme'}
          >
            {word}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Texte apres la derniere balise
    if (lastIndex < exercise.text.length) {
      parts.push(<span key={`t-${lastIndex}`}>{exercise.text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.synAntLegend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.legendDotSyn}`} />
          <span>Remplacer par un synonyme</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.legendDotAnt}`} />
          <span>Remplacer par un antonyme</span>
        </div>
      </div>

      <div className={styles.synAntText}>
        {renderText()}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Sous-composant : Composition
// ══════════════════════════════════════════════════════════

function EvaluationComposition({
  exercise,
  text,
  onTextChange,
  validation,
}: {
  exercise: EvaluationCompositionExercise;
  text: string;
  onTextChange: (text: string) => void;
  validation: EvaluationCompositionValidation | null;
}) {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className={styles.compositionContainer}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.compositionTheme}>
        <p className={styles.compositionThemeLabel}>Sujet</p>
        <p className={styles.compositionThemeText}>{exercise.theme}</p>
      </div>

      <div>
        <p className={styles.compositionConstraint}>{exercise.constraint}</p>
      </div>

      <div>
        <p style={{ fontSize: '0.78rem', color: 'var(--c-text-dim)', margin: '0 0 6px' }}>
          Mots à utiliser dans ton texte :
        </p>
        <div className={styles.compositionWords}>
          {exercise.requiredWords.map((w) => (
            <span key={w} className={styles.compositionWordTag}>{w}</span>
          ))}
        </div>
      </div>

      <textarea
        className={styles.compositionTextarea}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Écris ton texte ici..."
        disabled={validation !== null}
      />
      <div className={styles.compositionCounter}>{wordCount} mots</div>

      {validation && (
        <div className={styles.compositionFeedback}>
          <strong>Note : {validation.qualityScore}/10</strong>
          <p style={{ margin: '6px 0' }}>{validation.feedback}</p>
          <div className={styles.wordCheckList}>
            {validation.wordsUsed.map((wu) => (
              <div key={wu.word} className={styles.wordCheckItem}>
                <span>{wu.found ? '✓' : '✗'}</span>
                <span className={wu.found ? styles.correctionCorrect : styles.correctionIncorrect}>
                  {wu.word}
                </span>
                {wu.found && wu.form && wu.form !== wu.word && (
                  <span style={{ color: 'var(--c-text-dim)', fontSize: '0.72rem' }}>
                    (trouvé : « {wu.form} »)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Composant principal
// ══════════════════════════════════════════════════════════

export default function VocabulaireEvaluation({
  crossword,
  synonymAntonymText,
  composition,
  onSubmitAttempt,
  onBackToLearning,
}: VocabulaireEvaluationProps) {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  // Reponses pour chaque exercice
  const [crosswordAnswers, setCrosswordAnswers] = useState<Record<string, string>>({});
  const [synAntAnswers, setSynAntAnswers] = useState<Record<string, string>>({});
  const [compositionText, setCompositionText] = useState('');

  // Etat de soumission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Corrections
  const [crosswordCorrections, setCrosswordCorrections] = useState<Record<string, 'correct' | 'incorrect'> | null>(null);
  const [synAntCorrections, setSynAntCorrections] = useState<Record<string, { correct: boolean; expected: string }> | null>(null);
  const [compositionValidation, setCompositionValidation] = useState<EvaluationCompositionValidation | null>(null);
  const [score, setScore] = useState<EvaluationScore | null>(null);

  // ── Correction des mots croises (client) ──
  const correctCrossword = useCallback((): { correct: number; total: number; corrections: Record<string, 'correct' | 'incorrect'> } => {
    const corrections: Record<string, 'correct' | 'incorrect'> = {};
    let correct = 0;
    let total = 0;

    for (const word of crossword.words) {
      let wordCorrect = true;
      const expectedLetters = removeAccents(word.answer).toUpperCase();

      for (let i = 0; i < word.answer.length; i++) {
        const row = word.orientation === 'down' ? word.starty + i : word.starty;
        const col = word.orientation === 'across' ? word.startx + i : word.startx;
        const key = `${row}-${col}`;
        const expected = expectedLetters[i];
        const given = (crosswordAnswers[key] || '').toUpperCase();

        if (given === expected) {
          corrections[key] = 'correct';
        } else {
          corrections[key] = 'incorrect';
          wordCorrect = false;
        }
      }

      total++;
      if (wordCorrect) correct++;
    }

    return { correct, total, corrections };
  }, [crossword, crosswordAnswers]);

  // ── Correction synonymes/antonymes (client + Claude pour les cas douteux) ──
  const correctSynAnt = useCallback(async (): Promise<{ correct: number; total: number; corrections: Record<string, { correct: boolean; expected: string }> }> => {
    const corrections: Record<string, { correct: boolean; expected: string }> = {};
    let correct = 0;
    let total = 0;

    // Extraire la phrase contenant la balise {syn:original} ou {ant:original}
    // pour donner du contexte a Claude lors de la validation tolerante
    const extractContextSentence = (original: string): string => {
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`\\{(?:syn|ant):${escaped}\\}`);
      const match = tagRegex.exec(synonymAntonymText.text);
      if (!match) return '';
      const idx = match.index;
      let start = idx;
      while (start > 0 && !/[.!?\n]/.test(synonymAntonymText.text[start - 1])) start--;
      let end = idx + match[0].length;
      while (end < synonymAntonymText.text.length && !/[.!?\n]/.test(synonymAntonymText.text[end])) end++;
      if (end < synonymAntonymText.text.length) end++;
      // Remplacer la balise par le mot original simple pour la lisibilite
      return synonymAntonymText.text.slice(start, end).replace(/\{(?:syn|ant):([^}]+)\}/g, '$1').trim();
    };

    // 1. Verification client (liste acceptedAnswers)
    const needsClaudeCheck: { original: string; type: 'synonym' | 'antonym'; userAnswer: string; context: string }[] = [];

    for (const replacement of synonymAntonymText.replacements) {
      total++;
      const userAnswer = (synAntAnswers[replacement.original] || '').trim();
      if (!userAnswer) {
        corrections[replacement.original] = { correct: false, expected: replacement.acceptedAnswers[0] };
        continue;
      }

      const isInList = replacement.acceptedAnswers.some(
        (a) => a.toLowerCase() === userAnswer.toLowerCase()
      );

      if (isInList) {
        correct++;
        corrections[replacement.original] = { correct: true, expected: replacement.acceptedAnswers[0] };
      } else {
        // Reponse pas dans la liste — demander a Claude avec le contexte de la phrase
        needsClaudeCheck.push({
          original: replacement.original,
          type: replacement.type,
          userAnswer,
          context: extractContextSentence(replacement.original),
        });
        corrections[replacement.original] = { correct: false, expected: replacement.acceptedAnswers[0] };
      }
    }

    // 2. Verification Claude pour les cas douteux
    if (needsClaudeCheck.length > 0) {
      try {
        console.log('[EVAL] Verification Claude pour', needsClaudeCheck.length, 'reponses syn/ant');
        const headers = await getAuthHeaders();
        const response = await fetch('/api/vocabulaire/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            words: [],
            mode: 'validate_syn_ant',
            synAntChecks: needsClaudeCheck,
          }),
        });
        const data = await response.json();
        if (data.success && data.data.results) {
          for (const result of data.data.results) {
            if (result.valid) {
              corrections[result.original] = { correct: true, expected: result.userAnswer };
              correct++;
            }
          }
        }
      } catch (err) {
        console.error('[EVAL] Erreur verification Claude syn/ant:', err);
        // On garde les resultats client en cas d'erreur
      }
    }

    return { correct, total, corrections };
  }, [synonymAntonymText, synAntAnswers, getAuthHeaders]);

  // ── Soumission ──
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    console.log('[EVAL] Soumission demarree');
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Corriger mots croises (client)
      console.log('[EVAL] Correction mots croises...');
      const cwResult = correctCrossword();
      setCrosswordCorrections(cwResult.corrections);
      console.log('[EVAL] Mots croises:', cwResult.correct, '/', cwResult.total);

      // 2. Corriger synonymes/antonymes (client + Claude si besoin)
      console.log('[EVAL] Correction syn/ant...');
      const saResult = await correctSynAnt();
      setSynAntCorrections(saResult.corrections);
      console.log('[EVAL] Syn/ant:', saResult.correct, '/', saResult.total);

      // 3. Corriger composition (Claude)
      let compResult: EvaluationCompositionValidation = {
        wordsUsed: (composition.requiredWords || []).map((w) => ({ word: w, found: false })),
        qualityScore: 0,
        feedback: 'Texte trop court pour être évalué.',
      };

      const wordCount = compositionText.trim() ? compositionText.trim().split(/\s+/).length : 0;
      console.log('[EVAL] Composition:', wordCount, 'mots');

      if (wordCount >= 5) {
        try {
          console.log('[EVAL] Appel API composition...');
          const headers = await getAuthHeaders();
          const response = await fetch('/api/vocabulaire/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              words: [],
              mode: 'evaluate_composition',
              compositionText,
              requiredWords: composition.requiredWords,
              compositionTheme: composition.theme,
            }),
          });
          const data = await response.json();
          console.log('[EVAL] Reponse API:', data.success);
          if (data.success) {
            compResult = data.data;
          }
        } catch (err) {
          console.error('[EVAL] Erreur API composition:', err);
        }
      }

      setCompositionValidation(compResult);

      // Calculer le score total
      const wordsFound = compResult.wordsUsed ? compResult.wordsUsed.filter((w) => w.found).length : 0;
      const compTotal = (composition.requiredWords || []).length || 1;
      const compScore = Math.round(((compResult.qualityScore / 10) * 5) + ((wordsFound / compTotal) * 5));

      const evalScore: EvaluationScore = {
        date: new Date().toISOString(),
        crosswordScore: { correct: cwResult.correct, total: cwResult.total },
        synonymAntonymScore: { correct: saResult.correct, total: saResult.total },
        compositionScore: { score: compScore, total: 10 },
        totalCorrect: cwResult.correct + saResult.correct + compScore,
        totalPossible: cwResult.total + saResult.total + 10,
        percentage: Math.round(((cwResult.correct + saResult.correct + compScore) / (cwResult.total + saResult.total + 10)) * 100),
      };

      console.log('[EVAL] Score final:', evalScore.percentage, '%');
      setScore(evalScore);
      setIsSubmitted(true);
      setActiveTab(0);

      // Envoyer la tentative complete au parent (dans un try separe pour ne pas bloquer l'affichage)
      try {
        const attempt: EvaluationAttempt = {
          date: new Date().toISOString(),
          score: evalScore,
          crossword,
          synonymAntonymText,
          composition,
          crosswordAnswers,
          synAntAnswers,
          compositionText,
          crosswordCorrections: cwResult.corrections,
          synAntCorrections: saResult.corrections,
          compositionValidation: compResult,
        };
        onSubmitAttempt(attempt);
        console.log('[EVAL] Tentative envoyee au parent');
      } catch (err) {
        console.error('[EVAL] Erreur envoi tentative au parent:', err);
        // Ne pas bloquer — l'eleve voit quand meme ses resultats
      }
    } catch (err) {
      console.error('[EVAL] ERREUR GLOBALE soumission:', err);
      setSubmitError(
        `Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}. Vérifie la console.`
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [correctCrossword, correctSynAnt, compositionText, composition, crossword, synonymAntonymText, crosswordAnswers, synAntAnswers, getAuthHeaders, onSubmitAttempt]);

  // Score inline par activite (affiche au-dessus de chaque exercice apres correction)
  const getActivityScore = (tab: number): string | null => {
    if (!isSubmitted || !score) return null;
    if (tab === 0) return `${score.crosswordScore.correct}/${score.crosswordScore.total} mots corrects`;
    if (tab === 1) return `${score.synonymAntonymScore.correct}/${score.synonymAntonymScore.total} remplacements corrects`;
    if (tab === 2) return `${score.compositionScore.score}/${score.compositionScore.total}`;
    return null;
  };

  return (
    <div className={styles.container}>
      {/* En-tete */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Évaluation de vocabulaire</h2>
        <p className={styles.headerSub}>
          {isSubmitted ? 'Correction de ton évaluation' : 'Complète les 3 activités puis soumets ton évaluation'}
        </p>
      </div>

      {/* Navigation activites */}
      <div className={styles.activityNav}>
        {['Mots croisés', 'Synonymes / Antonymes', 'Rédaction'].map((label, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.activityTab} ${activeTab === i ? styles.activityTabActive : ''} ${isSubmitted ? styles.activityTabDone : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <span className={styles.tabIcon}>
              {isSubmitted ? '✓' : (i === 0 ? '⊞' : i === 1 ? '↔' : '✎')}
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className={styles.activityContent}>
        {/* Score inline par activite */}
        {isSubmitted && (
          <div className={styles.activityScoreBanner}>
            <span className={styles.activityScoreLabel}>Score :</span>
            <span className={styles.activityScoreValue}>{getActivityScore(activeTab)}</span>
          </div>
        )}

        {activeTab === 0 && (
          <CrosswordGrid
            exercise={crossword}
            answers={crosswordAnswers}
            onAnswerChange={(k, v) => setCrosswordAnswers((prev) => ({ ...prev, [k]: v }))}
            corrections={crosswordCorrections}
          />
        )}

        {activeTab === 1 && (
          <SynonymAntonymText
            exercise={synonymAntonymText}
            answers={synAntAnswers}
            onAnswerChange={(w, v) => setSynAntAnswers((prev) => ({ ...prev, [w]: v }))}
            corrections={synAntCorrections}
          />
        )}

        {activeTab === 2 && (
          <EvaluationComposition
            exercise={composition}
            text={compositionText}
            onTextChange={setCompositionText}
            validation={compositionValidation}
          />
        )}
      </div>

      {/* Note finale + retour apres soumission */}
      {isSubmitted && score && (
        <div className={styles.resultsContainer}>
          <div className={styles.resultTotal}>
            <p className={styles.resultTotalLabel}>Note finale</p>
            <div className={styles.resultTotalScore}>
              {score.totalCorrect}/{score.totalPossible}
            </div>
            <div className={styles.resultTotalPct}>{score.percentage}%</div>
          </div>

          <div className={styles.resultActions}>
            <button
              type="button"
              className={styles.resultBtnPrimary}
              onClick={onBackToLearning}
            >
              Retour à la liste
            </button>
          </div>
        </div>
      )}

      {/* Bouton soumettre — uniquement sur le dernier onglet (Redaction) */}
      {!isSubmitted && activeTab === 2 && (
        <div className={styles.submitSection}>
          {isSubmitting ? (
            <div className={styles.submitting}>
              <div className={styles.submitSpinner} />
              <span>Correction en cours...</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                Soumettre l&apos;évaluation
              </button>
              {submitError && (
                <p style={{ color: '#e74c3c', fontSize: '0.8rem', margin: '8px 0 0' }}>{submitError}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
