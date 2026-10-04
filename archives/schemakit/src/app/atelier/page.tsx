'use client';

/**
 * Bac à sable de l'éditeur — route PROVISOIRE, sans enregistrement. Sert à tester et à
 * capturer (`?type=mindmap`). Les schémas enregistrés vivent sur `/atelier/[id]`.
 */
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DiagramWorkspace } from '@/components/diagram/DiagramWorkspace';
import { transformDiagram } from '@/lib/diagram-transform';
import type { Diagram, DiagramType } from '@/types/diagram';

const TYPES: DiagramType[] = ['conceptmap', 'mindmap', 'hierarchy', 'timeline'];

function sampleDiagram(): Diagram {
  return {
    type: 'conceptmap',
    title: "Le cycle de l'eau",
    nodes: [
      { id: 'n1', label: 'Soleil', x: 0, y: 0, color: 'orange' },
      { id: 'n2', label: 'Évaporation', x: 260, y: 0, color: 'blue' },
      { id: 'n3', label: 'Nuages', x: 260, y: 160, color: 'white' },
      { id: 'n4', label: 'Pluie', x: 520, y: 160 },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', label: 'provoque' },
      { id: 'e2', source: 'n2', target: 'n3', label: 'forme' },
      { id: 'e3', source: 'n3', target: 'n4', label: 'donne' },
      { id: 'e4', source: 'n1', target: 'n4', label: 'chauffe' },
    ],
  };
}

function sampleTimeline(): Diagram {
  return {
    type: 'timeline',
    title: 'La Belgique au XIXe siècle',
    lanes: [
      { id: 'l1', label: 'Politique', side: 'above', color: 'blue' },
      { id: 'l2', label: 'Économie', side: 'below', color: 'yellow' },
    ],
    nodes: [
      { id: 't1', label: 'Congrès de Vienne', x: 0, y: 0, date: '1815', laneId: 'l1' },
      { id: 't2', label: 'Révolution belge', x: 0, y: 0, date: '1830-08-25', endDate: '1831-07-21', laneId: 'l1', color: 'pink' },
      { id: 't3', label: 'Constitution', x: 0, y: 0, date: '1831-02-07', laneId: 'l1' },
      { id: 't4', label: 'Première ligne de chemin de fer', x: 0, y: 0, date: '1835-05-05', laneId: 'l2' },
      { id: 't5', label: 'Crise industrielle', x: 0, y: 0, date: '1846', endDate: '1849', laneId: 'l2' },
      { id: 't6', label: 'Loi sur l’instruction', x: 0, y: 0, date: '1842' },
    ],
    edges: [],
  };
}

function initialDiagram(wanted: string | null): Diagram {
  if (wanted === 'timeline') return sampleTimeline();
  const sample = sampleDiagram();
  if (wanted && TYPES.includes(wanted as DiagramType)) return transformDiagram(sample, wanted as DiagramType).diagram;
  return sample;
}

export default function AtelierPage() {
  // useSearchParams exige une frontière Suspense dans l'App Router.
  return (
    <Suspense fallback={null}>
      <Sandbox />
    </Suspense>
  );
}

function Sandbox() {
  const params = useSearchParams();
  const [diagram, setDiagram] = useState<Diagram>(() => initialDiagram(params.get('type')));
  return (
    <DiagramWorkspace
      diagram={diagram}
      onChange={setDiagram}
      backHref="/"
      status="Bac à sable : rien n'est enregistré."
      instructions={
        <>
          <p>
            Complète la carte : ajoute <strong>Rivières</strong> et <strong>Océan</strong>, puis relie-les aux autres avec un mot de
            liaison (« alimente », « retourne à »…).
          </p>
          <p>Essaie ensuite les autres types de schéma : « Pluie » a deux parents, il y aura quelque chose « à placer ».</p>
        </>
      }
    />
  );
}
