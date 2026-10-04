'use client';

/**
 * Un schéma enregistré (stockage local du navigateur — la maquette). Enregistrement
 * automatique différé après chaque modification, vignette rafraîchie un peu plus tard.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DiagramWorkspace } from '@/components/diagram/DiagramWorkspace';
import { loadDiagram, saveDiagram, saveThumbnail } from '@/lib/local-store';
import { useMounted } from '@/lib/use-mounted';
import type { DiagramExportHandle } from '@/lib/diagram-export';
import type { Diagram } from '@/types/diagram';
import styles from './page.module.css';

type SaveState = 'saved' | 'pending' | 'error';

export default function SavedDiagramPage() {
  const params = useParams<{ id: string }>();
  // Le stockage local n'existe que dans le navigateur : on ne lit rien avant d'être monté.
  const mounted = useMounted();
  return mounted ? <SavedDiagram id={params.id} /> : null;
}

function SavedDiagram({ id }: { id: string }) {
  const [diagram, setDiagram] = useState<Diagram | null>(() => loadDiagram(id));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const exportRef = useRef<DiagramExportHandle | null>(null);
  const saveTimer = useRef<number | null>(null);
  const thumbTimer = useRef<number | null>(null);
  const latest = useRef<Diagram | null>(null);

  const flush = useCallback(() => {
    if (!latest.current) return;
    setSaveState(saveDiagram(id, latest.current) ? 'saved' : 'error');
  }, [id]);

  const refreshThumbnail = useCallback(async () => {
    try {
      const url = await exportRef.current?.toPng({ maxWidth: 480, pixelRatio: 1 });
      if (url) saveThumbnail(id, url);
    } catch {
      /* pas de vignette : pas grave */
    }
  }, [id]);

  const onChange = useCallback(
    (next: Diagram) => {
      setDiagram(next);
      latest.current = next;
      setSaveState('pending');
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flush, 800);
      if (thumbTimer.current) window.clearTimeout(thumbTimer.current);
      thumbTimer.current = window.setTimeout(refreshThumbnail, 4000);
    },
    [flush, refreshThumbnail],
  );

  // En quittant la page : on enregistre ce qui est en attente.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  if (diagram === null) {
    return (
      <main className={styles.missing}>
        <h1>Schéma introuvable</h1>
        <p>Il a peut-être été supprimé, ou il vient d&apos;un autre navigateur (les schémas de la maquette restent dans ce navigateur).</p>
        <Link href="/">← Mes schémas</Link>
      </main>
    );
  }

  const status = saveState === 'saved' ? 'Enregistré dans ce navigateur' : saveState === 'pending' ? 'Enregistrement…' : 'Enregistrement impossible (stockage plein ?)';
  return <DiagramWorkspace diagram={diagram} onChange={onChange} backHref="/" status={status} exportRef={exportRef} />;
}
