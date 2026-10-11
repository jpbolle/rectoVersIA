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
import { diagramDeDepart, estDiagramPlausible } from '@/lib/schemas-personnels';
import { melangerConcepts, schemaDuDevoir } from '@/lib/schema-devoir';
import type { Devoir } from '@/types/devoir';
import type { Diagram } from '@/types/diagram';
import type { SchemaMarques } from '@/types/correction';
import type { GenreMarque, SuggestionsMarques } from '@/components/Diagram/Pastilles';
import styles from './SchemaActivity.module.css';

interface Props {
  devoir: Pick<Devoir, 'intitule' | 'schema'>;
  /** `travail.content` : JSON du schéma, ou vide/HTML si rien n'a encore été fait */
  content: string | null | undefined;
  onChange?: (json: string) => void;
  readOnly?: boolean;
  /** Vue prof (correction) : plein cadre, pas de volet du bas. */
  exportRef?: React.RefObject<DiagramExportHandle | null>;
  /** Pastilles de correction du prof (vert/rouge) sur ce schéma */
  marques?: SchemaMarques;
  /** Présent = le prof corrige : il pose les pastilles d'un clic */
  onMarque?: (genre: GenreMarque, id: string) => void;
  /** Propositions de l'aide IA (prof) */
  suggestions?: SuggestionsMarques;
  onSuggestion?: (ligneId: string) => void;
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
  const concepts = config.concepts ?? [];
  return diagramDeDepart(config.typeDepart, devoir.intitule || 'Mon schéma', {
    conceptCentral: config.conceptCentral,
    concepts: config.melanger ? melangerConcepts(concepts) : concepts,
  });
}

export default function SchemaActivity({ devoir, content, onChange, readOnly = false, exportRef, marques, onMarque, suggestions, onSuggestion }: Props) {
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
        marques={marques}
        onMarque={onMarque}
        suggestions={suggestions}
        onSuggestion={onSuggestion}
      />
    </div>
  );
}
