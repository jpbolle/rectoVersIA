'use client';

// Un schéma personnel de l'élève, en plein écran : l'espace de travail SchémaKit
// (colonne titre/consignes à gauche, éditeur, volet du bas). Enregistrement
// automatique différé (0,8 s) sur /api/schemas/personnel/[id], vignette PNG
// rafraîchie un peu plus tard (4 s). Retour : Mes ressources › Mes schémas.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { DiagramWorkspace } from '@/components/Diagram/DiagramWorkspace';
import type { DiagramExportHandle } from '@/lib/diagram/diagram-export';
import type { Diagram } from '@/types/diagram';
import styles from './page.module.css';

type SaveState = 'saved' | 'pending' | 'error';
const SAVE_DELAY = 800;
const THUMB_DELAY = 4000;

export default function SchemaPersonnelPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, getAuthHeaders } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [diagram, setDiagram] = useState<Diagram | null | undefined>(undefined); // undefined = chargement
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const exportRef = useRef<DiagramExportHandle | null>(null);
  const saveTimer = useRef<number | null>(null);
  const thumbTimer = useRef<number | null>(null);
  const latest = useRef<Diagram | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (redirecting) return;
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      setRedirecting(true);
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, redirecting, router]);

  // Chargement
  useEffect(() => {
    if (!isAuthenticated || !params.id) return;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/schemas/personnel/${params.id}`, { headers });
        const json = await res.json();
        if (!json.success) throw new Error();
        latest.current = json.data.diagram as Diagram;
        setDiagram(json.data.diagram as Diagram);
      } catch {
        setDiagram(null);
      }
    })();
  }, [isAuthenticated, params.id, getAuthHeaders]);

  const flush = useCallback(async () => {
    if (!latest.current || !dirty.current) return;
    dirty.current = false;
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error();
      const res = await fetch(`/api/schemas/personnel/${params.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagram: latest.current }),
      });
      const json = await res.json();
      if (!json.success) throw new Error();
      setSaveState('saved');
    } catch {
      dirty.current = true;
      setSaveState('error');
    }
  }, [getAuthHeaders, params.id]);

  const refreshThumbnail = useCallback(async () => {
    try {
      const url = await exportRef.current?.toPng({ maxWidth: 480, pixelRatio: 1 });
      if (!url) return;
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`/api/schemas/personnel/${params.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnail: url }),
      });
    } catch {
      /* pas de vignette : pas grave */
    }
  }, [getAuthHeaders, params.id]);

  const onChange = useCallback(
    (next: Diagram) => {
      setDiagram(next);
      latest.current = next;
      dirty.current = true;
      setSaveState('pending');
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flush, SAVE_DELAY);
      if (thumbTimer.current) window.clearTimeout(thumbTimer.current);
      thumbTimer.current = window.setTimeout(refreshThumbnail, THUMB_DELAY);
    },
    [flush, refreshThumbnail],
  );

  // En quittant la page : on enregistre ce qui est en attente.
  useEffect(() => {
    const onHide = () => {
      flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  if (redirecting) return null;

  if (diagram === undefined) {
    return <main className={styles.missing}>Chargement du schéma…</main>;
  }
  if (diagram === null) {
    return (
      <main className={styles.missing}>
        <h1>Schéma introuvable</h1>
        <p>Il a peut-être été supprimé.</p>
        <Link href="/mes-ressources">← Mes ressources</Link>
      </main>
    );
  }

  const status = saveState === 'saved' ? 'Enregistré' : saveState === 'pending' ? 'Enregistrement…' : 'Enregistrement impossible — vérifie ta connexion';
  return (
    <div className={styles.page}>
      <DiagramWorkspace diagram={diagram} onChange={onChange} backHref="/mes-ressources" status={status} exportRef={exportRef} />
    </div>
  );
}
