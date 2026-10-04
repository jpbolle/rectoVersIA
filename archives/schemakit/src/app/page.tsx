'use client';

/**
 * Accueil « Mes schémas » — les schémas enregistrés dans ce navigateur (maquette).
 * Nouveau schéma (choix du type et du titre), ouvrir, dupliquer, supprimer.
 */
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import buttons from '@/components/ui/buttons.module.css';
import { createDiagram, deleteDiagram, duplicateDiagram, listDiagrams, loadThumbnail, type SavedDiagramMeta } from '@/lib/local-store';
import { useMounted } from '@/lib/use-mounted';
import { DIAGRAM_TYPE_LABELS, type DiagramType } from '@/types/diagram';
import styles from './page.module.css';

const TYPES: { type: DiagramType; hint: string; soon?: boolean }[] = [
  { type: 'conceptmap', hint: 'Des concepts reliés par des mots de liaison.' },
  { type: 'mindmap', hint: 'Un sujet au centre, des branches autour.' },
  { type: 'hierarchy', hint: 'Un organigramme numéroté, de haut en bas.' },
  { type: 'timeline', hint: 'Des événements datés sur un axe, par étages.' },
];

export default function HomePage() {
  // Le stockage local n'existe que dans le navigateur : on ne lit rien avant d'être monté.
  const mounted = useMounted();
  return mounted ? <Home /> : null;
}

function Home() {
  const router = useRouter();
  const [list, setList] = useState<SavedDiagramMeta[]>(() => listDiagrams());
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<DiagramType>('conceptmap');
  const [newTitle, setNewTitle] = useState('');
  const [toDelete, setToDelete] = useState<SavedDiagramMeta | null>(null);

  const create = (e: FormEvent) => {
    e.preventDefault();
    const meta = createDiagram(newType, newTitle.trim() || 'Sans titre');
    router.push(`/atelier/${meta.id}`);
  };

  const duplicate = (id: string) => {
    duplicateDiagram(id);
    setList(listDiagrams());
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteDiagram(toDelete.id);
    setToDelete(null);
    setList(listDiagrams());
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.brand}>SchémaKit</h1>
          <p className={styles.tagline}>Mes schémas — enregistrés dans ce navigateur.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/atelier" className={`${buttons.button}`}>
            Bac à sable
          </Link>
          <button type="button" className={`${buttons.button} ${buttons.primary}`} onClick={() => setCreating(true)}>
            ＋ Nouveau schéma
          </button>
        </div>
      </header>

      {list.length === 0 && (
        <section className={styles.empty}>
          <p>Aucun schéma pour l&apos;instant.</p>
          <button type="button" className={`${buttons.button} ${buttons.primary}`} onClick={() => setCreating(true)}>
            Créer mon premier schéma
          </button>
        </section>
      )}

      {list.length > 0 && (
        <ul className={styles.grid}>
          {list.map((m) => (
            <li key={m.id} className={styles.card}>
              <Link href={`/atelier/${m.id}`} className={styles.thumbLink} aria-label={`Ouvrir « ${m.title} »`}>
                <Thumb id={m.id} />
              </Link>
              <div className={styles.cardBody}>
                <Link href={`/atelier/${m.id}`} className={styles.cardTitle}>
                  {m.title}
                </Link>
                <p className={styles.cardMeta}>
                  {DIAGRAM_TYPE_LABELS[m.type]} · {formatDate(m.updatedAt)}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button type="button" className={`${buttons.button} ${buttons.small}`} onClick={() => duplicate(m.id)} title="Dupliquer">
                  Dupliquer
                </button>
                <button type="button" className={`${buttons.button} ${buttons.small}`} onClick={() => setToDelete(m)} title="Supprimer">
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
            <button type="submit" form="new-diagram" className={`${buttons.button} ${buttons.primary}`}>
              Créer
            </button>
          </>
        }
      >
        <form id="new-diagram" onSubmit={create} className={styles.form}>
          <label className={styles.label}>
            Titre
            <input className={styles.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Le cycle de l'eau" autoFocus />
          </label>
          <div className={styles.typeGrid} role="radiogroup" aria-label="Type de schéma">
            {TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                role="radio"
                aria-checked={newType === t.type}
                className={styles.typeCard}
                data-active={newType === t.type || undefined}
                disabled={t.soon}
                onClick={() => setNewType(t.type)}
              >
                <strong>{DIAGRAM_TYPE_LABELS[t.type]}</strong>
                <span>{t.soon ? 'Bientôt' : t.hint}</span>
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
            <button type="button" className={`${buttons.button} ${buttons.danger}`} onClick={confirmDelete}>
              Supprimer
            </button>
          </>
        }
      >
        <p>
          « {toDelete?.title} » sera supprimé de ce navigateur. Cette action ne se rattrape pas.
        </p>
      </Modal>
    </main>
  );
}

function Thumb({ id }: { id: string }) {
  const [src] = useState<string | null>(() => loadThumbnail(id));
  // eslint-disable-next-line @next/next/no-img-element -- data URL locale, pas d'optimisation possible
  return src ? <img src={src} alt="" className={styles.thumb} /> : <div className={styles.thumbEmpty}>Aperçu à venir</div>;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}
