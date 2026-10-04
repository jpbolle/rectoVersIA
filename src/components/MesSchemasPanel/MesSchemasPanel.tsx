'use client';

// « Mes schémas » — onglet de Mes ressources (élève) : les cartes que l'élève
// construit pour lui-même, sans activité ni base documentaire (décision JP du
// 2026-10-04). Vignettes, nouveau schéma (type + titre), ouvrir, dupliquer,
// supprimer (popup de l'app, jamais `confirm()`). Les données passent par
// /api/schemas/personnel ; l'édition se fait sur /mes-ressources/schemas/[id].
// Repris de l'accueil de la maquette SchémaKit (stockage local → Firestore).

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import { Modal } from '@/components/Diagram/ui/Modal';
import buttons from '@/components/Diagram/ui/buttons.module.css';
import { DIAGRAM_TYPES, DIAGRAM_TYPE_LABELS, type DiagramType } from '@/types/diagram';
import type { SchemaPersonnelMeta } from '@/lib/schemas-personnels';
import styles from './MesSchemasPanel.module.css';

const HINTS: Record<DiagramType, string> = {
  conceptmap: 'Des concepts reliés par des mots de liaison.',
  libre: 'Des formes et des flèches, comme sur un tableau blanc.',
  mindmap: 'Un sujet au centre, des branches autour.',
  hierarchy: 'Un organigramme numéroté, de haut en bas.',
  timeline: 'Des événements datés sur un axe, par étages.',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MesSchemasPanel() {
  const { getAuthHeaders } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<SchemaPersonnelMeta[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<DiagramType>('conceptmap');
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<SchemaPersonnelMeta | null>(null);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/schemas/personnel', { headers });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || json.message);
      setList(json.data as SchemaPersonnelMeta[]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur réseau');
      setList([]);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    charger();
  }, [charger]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/schemas/personnel', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, titre: newTitle.trim() || 'Sans titre' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || json.message);
      router.push(`/mes-ressources/schemas/${json.data.id}`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur réseau');
      setBusy(false);
    }
  };

  const duplicate = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/schemas/personnel', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicateOf: id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || json.message);
      await charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete || busy) return;
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`/api/schemas/personnel/${toDelete.id}`, { method: 'DELETE', headers });
      setToDelete(null);
      await charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.entete}>
        <p className={styles.note}>
          Tes cartes à toi : carte conceptuelle, schéma libre, carte mentale, schéma hiérarchisé, ligne du temps.
          Tu peux changer de type en cours de route.
        </p>
        <button type="button" className={`${buttons.button} ${buttons.primary}`} onClick={() => setCreating(true)}>
          ＋ Nouveau schéma
        </button>
      </div>

      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {list === null ? (
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : list.length === 0 ? (
        <div className={styles.vide}>
          <EmptyState icon="🗺️" message="Aucun schéma pour le moment." />
          <button type="button" className={`${buttons.button} ${buttons.primary}`} onClick={() => setCreating(true)}>
            Créer mon premier schéma
          </button>
        </div>
      ) : (
        <ul className={styles.grid}>
          {list.map((m) => (
            <li key={m.id} className={styles.card}>
              <Link href={`/mes-ressources/schemas/${m.id}`} className={styles.thumbLink} aria-label={`Ouvrir « ${m.titre} »`}>
                {m.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL, pas d'optimisation possible
                  <img src={m.thumbnail} alt="" className={styles.thumb} />
                ) : (
                  <div className={styles.thumbEmpty}>Aperçu à venir</div>
                )}
              </Link>
              <div className={styles.cardBody}>
                <Link href={`/mes-ressources/schemas/${m.id}`} className={styles.cardTitle}>
                  {m.titre}
                </Link>
                <p className={styles.cardMeta}>
                  {DIAGRAM_TYPE_LABELS[m.type]} · {formatDate(m.updatedAt)}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button type="button" className={`${buttons.button} ${buttons.small}`} disabled={busy} onClick={() => duplicate(m.id)} title="Dupliquer">
                  Dupliquer
                </button>
                <button type="button" className={`${buttons.button} ${buttons.small}`} disabled={busy} onClick={() => setToDelete(m)} title="Supprimer">
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={creating}
        title="Nouveau schéma"
        onClose={() => setCreating(false)}
        actions={
          <>
            <button type="button" className={buttons.button} onClick={() => setCreating(false)}>
              Annuler
            </button>
            <button type="submit" form="new-schema" className={`${buttons.button} ${buttons.primary}`} disabled={busy}>
              Créer
            </button>
          </>
        }
      >
        <form id="new-schema" onSubmit={create} className={styles.form}>
          <label className={styles.label}>
            Titre
            <input className={styles.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Le cycle de l’eau" autoFocus />
          </label>
          <div className={styles.typeGrid} role="radiogroup" aria-label="Type de schéma">
            {DIAGRAM_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={newType === t}
                className={styles.typeCard}
                data-active={newType === t || undefined}
                onClick={() => setNewType(t)}
              >
                <strong>{DIAGRAM_TYPE_LABELS[t]}</strong>
                <span>{HINTS[t]}</span>
              </button>
            ))}
          </div>
        </form>
      </Modal>

      <Modal
        open={toDelete !== null}
        title="Supprimer ce schéma ?"
        onClose={() => setToDelete(null)}
        actions={
          <>
            <button type="button" className={buttons.button} onClick={() => setToDelete(null)}>
              Annuler
            </button>
            <button type="button" className={`${buttons.button} ${buttons.danger}`} disabled={busy} onClick={confirmDelete}>
              Supprimer
            </button>
          </>
        }
      >
        <p>« {toDelete?.titre} » sera supprimé. Cette action ne se rattrape pas.</p>
      </Modal>
    </div>
  );
}
