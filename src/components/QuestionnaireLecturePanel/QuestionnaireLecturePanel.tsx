'use client';

// Bibliothèque de questionnaires de lecture — onglet de « Mes Ressources ».
//
// Un questionnaire est une ressource RÉUTILISABLE, pas le contenu d'une
// activité : on l'écrit une fois, on le donne à autant de classes qu'on veut,
// année après année. Jusqu'ici il vivait dans l'activité, et le rejouer
// obligeait à dupliquer celle-ci en entier.
//
// Les cartes sont celles de toute la page (RessourceCard, plan 2026-10-11).
// Icône ❓ et non 📋 : le 📋 est celui des grilles d'évaluation.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import CreateOeuvreCard from '@/components/OeuvreCard/CreateOeuvreCard';
import RessourceCard from '@/components/RessourceCard/RessourceCard';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import type { LectureQuiz } from '@/types/lecture';
import type {
  QuestionnaireLecture,
  QuestionnaireLectureResume,
} from '@/types/questionnaire-lecture';
import blocs from '@/components/OeuvrePanel/OeuvrePanel.module.css';
import styles from './QuestionnaireLecturePanel.module.css';

interface Props {
  /** « Utiliser pour une classe » sur mes questionnaires — absent = pas de bouton */
  onUtiliser?: (q: QuestionnaireLectureResume) => void;
}

export default function QuestionnaireLecturePanel({ onUtiliser }: Props = {}) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [miens, setMiens] = useState<QuestionnaireLectureResume[]>([]);
  const [exemples, setExemples] = useState<QuestionnaireLectureResume[]>([]);
  // Ceux des collègues (bloc « des professeurs », toujours présent — JP 2026-10-09)
  const [autres, setAutres] = useState<QuestionnaireLectureResume[]>([]);
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
        setAutres(Array.isArray(json.data.autres) ? json.data.autres : []);
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

  // Dupliquer un questionnaire de collègue : on le lit, on en crée une copie à soi
  const dupliquer = useCallback(
    async (q: QuestionnaireLectureResume) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch(`/api/questionnaires-lecture/${q.id}`, { headers });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Lecture impossible');
        const post = await fetch('/api/questionnaires-lecture', {
          method: 'POST',
          headers,
          body: JSON.stringify({ nom: `COPIE - ${json.data.nom}`, description: json.data.description ?? '', quiz: json.data.quiz }),
        });
        const pj = await post.json();
        if (!pj.success) throw new Error(pj.message || 'Duplication impossible');
        setMessage('Questionnaire dupliqué — il est dans « Mes questionnaires »');
        charger();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Duplication impossible');
      }
    },
    [getAuthHeaders, charger]
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
      // ⚠ Le serveur écarte les questions inutilisables (sans énoncé, sans
      // image…). Quand il l'a fait, on le DIT et on laisse l'éditeur OUVERT :
      // refermer sur un « Questionnaire enregistré » a fait croire, le
      // 2026-09-20, que dix questions étaient en base alors que deux l'étaient.
      if (json.avertissement) {
        setMessage(json.avertissement);
        if (nouveau && json.data?.id) setOuvert({ ...ouvert, id: json.data.id });
        await charger();
        return;
      }
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

  // Un avertissement de travail écarté ne peut pas avoir l'air d'une
  // confirmation : il se distingue à l'œil (le ⚠️ le signe).
  const classeMessage = message?.startsWith('⚠️')
    ? `${styles.message} ${styles.messageAlerte}`
    : styles.message;

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
        {message && <p className={classeMessage}>{message}</p>}
        <LectureQuizBuilder
          value={quiz}
          onChange={setQuiz}
          getAuthHeaders={getAuthHeaders}
        />
      </section>
    );
  }

  // ── La bibliothèque ──
  const etiquettesDe = (q: QuestionnaireLectureResume) => [
    ...(q.archive ? ['Archivé'] : []),
    q.mode === 'quiz' ? 'Quiz' : 'Questionnaire',
    `${q.nbQuestions} question${q.nbQuestions > 1 ? 's' : ''}`,
    `${q.points} pt${q.points > 1 ? 's' : ''}`,
  ];

  // Mêmes blocs blancs titrés que les autres onglets (Œuvres, Portfolios…) —
  // il n'avait ni cadre ni titre « Mes questionnaires » (2026-10-11)
  return (
    <div className={blocs.panneau}>
      {message && <p className={classeMessage}>{message}</p>}

      <section className={blocs.groupe}>
      <div className={blocs.groupeEntete}>
        <h2 className={blocs.groupeTitre}>Mes questionnaires</h2>
        <p className={blocs.groupeAide}>Vos questionnaires de lecture, à réutiliser d’une activité à l’autre.</p>
      </div>
      <div className={styles.grid}>
        <CreateOeuvreCard onClick={creer} libelle="Créer un questionnaire" />

        {chargement ? (
          <EmptyState icon="hourglass" message="En cours de chargement" />
        ) : (
          miens.map((q) => (
            <RessourceCard
              key={q.id}
              icone="❓"
              titre={q.nom}
              etiquettes={etiquettesDe(q)}
              description={q.description}
              archivee={q.archive}
              // Clic : ce que faisait ✏️ (ouvrir dans le constructeur)
              onOuvrir={() => ouvrir(q.id)}
              titreOuvrir="Ouvrir le questionnaire"
              onArchiver={() => archiver(q)}
              onSupprimer={() => supprimer(q)}
              principale={onUtiliser ? { libelle: 'Utiliser pour une classe', onClick: () => onUtiliser(q) } : undefined}
            />
          ))
        )}
      </div>

      </section>

      {/* Le second bloc, TOUJOURS présent — même vide : exemples partagés et
          questionnaires des collègues, à dupliquer pour se les approprier */}
      <section className={blocs.groupe}>
      <div className={blocs.groupeEntete}>
        <h2 className={blocs.groupeTitre}>Questionnaires des professeurs</h2>
        <p className={blocs.groupeAide}>À dupliquer pour les modifier — la copie devient la vôtre.</p>
      </div>
      {!chargement && exemples.length === 0 && autres.length === 0 && (
        <p className={blocs.groupeAide}>Aucun questionnaire de collègue pour l’instant.</p>
      )}
      <div className={styles.grid}>
        {[...exemples, ...autres].map((q) => (
          <RessourceCard
            key={q.id}
            icone="❓"
            titre={q.nom}
            etiquettes={[...(q.shared ? ['Exemple partagé'] : []), ...etiquettesDe(q)]}
            description={q.description}
            onDupliquer={() => dupliquer(q)}
            lectureSeule
          />
        ))}
      </div>
      </section>
    </div>
  );
}
