'use client';

// Ajouter une activité à un module — trois chemins qui mènent au même endroit :
//
//  1. hors application  : un débat, une lecture à voix haute. Elle compte dans
//     le module sans passer par Recto-versIA.
//  2. rattacher         : une activité déjà créée dans Mes Activités.
//  3. créer             : le FORMULAIRE DE CRÉATION HABITUEL, ouvert ici.
//     L'activité créée est une activité normale — elle apparaît dans Mes
//     Activités — et reste rattachée au module.
//
// La passerelle est à double sens : le module garde `devoirId`, et le devoir
// reçoit `scenarisationRef` à l'enregistrement de la scénarisation.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import CreationForm from '@/components/CreationForm/CreationForm';
import { atelierLabel } from '@/types/didactique';
import { nouvelleActivite } from '@/types/scenarisation';
import type { ModuleActivite, ModuleDidactique } from '@/types/scenarisation';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import styles from './ScenarisationPanel.module.css';

interface Props {
  module: ModuleDidactique;
  onClose: () => void;
  onAjouter: (activite: ModuleActivite) => void;
}

type Chemin = null | 'horsApp' | 'rattacher' | 'creer';

export default function ModuleActivitesModal({ module, onClose, onAjouter }: Props) {
  const { getAuthHeaders } = useAuth();
  const { classes } = useClasses();
  const { grilleTypes, grilles } = useGrilleTypes();

  const [chemin, setChemin] = useState<Chemin>(null);
  const [titreHorsApp, setTitreHorsApp] = useState('');
  const [devoirs, setDevoirs] = useState<Devoir[]>([]);
  const [chargement, setChargement] = useState(false);
  const [enCreation, setEnCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const classeNames = classes
    .filter((c) => !c.archive)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Les activités existantes ne sont chargées que si on choisit ce chemin
  useEffect(() => {
    if (chemin !== 'rattacher' || devoirs.length > 0) return;
    let annule = false;
    (async () => {
      setChargement(true);
      const headers = await getAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch('/api/devoirs', { headers });
        const json = await res.json();
        if (!annule && json.success) setDevoirs(json.data as Devoir[]);
      } catch {
        if (!annule) setErreur('Chargement des activités impossible');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [chemin, devoirs.length, getAuthHeaders]);

  const creerActivite = async (data: CreateDevoirData) => {
    setEnCreation(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/devoirs', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        setErreur(json.message || 'Création impossible');
        return;
      }
      onAjouter({
        ...nouvelleActivite(data.intitule),
        devoirId: json.data.id,
        typeTravail: data.typeTravail ?? null,
      });
    } catch {
      setErreur('Erreur réseau');
    } finally {
      setEnCreation(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.modal} ${chemin === 'creer' ? styles.modalLarge : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.mHead}>
          <h3 className={styles.mTitle}>
            {chemin === 'creer' ? 'Créer une activité pour ce module' : 'Ajouter une activité au module'}
          </h3>
          <span className={styles.mSub}>{module.titre || 'Module sans titre'}</span>
          <button type="button" className={styles.mClose} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.mBody}>
          {erreur && <p className={styles.errText}>{erreur}</p>}

          {/* ── Choix du chemin ── */}
          {chemin === null && (
            <>
              <button type="button" className={styles.path} onClick={() => setChemin('horsApp')}>
                <span className={styles.pathTitle}>🗣 Une activité hors application</span>
                <span className={styles.pathDesc}>
                  Un débat, une lecture à voix haute, une visite. Elle compte dans le module sans
                  passer par Recto-versIA.
                </span>
              </button>

              <button type="button" className={styles.path} onClick={() => setChemin('rattacher')}>
                <span className={styles.pathTitle}>🔗 Rattacher une activité existante</span>
                <span className={styles.pathDesc}>
                  Choisir parmi les activités déjà créées dans Mes Activités.
                </span>
              </button>

              <button type="button" className={styles.path} onClick={() => setChemin('creer')}>
                <span className={styles.pathTitle}>➕ Créer une activité Recto-versIA</span>
                <span className={styles.pathDesc}>
                  Ouvre le formulaire de création habituel. Une fois enregistrée, l’activité apparaît
                  dans Mes Activités <em>et</em> reste rattachée à ce module.
                </span>
              </button>
            </>
          )}

          {/* ── 1. Hors application ── */}
          {chemin === 'horsApp' && (
            <div className={styles.pathBody}>
              <label className={styles.detailLabel}>Intitulé de l’activité</label>
              <input
                className={styles.mInput}
                value={titreHorsApp}
                onChange={(e) => setTitreHorsApp(e.target.value)}
                placeholder="Ex. : débat en classe sur la peine de mort"
                autoFocus
              />
              <div className={styles.mActions}>
                <button type="button" className={styles.btn} onClick={() => setChemin(null)}>
                  ← Retour
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={!titreHorsApp.trim()}
                  onClick={() => onAjouter(nouvelleActivite(titreHorsApp.trim()))}
                >
                  Ajouter au module
                </button>
              </div>
            </div>
          )}

          {/* ── 2. Rattacher une activité existante ── */}
          {chemin === 'rattacher' && (
            <div className={styles.pathBody}>
              {chargement && <p className={styles.dim}>Chargement des activités…</p>}
              {!chargement && devoirs.length === 0 && (
                <p className={styles.dim}>Aucune activité créée pour l’instant.</p>
              )}
              <div className={styles.existing}>
                {devoirs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={styles.exItem}
                    onClick={() =>
                      onAjouter({
                        ...nouvelleActivite(d.intitule),
                        devoirId: d.id,
                        typeTravail: d.typeTravail ?? null,
                      })
                    }
                  >
                    <span className={styles.exType}>
                      {atelierLabel(d.atelier ?? '', true) || d.typeTravail}
                    </span>
                    <span className={styles.exName}>{d.intitule}</span>
                    <span className={styles.dim}>
                      {d.classes.length ? d.classes.join(', ') : 'aucune classe'}
                    </span>
                  </button>
                ))}
              </div>
              <div className={styles.mActions}>
                <button type="button" className={styles.btn} onClick={() => setChemin(null)}>
                  ← Retour
                </button>
              </div>
            </div>
          )}

          {/* ── 3. Créer : le formulaire habituel, ouvert ici ── */}
          {chemin === 'creer' && (
            <div className={styles.creationWrap}>
              <p className={styles.dim}>
                Le formulaire est le même que celui de Mes Activités. L’activité créée y apparaîtra.
              </p>
              <CreationForm
                classeNames={classeNames}
                grilleTypes={grilleTypes}
                grilles={grilles}
                isVisible
                onSubmit={creerActivite}
                isSubmitting={enCreation}
                onClose={() => setChemin(null)}
                getAuthHeaders={getAuthHeaders}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
