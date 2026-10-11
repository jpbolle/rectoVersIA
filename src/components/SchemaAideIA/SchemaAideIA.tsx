'use client';

// Onglet « AIDE IA » du prof dans la correction d'un atelier de
// conceptualisation (étape 4 du plan 2026-10-11) : le schéma de l'élève
// comparé au corrigé. Compteurs EN TÊTE (ils bougent avec chaque ✓ / ✗),
// puis le tableau — une rangée par famille (concepts, liens) pour que les
// deux colonnes, présent | absent-en trop-erroné, se lisent au même niveau.
// La justification de chaque ligne est au survol de ⓘ. Pas de résumé
// textuel (JP : « indigeste »).
// L'état vit dans useSchemaComparaison (partagé avec les pastilles pâles du schéma).

import { useState } from 'react';
import { compteurs, estArbre, estPresente, type ComparaisonSchema, type Decision, type LigneComparaison } from '@/lib/schema-comparaison';
import { justificationDeLigne } from '@/hooks/useSchemaComparaison';
import type { SchemaMarques } from '@/types/correction';
import styles from './SchemaAideIA.module.css';

interface Props {
  comparaison: ComparaisonSchema | null | undefined;
  enCours: boolean;
  erreur: string | null;
  comparer: () => void;
  decider: (ligneId: string, decision: Decision | null) => void;
  aCorrige: boolean;
  marques: SchemaMarques | undefined;
  lectureSeule?: boolean;
}

const STATUTS: Record<string, string> = {
  present: 'présent',
  absent: 'absent',
  en_trop: 'en trop',
  juste: 'juste',
  faux: 'faux',
};

