'use client';

// Le CONSTRUCTEUR d'un portfolio d'apprentissage — le serpentin des étapes
// (mécanisme partagé avec la séquence FLE : `Serpentin`), au verso d'une
// activité « Portfolio » et dans l'atelier d'une matrice (Mes Ressources).
//
// Le « + » ouvre DIRECTEMENT la popup d'étape (2026-10-10, JP : « qu'il n'y
// ait qu'une étape […] l'activité doit être proposée comme alternative aux
// dépôts ») : c'est dans la popup qu'on choisit des dépôts OU une activité de
// Mes Activités (existante, ou créée sur place depuis l'atelier pleine page).
//
// Un clic sur le titre d'un encadré rouvre la même popup. Les encadrés se
// déplacent par glisser-déposer (flèches retirées le 2026-10-11, JP — ⚠ le
// glisser-déposer natif ne réagit pas au doigt : pas de réordonnancement sur
// écran tactile).
//
// L'INTRODUCTION (JP, 2026-10-11) : le serpentin COMMENCE obligatoirement par
// elle, comme il finit par la cible — un disque (l'image de couverture
// recadrée, ou le titre du portfolio). Ni « + » avant, ni glisser, ni retrait.
// Un portfolio qui n'en a pas encore la reçoit à l'ouverture (`avecIntroduction`).

