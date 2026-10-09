'use client';

import { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { Devoir } from '@/types/devoir';
import { avancementConsignes, decouperConsignes } from '@/lib/consignes-etapes';
import styles from './ConsignesTab.module.css';

interface ConsignesTabProps {
  devoir: Devoir;
  /**
   * Feuille de route : les clés des consignes cochées. Absent = pas de copie
   * (aperçu du prof avant publication) → la liste se lit sans case.
   */
  cochees?: string[] | null;
  /** Cocher / décocher. Absent = lecture seule (le prof suit, il ne coche pas). */
  onToggle?: (cle: string) => void;
  /** Vue du prof : le texte d'aide parle de l'élève, pas de « toi ». */
  isProfessorView?: boolean;
}

// Fonction pour transformer les URLs en liens cliquables
function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset lastIndex car le regex est global
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
          // Le lien vit dans une ligne cochable : l'ouvrir ne doit pas cocher
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function ConsignesTab({ devoir, cochees, onToggle, isProfessorView = false }: ConsignesTabProps) {
  // Une ligne = une étape (option A, 2026-10-09) ; clé = le texte de la ligne
  const etapes = useMemo(() => decouperConsignes(devoir.consignes), [devoir.consignes]);
  const setCochees = useMemo(() => new Set(cochees ?? []), [cochees]);
  const { faites, total } = avancementConsignes(etapes, cochees);
  const peutCocher = !!onToggle;
  // Sans copie (aperçu prof), pas de case : le texte seul, tel que l'élève le lira
  const avecCases = cochees !== undefined && cochees !== null && total > 0;

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <div className={styles.titreLigne}>
          <h3 className={styles.sectionTitle}>Consignes</h3>
          {avecCases && (
            <span
              className={`${styles.compteur} ${faites === total ? styles.compteurComplet : ''}`}
              title={isProfessorView ? 'Consignes cochées par l’élève' : 'Consignes que tu as cochées'}
            >
              {faites} / {total}
            </span>
          )}
        </div>
        <div className={styles.content}>
          {etapes.length === 0 ? (
            <p className={styles.empty}>Aucune consigne spécifique pour ce devoir.</p>
          ) : (
            <ul className={styles.etapes}>
              {etapes.map((etape, index) => {
                if (etape.genre === 'titre') {
                  return (
                    <li key={`titre-${index}`} className={styles.etapeTitre}>
                      {linkifyText(etape.texte)}
                    </li>
                  );
                }
                const faite = setCochees.has(etape.cle);
                const basculer = peutCocher ? () => onToggle(etape.cle) : undefined;
                return (
                  <li
                    key={etape.cle}
                    className={`${styles.etape} ${faite ? styles.etapeFaite : ''} ${peutCocher ? styles.etapeCochable : ''}`}
                    onClick={basculer}
                  >
                    {avecCases && (
                      <button
                        type="button"
                        className={`${styles.check} ${faite ? styles.checkFait : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          basculer?.();
                        }}
                        disabled={!peutCocher}
                        aria-pressed={faite}
                        aria-label={faite ? 'Marquer comme à faire' : 'Marquer comme fait'}
                      >
                        {faite && <Check size={12} strokeWidth={3} />}
                      </button>
                    )}
                    <span className={styles.etapeTexte}>{linkifyText(etape.texte)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {avecCases && (
          <p className={styles.aide}>
            {isProfessorView
              ? 'Ce que l’élève a coché dans sa feuille de route.'
              : 'Coche ce que tu as fait — ton professeur voit ton avancement.'}
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Informations</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Échéance</span>
            <span className={styles.infoValue}>
              {devoir.dateRemise
                ? new Date(devoir.dateRemise).toLocaleDateString('fr-BE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'non fixée'}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Grille d&apos;évaluation</span>
            <span className={styles.infoValue}>{devoir.grille}</span>
          </div>
          {devoir.accesIA && (
            <div className={styles.infoItem}>
              <span className={styles.iaBadge}>
                <span>🤖</span>
                <span>Assistance IA disponible</span>
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
