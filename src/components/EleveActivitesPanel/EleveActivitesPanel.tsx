'use client';

// Fiche élève (prof) › onglet « Activités » (JP, 2026-10-08) : ses activités
// avec son avancement, ses parcours FLE étape par étape, ses lectures de
// cours, ses évaluations. Servi par /api/profil/activites?eleveId=.

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { atelierLabel } from '@/types/didactique';
import { SECTIONS_ORDRE, libelleSource } from '@/types/lecture-cours';
import type { LectureCoursResume } from '@/types/lecture-cours';
import { labelTypeEvaluation } from '@/types/evaluation-fle';
import type { EvaluationFle } from '@/types/evaluation-fle';
import styles from './EleveActivitesPanel.module.css';

type Statut = 'non-commence' | 'en-cours' | 'remis' | 'corrige';

interface Donnees {
  activites: {
    devoirId: string;
    intitule: string;
    typeTravail: string;
    atelier: string | null;
    classes: string[];
    dateRemise: string | null;
    archive: boolean;
    statut: Statut;
    score: number | null;
  }[];
  parcours: { devoirId: string; intitule: string; etapes: { titre: string; nature: string; devoirId: string | null; statut: Statut | null }[] }[];
  lectures: LectureCoursResume[];
  evaluations: EvaluationFle[];
}

const STATUT: Record<Statut, { label: string; classe: string }> = {
  'non-commence': { label: 'pas commencé', classe: 'sNon' },
  'en-cours': { label: 'en cours', classe: 'sEnCours' },
  remis: { label: 'remis', classe: 'sRemis' },
  corrige: { label: 'corrigé', classe: 'sCorrige' },
};

const ICONE: Record<string, string> = {
  ecrire: '✏️',
  lire: '📖',
  rechercher: '🔎',
  vocabulaire: '🔤',
  autoevaluation: '🪞',
  schematiser: '🗺️',
};

function dateCourte(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }) : '';
}

function Pastille({ statut }: { statut: Statut }) {
  const s = STATUT[statut];
  return <span className={`${styles.pastille} ${styles[s.classe]}`}>{s.label}</span>;
}

export default function EleveActivitesPanel({ eleveId }: { eleveId: string }) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/profil/activites?eleveId=${encodeURIComponent(eleveId)}`, { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) setDonnees(json.data);
        else setErreur(json.message || 'Chargement impossible.');
      } catch {
        if (!annule) setErreur('Chargement impossible.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, getAuthHeaders, eleveId]);

  if (erreur) return <p className={styles.vide}>{erreur}</p>;
  if (!donnees) return <p className={styles.vide}>Chargement…</p>;

  const enCours = donnees.activites.filter((a) => !a.archive);
  const compte = (s: Statut) => enCours.filter((a) => a.statut === s).length;

  return (
    <div className={styles.panel}>
      {/* ── Les tuiles ── */}
      <div className={styles.tuiles}>
        <div className={styles.tuile}>
          <span className={styles.chiffre}>{enCours.length}</span>
          <span className={styles.libelle}>activités en cours</span>
        </div>
        <div className={styles.tuile}>
          <span className={styles.chiffre}>{compte('remis') + compte('corrige')}</span>
          <span className={styles.libelle}>remises</span>
        </div>
        <div className={styles.tuile}>
          <span className={styles.chiffre}>{compte('non-commence')}</span>
          <span className={styles.libelle}>pas commencées</span>
        </div>
        <div className={styles.tuile}>
          <span className={styles.chiffre}>{donnees.lectures.length}</span>
          <span className={styles.libelle}>lectures de cours</span>
        </div>
      </div>

      {/* ── Les parcours FLE ── */}
      {donnees.parcours.length > 0 && (
        <section className={styles.bloc}>
          <h4 className={styles.titre}>🧭 Parcours</h4>
          {donnees.parcours.map((p) => {
            const faites = p.etapes.filter((e) => e.statut === 'remis' || e.statut === 'corrige').length;
            const total = p.etapes.filter((e) => e.devoirId).length;
            return (
              <div key={p.devoirId} className={styles.parcours}>
                <div className={styles.parcoursTete}>
                  <span className={styles.parcoursTitre}>{p.intitule}</span>
                  <span className={styles.parcoursAvancee}>
                    {faites}/{total} activité{total > 1 ? 's' : ''} faite{faites > 1 ? 's' : ''}
                  </span>
                </div>
                <ol className={styles.etapes}>
                  {p.etapes.map((e, i) => (
                    <li key={i} className={`${styles.etape} ${e.statut === 'remis' || e.statut === 'corrige' ? styles.etapeFaite : ''}`}>
                      <span className={styles.etapePicto}>{e.nature === 'theorie' ? '📖' : '📝'}</span>
                      <span className={styles.etapeTitre}>{e.titre}</span>
                      {e.statut && <Pastille statut={e.statut} />}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Les activités ── */}
      <section className={styles.bloc}>
        <h4 className={styles.titre}>📝 Activités</h4>
        {donnees.activites.length === 0 ? (
          <p className={styles.vide}>Aucune activité donnée à ses classes.</p>
        ) : (
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>Activité</th>
                <th>Classe</th>
                <th>Échéance</th>
                <th>Avancement</th>
              </tr>
            </thead>
            <tbody>
              {donnees.activites.map((a) => (
                <tr key={a.devoirId} className={a.archive ? styles.archivee : ''}>
                  <td>
                    <a className={styles.lien} href={`/dashboard/travaux/${a.devoirId}`} target="_blank" rel="noopener noreferrer">
                      {ICONE[a.typeTravail] ?? '📄'} {a.intitule}
                    </a>
                    <span className={styles.sous}>{a.atelier ? atelierLabel(a.atelier, true) : a.typeTravail}</span>
                  </td>
                  <td>{a.classes.join(', ')}</td>
                  <td>{dateCourte(a.dateRemise)}</td>
                  <td>
                    <Pastille statut={a.statut} />
                    {a.score !== null && <span className={styles.score}> {a.score} %</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Les lectures de cours ── */}
      {donnees.lectures.length > 0 && (
        <section className={styles.bloc}>
          <h4 className={styles.titre}>📚 Lectures de cours</h4>
          <ul className={styles.liste}>
            {donnees.lectures.map((l) => (
              <li key={l.id}>
                <a className={styles.lien} href={`/fle/lectures/${encodeURIComponent(l.id)}?eleveId=${encodeURIComponent(eleveId)}`} target="_blank" rel="noopener noreferrer">
                  {l.titre}
                </a>
                <span className={styles.sous}>
                  {[libelleSource(l.source), dateCourte(l.createdAt), `${l.sectionsPretes}/${SECTIONS_ORDRE.length - 1} sections`].join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Les évaluations FLE ── */}
      {donnees.evaluations.length > 0 && (
        <section className={styles.bloc}>
          <h4 className={styles.titre}>🎯 Évaluations</h4>
          <ul className={styles.liste}>
            {donnees.evaluations.map((e) => (
              <li key={e.id} className={styles.evaluation}>
                <span className={`${styles.type} ${styles[`type_${e.type}`]}`}>{labelTypeEvaluation(e.type)}</span>
                <span>{e.titre}</span>
                {e.statut && <Pastille statut={e.statut} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
