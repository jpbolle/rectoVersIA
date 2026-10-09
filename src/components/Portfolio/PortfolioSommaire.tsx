'use client';

// Le SOMMAIRE DU PORTFOLIO — colonne de droite, à la place de l'onglet
// Consignes (JP, 2026-10-09 : « un mix entre liste de tâches et sommaire »).
// Sur le modèle du sommaire d'une œuvre : sections repliables, une ligne par
// étape, clic = j'y vais. Avec en plus une CASE par étape, COCHÉE TOUTE SEULE
// quand l'étape est faite (dépôts obligatoires remplis, activité remise) ;
// seule une étape sans trace se coche à la main. 🔒 sur les étapes fermées,
// 👥 sur les collectives, l'échéance à droite (rouge si dépassée).
//
// En tête, les consignes générales de l'activité, en texte (sans cases : la
// liste de tâches, c'est le sommaire lui-même).
//
// ⚠ Rendu DANS `.content` de l'AssistancePanel, à `padding: 0` : il pose son
// propre retrait (gotcha du projet).

import { useState } from 'react';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import { decouperConsignes } from '@/lib/consignes-etapes';
import { avancement, echeanceLisible, enCours, enRetard, faite, fermee } from '@/lib/portfolio-etat';
import { estEtapeSansTrace, sectionsDuPortfolio } from '@/types/portfolio';
import styles from './Portfolio.module.css';

interface Props {
  eleve: PortfolioEleve;
  lectureSeule?: boolean;
}

export default function PortfolioSommaire({ eleve, lectureSeule = false }: Props) {
  const { parcours, etapes, contenu, etape, allerA, cocher } = eleve;
  // Sections repliées par l'élève ; celle de l'étape ouverte s'ouvre d'elle-même
  const [repliees, setRepliees] = useState<Set<string>>(new Set());

  if (!parcours) return <p className={styles.sommaireVide}>Chargement…</p>;

  const consignes = decouperConsignes(parcours.consignes);
  const sections = sectionsDuPortfolio(etapes);
  const { faites, total } = avancement(etapes, contenu);
  const sectionCourante = etape?.section ?? '';

  const basculer = (cle: string) =>
    setRepliees((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  return (
    <div className={styles.sommaire}>
      {parcours.tacheFinale && (
        <div className={styles.sommaireTache}>
          <b>Tâche finale</b> — {parcours.tacheFinale}
        </div>
      )}
      {consignes.length > 0 && (
        <div className={styles.sommaireConsignes}>
          {consignes.map((c) => (
            <p key={c.cle} className={c.genre === 'titre' ? styles.sommaireConsigneTitre : ''}>
              {c.texte}
            </p>
          ))}
        </div>
      )}

      <div className={styles.sommaireCompteur}>
        <span>
          {faites} étape{faites > 1 ? 's' : ''} faite{faites > 1 ? 's' : ''} sur {total}
        </span>
        <span className={styles.sommaireBarre} aria-hidden="true">
          <i style={{ width: total ? `${Math.round((faites / total) * 100)}%` : '0%' }} />
        </span>
      </div>
      <div className={styles.sommaireLegende}>
        <span>☑ cochée toute seule quand c’est fait</span>
        <span>🔒 fermée</span>
        <span>👥 collective</span>
      </div>

      {sections.map((s, si) => {
        const cle = s.section || `__${si}`;
        const ouverte = !repliees.has(cle) || s.section === sectionCourante;
        const nbFaites = s.etapes.filter(({ etape: e }) => faite(e, contenu)).length;
        return (
          <div key={cle} className={styles.sommaireSection}>
            {s.section && (
              <button type="button" className={styles.sommaireSectionTitre} onClick={() => basculer(cle)}>
                <span className={styles.sommaireChevron} aria-hidden="true">{ouverte ? '▾' : '▸'}</span>
                <span className={styles.sommaireSectionTexte}>{s.section}</span>
                <span className={styles.sommaireSectionN}>
                  {nbFaites}/{s.etapes.length}
                </span>
              </button>
            )}
            {ouverte &&
              s.etapes.map(({ etape: e, index: i }) => {
                const estFaite = faite(e, contenu);
                const estFermee = fermee(etapes, i, contenu);
                const courante = etape?.id === e.id;
                const sansTrace = estEtapeSansTrace(e);
                const retard = enRetard(e, contenu);
                return (
                  <div
                    key={e.id}
                    className={`${styles.sommaireItem} ${courante ? styles.sommaireItemActif : ''} ${
                      estFermee ? styles.sommaireItemFerme : ''
                    } ${!s.section ? styles.sommaireItemSansSection : ''}`}
                  >
                    {estFermee ? (
                      <span className={styles.sommaireIc} aria-hidden="true">🔒</span>
                    ) : (
                      <input
                        type="checkbox"
                        className={styles.sommaireCase}
                        checked={estFaite}
                        disabled={!sansTrace || lectureSeule}
                        onChange={(ev) => sansTrace && cocher(e.id, ev.target.checked)}
                        title={
                          sansTrace
                            ? 'Étape sans trace : c’est toi qui coches'
                            : estFaite
                              ? 'Faite'
                              : 'Se coche toute seule quand l’étape est faite'
                        }
                        aria-label={`${e.titre} — ${estFaite ? 'faite' : 'à faire'}`}
                      />
                    )}
                    {e.portee === 'collective' && <span className={styles.sommaireIc} aria-hidden="true">👥</span>}
                    <button
                      type="button"
                      className={`${styles.sommaireTitre} ${estFaite ? styles.sommaireTitreFait : ''}`}
                      onClick={() => allerA(e.id)}
                      disabled={estFermee}
                      title={estFermee ? 'Termine d’abord l’étape qui précède' : e.titre}
                    >
                      {e.titre}
                      {sansTrace && <small> · sans trace</small>}
                      {!estFaite && !sansTrace && enCours(e, contenu) && <small> · en cours</small>}
                    </button>
                    {e.echeance && (
                      <span className={`${styles.sommaireDate} ${retard ? styles.sommaireDateRetard : ''}`}>
                        {echeanceLisible(e.echeance)}
                        {retard && ' · en retard'}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
