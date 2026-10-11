'use client';

// EXPORT PDF d'une copie d'écriture (2026-10-11, JP : « cela leur permettra
// d'avoir le doc pour les répétitions »). Approche choisie par JP : la fenêtre
// d'impression du navigateur (« Enregistrer au format PDF », standard sur
// Chromebook) — aucune bibliothèque ajoutée.
//
// Au clic, une feuille propre (titre, auteurs, texte) est posée à la racine du
// document le temps de l'impression ; la feuille de style d'impression masque
// tout le reste.
//
// ⚠ Le texte est du HTML de copie : il est NETTOYÉ avant d'être posé (liste
// blanche de balises, aucun attribut sauf l'alignement) — une copie de groupe
// est écrite par plusieurs élèves, rien d'exécutable ne doit passer.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ImpressionCopie.module.css';

const GARDEES = new Set(['P', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SPAN', 'MARK', 'SUB', 'SUP', 'HR']);
const SUPPRIMEES = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'TEMPLATE']);

function nettoyer(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parcourir = (parent: Element) => {
    for (const el of [...parent.children]) {
      if (SUPPRIMEES.has(el.tagName)) {
        el.remove();
        continue;
      }
      parcourir(el);
      if (!GARDEES.has(el.tagName)) {
        // Balise inconnue : on garde son contenu, pas la balise
        el.replaceWith(...el.childNodes);
        continue;
      }
      const alignement = (el as HTMLElement).style?.textAlign;
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
      if (alignement && ['left', 'right', 'center', 'justify'].includes(alignement)) {
        (el as HTMLElement).style.textAlign = alignement;
      }
    }
  };
  parcourir(doc.body);
  return doc.body.innerHTML;
}

interface Props {
  titre: string;
  auteurs?: string;
  html: string;
}

export default function ImpressionCopie({ titre, auteurs, html }: Props) {
  const [feuille, setFeuille] = useState<{ racine: HTMLDivElement; texte: string } | null>(null);

  // La feuille est posée : on imprime, puis on la retire
  useEffect(() => {
    if (!feuille) return;
    const fin = () => {
      feuille.racine.remove();
      setFeuille(null);
    };
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', fin);
    };
  }, [feuille]);

  const imprimer = () => {
    const racine = document.createElement('div');
    racine.className = styles.racine;
    document.body.appendChild(racine);
    setFeuille({ racine, texte: nettoyer(html) });
  };

  return (
    <>
      <button
        type="button"
        className={styles.bouton}
        onClick={imprimer}
        disabled={!!feuille}
        title="Ouvre l’impression : choisis « Enregistrer au format PDF »"
      >
        📄 PDF
      </button>
      {feuille &&
        createPortal(
          <>
            <div className={styles.entete}>
              <p className={styles.titre}>{titre}</p>
              {auteurs && <p className={styles.auteurs}>{auteurs}</p>}
            </div>
            <div className={styles.texte} dangerouslySetInnerHTML={{ __html: feuille.texte }} />
          </>,
          feuille.racine
        )}
    </>
  );
}
