'use client';

// Bibliothèque de questionnaires de lecture — onglet de « Mes Ressources ».
//
// Un questionnaire est une ressource RÉUTILISABLE, pas le contenu d'une
// activité : on l'écrit une fois, on le donne à autant de classes qu'on veut,
// année après année. Jusqu'ici il vivait dans l'activité, et le rejouer
// obligeait à dupliquer celle-ci en entier.
//
// Les cartes reprennent le gabarit de `GrilleCard` / `OeuvreCard` : des
// familles voisines dans une même page ne peuvent pas se ressembler « à peu
// près ».

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import type { LectureQuiz } from '@/types/lecture';
import type {
  QuestionnaireLecture,
  QuestionnaireLectureResume,
} from '@/types/questionnaire-lecture';
import styles from './QuestionnaireLecturePanel.module.css';

export default function QuestionnaireLecturePanel() {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [miens, setMiens] = useState<QuestionnaireLectureResume[]>([]);
  const [exemples, setExemples] = useState<QuestionnaireLectureResume[]>([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Questionnaire ouvert dans le constructeur (null = la bibliothèque)
  const [ouvert, setOuvert] = useState<QuestionnaireLecture | null>(null);
  const [nom, setNom] = useState('');
  const [quiz, setQuiz] = useState<LectureQuiz | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const charger = useCallback(async () => {
    if (!isAuthenticated) return;
    setChargement(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/questionnaires-lecture', { headers });
      const json = await res.json();
      if (json.success) {
        setMiens(json.data.miens);
        setExemples(json.data.exemples);
      }
    } catch (err) {
      console.error('Erreur chargement des questionnaires:', err);
    } finally {
      setChargement(false);
    }
  }, [isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvrir = useCallback(
    async (id: string) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/questionnaires-lecture/${id}`, { headers });
      const json = await res.json();
      if (!json.success) {
        setMessage(json.message || 'Ouverture impossible');
        return;
      }
      setOuvert(json.data);
      setNom(json.data.nom);
      setQuiz(json.data.quiz);
    },
    [getAuthHeaders]
  );

  const creer = useCallback(() => {
    // Pas de popup pour le nom : le champ est en tête du constructeur, à
    // l'endroit même où le prof commence à écrire.
    setOuvert({
      id: '',
      nom: '',
      profId: '',
      anneeScolaire: '',
      archive: false,
      quiz: { mode: 'worksheet', questions: [] },
      createdAt: '',
      updatedAt: '',
    });
    setNom('');
    setQuiz({ mode: 'worksheet', questions: [] });
  }, []);

  const enregistrer = useCallback(async () => {
    if (!ouvert) return;
    if (!nom.trim()) {
      setMessage('Donnez un nom au questionnaire.');
      return;
    }
    setEnregistre(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const nouveau = !ouvert.id;
      const res = await fetch(
        nouveau ? '/api/questionnaires-lecture' : `/api/questionnaires-lecture/${ouvert.id}`,
        {
          method: nouveau ? 'POST' : 'PATCH',
          headers,
          body: JSON.stringify({ nom: nom.trim(), quiz }),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
      setMessage('Questionnaire enregistré.');
      setOuvert(null);
      await charger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setEnregistre(false);
    }
  }, [ouvert, nom, quiz, getAuthHeaders, charger]);

  const archiver = useCallback(
    async (q: QuestionnaireLectureResume) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`/api/questionnaires-lecture/${q.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ archive: !q.archive }),
      });
      await charger();
    },
    [getAuthHeaders, charger]
  );

  const supprimer = useCallback(
    async (q: QuestionnaireLectureResume) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/questionnaires-lecture/${q.id}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json();
      // Le serveur refuse tant qu'une activité s'en sert, et dit laquelle.
      setMessage(json.success ? 'Questionnaire supprimé.' : json.message);
      await charger();
    },
    [getAuthHeaders, charger]
  );

  // ── Le constructeur, plein écran ──
  if (ouvert) {
    return (
      <section className={styles.builder}>
        <div className={styles.builderHead}>
          <input
            className={styles.nomInput}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom du questionnaire — ex : Diagnostic de rentrée 4e"
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={enregistrer}
            disabled={enregistre}
          >
            {enregistre ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => setOuvert(null)}>
            Fermer
          </button>
        </div>
        {message && <p className={styles.message}>{message}</p>}
        <LectureQuizBuilder
          value={quiz}
          onChange={setQuiz}
          getAuthHeaders={getAuthHeaders}
        />
      </section>
    );
  }

  // ── La bibliothèque ──
  return (
    <section>
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.grid}>
        <button type="button" className={styles.createCard} onClick={creer}>
          <span className={styles.createIcon}>➕</span>
          <span className={styles.createLabel}>Nouveau questionnaire</span>
        </button>

        {chargement ? (
          <EmptyState icon="hourglass" message="En cours de chargement" />
        ) : (
          miens.map((q) => (
            <article
              key={q.id}
              className={`${styles.card} ${q.archive ? styles.cardArchivee : ''}`}
            >
              <div className={styles.tags}>
                {q.archive && <span className={styles.tag}>Archivé</span>}
                <span className={styles.tag}>{q.mode === 'quiz' ? 'Quiz' : 'Questionnaire'}</span>
              </div>

              <div className={styles.cardIcon}>📋</div>
              <h3 className={styles.title}>{q.nom}</h3>
              {q.description && <p className={styles.description}>{q.description}</p>}

              <div className={styles.metaRow}>
                <span className={styles.metaItem}>
                  ❓ {q.nbQuestions} question{q.nbQuestions > 1 ? 's' : ''}
                </span>
                <span className={styles.metaItem}>
                  🎯 {q.points} pt{q.points > 1 ? 's' : ''}
                </span>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => ouvrir(q.id)}
                  title="Ouvrir le questionnaire"
                  aria-label="Ouvrir le questionnaire"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => archiver(q)}
                  title={q.archive ? 'Désarchiver' : 'Archiver'}
                  aria-label={q.archive ? 'Désarchiver' : 'Archiver'}
                >
                  {q.archive ? '📤' : '📥'}
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => supprimer(q)}
                  title="Supprimer"
                  aria-label="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {exemples.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Questionnaires des professeurs</h2>
          <div className={styles.grid}>
            {exemples.map((q) => (
              <article key={q.id} className={styles.card}>
                <div className={styles.cardIcon}>📋</div>
                <h3 className={styles.title}>{q.nom}</h3>
                <div className={styles.metaRow}>
                  <span className={styles.metaItem}>
                    ❓ {q.nbQuestions} question{q.nbQuestions > 1 ? 's' : ''}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