export default function SchemaAideIA({ comparaison, enCours, erreur, comparer, decider, aCorrige, marques, lectureSeule }: Props) {
  const [voirRefusees, setVoirRefusees] = useState(false);

  if (comparaison === undefined) return <p className={`${styles.panneau} ${styles.note}`}>Chargement…</p>;

  if (!comparaison) {
    return (
      <div className={styles.vide}>
        <p>L’IA compare le schéma de l’élève à votre corrigé : concepts présents, absents ou en trop, liens justes, faux ou manquants. Ses propositions apparaissent en pastilles pâles sur le schéma.</p>
        {aCorrige ? (
          !lectureSeule && (
            <button type="button" className={styles.btn} onClick={comparer} disabled={enCours}>
              {enCours ? 'Comparaison en cours…' : '🔍 Comparer avec mon corrigé'}
            </button>
          )
        ) : (
          <p className={styles.note}>Choisissez d’abord un corrigé : modifier l’activité › Ajout de contenus › Corrigé du professeur.</p>
        )}
        {erreur && <p className={styles.erreur}>{erreur}</p>}
      </div>
    );
  }

  const refusees = comparaison.lignes.filter((l) => comparaison.decisions[l.id] === 'refuse');
  const visibles = comparaison.lignes.filter((l) => voirRefusees || comparaison.decisions[l.id] !== 'refuse');
  const titreLiens = estArbre(comparaison.type) ? 'Rattachements' : comparaison.type === 'timeline' ? 'Places' : 'Liens';

  const carte = (l: LigneComparaison) => {
    const d = comparaison.decisions[l.id];
    const principal = l.statut === 'absent' ? l.corrige : l.eleve ?? l.corrige;
    const justification = justificationDeLigne(l);
    return (
      <li key={l.id} className={`${styles.ligne} ${d === 'accepte' ? styles.acceptee : ''} ${d === 'refuse' ? styles.refusee : ''}`}>
        <span className={`${styles.statut} ${estPresente(l) ? styles.statutBon : styles.statutMauvais}`}>{STATUTS[l.statut]}</span>
        <span className={styles.principal}>{principal || '—'}</span>
        <span className={styles.gestes}>
          {/* Le petit robot des grilles d'évaluation ; seulement s'il a quelque chose à dire */}
          {justification ? (
            <span className={styles.info} title={justification} aria-label={justification} tabIndex={0}>
              🤖
            </span>
          ) : (
            // Place gardée : les ✓ ✗ restent alignés d'une ligne à l'autre
            <span className={styles.info} aria-hidden="true" />
          )}
          {!lectureSeule && (
            <>
              <button
                type="button"
                className={`${styles.geste} ${d === 'accepte' ? styles.gesteOui : ''}`}
                onClick={() => decider(l.id, d === 'accepte' ? null : 'accepte')}
                title={d === 'accepte' ? 'Retirer mon accord' : l.cibleId ? 'Valider (pose la pastille)' : 'Valider'}
                aria-label="Valider"
              >
                ✓
              </button>
              <button
                type="button"
                className={`${styles.geste} ${d === 'refuse' ? styles.gesteNon : ''}`}
                onClick={() => decider(l.id, d === 'refuse' ? null : 'refuse')}
                title={d === 'refuse' ? 'Rétablir la ligne' : 'Refuser (la ligne ne compte plus)'}
                aria-label="Refuser"
              >
                ✗
              </button>
            </>
          )}
        </span>
      </li>
    );
  };

  // Une rangée = une famille, deux colonnes alignées
  const rangee = (genre: 'concept' | 'lien', titre: string) => {
    const lignes = visibles.filter((l) => l.genre === genre);
    if (lignes.length === 0) return null;
    const gauche = lignes.filter(estPresente);
    const droite = lignes.filter((l) => !estPresente(l));
    return (
      <>
        <p className={styles.sousTitre}>{titre}</p>
        <div className={styles.rangee}>
          <ul className={`${styles.liste} ${styles.colBon}`}>
            {gauche.length ? gauche.map(carte) : <li className={styles.rien}>—</li>}
          </ul>
          <ul className={`${styles.liste} ${styles.colMauvais}`}>
            {droite.length ? droite.map(carte) : <li className={styles.rien}>—</li>}
          </ul>
        </div>
      </>
    );
  };

  return (
    <div className={styles.panneau}>
      <div className={styles.compteurs}>
        {compteurs(comparaison, marques).map((c) => (
          <div
            key={c.libelle}
            className={`${styles.compteur} ${c.ton === 'bon' ? styles.compteurBon : styles.compteurMauvais}`}
            title={`${c.confirmes} confirmé${c.confirmes > 1 ? 's' : ''} par vous`}
          >
            <span className={styles.compteurValeur}>{c.valeur}</span>
            <span className={styles.compteurLibelle}>{c.libelle}</span>
            {/* 3ᵉ ligne, toujours là (hauteur égale) : la pastille des confirmations, rangée à droite */}
            <span className={styles.compteurPied}>
              {c.confirmes > 0 && <span className={styles.compteurConfirmes}>{c.confirmes} ✓</span>}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.entetes}>
        <h4 className={styles.titreBon}>✔ Présent dans le schéma de l’élève</h4>
        <h4 className={styles.titreMauvais}>✘ Absent, en trop ou erroné</h4>
      </div>
      {rangee('concept', 'Concepts')}
      {rangee('lien', titreLiens)}

      <div className={styles.pied}>
        {comparaison.demandeParEleve && (
          <span className={styles.note}>
            🤖 L’élève a utilisé son aide IA le {new Date(comparaison.demandeParEleve).toLocaleDateString('fr-BE')} : il a vu ce qu’il avait trouvé et le nombre d’éléments manquants.
          </span>
        )}
        {refusees.length > 0 && (
          <button type="button" className={styles.lien} onClick={() => setVoirRefusees((v) => !v)}>
            {voirRefusees ? 'Masquer les lignes refusées' : `Voir les lignes refusées (${refusees.length})`}
          </button>
        )}
        {!lectureSeule && (
          <button type="button" className={styles.lien} onClick={comparer} disabled={enCours}>
            {enCours ? 'Comparaison en cours…' : '↻ Relancer la comparaison'}
          </button>
        )}
        <span className={styles.note}>Propositions de l’IA, à vérifier : pastilles pâles sur le schéma, un clic les valide.</span>
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
    </div>
  );
}