import { useEffect, useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import Serpentin from '@/components/SequenceFleBuilder/Serpentin';
import EtapePortfolioModal from './EtapePortfolioModal';
import { atelierLabel } from '@/types/didactique';
import {
  avecIntroduction,
  estEtapeSansTrace,
  nouvelleEtape,
  numeroEtape,
  ordonnerIntroduction,
  styleCouverture,
  urlCouverture,
  type PortfolioEtape,
} from '@/types/portfolio';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import serp from '@/components/SequenceFleBuilder/SequenceFleBuilder.module.css';
import styles from './Portfolio.module.css';

interface Props {
  etapes: PortfolioEtape[];
  onChange: (etapes: PortfolioEtape[]) => void;
  disabled?: boolean;
  // Atelier pleine page : créer une activité sur place. `modele` = l'étape
  // telle que réglée dans la popup ; `remplace` = elle existe déjà à `index`
  onCreerActivite?: (index: number, modele: PortfolioEtape, remplace: boolean) => void;
  // Atelier : ouvrir l'activité d'un renvoi (popup ✏️)
  onOuvrirActivite?: (devoirId: string) => void;
  // La tâche finale : l'encadré CIBLE au bout du serpentin
  tacheFinale?: string;
  // Le titre du portfolio : dans le disque de l'introduction, sans image
  titrePortfolio?: string;
}

function echeanceCourte(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
}

export default function PortfolioBuilder({
  etapes: etapesBrutes,
  onChange,
  disabled = false,
  onCreerActivite,
  onOuvrirActivite,
  tacheFinale,
  titrePortfolio,
}: Props) {
  // L'introduction manque (portfolio d'avant le 2026-10-11) : on la pose en
  // tête — l'enregistrement suivant l'écrit
  useEffect(() => {
    if (disabled || etapesBrutes[0]?.introduction) return;
    onChange(avecIntroduction(etapesBrutes));
  }, [disabled, etapesBrutes, onChange]);
  const etapes = ordonnerIntroduction(etapesBrutes);

  // La popup d'étape : l'étape en cours d'édition, et sa position si elle
  // est NOUVELLE (sinon elle remplace celle qui porte son id)
  const [edition, setEdition] = useState<{ etape: PortfolioEtape; insertion: number | null } | null>(null);

  const inserer = (etape: PortfolioEtape, index: number) => {
    const liste = [...etapes];
    liste.splice(index, 0, etape);
    onChange(liste);
  };

  // Le « + » : une nouvelle étape, qui hérite de la section de celle qui la précède
  const ouvrirPlus = (index: number) => {
    const precedente = etapes[index - 1];
    setEdition({ etape: nouvelleEtape({ section: precedente?.section ?? '' }), insertion: index });
  };

  // « Créer une nouvelle activité » depuis la popup : l'atelier prend la page,
  // puis pose l'activité créée dans cette étape (nouvelle ou existante)
  const creerDepuisPopup = onCreerActivite
    ? (brouillon: PortfolioEtape) => {
        if (!edition) return;
        const index = edition.insertion ?? etapes.findIndex((e) => e.id === brouillon.id);
        onCreerActivite(index, brouillon, edition.insertion === null);
        setEdition(null);
      }
    : undefined;

  const enregistrerEtape = (etape: PortfolioEtape) => {
    if (!edition) return;
    if (edition.insertion !== null) inserer(etape, edition.insertion);
    else onChange(etapes.map((e) => (e.id === etape.id ? etape : e)));
    setEdition(null);
  };

  // Glisser-déposer dans le serpentin : l'étape `de` prend la position `vers`
  const glisser = (de: number, vers: number) => {
    const liste = [...etapes];
    const [etape] = liste.splice(de, 1);
    liste.splice(vers, 0, etape);
    onChange(liste);
  };

  const retirer = (id: string) => onChange(etapes.filter((e) => e.id !== id));

  const sections = [...new Set(etapes.map((e) => (e.section ?? '').trim()).filter(Boolean))];

  // L'introduction : un disque, symétrique de la cible
  const rendreIntroduction = (e: PortfolioEtape) => {
    const url = urlCouverture(e.couverture);
    return (
      <div key={e.id} className={styles.intro}>
        <button
          type="button"
          className={`${styles.introDisque} ${url ? styles.introDisqueImage : ''}`}
          onClick={() => setEdition({ etape: e, insertion: null })}
          title="Régler l’introduction (image, objectifs, informations générales)"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className={styles.introImage} style={styleCouverture(e.couvertureCadrage)} />
          ) : (
            <>
              <span className={styles.cibleLabel}>{e.titre || 'Introduction'}</span>
              <span className={styles.introTitre}>{titrePortfolio?.trim() || 'Le titre du portfolio'}</span>
            </>
          )}
        </button>
        {url && <span className={styles.introEtiquette}>{e.titre || 'Introduction'}</span>}
      </div>
    );
  };

  const rendreEtape = (e: PortfolioEtape, i: number) => {
    if (e.introduction) return rendreIntroduction(e);
    const renvoi = e.nature === 'activite';
    const sansTrace = estEtapeSansTrace(e);
    const nbDepots = e.depots?.length ?? 0;
    return (
      <article
        key={e.id}
        className={`${serp.encadre} ${renvoi ? serp.encadreActivite : styles.encadreEtape} ${disabled ? '' : styles.encadreMobile}`}
      >
        <span className={`${serp.numero} ${renvoi ? '' : styles.numeroEtape}`}>{numeroEtape(etapes, i)}</span>
        {/* Trois natures, trois icônes (JP, 2026-10-11) — les mêmes que les choix
            de la popup : 🎯 une activité de Mes Activités, 📥 des dépôts dans le
            portfolio, 🎭 une performance hors de l'application (sans trace) */}
        <span className={serp.icone} aria-hidden="true" title={renvoi ? 'Activité' : sansTrace ? 'Hors de l’application' : 'Dépôts'}>
          {renvoi ? '🎯' : sansTrace ? '🎭' : '📥'}
        </span>
        <span className={styles.section} title={e.section}>{e.section || (renvoi ? 'Activité' : 'Étape')}</span>
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
          {e.portee === 'collective' && <span className={`${styles.badge} ${styles.badgeCollectif}`}>👥</span>}
          {e.verrouille && <span className={`${styles.badge} ${styles.badgeVerrou}`} title="Verrouille l’étape suivante">🔒</span>}
          {e.validation?.bloquante && (
            <span className={`${styles.badge} ${styles.badgeVerrou}`} title="La suite attend la validation du professeur">
              ✓🔒
            </span>
          )}
          {(e.validation?.attribue.length ?? 0) > 0 && (
            <span className={styles.badge} title={`Attribue : ${e.validation!.attribue.map((v) => v.nom).join(', ')}`}>
              📌 {e.validation!.attribue.length}
            </span>
          )}
          {(e.affiche?.length ?? 0) > 0 && (
            <span className={styles.badge} title="Affiche des valeurs attribuées plus tôt">
              👁 {e.affiche!.length}
            </span>
          )}
        </span>
        {!disabled && (
          <>
            {/* Le pied : la poignée (on peut faire glisser l'encadré) à gauche,
                le retrait à droite — même poids, même ligne */}
            <span className={styles.piedEncadre}>
              <span className={styles.poignee} title="Glisser pour déplacer l’étape" aria-hidden="true">
                <GripHorizontal size={15} />
              </span>
              <button
                type="button"
                className={styles.retirerEncadre}
                onClick={() => retirer(e.id)}
                title="Retirer du portfolio"
                aria-label={`Retirer « ${e.titre} » du portfolio`}
              >
                <X size={14} />
              </button>
            </span>
          </>
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
            Le « + » ajoute une étape à cet endroit : des dépôts dans le portfolio, ou une activité de Mes
            Activités. Un clic sur le titre règle l’étape ; on la déplace en la faisant glisser.
          </span>
        </p>

        <Serpentin
          items={etapes}
          cle={(e) => e.id}
          rendreItem={rendreEtape}
          onPlus={disabled ? undefined : ouvrirPlus}
          onDeplacer={disabled ? undefined : glisser}
          debutFixe={etapes[0]?.introduction === true}
          // Le bout du chemin : la tâche finale, encadré CIBLE (JP, 2026-10-11)
          fin={
            etapes.length > 0 ? (
              <div className={styles.cible} title={tacheFinale?.trim() || 'La tâche finale se règle dans la fiche du portfolio'}>
                <div className={styles.cibleDisque}>
                  <span className={styles.cibleLabel}>Tâche finale</span>
                  <span className={styles.cibleTexte}>{tacheFinale?.trim() || 'À définir dans la fiche'}</span>
                </div>
              </div>
            ) : undefined
          }
          aideDepart="Première étape : une étape du portfolio, ou une activité existante."
        />
      </div>

      {etapeEnEdition && (
        <EtapePortfolioModal
          key={etapeEnEdition.id}
          etape={etapeEnEdition}
          sections={sections}
          titreSuivante={titreSuivante}
          onSave={enregistrerEtape}
          onClose={() => setEdition(null)}
          onOuvrirActivite={onOuvrirActivite}
          onCreerActivite={creerDepuisPopup}
          valeursDisponibles={etapes
            .slice(0, Math.max(0, indexEdition))
            .flatMap((x) => (x.validation?.attribue ?? []).map((v) => ({ ...v, etapeTitre: x.titre })))}
          titrePortfolio={titrePortfolio}
          disabled={disabled}
        />
      )}
    </div>
  );
}
