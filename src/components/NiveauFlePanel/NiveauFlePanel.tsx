'use client';

// Le positionnement CECR d'un élève : le radar à gauche, et à droite une ligne
// par compétence — libellé, niveau en gras, curseur — plus les objectifs du
// mois. Maquette de JP du 2026-09-14.
//
// Deux modes :
//  - `eleveId` fourni : le PROF règle les curseurs et écrit les objectifs
//    (fiche élève de Mes Classes). Chaque geste est enregistré aussitôt,
//    avec un petit délai pour ne pas mitrailler le serveur pendant un glissé.
//  - sans `eleveId` : l'ÉLÈVE consulte son propre positionnement (/fle) —
//    rien n'est modifiable, le niveau se lit en crans pleins.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { competencesVisibles, niveauxVisibles } from '@/types/didactique-fle';
import { libelleMois, moisCourant } from '@/types/niveaux-fle';
import type { NiveauxFle, ObjectifMois } from '@/types/niveaux-fle';
import RadarFle from '@/components/RadarFle/RadarFle';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './NiveauFlePanel.module.css';

interface Props {
  eleveId?: string;
  // Sert au titre côté élève (« Bonjour … » se lit sur la page, pas ici)
  compact?: boolean;
}

const DELAI_ENREGISTREMENT = 500;

