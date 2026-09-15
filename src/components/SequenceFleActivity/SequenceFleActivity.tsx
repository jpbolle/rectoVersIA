'use client';

// Le PARCOURS d'une séquence FLE, côté élève — l'écran ouvert par
// /activites/[id] quand l'activité est de type « sequence ».
//
// Dépouillé, gros pictogrammes, peu de texte (public DASPA) :
//  - une ligne de progression, un cran par étape ;
//  - les étapes dans l'ordre : une THÉORIE se déplie (introduction, puis les
//    ressources en volets — les mêmes que dans une activité), une ACTIVITÉ
//    est une carte avec sa pastille d'état (à faire · en cours · fait) qui
//    ouvre l'écran habituel.
// L'état se déduit des copies : rien n'est stocké ici.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { niveauLabel, typeModuleLabel } from '@/types/didactique-fle';
import { iconeTypeModule, introductionVide } from '@/types/module-fle';
import type { EtapeParcours, EtapeParcoursActivite, ParcoursFle } from '@/types/sequence-fle';
import type { Devoir } from '@/types/devoir';
import { atelierLabel } from '@/types/didactique';
import EmptyState from '@/components/EmptyState/EmptyState';
import RessourcesTab from '@/components/RessourcesTab/RessourcesTab';
import styles from './SequenceFleActivity.module.css';

interface Props {
  devoirId: string;
  intitule: string;
  // Le prof en prévisualisation : pas d'état, tout est « à faire »
  isPreviewMode?: boolean;
}

const ETAT_LABEL = { 'a-faire': 'À faire', 'en-cours': 'En cours', fait: 'Fait' } as const;
const ETAT_PICTO = { 'a-faire': '○', 'en-cours': '◐', fait: '●' } as const;

function estFaite(e: EtapeParcours): boolean {
  return e.nature === 'activite' && e.etat === 'fait';
}

export default function SequenceFleActivity({ devoirId, intitule, isPreviewMode }: Props) {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const { config } = useDidactiqueFle();
  const [parcours, setParcours] = useState<ParcoursFle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/devoirs/${devoirId}/parcours-fle`, { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) setParcours(json.data);
        else setErreur(json.message || 'Impossible de charger la séquence.');
      } catch {
        if (!annule) setErreur('Impossible de charger la séquence.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, getAuthHeaders, devoirId]);

  // L'étape en cours : la première activité pas encore faite, ou la théorie
  // qui la précède immédiatement — c'est elle qui est ouverte tant que
  // l'élève n'en a pas choisi une autre (dérivé, pas un état)
  const enCours = useMemo(() => {
    if (!parcours) return null;
    const i = parcours.etapes.findIndex((e) => e.nature === 'activite' && e.etat !== 'fait');
    if (i < 0) return parcours.etapes[parcours.etapes.length - 1]?.id ?? null;
    const precedente = parcours.etapes[i - 1];
    return precedente && precedente.nature === 'theorie' ? precedente.id : parcours.etapes[i].id;
  }, [parcours]);
  const [choixOuvert, setChoixOuvert] = useState<string | null | undefined>(undefined);
  const ouvert = choixOuvert === undefined ? enCours : choixOuvert;

  if (erreur) return <EmptyState icon="🧭" message={erreur} />;
  if (!parcours) return <EmptyState icon="hourglass" message="En cours de chargement" />;
  if (parcours.etapes.length === 0) {
    return <EmptyState icon="🧭" message="Cette séquence n’a pas encore d’étape. Reviens bientôt !" />;
  }

  const activites = parcours.etapes.filter((e): e is EtapeParcoursActivite => e.nature === 'activite');
  const aFaire = activites.filter((a) => a.etat !== 'fait').length;
  const total = parcours.etapes.length;

  return (
    <div className={styles.parcours}>
      <header className={styles.entete}>
        <h1 className={styles.titre}>
          <span aria-hidden="true">🧭</span> {intitule}
        </h1>
        <p className={styles.sousTitre}>
          {aFaire === 0 ? 'Tout est fait. Bravo !' : `${aFaire} activité${aFaire > 1 ? 's' : ''} à faire`}
        </p>
      </header>

      {/* Ligne de progression : un cran par étape */}
      <ol className={styles.ligne} aria-label={`${total} étapes`}>
        {parcours.etapes.map((e, i) => {
          const fait = estFaite(e);
          const courant = e.id === enCours;
          return (
            <li key={e.id} className={styles.cran}>
              <button
                type="button"
                className={`${styles.cranBouton} ${e.nature === 'theorie' ? styles.cranTheorie : ''} ${fait ? styles.cranFait : ''} ${courant ? styles.cranCourant : ''}`}
                onClick={() => setChoixOuvert(e.id)}
                title={e.nature === 'theorie' ? e.titre : e.intitule}
              >
                {fait ? '✓' : e.nature === 'theorie' ? '📖' : i + 1}
              </button>
              {i < total - 1 && <span className={`${styles.trait} ${fait ? styles.traitFait : ''}`} />}
            </li>
          );
        })}
      </ol>

      {/* Les étapes */}
      <div className={styles.modules}>
        {parcours.etapes.map((e, i) => {
          if (e.nature === 'activite') {
            return (
              <Link
                key={e.id}
                href={isPreviewMode ? `/activites/${e.devoirId}?preview=true` : `/activites/${e.devoirId}`}
                className={`${styles.activite} ${styles[`activite_${e.etat.replace('-', '_')}`]} ${e.id === enCours ? styles.activiteCourante : ''}`}
              >
                <span className={styles.activiteEtat} aria-hidden="true">{ETAT_PICTO[e.etat]}</span>
                <span className={styles.activiteTexte}>
                  <span className={styles.activiteNum}>Étape {i + 1} · Activité</span>
                  <span className={styles.activiteNom}>{e.intitule || 'Activité'}</span>
                </span>
                <span className={styles.activiteType}>{atelierLabel(e.atelier ?? '', true) || e.typeTravail}</span>
                <span className={styles.activiteLabel}>{ETAT_LABEL[e.etat]}</span>
              </Link>
            );
          }
          const deplie = ouvert === e.id;
          return (
            <section key={e.id} className={styles.module}>
              <button type="button" className={styles.moduleEntete} onClick={() => setChoixOuvert(deplie ? null : e.id)}>
                <span className={styles.modulePicto} aria-hidden="true">{iconeTypeModule(e.type)}</span>
                <span className={styles.moduleTexte}>
                  <span className={styles.moduleNum}>Étape {i + 1} · Théorie</span>
                  <span className={styles.moduleTitre}>{e.titre}</span>
                  <span className={styles.moduleMeta}>
                    {e.type && typeModuleLabel(config, e.type)}
                    {e.type && e.niveau && ' · '}
                    {e.niveau && niveauLabel(config, e.niveau)}
                  </span>
                </span>
                <span className={styles.moduleChevron} aria-hidden="true">{deplie ? '▾' : '▸'}</span>
              </button>

              {deplie && (
                <div className={styles.moduleCorps}>
                  {!introductionVide(e.introduction) && (
                    <div className={styles.theorieTexte} dangerouslySetInnerHTML={{ __html: e.introduction }} />
                  )}
                  {e.ressources ? (
                    /* Les mêmes volets que l'onglet Ressources d'une activité :
                       le composant ne lit que `ressources` et `id` du devoir */
                    <div className={styles.ressources}>
                      <RessourcesTab devoir={{ id: e.moduleId, ressources: e.ressources } as unknown as Devoir} />
                    </div>
                  ) : (
                    introductionVide(e.introduction) && <p className={styles.vide}>Rien à lire dans ce module pour l’instant.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
