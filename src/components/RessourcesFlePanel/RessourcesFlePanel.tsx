'use client';

// Mes Ressources › Modules FLE — deux sous-sections (demande JP, 2026-09-19) :
//   · POINTS DE THÉORIE : la bibliothèque `modulesFle` (introduction + ressources) ;
//   · ACTIVITÉS : les activités FLE, qui vivent ICI et non au tableau de bord ;
//   · SÉQUENCES DE COURS : l'atelier des séquences FLE, serpentin en grand
//     (elles restent aussi au tableau de bord).
// Les deux premières sont les deux natures d'étape d'une séquence : le « + »
// de la ligne du temps y renvoie (nouvel onglet) quand il faut créer.

import { useState } from 'react';
import ModuleFlePanel from '@/components/ModuleFlePanel/ModuleFlePanel';
import ActiviteFlePanel from '@/components/ActiviteFlePanel/ActiviteFlePanel';
import SequencesFlePanel from '@/components/SequencesFlePanel/SequencesFlePanel';
import styles from './RessourcesFlePanel.module.css';

export type SectionFle = 'theorie' | 'activites' | 'sequences';

interface Props {
  sectionInitiale?: SectionFle;
}

export default function RessourcesFlePanel({ sectionInitiale = 'theorie' }: Props) {
  const [section, setSection] = useState<SectionFle>(sectionInitiale);

  return (
    <div className={styles.panneau}>
      <div className={styles.bascule} role="tablist" aria-label="Ressources FLE">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'theorie'}
          className={`${styles.basculeBtn} ${section === 'theorie' ? styles.basculeActive : ''}`}
          onClick={() => setSection('theorie')}
        >
          📖 Points de théorie
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'activites'}
          className={`${styles.basculeBtn} ${section === 'activites' ? styles.basculeActive : ''}`}
          onClick={() => setSection('activites')}
        >
          🎯 Activités
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'sequences'}
          className={`${styles.basculeBtn} ${section === 'sequences' ? styles.basculeActive : ''}`}
          onClick={() => setSection('sequences')}
        >
          🧭 Séquences de cours
        </button>
      </div>

      {section === 'theorie' && <ModuleFlePanel />}
      {section === 'activites' && <ActiviteFlePanel />}
      {section === 'sequences' && <SequencesFlePanel />}
    </div>
  );
}
