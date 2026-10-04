'use client';

/**
 * L'espace de travail complet d'un schéma : colonne de gauche (1/5 : titre, consignes),
 * à droite (4/5) le sélecteur de type, l'éditeur du type courant et le volet du bas
 * (Outils · Markdown · À placer, quadrillage, PNG, PDF).
 * Il tient l'état d'édition ; la persistance (stockage local, plus tard Recto-versIA)
 * est l'affaire du parent via `onChange`.
 */
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import {
  DIAGRAM_TYPE_LABELS,
  effectiveBox,
  effectiveLine,
  type BoxStyle,
  type ColorRef,
  type Diagram,
  type DiagramType,
  type LineStyle,
} from '@/types/diagram';
import { fromMarkdown, toMarkdown } from '@/lib/diagram-markdown';
import { transformDiagram } from '@/lib/diagram-transform';
import { isTreeType, rootOf } from '@/lib/tree';
import { downloadDataUrl, printDataUrl, safeFilename, type DiagramExportHandle } from '@/lib/diagram-export';
import { readPreference, subscribePreferences, writePreference } from '@/lib/local-store';
import { ConceptMapEditor } from './ConceptMapEditor';
import { TreeEditor } from './TreeEditor';
import { TimelineEditor } from './TimelineEditor';
import { BottomPanel, type BottomTab } from './BottomPanel';
import { StylePanel, type StyleTarget } from './StylePanel';
import { MarkdownPanel } from './MarkdownPanel';
import { PendingPanel } from './PendingPanel';
import { EMPTY_SELECTION, type EditorSelection } from './editor-types';
import styles from './DiagramWorkspace.module.css';

const TYPES: DiagramType[] = ['conceptmap', 'mindmap', 'hierarchy', 'timeline'];

const HELP: Record<DiagramType, string[]> = {
  conceptmap: [
    'Double-clic sur une boîte pour écrire dedans.',
    "Tire un lien depuis un point d'accroche vers une autre boîte.",
    'Clique sur un lien pour écrire le mot de liaison.',
  ],
  mindmap: ['Double-clic sur une idée pour la modifier.', 'Tab ajoute une idée enfant, Entrée une idée sœur.', 'La disposition est automatique.'],
  hierarchy: ['Double-clic sur une idée pour la modifier.', 'Tab ajoute une idée enfant, Entrée une idée sœur.', 'La numérotation se calcule toute seule.'],
  timeline: [
    'Ajouter un événement : titre, date (1815, 1815-06-18, -52), fin facultative, étage.',
    'Double-clic sur un événement pour le modifier ; clic sur le nom d’un étage pour le régler.',
    'La position se calcule à partir des dates : rien à déplacer.',
  ],
};

interface Props {
  diagram: Diagram;
  onChange: (diagram: Diagram) => void;
  /** Consignes affichées dans la colonne de gauche (sinon : aide du type courant). */
  instructions?: ReactNode;
  /** Ligne d'état sous le titre (« Enregistré », « Page de test »…). */
  status?: ReactNode;
  backHref?: string;
  readOnly?: boolean;
  /** Pour que le parent puisse produire une vignette. */
  exportRef?: RefObject<DiagramExportHandle | null>;
}

