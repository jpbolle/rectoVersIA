'use client';

// Mes Ressources › PORTFOLIOS — les MATRICES de portfolio du prof (plan
// 2026-10-09). Une matrice est la trame réutilisable ; « Utiliser pour une
// classe » en fait une ACTIVITÉ (copie des étapes, rangée dans Mes Activités),
// que le prof adapte ensuite sans toucher à la matrice.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import CreationForm from '@/components/CreationForm/CreationForm';
import CreateOeuvreCard from '@/components/OeuvreCard/CreateOeuvreCard';
import EmptyState from '@/components/EmptyState/EmptyState';
import PortfolioAtelier from './PortfolioAtelier';
import { ATELIER_PORTFOLIO } from '@/types/didactique';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import type { PortfolioMatrice } from '@/types/portfolio';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import styles from './Portfolio.module.css';

export default function PortfolioPanel() {
  const { getAuthHeaders } = useAuth();
  const { devoirs, createDevoir, updateDevoir } = useDevoirs();
  const { grilleTypes, grilles } = useGrilleTypes();
  const { classes } = useClasses();
  const classeNames = classes
    .filter((c) => !c.archive)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));

  const [matrices, setMatrices] = useState<PortfolioMatrice[] | null>(null);
  // Les matrices des collègues (bloc « des professeurs », toujours présent — JP 2026-10-09)
  const [autres, setAutres] = useState<PortfolioMatrice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  // Création d'une matrice : popup titre + description
  const [creation, setCreation] = useState(false);
  const [titreNouveau, setTitreNouveau] = useState('');
  const [descNouvelle, setDescNouvelle] = useState('');
  const [envoi, setEnvoi] = useState(false);
  // « Utiliser pour une classe » : le formulaire de création d'activité, pré-rempli
  const [utiliser, setUtiliser] = useState<PortfolioMatrice | null>(null);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/portfolios', { headers });
      const json = await res.json();
      setMatrices(json.success ? (json.data as PortfolioMatrice[]) : []);
      setAutres(json.success && Array.isArray(json.autres) ? (json.autres as PortfolioMatrice[]) : []);
    } catch {
      setMatrices([]);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  const signaler = (e: unknown) => setMessage(e instanceof Error ? e.message : 'Erreur');

  const creer = async () => {
    const titre = titreNouveau.trim();
    if (!titre) return;
    setEnvoi(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers,
        body: JSON.stringify({ titre, description: descNouvelle.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Création impossible');
      setCreation(false);
      setTitreNouveau('');
      setDescNouvelle('');
      await charger();
      // Une matrice se compose aussitôt : on ouvre son atelier
      setOuverte((json.data as PortfolioMatrice).id);
    } catch (e) {
      signaler(e);
    } finally {
      setEnvoi(false);
    }
  };

  const patcher = async (id: string, data: Record<string, unknown>) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch(`/api/portfolios/${id}`, { method: 'PATCH', headers, body: JSON.stringify(data) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Modification impossible');
      await charger();
    } catch (e) {
      signaler(e);
    }
  };

  const dupliquer = async (m: PortfolioMatrice) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          titre: `COPIE - ${m.titre}`,
          description: m.description,
          tacheFinale: m.tacheFinale,
          consignes: m.consignes,
          ressources: m.ressources,
          etapes: m.etapes,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Duplication impossible');
      setMessage('Portfolio dupliqué');
      await charger();
    } catch (e) {
      signaler(e);
    }
  };

  const creerActivite = useCallback(
    async (data: CreateDevoirData) => {
      setEnvoi(true);
      try {
        await createDevoir(data);
        setUtiliser(null);
        setMessage(`Activité « ${data.intitule} » créée — elle est dans Mes Activités`);
      } catch (e) {
        signaler(e);
      } finally {
        setEnvoi(false);
      }
    },
    [createDevoir]
  );

  const enregistrerDevoir = useCallback(
    async (id: string, data: Partial<Devoir>, silencieux = false): Promise<boolean> => {
      try {
        await updateDevoir(id, data);
        if (!silencieux) setMessage('Modifications enregistrées');
        return true;
      } catch (e) {
        signaler(e);
        return false;
      }
    },
    [updateDevoir]
  );

  if (utiliser) {
    return (
      <CreationForm
        atelierInitial={ATELIER_PORTFOLIO}
        portfolioInitial={utiliser}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isVisible
        onSubmit={creerActivite}
        isSubmitting={envoi}
        onClose={() => setUtiliser(null)}
        getAuthHeaders={getAuthHeaders}
      />
    );
  }

  const matriceOuverte = ouverte ? matrices?.find((m) => m.id === ouverte) ?? null : null;
  if (matriceOuverte) {
    return (
      <PortfolioAtelier
        key={matriceOuverte.id}
        matrice={matriceOuverte}
        devoirs={devoirs}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        createDevoir={createDevoir}
        enregistrerDevoir={enregistrerDevoir}
        getAuthHeaders={getAuthHeaders}
        onRetour={() => {
          setOuverte(null);
          void charger();
        }}
      />
    );
  }

  const actives = (matrices ?? []).filter((m) => !m.archive);
  const archivees = (matrices ?? []).filter((m) => m.archive);

  const carte = (m: PortfolioMatrice, lectureSeule = false) => {
    const nbRenvois = m.etapes.filter((e) => e.nature === 'activite').length;
    const nbCollectives = m.etapes.filter((e) => e.portee === 'collective').length;
    const sections = new Set(m.etapes.map((e) => (e.section ?? '').trim()).filter(Boolean)).size;
    const arreter = (fn: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      fn();
    };
    return (
      <article
        key={m.id}
        className={`${styles.carte} ${m.archive ? styles.carteArchivee : ''}`}
        onClick={() => !lectureSeule && setOuverte(m.id)}
        role={lectureSeule ? undefined : 'button'}
        tabIndex={lectureSeule ? undefined : 0}
        onKeyDown={(e) => !lectureSeule && e.key === 'Enter' && e.target === e.currentTarget && setOuverte(m.id)}
      >
        <h3 className={styles.carteTitre}>
          <span aria-hidden="true">🗂️</span>
          {m.titre}
        </h3>
        <div className={styles.etiquettes}>
          <span>{m.etapes.length} étape{m.etapes.length > 1 ? 's' : ''}</span>
          {sections > 0 && <span>{sections} section{sections > 1 ? 's' : ''}</span>}
          {nbRenvois > 0 && <span>{nbRenvois} activité{nbRenvois > 1 ? 's' : ''}</span>}
          {nbCollectives > 0 && <span>{nbCollectives} collective{nbCollectives > 1 ? 's' : ''}</span>}
          {m.archive && <span>Archivé</span>}
        </div>
        <p className={styles.carteDesc}>{m.description || m.tacheFinale || 'Aucune description.'}</p>
        <div className={styles.carteActions}>
          <button type="button" className={lectureSeule ? styles.btn : styles.btnGhost} onClick={arreter(() => dupliquer(m))}>
            Dupliquer
          </button>
          {!lectureSeule && (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={arreter(() => patcher(m.id, { archive: !m.archive }))}
            >
              {m.archive ? 'Restaurer' : 'Archiver'}
            </button>
          )}
          {!lectureSeule && !m.archive && (
            <button type="button" className={styles.btn} onClick={arreter(() => setUtiliser(m))}>
              Utiliser pour une classe
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className={styles.panneau}>
      {message && (
        <div className={styles.message} onClick={() => setMessage(null)} role="status">
          {message}
        </div>
      )}

      {matrices === null ? (
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : (
        <>
          <section>
            <div className={styles.groupeEntete}>
              <h2 className={styles.groupeTitre}>Mes portfolios</h2>
              <p className={styles.groupeAide}>
                La trame d’un portfolio d’apprentissage : des étapes vers une tâche finale, avec objectifs,
                échéances, statut IA et dépôts. « Utiliser pour une classe » en fait une activité de Mes
                Activités, que vous adaptez sans toucher la trame.
              </p>
            </div>
            <div className={styles.grille}>
              <CreateOeuvreCard onClick={() => setCreation(true)} libelle="Créer un portfolio" />
              {actives.map((m) => carte(m))}
            </div>
          </section>

          {/* Le second bloc, TOUJOURS présent — même vide (JP, 2026-10-09) */}
          <section>
            <div className={styles.groupeEntete}>
              <h2 className={styles.groupeTitre}>Portfolios des professeurs</h2>
              <p className={styles.groupeAide}>À dupliquer pour les modifier — la copie devient la vôtre.</p>
            </div>
            {autres.length === 0 ? (
              <p className={styles.groupeAide}>Aucun portfolio de collègue pour l’instant.</p>
            ) : (
              <div className={styles.grille}>{autres.map((m) => carte(m, true))}</div>
            )}
          </section>

          {archivees.length > 0 && (
            <section>
              <div className={styles.groupeEntete}>
                <h2 className={styles.groupeTitre}>Archivés</h2>
              </div>
              <div className={styles.grille}>{archivees.map((m) => carte(m))}</div>
            </section>
          )}
        </>
      )}

      {creation && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setCreation(false)}>
          <div className={base.popup}>
            <header className={base.popupEntete}>
              <h3>Nouveau portfolio</h3>
              <button type="button" className={base.popupFermer} onClick={() => setCreation(false)} aria-label="Fermer">
                ✕
              </button>
            </header>
            <div className={base.popupCorps}>
              <label className={styles.lab} htmlFor="pfo-titre">Titre</label>
              <input
                id="pfo-titre"
                className={styles.input}
                value={titreNouveau}
                onChange={(e) => setTitreNouveau(e.target.value)}
                placeholder="Interpréter Molière !"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && void creer()}
              />
              <label className={styles.lab} htmlFor="pfo-description">Description <span className={styles.labNote}>— facultative</span></label>
              <input
                id="pfo-description"
                className={styles.input}
                value={descNouvelle}
                onChange={(e) => setDescNouvelle(e.target.value)}
                placeholder="Certification de Noël, 4ᵉ…"
              />
            </div>
            <footer className={base.popupPied}>
              <span className={base.popupNote}>Les étapes se composent ensuite, dans l’atelier.</span>
              <button type="button" className={base.btnGhost} onClick={() => setCreation(false)}>
                Annuler
              </button>
              <button type="button" className={base.btnPrimary} onClick={() => void creer()} disabled={envoi || !titreNouveau.trim()}>
                Créer et composer
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
