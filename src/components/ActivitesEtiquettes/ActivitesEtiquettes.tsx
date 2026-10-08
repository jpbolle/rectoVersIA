'use client';

// Des activités en ÉTIQUETTES (le titre, cliquable) plutôt qu'en cartes — pour
// ce qui est rangé : classé, archivé. Au survol ou au clavier, une infobulle de
// l'app (jamais celle du navigateur) : classes, échéance, type d'activité.
// Partagé entre la page des activités de l'élève et le tableau de bord du prof
// (2026-10-09) ; l'appelant dit quelles classes montrer et où mène le clic.

import { useRouter } from 'next/navigation';
import { atelierLabel, atelierParDispositif } from '@/types/didactique';
import type { Dispositif } from '@/types/didactique';
import type { Devoir } from '@/types/devoir';
import styles from './ActivitesEtiquettes.module.css';

/** « mer. 8 oct. 2026 » — ou rien si l'activité n'a pas d'échéance */
function echeanceLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  devoirs: Devoir[];
  /** Où mène le clic sur une étiquette */
  hrefDe: (d: Devoir) => string;
  /** Les classes à montrer dans l'infobulle (absent = celles de l'activité) */
  classesDe?: (d: Devoir) => string[];
  /** Message quand la liste est vide */
  vide: string;
  /** Un sous-titre au-dessus des étiquettes (onglet « Toutes ») */
  titre?: string;
  /** La dernière ligne de l'infobulle */
  note?: string;
}

export default function ActivitesEtiquettes({
  devoirs,
  hrefDe,
  classesDe = (d) => d.classes,
  vide,
  titre,
  note = 'Cliquer pour ouvrir',
}: Props) {
  const router = useRouter();
  if (devoirs.length === 0) {
    return titre ? null : <p className={styles.vide}>{vide}</p>;
  }
  return (
    <>
      {titre && <h4 className={styles.sousTitre}>{titre}</h4>}
      <div className={styles.etiquettes}>
        {devoirs.map((d) => {
          const classes = classesDe(d);
          const echeance = echeanceLabel(d.dateRemise);
          const type = atelierLabel(
            d.atelier || atelierParDispositif(d.typeTravail as Dispositif).id,
            true
          );
          return (
            <span key={d.id} className={styles.etiquetteWrap}>
              <button type="button" className={styles.etiquette} onClick={() => router.push(hrefDe(d))}>
                {d.intitule}
              </button>
              <span className={styles.infobulle} role="tooltip">
                <span className={styles.ligne}>
                  <span className={styles.cle}>Classe</span>
                  {classes.length ? classes.join(', ') : '—'}
                </span>
                <span className={styles.ligne}>
                  <span className={styles.cle}>Échéance</span>
                  {echeance || 'aucune'}
                </span>
                <span className={styles.ligne}>
                  <span className={styles.cle}>Type</span>
                  {type}
                </span>
                <span className={styles.noteBulle}>{note}</span>
              </span>
            </span>
          );
        })}
      </div>
    </>
  );
}
