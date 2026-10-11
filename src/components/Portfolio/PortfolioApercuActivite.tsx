'use client';

// LA MINIATURE d'une copie d'activité, dans la copie du portfolio lue par le
// prof (JP, 2026-10-11 : « voir si l'élève a avancé dans son travail et si
// cela mérite le détour ») — sous l'étape dépliée, cliquable vers la page de
// correction :
//  - schéma : le schéma de l'élève à l'identique, en petit (moteur de schéma
//    en lecture seule), le nombre d'idées et de liens ;
//  - écriture : le début du texte et le nombre de mots ;
//  - et, pour tout atelier, la date de la dernière modification.
// La copie n'est lue qu'à l'ouverture de l'étape (le composant ne vit que là).

import { useEffect, useState } from 'react';
import { DiagramWorkspace } from '@/components/Diagram/DiagramWorkspace';
import type { Diagram } from '@/types/diagram';
import styles from './Portfolio.module.css';

interface Props {
  travailId: string;
  typeTravail?: string;
  href: string;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  // Ce qui va dans la colonne de GAUCHE, sous le résumé (le bouton « Corriger la copie »)
  children?: React.ReactNode;
  // Sous le résumé, dans la colonne de gauche (l'historique des retours)
  gauche?: React.ReactNode;
}

interface Copie {
  content: string;
  updatedAt?: string;
  status?: string;
}

function lireSchema(content: string): Diagram | null {
  try {
    const d = JSON.parse(content);
    return Array.isArray(d?.nodes) ? (d as Diagram) : null;
  } catch {
    return null;
  }
}

function texteDe(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function court(s: string, n: number): string {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// Le schéma en petit : le VRAI moteur de schéma, en lecture seule (comme la
// loupe du corrigé), rendu à sa taille NORMALE puis réduit au tiers — le
// forcer dans un petit cadre faussait son ajustement (canevas vide, 2026-10-11).
// Aucun geste dedans : toute la miniature est un lien vers la correction.
const rien = () => {};
function MiniSchema({ d }: { d: Diagram }) {
  return (
    <div className={styles.apercuSchema} aria-hidden="true">
      <div className={styles.apercuSchemaEchelle}>
        <DiagramWorkspace diagram={d} onChange={rien} readOnly embedded lockType />
      </div>
    </div>
  );
}

export default function PortfolioApercuActivite({ travailId, typeTravail, href, getAuthHeaders, children, gauche }: Props) {
  const [copie, setCopie] = useState<Copie | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const json = await (await fetch(`/api/travaux/${encodeURIComponent(travailId)}`, { headers })).json();
        if (annule) return;
        if (json.success) setCopie(json.data as Copie);
        else setErreur(true);
      } catch {
        if (!annule) setErreur(true);
      }
    })();
    return () => {
      annule = true;
    };
  }, [travailId, getAuthHeaders]);

  if (erreur)
    return (
      <>
        {gauche}
        {children}
      </>
    );
  if (!copie) return <p className={styles.lectureVide}>Chargement de l’aperçu…</p>;

  const modifie = copie.updatedAt
    ? new Date(copie.updatedAt).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
  let corps: React.ReactNode = null;
  let resume = '';

  if (typeTravail === 'schematiser') {
    const d = lireSchema(copie.content);
    const idees = d?.nodes.length ?? 0;
    const liens = d ? (d.nodes.some((n) => n.parentId) ? d.nodes.filter((n) => n.parentId).length : d.edges.length) : 0;
    resume = `${idees} idée${idees > 1 ? 's' : ''} · ${liens} lien${liens > 1 ? 's' : ''}`;
    corps = d && idees > 0 ? <MiniSchema d={d} /> : <p className={styles.lectureVide}>Schéma encore vide.</p>;
  } else if (typeTravail === 'ecrire') {
    const texte = texteDe(copie.content);
    const mots = texte ? texte.split(' ').length : 0;
    resume = `${mots} mot${mots > 1 ? 's' : ''}`;
    corps = texte ? <p className={styles.apercuTexte}>{court(texte, 320)}</p> : <p className={styles.lectureVide}>Copie encore vide.</p>;
  }

  return (
    // Deux colonnes (JP) : à gauche le résumé, à droite la miniature — le bouton
    // de correction posé sur son coin supérieur droit (JP, 2026-10-11). Deux
    // liens frères, jamais imbriqués.
    <div className={styles.apercu}>
      <div className={styles.apercuInfos}>
        <span className={styles.apercuPied}>
          {resume && <b>{resume}</b>}
          {modifie && <span>modifiée le {modifie}</span>}
          {copie.status === 'submitted' && <span>remise</span>}
        </span>
        {gauche}
        {!corps && children}
      </div>
      {corps && (
        <div className={styles.apercuVignette}>
          <a className={styles.apercuCorps} href={href} target="_blank" rel="noopener noreferrer" title="Ouvrir la copie pour la corriger">
            {corps}
          </a>
          {children && <div className={styles.apercuBouton}>{children}</div>}
        </div>
      )}
    </div>
  );
}