export function DiagramWorkspace({ diagram, onChange, instructions, status, backHref, readOnly = false, exportRef: externalRef }: Props) {
  // `revision` force l'éditeur de carte conceptuelle à relire `diagram` (import, transformation, style).
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<EditorSelection>(EMPTY_SELECTION);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<BottomTab>('style');
  const [message, setMessage] = useState('');
  // Préférence d'affichage lue dans le navigateur (quadrillé par défaut).
  const grid = useSyncExternalStore(subscribePreferences, () => readPreference('grid', true), () => true);
  const [withPositions, setWithPositions] = useState(false);
  // null = le texte suit le schéma ; sinon l'utilisateur est en train de le modifier.
  const [draft, setDraft] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const ownRef = useRef<DiagramExportHandle | null>(null);
  const exportRef = externalRef ?? ownRef;

  const changeGrid = (v: boolean) => writePreference('grid', v);

  const openTools = useCallback(() => {
    setPanelOpen(true);
    setTab('style');
  }, []);

  /** Toute modification venue d'ailleurs que de l'éditeur lui-même. */
  const replace = useCallback(
    (next: Diagram) => {
      onChange(next);
      setRevision((r) => r + 1);
    },
    [onChange],
  );

  // ─── Markdown ────────────────────────────────────────────────────────────
  const markdown = useMemo(() => toMarkdown(diagram, { withPositions }), [diagram, withPositions]);
  const text = draft ?? markdown;

  const applyMarkdown = () => {
    try {
      const result = fromMarkdown(text, diagram);
      replace(result.diagram);
      setDraft(null);
      setMessage(result.warnings.length ? result.warnings.join(' ') : 'Schéma reconstruit depuis le Markdown.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Markdown illisible.');
    }
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setMessage('Markdown copié dans le presse-papiers.');
    } catch {
      setMessage('Copie impossible : sélectionne le texte et copie-le à la main.');
    }
  };

  // ─── Type ────────────────────────────────────────────────────────────────
  const switchType = (type: DiagramType) => {
    if (type === diagram.type) return;
    try {
      const result = transformDiagram(diagram, type);
      replace(result.diagram);
      setDraft(null);
      setSelection(EMPTY_SELECTION);
      const pendingAdded = (result.diagram.pending?.length ?? 0) - (diagram.pending?.length ?? 0);
      if (pendingAdded > 0) setTab('pending');
      setMessage(result.warnings.length ? result.warnings.join(' ') : `Transformé en ${DIAGRAM_TYPE_LABELS[type].toLowerCase()}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Transformation impossible.');
    }
  };

  // ─── Titre ───────────────────────────────────────────────────────────────
  const root = isTreeType(diagram.type) ? rootOf(diagram.nodes) : undefined;
  const title = root ? root.label : diagram.title;
  const renameTitle = (value: string) => {
    if (root) {
      replace({ ...diagram, title: value, nodes: diagram.nodes.map((n) => (n.id === root.id ? { ...n, label: value } : n)) });
    } else {
      replace({ ...diagram, title: value });
    }
  };

  // ─── Style de la sélection ───────────────────────────────────────────────
  const selectedNodes = diagram.nodes.filter((n) => selection.nodeIds.includes(n.id));
  const selectedEdges = diagram.edges.filter((e) => selection.edgeIds.includes(e.id));
  const treeBranchNodes = isTreeType(diagram.type) ? selectedNodes.filter((n) => n.parentId) : [];

  const target: StyleTarget = (() => {
    if (selectedNodes.length) {
      const first = selectedNodes[0];
      const count = selectedNodes.length;
      const t: StyleTarget = {
        title: count === 1 ? `Boîte « ${first.label || 'sans texte'} »` : `${count} boîtes sélectionnées`,
        fill: first.color ?? 'yellow',
        box: effectiveBox(first.box, diagram),
      };
      if (treeBranchNodes.length) {
        t.line = effectiveLine(treeBranchNodes[0].branch, diagram);
        t.lineLabel = count === 1 ? 'Branche vers le parent' : 'Branches';
      }
      return t;
    }
    if (selectedEdges.length) {
      const first = selectedEdges[0];
      return {
        title: selectedEdges.length === 1 ? `Lien${first.label ? ` « ${first.label} »` : ''}` : `${selectedEdges.length} liens sélectionnés`,
        line: effectiveLine(first.line, diagram),
        lineLabel: 'Lien',
      };
    }
    return {
      title: 'Rien de sélectionné : réglages par défaut du schéma (clique sur une boîte ou un lien pour le styler).',
      box: effectiveBox(undefined, diagram),
      line: effectiveLine(undefined, diagram),
      lineLabel: isTreeType(diagram.type) ? 'Branches' : 'Liens',
      ...(diagram.type === 'timeline' ? { line: undefined } : {}),
    };
  })();

  const applyFill = (color: ColorRef) => {
    if (!selectedNodes.length) return;
    replace({ ...diagram, nodes: diagram.nodes.map((n) => (selection.nodeIds.includes(n.id) ? { ...n, color } : n)) });
  };
  const applyBox = (patch: BoxStyle) => {
    if (selectedNodes.length) {
      replace({ ...diagram, nodes: diagram.nodes.map((n) => (selection.nodeIds.includes(n.id) ? { ...n, box: { ...n.box, ...patch } } : n)) });
    } else {
      replace({ ...diagram, defaults: { ...diagram.defaults, box: { ...diagram.defaults?.box, ...patch } } });
    }
  };
  const applyLine = (patch: LineStyle) => {
    if (selectedEdges.length) {
      replace({ ...diagram, edges: diagram.edges.map((e) => (selection.edgeIds.includes(e.id) ? { ...e, line: { ...e.line, ...patch } } : e)) });
    } else if (treeBranchNodes.length) {
      const ids = new Set(treeBranchNodes.map((n) => n.id));
      replace({ ...diagram, nodes: diagram.nodes.map((n) => (ids.has(n.id) ? { ...n, branch: { ...n.branch, ...patch } } : n)) });
    } else if (!selectedNodes.length) {
      replace({ ...diagram, defaults: { ...diagram.defaults, line: { ...diagram.defaults?.line, ...patch } } });
    }
  };

  // ─── À placer ────────────────────────────────────────────────────────────
  const pending = diagram.pending ?? [];
  const removeTag = (tag: string) => {
    const i = pending.indexOf(tag);
    if (i < 0) return;
    const next = [...pending.slice(0, i), ...pending.slice(i + 1)];
    onChange({ ...diagram, pending: next.length ? next : undefined });
  };
  // L'onglet « À placer » disparaît avec son dernier tag : on retombe sur « Outils ».
  const activeTab: BottomTab = tab === 'pending' && pending.length === 0 ? 'style' : tab;

  // ─── Export ──────────────────────────────────────────────────────────────
  const exportPng = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const url = await exportRef.current.toPng();
      downloadDataUrl(url, safeFilename(title, 'png'));
      setMessage('Image PNG téléchargée.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Export impossible.');
    } finally {
      setExporting(false);
    }
  };
  const exportPdf = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const url = await exportRef.current.toPng();
      if (!printDataUrl(url, title || 'Schéma')) setMessage('Fenêtre bloquée : autorise les fenêtres surgissantes pour imprimer.');
      else setMessage("Dans la fenêtre d'impression, choisis « Enregistrer en PDF ».");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Export impossible.');
    } finally {
      setExporting(false);
    }
  };

  const consumeTag = useCallback(
    (tag: string) => {
      const list = diagram.pending ?? [];
      const i = list.indexOf(tag);
      if (i < 0) return;
      const next = [...list.slice(0, i), ...list.slice(i + 1)];
      onChange({ ...diagram, pending: next.length ? next : undefined });
    },
    [diagram, onChange],
  );

  return (
    <div className={styles.page}>
      <aside className={styles.side}>
        {backHref && (
          <Link href={backHref} className={styles.back}>
            ← Mes schémas
          </Link>
        )}
        <p className={styles.kicker}>{DIAGRAM_TYPE_LABELS[diagram.type]}</p>
        {readOnly ? (
          <h1 className={styles.title}>{title || 'Sans titre'}</h1>
        ) : (
          <textarea
            className={styles.titleInput}
            value={title}
            rows={1}
            placeholder="Titre du schéma"
            onChange={(e) => renameTitle(e.target.value.replace(/\n/g, ' '))}
            aria-label="Titre du schéma"
          />
        )}
        {status && <p className={styles.status}>{status}</p>}
        <div className={styles.instructions}>
          {instructions ?? (
            <>
              <p className={styles.sectionLabel}>Comment faire</p>
              <ul className={styles.tips}>
                {HELP[diagram.type].map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>

      <section className={styles.workspace}>
        {!readOnly && (
          <div className={styles.typeBar} role="tablist" aria-label="Type de schéma">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={diagram.type === t}
                className={styles.typeButton}
                data-active={diagram.type === t || undefined}
                onClick={() => switchType(t)}
              >
                {DIAGRAM_TYPE_LABELS[t]}
              </button>
            ))}
            <span className={styles.typeHint}>Changer de type transforme le schéma ; ce qui ne passe pas va dans « À placer ».</span>
          </div>
        )}
        <div className={styles.editor}>
          {diagram.type === 'timeline' ? (
            <TimelineEditor
              diagram={diagram}
              onChange={onChange}
              grid={grid}
              readOnly={readOnly}
              onSelectionChange={setSelection}
              exportRef={exportRef}
              onOpenTools={openTools}
            />
          ) : isTreeType(diagram.type) ? (
            <TreeEditor
              diagram={diagram}
              onChange={onChange}
              grid={grid}
              readOnly={readOnly}
              onSelectionChange={setSelection}
              exportRef={exportRef}
              onOpenTools={openTools}
            />
          ) : (
            <ConceptMapEditor
              diagram={diagram}
              revision={revision}
              onChange={onChange}
              grid={grid}
              readOnly={readOnly}
              onSelectionChange={setSelection}
              exportRef={exportRef}
              onConsumeTag={consumeTag}
              onOpenTools={openTools}
            />
          )}
        </div>
        {!readOnly && (
          <BottomPanel
            open={panelOpen}
            onToggle={() => setPanelOpen((o) => !o)}
            tab={activeTab}
            onTab={setTab}
            pendingCount={pending.length}
            message={message}
            grid={grid}
            onGrid={changeGrid}
            onPng={exportPng}
            onPdf={exportPdf}
            exporting={exporting}
          >
            {activeTab === 'style' && <StylePanel target={target} onFill={applyFill} onBox={applyBox} onLine={applyLine} />}
            {activeTab === 'markdown' && (
              <MarkdownPanel
                text={text}
                dirty={draft !== null}
                withPositions={withPositions}
                onWithPositions={setWithPositions}
                onEdit={(t) => {
                  setDraft(t);
                  setMessage('');
                }}
                onCancel={() => setDraft(null)}
                onApply={applyMarkdown}
                onCopy={copyMarkdown}
              />
            )}
            {activeTab === 'pending' && <PendingPanel tags={pending} onRemove={removeTag} />}
          </BottomPanel>
        )}
      </section>
    </div>
  );
}