export default function NiveauFlePanel({ eleveId, compact }: Props) {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const { config } = useDidactiqueFle();
  const modeProf = Boolean(eleveId);

  const [niveaux, setNiveaux] = useState<NiveauxFle | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const competences = useMemo(() => competencesVisibles(config), [config]);
  const crans = useMemo(() => niveauxVisibles(config), [config]);

  // Chargement
  useEffect(() => {
    if (!isAuthenticated) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const url = eleveId ? `/api/niveaux-fle?eleveId=${encodeURIComponent(eleveId)}` : '/api/niveaux-fle';
        const res = await fetch(url, { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) {
          setNiveaux(
            json.data.niveaux ?? {
              eleveId: eleveId ?? '',
              positionnement: {},
              objectifsMois: [],
              historique: [],
              updatedAt: '',
            }
          );
        } else {
          setErreur(json.message || 'Impossible de charger le positionnement.');
        }
      } catch {
        if (!annule) setErreur('Impossible de charger le positionnement.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, getAuthHeaders, eleveId]);

  // Enregistrement différé : le dernier état gagne
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aEnvoyer = useRef<Partial<NiveauxFle> | null>(null);

  const envoyer = useCallback(async () => {
    const patch = aEnvoyer.current;
    aEnvoyer.current = null;
    if (!patch || !eleveId) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/niveaux-fle', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eleveId, ...patch }),
      });
      const json = await res.json();
      if (!json.success) setErreur(json.message || "Erreur lors de l'enregistrement.");
    } catch {
      setErreur("Erreur de connexion pendant l'enregistrement.");
    } finally {
      setEnregistrement(false);
    }
  }, [eleveId, getAuthHeaders]);

  const programmer = useCallback(
    (patch: Partial<NiveauxFle>) => {
      aEnvoyer.current = { ...(aEnvoyer.current ?? {}), ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(envoyer, DELAI_ENREGISTREMENT);
    },
    [envoyer]
  );

  // Un envoi encore en attente part quand le panneau se ferme
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        envoyer();
      }
    },
    [envoyer]
  );

  const regler = (competenceId: string, indexCran: number) => {
    if (!niveaux || !modeProf) return;
    const niveauId = crans[indexCran]?.id;
    if (!niveauId) return;
    const positionnement = { ...niveaux.positionnement, [competenceId]: niveauId };
    setNiveaux({ ...niveaux, positionnement });
    programmer({ positionnement });
  };

  const ecrireObjectif = (mois: string, texte: string) => {
    if (!niveaux || !modeProf) return;
    const autres = niveaux.objectifsMois.filter((o) => o.mois !== mois);
    const objectifsMois: ObjectifMois[] = [{ mois, texte }, ...autres].sort((a, b) =>
      b.mois.localeCompare(a.mois)
    );
    setNiveaux({ ...niveaux, objectifsMois });
    programmer({ objectifsMois });
  };

  if (chargement) return <EmptyState icon="hourglass" message="En cours de chargement" />;
  if (!niveaux) return <EmptyState icon="🧭" message={erreur ?? 'Aucun positionnement.'} />;

  const indexDe = (competenceId: string) => {
    const i = crans.findIndex((n) => n.id === niveaux.positionnement[competenceId]);
    return i < 0 ? 0 : i;
  };

  const mois = moisCourant();
  const objectifCourant = niveaux.objectifsMois.find((o) => o.mois === mois)?.texte ?? '';
  const objectifsPasses = niveaux.objectifsMois.filter((o) => o.mois !== mois);

  return (
    <div className={`${styles.panel} ${compact ? styles.panelCompact : ''}`}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.deuxColonnes}>
        <div className={styles.colRadar}>
          <RadarFle competences={competences} niveaux={crans} positionnement={niveaux.positionnement} />
        </div>

        <div className={styles.colCurseurs}>
          <div className={styles.curseursHead}>
            <span className={styles.curseursTitre}>
              {modeProf ? 'Positionnement' : 'Mes niveaux'}
            </span>
            {modeProf && (
              <span className={styles.etat}>{enregistrement ? 'Enregistrement…' : 'Enregistré'}</span>
            )}
          </div>

          {competences.map((c) => {
            const i = indexDe(c.id);
            return (
              <div key={c.id} className={styles.ligne}>
                <span className={styles.ligneLibelle}>{c.label}</span>
                <b className={styles.ligneNiveau}>{crans[i]?.label ?? '—'}</b>
                {modeProf ? (
                  <input
                    type="range"
                    className={styles.curseur}
                    min={0}
                    max={crans.length - 1}
                    step={1}
                    value={i}
                    onChange={(e) => regler(c.id, Number(e.target.value))}
                    aria-label={`${c.label} : niveau`}
                    list={`crans-${c.id}`}
                  />
                ) : (
                  <span className={styles.crans} aria-hidden="true">
                    {crans.map((n, k) => (
                      <span
                        key={n.id}
                        className={`${styles.cran} ${k <= i ? styles.cranPlein : ''}`}
                        title={n.label}
                      />
                    ))}
                  </span>
                )}
                {modeProf && (
                  <datalist id={`crans-${c.id}`}>
                    {crans.map((n, k) => (
                      <option key={n.id} value={k} label={n.label} />
                    ))}
                  </datalist>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Objectifs du mois — le prof écrit, l'élève lit */}
      <section className={styles.objectifs}>
        <div className={styles.objectifsHead}>
          <span className={styles.objectifsTitre}>
            {modeProf ? 'Objectifs du mois' : 'Mes objectifs du mois'}
          </span>
          <span className={styles.objectifsMois}>{libelleMois(mois)}</span>
        </div>
        {modeProf ? (
          <textarea
            className={styles.objectifsChamp}
            value={objectifCourant}
            onChange={(e) => ecrireObjectif(mois, e.target.value)}
            placeholder="Ce que l’élève doit viser ce mois-ci : « Je peux me présenter », « Je comprends les consignes de la classe »…"
            rows={3}
          />
        ) : objectifCourant ? (
          <p className={styles.objectifsTexte}>{objectifCourant}</p>
        ) : (
          <p className={styles.objectifsVide}>Ton professeur n’a pas encore écrit d’objectif ce mois-ci.</p>
        )}

        {modeProf && objectifsPasses.length > 0 && (
          <details className={styles.objectifsPasses}>
            <summary>Mois précédents ({objectifsPasses.length})</summary>
            {objectifsPasses.map((o) => (
              <p key={o.mois} className={styles.objectifPasse}>
                <b>{libelleMois(o.mois)}</b> — {o.texte}
              </p>
            ))}
          </details>
        )}
      </section>
    </div>
  );
}
