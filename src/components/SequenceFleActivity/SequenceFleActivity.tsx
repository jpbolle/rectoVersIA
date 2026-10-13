'use client';

// La SÉQUENCE FLE côté élève, dans la page de travail à DEUX COLONNES
// (plan 2026-10-13, comme le portfolio) :
//  - colonne 1 (`SequenceEtape`) : l'étape ouverte — une THÉORIE (introduction,
//    ressources en volets, « J'ai lu, je continue ») ou une ACTIVITÉ (sa carte :
//    état, type, « Ouvrir l'activité ») ;
//  - rail (`SequenceSommaire`) : « Sommaire de la séquence », une ligne par
//    étape, cochée quand elle est faite, clic = j'y vais.
// Une activité est faite quand sa copie est remise ; une théorie, quand
// l'élève a cliqué « J'ai lu » (fiche `progressionsSequence`, serveur).
// L'ancien « serpentin » centré (ligne de crans + étapes empilées) a disparu.

import Link from 'next/link';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { etapeFaite, type ParcoursFleEleve } from '@/hooks/useParcoursFle';
import { niveauLabel, typeModuleLabel } from '@/types/didactique-fle';
import { iconeTypeModule, introductionVide } from '@/types/module-fle';
import { iconeAtelier } from '@/types/sequence-fle';
import type { Devoir } from '@/types/devoir';
import { atelierLabel } from '@/types/didactique';
import { decouperConsignes } from '@/lib/consignes-etapes';
import EmptyState from '@/components/EmptyState/EmptyState';
import RessourcesTab from '@/components/RessourcesTab/RessourcesTab';
import styles from './SequenceFleActivity.module.css';

const ETAT_LABEL = { 'a-faire': 'À faire', 'en-cours': 'En cours', fait: 'Fait' } as const;

// ————— Colonne 1 : l'étape ouverte —————

export function SequenceEtape({
  seq,
  isPreviewMode = false,
}: {
  seq: ParcoursFleEleve;
  isPreviewMode?: boolean;
}) {
  const { config } = useDidactiqueFle();
  const { parcours, erreur, etape, index, allerA, marquerLu, enregistrement, faites, total } = seq;

  if (!parcours) {
    return (
      <div className={styles.colonne}>
        {erreur ? <EmptyState icon="🧭" message={erreur} /> : <EmptyState icon="hourglass" message="En cours de chargement" />}
      </div>
    );
  }
  if (!etape) {
    return (
      <div className={styles.colonne}>
        <EmptyState icon="🧭" message="Cette séquence n’a pas encore d’étape. Reviens bientôt !" />
      </div>
    );
  }

  const precedente = parcours.etapes[index - 1];
  const suivante = parcours.etapes[index + 1];
  const theorie = etape.nature === 'theorie' ? etape : null;
  const activite = etape.nature === 'activite' ? etape : null;

  return (
    <div className={styles.colonne}>
      {/* En-tête : l'étape, et où l'on en est dans la séquence */}
      <div className={styles.entete}>
        <span className={styles.entetePicto} aria-hidden="true">
          {theorie ? iconeTypeModule(theorie.type) : iconeAtelier(activite!.atelier)}
        </span>
        <span className={styles.enteteTexte}>
          <span className={styles.enteteNum}>
            Étape {index + 1} sur {total} · {theorie ? 'Théorie' : 'Activité'}
          </span>
          <span className={styles.enteteTitre}>{theorie ? theorie.titre : activite!.intitule || 'Activité'}</span>
          {theorie && (theorie.type || theorie.niveau) && (
            <span className={styles.enteteMeta}>
              {theorie.type && typeModuleLabel(config, theorie.type)}
              {theorie.type && theorie.niveau && ' · '}
              {theorie.niveau && niveauLabel(config, theorie.niveau)}
            </span>
          )}
        </span>
        <span className={`${styles.etat} ${etapeFaite(etape) ? styles.etatFait : ''}`}>
          {etapeFaite(etape) ? '✓ Fait' : `${faites}/${total} fait${faites > 1 ? 'es' : 'e'}`}
        </span>
      </div>

      <div className={styles.corps}>
        {theorie && (
          <>
            {!introductionVide(theorie.introduction) && (
              <div className={styles.theorieTexte} dangerouslySetInnerHTML={{ __html: theorie.introduction }} />
            )}
            {theorie.ressources ? (
              /* Les mêmes volets que l'onglet Ressources d'une activité :
                 le composant ne lit que `ressources` et `id` du devoir */
              <div className={styles.ressources}>
                <RessourcesTab devoir={{ id: theorie.moduleId, ressources: theorie.ressources } as unknown as Devoir} />
              </div>
            ) : (
              introductionVide(theorie.introduction) && <p className={styles.vide}>Rien à lire dans cette étape pour l’instant.</p>
            )}

            {/* « J'ai lu » — le même geste que la lecture de cours */}
            <div className={styles.actions}>
              {theorie.etat === 'fait' ? (
                <span className={styles.luFait}>✓ Fait{suivante ? ' — l’étape suivante est ouverte.' : '.'}</span>
              ) : (
                <button type="button" className={styles.btnLu} onClick={() => void marquerLu()} disabled={enregistrement}>
                  ✓ {suivante ? 'J’ai lu, je continue' : 'J’ai lu'}
                </button>
              )}
            </div>
          </>
        )}

        {activite && (
          <Link
            href={isPreviewMode ? `/activites/${activite.devoirId}?preview=true` : `/activites/${activite.devoirId}`}
            className={`${styles.activite} ${styles[`activite_${activite.etat.replace('-', '_')}`]}`}
          >
            <span className={styles.activitePicto} aria-hidden="true">
              {iconeAtelier(activite.atelier)}
            </span>
            <span className={styles.activiteTexte}>
              <span className={styles.activiteNom}>{activite.intitule || 'Activité'}</span>
              <span className={styles.activiteType}>{atelierLabel(activite.atelier ?? '', true) || activite.typeTravail}</span>
            </span>
            <span className={styles.activiteLabel}>{ETAT_LABEL[activite.etat]}</span>
            <span className={styles.activiteOuvrir}>
              {activite.etat === 'fait' ? 'Revoir' : activite.etat === 'en-cours' ? 'Continuer' : 'Commencer'} →
            </span>
          </Link>
        )}

        {erreur && <p className={styles.erreur}>{erreur}</p>}
      </div>

      {/* Navigation entre étapes, en pied de colonne */}
      <div className={styles.pied}>
        <button type="button" className={styles.nav} onClick={() => precedente && allerA(precedente.id)} disabled={!precedente}>
          ← Étape précédente
        </button>
        <button type="button" className={styles.nav} onClick={() => suivante && allerA(suivante.id)} disabled={!suivante}>
          Étape suivante →
        </button>
      </div>
    </div>
  );
}

