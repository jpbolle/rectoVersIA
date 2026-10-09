'use client';

// Le CONSTRUCTEUR d'un portfolio d'apprentissage — le serpentin des étapes
// (mécanisme partagé avec la séquence FLE : `Serpentin`), au verso d'une
// activité « Portfolio » et dans l'atelier d'une matrice (Mes Ressources).
//
// Le « + » propose TROIS choses (décision du 2026-10-09, « je te laisse
// décider de la méthode ») :
//  1. une ÉTAPE DU PORTFOLIO (objectifs, consigne, dépôts) — popup d'étape ;
//  2. une ACTIVITÉ EXISTANTE de Mes Activités (conceptualisation, sondage,
//     questionnaire, œuvre…) — liste filtrable ;
//  3. CRÉER UNE ACTIVITÉ sur place — seulement dans l'atelier pleine page,
//     qui sait ouvrir le formulaire de création sans empiler les popups.
//
// Un clic sur le titre d'un encadré ouvre la popup d'étape (section, échéance,
// IA, portée, verrou, dépôts) ; pour un renvoi, la popup propose en plus
// d'ouvrir l'activité elle-même.

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Serpentin from '@/components/SequenceFleBuilder/Serpentin';
import EtapePortfolioModal from './EtapePortfolioModal';
import { atelierLabel } from '@/types/didactique';
import type { Devoir } from '@/types/devoir';
import { iconeAtelier } from '@/types/sequence-fle';
import {
  estEtapeSansTrace,
  nouvelleEtape,
  STATUT_IA_LABELS,
  type PortfolioEtape,
} from '@/types/portfolio';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import serp from '@/components/SequenceFleBuilder/SequenceFleBuilder.module.css';
import styles from './Portfolio.module.css';

type Nature = 'etape' | 'activite';

interface Props {
  etapes: PortfolioEtape[];
  onChange: (etapes: PortfolioEtape[]) => void;
  disabled?: boolean;
  // Atelier pleine page : créer une activité sur place, insérée à cet index
  onCreerActivite?: (insertion: number) => void;
  // Atelier : ouvrir l'activité d'un renvoi (popup ✏️)
  onOuvrirActivite?: (devoirId: string) => void;
}

function echeanceCourte(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
}

