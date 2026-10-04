'use client';

// ATELIER DE CONCEPTUALISATION — la colonne de travail de l'élève (et la vue
// prof en correction) : l'espace de travail SchémaKit posé dans la page, sans
// sa colonne de gauche (titre et consignes sont dans le rail de droite).
// Le schéma vit dans `travail.content` sous forme de JSON `Diagram` ; ce
// composant le lit à l'ouverture et renvoie chaque modification en JSON au
// parent, qui l'enregistre (useTravail, différé). Plan du 2026-10-04.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DiagramWorkspace } from '@/components/Diagram/DiagramWorkspace';
import type { DiagramExportHandle } from '@/lib/diagram/diagram-export';
import { diagramVide, estDiagramPlausible } from '@/lib/schemas-personnels';
import { schemaDuDevoir } from '@/lib/schema-devoir';
import type { Devoir } from '@/types/devoir';
import type { Diagram } from '@/types/diagram';
import styles from './SchemaActivity.module.css';

interface Props {
  devoir: Pick<Devoir, 'intitule' | 'schema'>;
  /** `travail.content` : JSON du schéma, ou vide/HTML si rien n'a encore été fait */
  content: string | null | undefined;
  onChange?: (json: string) => void;
  readOnly?: boolean;
  /** Vue prof (correction) : plein cadre, pas de volet du bas. */
  exportRef?: React.RefObject<DiagramExportHandle | null>;
}

/** Le schéma lu dans la copie, ou le schéma de départ voulu par le prof. */
export function diagramDuTravail(content: string | null | undefined, devoir: Pick<Devoir, 'intitule' | 'schema'>): Diagram {
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (estDiagramPlausible(parsed)) return parsed;
    } catch {
      /* pas du JSON : copie vierge ou d'un autre dispositif */
    }
  }
  const config = schemaDuDevoir(devoir);
  return diagramVide(config.typeDepart, devoir.intitule || 'Mon schéma');
}

export default function SchemaActivity({ devoir, content, onChange, readOnly = false, exportRef }: Props) {
  const [diagram, setDiagram] = useState<Diagram>(() => diagramDuTravail(content, devoir));
  // Ce qu'on a envoyé en dernier : si `content` revient identique, rien à relire.
  const lastEmitted = useRef<string | null>(null);

  // La copie arrive parfois APRÈS le premier rendu (chargement) : on relit alors.
  useEffect(() => {
    if (content && content === lastEmitted.current) return;
    setDiagram(diagramDuTravail(content, devoir));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relire quand la copie change, pas quand l'activité re-rend
  }, [content]);

  const handleChange = useCallback(
    (next: Diagram) => {
      setDiagram(next);
      if (!onChange) return;
      const json = JSON.stringify(next);
      lastEmitted.current = json;
      onChange(json);
    },
    [onChange],
  );

  const config = schemaDuDevoir(devoir);

  return (
    <div className={styles.cadre}>
      <DiagramWorkspace
        diagram={diagram}
        onChange={handleChange}
        readOnly={readOnly}
        embedded
        lockType={!config.typeLibre}
        exportRef={exportRef}
      />
    </div>
  );
}
