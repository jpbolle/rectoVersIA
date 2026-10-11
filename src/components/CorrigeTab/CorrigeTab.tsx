'use client';

// Onglet « CORRIGÉ DU PROFESSEUR » de l'élève (écriture, conceptualisation —
// JP, 2026-10-11) : en vis-à-vis de sa copie, dans la colonne de droite. Le
// serveur n'envoie le corrigé qu'une fois CETTE copie corrigée et rendue
// visible (elle est alors rendue et verrouillée) ; d'ici là, l'onglet est grisé
// dans le rail et ce composant n'a rien à montrer.

import { useState } from 'react';
import { Search } from 'lucide-react';
import { DiagramWorkspace } from '@/components/Diagram/DiagramWorkspace';
import SchemaApercu from '@/components/SchemaApercu/SchemaApercu';
import type { Devoir } from '@/types/devoir';
import styles from './CorrigeTab.module.css';

const rien = () => {};

export default function CorrigeTab({ devoir }: { devoir: Devoir }) {
  const [grand, setGrand] = useState(false);
  const schema = devoir.typeTravail === 'schematiser' ? devoir.schema?.corrige ?? null : null;
  const production = devoir.typeTravail === 'ecrire' ? devoir.corrigeReference?.production?.trim() ?? '' : '';

  if (schema) {
    return (
      <div className={styles.container}>
        <div className={styles.entete}>
          <p className={styles.titre}>{schema.titre}</p>
          <button type="button" className={styles.loupe} onClick={() => setGrand(true)} title="Voir en grand">
            <Search size={15} aria-hidden="true" /> Voir en grand
          </button>
        </div>
        <div className={styles.cadre}>
          <DiagramWorkspace diagram={schema.diagram} onChange={rien} readOnly embedded lockType />
        </div>
        {grand && <SchemaApercu diagram={schema.diagram} titre={schema.titre} onClose={() => setGrand(false)} />}
      </div>
    );
  }

  if (production) {
    return (
      <div className={styles.container}>
        <div className={styles.production}>{production}</div>
      </div>
    );
  }

  return (
    <div className={styles.vide}>
      <span aria-hidden="true">🔒</span>
      <p>Le corrigé s’ouvrira quand ton professeur aura corrigé ta copie.</p>
    </div>
  );
}