export default function PortfolioBuilder({ etapes, onChange, disabled = false, onCreerActivite, onOuvrirActivite }: Props) {
  const { getAuthHeaders } = useAuth();

  // Le « + » : où insérer, et quoi
  const [insertion, setInsertion] = useState<number | null>(null);
  const [nature, setNature] = useState<Nature | null>(null);
  const [devoirs, setDevoirs] = useState<Devoir[] | null>(null);
  const [recherche, setRecherche] = useState('');

  // La popup d'étape : l'étape en cours d'édition, et sa position si elle
  // est NOUVELLE (sinon elle remplace celle qui porte son id)
  const [edition, setEdition] = useState<{ etape: PortfolioEtape; insertion: number | null } | null>(null);

  useEffect(() => {
    if (nature !== 'activite') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/devoirs', { headers });
        const json = await res.json();
        if (annule) return;
        setDevoirs(
          json.success
            ? (json.data as Devoir[]).filter(
                (d) => !d.archive && d.typeTravail !== 'sequence' && d.typeTravail !== 'portfolio'
              )
            : []
        );
      } catch {
        if (!annule) setDevoirs([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [nature, getAuthHeaders]);

  const ouvrirPlus = (index: number) => {
    setInsertion(index);
    setNature(null);
    setRecherche('');
  };

  const inserer = (etape: PortfolioEtape, index: number) => {
    const liste = [...etapes];
    liste.splice(index, 0, etape);
    onChange(liste);
  };

  // Une nouvelle étape propre hérite de la section de celle qui la précède
  const commencerEtape = () => {
    if (insertion === null) return;
    const precedente = etapes[insertion - 1];
    setEdition({ etape: nouvelleEtape({ section: precedente?.section ?? '' }), insertion });
    setInsertion(null);
  };

  const insererDevoir = (d: Devoir) => {
    if (insertion === null) return;
    const precedente = etapes[insertion - 1];
    inserer(
      nouvelleEtape({
        nature: 'activite',
        devoirId: d.id,
        titre: d.intitule,
        atelier: d.atelier,
        typeTravail: d.typeTravail,
        section: precedente?.section ?? '',
      }),
      insertion
    );
    setInsertion(null);
  };

  const enregistrerEtape = (etape: PortfolioEtape) => {
    if (!edition) return;
    if (edition.insertion !== null) inserer(etape, edition.insertion);
    else onChange(etapes.map((e) => (e.id === etape.id ? etape : e)));
    setEdition(null);
  };

  const deplacer = (i: number, sens: -1 | 1) => {
    const j = i + sens;
    if (j < 0 || j >= etapes.length) return;
    const liste = [...etapes];
    [liste[i], liste[j]] = [liste[j], liste[i]];
    onChange(liste);
  };

  const retirer = (id: string) => onChange(etapes.filter((e) => e.id !== id));

  const sections = [...new Set(etapes.map((e) => (e.section ?? '').trim()).filter(Boolean))];
  const q = recherche.trim().toLowerCase();
  const candidats = (devoirs ?? []).filter((d) => !q || d.intitule.toLowerCase().includes(q));

  const rendreEtape = (e: PortfolioEtape, i: number) => {
    const renvoi = e.nature === 'activite';
    const sansTrace = estEtapeSansTrace(e);
    const nbDepots = e.depots?.length ?? 0;
    return (
      <article
        key={e.id}
        className={`${serp.encadre} ${renvoi ? serp.encadreActivite : styles.encadreEtape}`}
      >
        <span className={serp.numero}>{i + 1}</span>
        <span className={styles.section} title={e.section}>{e.section || (renvoi ? 'Activité' : 'Étape')}</span>
        <span className={serp.icone} aria-hidden="true">{renvoi ? iconeAtelier(e.atelier) : sansTrace ? '🎭' : '📝'}</span>
        <button
          type="button"
          className={`${serp.titre} ${serp.titreLien}`}
          title={`Régler « ${e.titre} »`}
          onClick={() => setEdition({ etape: e, insertion: null })}
        >
          {e.titre || '(sans titre)'}
        </button>
        <span className={serp.meta}>
          {renvoi
            ? atelierLabel(e.atelier ?? '', true) || e.typeTravail || 'activité'
            : sansTrace
              ? 'sans trace'
              : `${nbDepots} dépôt${nbDepots > 1 ? 's' : ''}`}
        </span>
        <span className={styles.badges}>
          {e.echeance && <span className={styles.badge}>📅 {echeanceCourte(e.echeance)}</span>}
          {e.ia && <span className={styles.badge} title={STATUT_IA_LABELS[e.ia].long}>{STATUT_IA_LABELS[e.ia].picto}</span>}
          {e.portee === 'collective' && <span className={`${styles.badge} ${styles.badgeCollectif}`}>👥</span>}
          {e.verrouille && <span className={`${styles.badge} ${styles.badgeVerrou}`} title="Verrouille l’étape suivante">🔒</span>}
        </span>
        {!disabled && (
          <span className={serp.actions}>
            <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} title="Avancer dans le parcours">◀</button>
            <button type="button" onClick={() => deplacer(i, 1)} disabled={i === etapes.length - 1} title="Reculer dans le parcours">▶</button>
            <button type="button" onClick={() => retirer(e.id)} title="Retirer du portfolio">✕</button>
          </span>
        )}
      </article>
    );
  };

  const etapeEnEdition = edition?.etape ?? null;
  const indexEdition = etapeEnEdition
    ? edition!.insertion !== null
      ? edition!.insertion
      : etapes.findIndex((e) => e.id === etapeEnEdition.id)
    : -1;
  const titreSuivante =
    indexEdition >= 0 ? (edition!.insertion !== null ? etapes[indexEdition]?.titre : etapes[indexEdition + 1]?.titre) ?? null : null;

  return (
    <div className={serp.builder}>
      <div className={base.bloc}>
        <p className={base.blocTitre}>
          Le portfolio, étape par étape
          <span>
            Le « + » ajoute une étape à cet endroit : une étape du portfolio (objectifs, consigne, dépôts) ou une
            activité de Mes Activités. Un clic sur le titre règle l’étape : section, échéance, IA, portée, verrou.
          </span>
        </p>

        <Serpentin
          items={etapes}
          cle={(e) => e.id}
          rendreItem={rendreEtape}
          onPlus={disabled ? undefined : ouvrirPlus}
          aideDepart="Première étape : une étape du portfolio, ou une activité existante."
        />
      </div>

      {/* ── Le « + » : la nature, puis l'existant ── */}
      {insertion !== null && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setInsertion(null)}>
          <div className={base.popup}>
            <header className={base.popupEntete}>
              <h3>
                Ajouter une étape
                {etapes.length > 0 && <span className={serp.popupPosition}> — en position {insertion + 1}</span>}
              </h3>
              <button type="button" className={base.popupFermer} onClick={() => setInsertion(null)}>
                ✕
              </button>
            </header>
            <div className={base.popupCorps}>
              <div className={styles.natures}>
                <button type="button" className={styles.natureBtn} onClick={commencerEtape}>
                  <span className={styles.natureIcone} aria-hidden="true">📝</span>
                  <span className={styles.natureTitre}>Une étape du portfolio</span>
                  <span className={styles.natureAide}>objectifs, consigne, dépôts — ou sans trace</span>
                </button>
                <button
                  type="button"
                  className={`${styles.natureBtn} ${nature === 'activite' ? styles.natureActive : ''}`}
                  onClick={() => {
                    setNature('activite');
                    setRecherche('');
                  }}
                >
                  <span className={styles.natureIcone} aria-hidden="true">🎯</span>
                  <span className={styles.natureTitre}>Une activité existante</span>
                  <span className={styles.natureAide}>schéma, sondage, questionnaire, œuvre…</span>
                </button>
                <button
                  type="button"
                  className={styles.natureBtn}
                  onClick={() => {
                    if (!onCreerActivite) return;
                    const index = insertion;
                    setInsertion(null);
                    onCreerActivite(index);
                  }}
                  disabled={!onCreerActivite}
                  title={onCreerActivite ? undefined : 'Depuis l’atelier du portfolio (Mes Ressources › Portfolios)'}
                >
                  <span className={styles.natureIcone} aria-hidden="true">➕</span>
                  <span className={styles.natureTitre}>Créer une activité</span>
                  <span className={styles.natureAide}>
                    {onCreerActivite ? 'sur place, insérée ici' : 'depuis l’atelier du portfolio'}
                  </span>
                </button>
              </div>

              {nature === 'activite' && (
                <>
                  <input
                    type="search"
                    className={styles.recherche}
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Rechercher une activité…"
                    autoFocus
                  />
                  {devoirs === null ? (
                    <p className={base.vide}>Chargement…</p>
                  ) : candidats.length === 0 ? (
                    <p className={base.vide}>{q ? 'Aucune activité ne correspond.' : 'Aucune activité pour l’instant.'}</p>
                  ) : (
                    <div className={base.liste}>
                      {candidats.map((d) => (
                        <button key={d.id} type="button" className={base.item} onClick={() => insererDevoir(d)}>
                          <span>{iconeAtelier(d.atelier)}</span>
                          <span className={base.activiteNom}>{d.intitule}</span>
                          <span className={base.itemClasses}>
                            {atelierLabel(d.atelier ?? '', true) || d.typeTravail}
                            {d.classes.length ? ` · ${d.classes.join(', ')}` : ' · sans classe'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <footer className={base.popupPied}>
              <span className={base.popupNote}>
                {nature === 'activite'
                  ? 'L’activité reste dans Mes Activités ; le portfolio y renvoie et coche l’étape à la remise.'
                  : 'Choisis ce que tu ajoutes.'}
              </span>
              <button type="button" className={base.btnGhost} onClick={() => setInsertion(null)}>
                Fermer
              </button>
            </footer>
          </div>
        </div>
      )}

      {etapeEnEdition && (
        <EtapePortfolioModal
          key={etapeEnEdition.id}
          etape={etapeEnEdition}
          sections={sections}
          titreSuivante={titreSuivante}
          onSave={enregistrerEtape}
          onClose={() => setEdition(null)}
          onOuvrirActivite={onOuvrirActivite}
          disabled={disabled}
        />
      )}
    </div>
  );
}