// ————— Rail : le sommaire de la séquence —————

export function SequenceSommaire({ seq, consignes }: { seq: ParcoursFleEleve; consignes?: string }) {
  const { parcours, etape: ouverte, allerA, faites, total } = seq;
  if (!parcours) return <p className={styles.sommaireVide}>Chargement…</p>;
  const lignes = decouperConsignes(consignes);

  return (
    <div className={styles.sommaire}>
      {lignes.length > 0 && (
        <div className={styles.sommaireConsignes}>
          {lignes.map((c) => (
            <p key={c.cle} className={c.genre === 'titre' ? styles.sommaireConsigneTitre : ''}>
              {c.texte}
            </p>
          ))}
        </div>
      )}

      <div className={styles.sommaireCompteur}>
        <span>
          {faites === total && total > 0
            ? 'Tout est fait. Bravo !'
            : `${faites} étape${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${total}`}
        </span>
        <span className={styles.sommaireBarre} aria-hidden="true">
          <i style={{ transform: `scaleX(${total ? faites / total : 0})` }} />
        </span>
      </div>

      <ol className={styles.sommaireListe}>
        {parcours.etapes.map((e, i) => {
          const fait = etapeFaite(e);
          return (
            <li key={e.id}>
              <button
                type="button"
                className={`${styles.sommaireItem} ${ouverte?.id === e.id ? styles.sommaireItemActif : ''}`}
                onClick={() => allerA(e.id)}
                aria-current={ouverte?.id === e.id ? 'step' : undefined}
              >
                <span className={`${styles.sommaireCase} ${fait ? styles.sommaireCaseFaite : ''}`} aria-hidden="true">
                  {fait ? '✓' : ''}
                </span>
                <span className={styles.sommaireTexte}>
                  <span className={styles.sommaireNum}>
                    {i + 1}. {e.nature === 'theorie' ? 'Théorie' : 'Activité'}
                  </span>
                  <span className={`${styles.sommaireTitre} ${fait ? styles.sommaireTitreFait : ''}`}>
                    {e.nature === 'theorie' ? e.titre : e.intitule || 'Activité'}
                  </span>
                </span>
                {e.nature === 'activite' && e.etat === 'en-cours' && <small className={styles.sommaireEnCours}>en cours</small>}
              </button>
            </li>
          );
        })}
      </ol>
      <p className={styles.sommaireLegende}>✓ se coche quand l’étape est faite : activité remise, théorie lue.</p>
    </div>
  );
}
