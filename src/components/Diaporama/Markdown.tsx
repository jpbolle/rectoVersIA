'use client';

// Rendu et saisie du Markdown des dias (repris de VibeCoding, plan 2026-10-13).
// `react-markdown` n'exécute jamais le HTML collé dans le texte : l'affichage
// reste sûr pour une page ouverte par des élèves. Les tailles sont en « em » :
// le texte suit la taille du bloc qui le contient (dia, fenêtre, plein écran).

import { useRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './Markdown.module.css';

const composants: Components = {
  h1: ({ children }) => <h3 className={styles.h1}>{children}</h3>,
  h2: ({ children }) => <h4 className={styles.h2}>{children}</h4>,
  h3: ({ children }) => <h5 className={styles.h3}>{children}</h5>,
  p: ({ children }) => <p className={styles.p}>{children}</p>,
  ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
  ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
  li: ({ children }) => <li className={styles.li}>{children}</li>,
  strong: ({ children }) => <strong className={styles.strong}>{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.a}>
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className={styles.blockquote}>{children}</blockquote>,
  code: ({ children }) => <code className={styles.code}>{children}</code>,
  table: ({ children }) => <table className={styles.table}>{children}</table>,
  th: ({ children }) => <th className={styles.th}>{children}</th>,
  td: ({ children }) => <td className={styles.td}>{children}</td>,
  hr: () => <hr className={styles.hr} />,
};

// « En ligne » (titres de dia) : ni paragraphe ni grand titre
const composantsEnLigne: Components = {
  ...composants,
  p: ({ children }) => <>{children}</>,
  h1: ({ children }) => <strong>{children}</strong>,
  h2: ({ children }) => <strong>{children}</strong>,
  h3: ({ children }) => <strong>{children}</strong>,
};

export function Markdown({
  children,
  className = '',
  enLigne = false,
}: {
  children: string;
  className?: string;
  enLigne?: boolean;
}) {
  const Balise = enLigne ? 'span' : 'div';
  return (
    <Balise className={`${styles.racine} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={enLigne ? composantsEnLigne : composants}>
        {children}
      </ReactMarkdown>
    </Balise>
  );
}

// ————— Champ Markdown avec barre de mise en forme (éditeur) —————

type Selection = { texte: string; debut: number; fin: number };

// Applique `fn` aux lignes touchées par la sélection (ou à la ligne du curseur)
function surLignes(v: string, debut: number, fin: number, fn: (lignes: string[]) => string[]): Selection {
  const dernier = fin > debut && v[fin - 1] === '\n' ? fin - 1 : fin;
  const de = v.lastIndexOf('\n', debut - 1) + 1;
  const trouve = v.indexOf('\n', dernier);
  const a = trouve === -1 ? v.length : trouve;
  const bloc = fn(v.slice(de, a).split('\n')).join('\n');
  const texte = v.slice(0, de) + bloc + v.slice(a);
  return debut === fin
    ? { texte, debut: de + bloc.length, fin: de + bloc.length }
    : { texte, debut: de, fin: de + bloc.length };
}

const TITRE = /^#{1,6}\s+/;
const PUCE = /^(\s*)[-*+]\s+/;

// Titre de niveau `niveau` ; un second clic sur le même niveau le retire
function basculerTitre(v: string, debut: number, fin: number, niveau: number): Selection {
  const marque = '#'.repeat(niveau) + ' ';
  return surLignes(v, debut, fin, (lignes) => {
    const pleines = lignes.filter((l) => l.trim());
    const deja = pleines.length > 0 && pleines.every((l) => l.startsWith(marque) && !l.startsWith(marque + '#'));
    return lignes.map((l) => {
      const nue = l.replace(TITRE, '');
      if (deja) return nue;
      return l.trim() || lignes.length === 1 ? marque + nue : l;
    });
  });
}

// Liste à puces ; un second clic retire les puces
function basculerPuces(v: string, debut: number, fin: number): Selection {
  return surLignes(v, debut, fin, (lignes) => {
    const pleines = lignes.filter((l) => l.trim());
    const deja = pleines.length > 0 && pleines.every((l) => PUCE.test(l));
    return lignes.map((l) => {
      if (deja) return l.replace(PUCE, '$1');
      return l.trim() || lignes.length === 1 ? l.replace(/^(\s*)/, '$1- ') : l;
    });
  });
}

// Gras / italique : entoure la sélection (ou retire la marque si elle y est)
function basculerMarque(v: string, debut: number, fin: number, marque: string): Selection {
  const n = marque.length;
  if (debut !== fin && v.slice(debut - n, debut) === marque && v.slice(fin, fin + n) === marque) {
    return { texte: v.slice(0, debut - n) + v.slice(debut, fin) + v.slice(fin + n), debut: debut - n, fin: fin - n };
  }
  return { texte: v.slice(0, debut) + marque + v.slice(debut, fin) + marque + v.slice(fin), debut: debut + n, fin: fin + n };
}

// Lien : la sélection devient le texte du lien, « https:// » reste sélectionné
function insererLien(v: string, debut: number, fin: number): Selection {
  const label = v.slice(debut, fin) || 'texte du lien';
  const url = 'https://';
  const texte = v.slice(0, debut) + `[${label}](${url})` + v.slice(fin);
  return debut === fin
    ? { texte, debut: debut + 1, fin: debut + 1 + label.length }
    : { texte, debut: debut + label.length + 3, fin: debut + label.length + 3 + url.length };
}

export function MarkdownEditeur({
  valeur,
  onChange,
  lignes,
  placeholder,
}: {
  valeur: string;
  onChange: (v: string) => void;
  lignes?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const appliquer = (action: (v: string, debut: number, fin: number) => Selection) => {
    const el = ref.current;
    if (!el) return;
    const suite = action(valeur, el.selectionStart, el.selectionEnd);
    onChange(suite.texte);
    // Replace la sélection une fois le nouveau texte affiché
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(suite.debut, suite.fin);
    });
  };

  const outil = (label: string, title: string, action: (v: string, d: number, f: number) => Selection) => (
    <button
      type="button"
      title={title}
      // Garde le curseur dans le champ au moment du clic
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => appliquer(action)}
      className={styles.outil}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.editeur}>
      <div className={styles.barre} role="toolbar" aria-label="Mise en forme">
        {outil('H1', 'Grand titre', (v, d, f) => basculerTitre(v, d, f, 1))}
        {outil('H2', 'Titre moyen', (v, d, f) => basculerTitre(v, d, f, 2))}
        {outil('H3', 'Petit titre', (v, d, f) => basculerTitre(v, d, f, 3))}
        <span className={styles.separateur} aria-hidden />
        {outil('G', 'Gras', (v, d, f) => basculerMarque(v, d, f, '**'))}
        {outil('I', 'Italique', (v, d, f) => basculerMarque(v, d, f, '*'))}
        {outil('• Puces', 'Liste à puces', basculerPuces)}
        {outil('Lien', 'Lien vers une page web', insererLien)}
      </div>
      <textarea
        ref={ref}
        value={valeur}
        rows={lignes}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={styles.zone}
      />
    </div>
  );
}

/** Aide-mémoire sous les champs Markdown */
export function MarkdownAide() {
  return (
    <p className={styles.aide}>
      Markdown&#8239;: <code>## Titre</code> · <code>- puce</code> (2 espaces devant pour un sous-niveau) ·{' '}
      <code>1. liste numérotée</code> · <code>**gras**</code> · <code>*italique*</code> ·{' '}
      <code>[texte](https://…)</code> · ligne vide = nouveau paragraphe
    </p>
  );
}
