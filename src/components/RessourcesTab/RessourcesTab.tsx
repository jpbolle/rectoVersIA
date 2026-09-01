'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DictionaryPanel from '@/components/DictionaryPanel';
import { DrawToolbar, DrawCanvas } from '@/components/DrawTools/DrawTools';
import { parseYoutubeId, youtubeEmbedUrl } from '@/lib/youtube';
import { integrationAutorisee } from '@/lib/integration';
import type { DrawTool, DrawShape } from '@/types/draw';
import { normaliserVideos } from '@/types/devoir';
import type { Devoir } from '@/types/devoir';
import styles from './RessourcesTab.module.css';

const RessourceEditor = dynamic(
  () => import('@/components/RessourceEditor/RessourceEditor'),
  { ssr: false }
);

interface RessourcesTabProps {
  devoir: Devoir;
  ressourceAnnotations?: string;
  onRessourceAnnotationsChange?: (html: string) => void;
  ressourceNotes?: Record<string, string>;
  onRessourceNotesChange?: (notes: Record<string, string>) => void;
  /** Tracés de l'élève sur les images de ressources (clé = fileId) */
  ressourceImageShapes?: Record<string, DrawShape[]>;
  onRessourceImageShapesChange?: (shapes: Record<string, DrawShape[]>) => void;
  /** Annotations de l'élève (lecture seule pour le prof) */
  studentRessourceAnnotations?: string;
  studentRessourceNotes?: Record<string, string>;
  studentRessourceImageShapes?: Record<string, DrawShape[]>;
  /** Aide dictionnaire permanente (élève) — bloc affiché si le callback est fourni */
  dictionaryEnabled?: boolean;
  onDictionaryEnabledChange?: (value: boolean) => void;
}

// ── Image de ressource : atelier de tracé (élève) ou tracés en lecture seule (prof) ──
function RessourceImageWorkspace({
  url,
  name,
  shapes,
  onShapesChange,
}: {
  url: string;
  name: string;
  shapes: DrawShape[];
  onShapesChange?: (updater: (prev: DrawShape[]) => DrawShape[]) => void;
}) {
  const [tool, setTool] = useState<DrawTool>('select');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const readOnly = !onShapesChange;

  return (
    <figure className={styles.imageFigure}>
      {!readOnly && (
        <DrawToolbar
          tool={tool}
          setTool={setTool}
          hasSelection={selectedShapeId !== null}
          direction="horizontal"
        />
      )}
      <DrawCanvas
        imageUrl={url}
        alt={name}
        shapes={shapes}
        onShapesChange={onShapesChange}
        tool={tool}
        selectedShapeId={selectedShapeId}
        setSelectedShapeId={setSelectedShapeId}
        readOnly={readOnly}
      />
      <figcaption className={styles.imageCaption}>
        <button type="button" className={styles.imageZoomBtn} onClick={() => setZoomed(true)}>
          🔍
        </button>
        {name}
        {readOnly && shapes.length > 0 && (
          <span className={styles.imageShapesTag}>
            ✏️ {shapes.length} tracé{shapes.length > 1 ? 's' : ''} de l&apos;élève
          </span>
        )}
      </figcaption>
      {zoomed && (
        <div className={styles.imagePopup} onClick={() => setZoomed(false)}>
          <div className={styles.imagePopupInner} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.imagePopupClose} onClick={() => setZoomed(false)}>✕</button>
            <DrawCanvas
              imageUrl={url}
              alt={name}
              shapes={shapes}
              tool="select"
              selectedShapeId={null}
              setSelectedShapeId={() => {}}
              readOnly
            />
          </div>
        </div>
      )}
    </figure>
  );
}

// Fonction pour transformer les URLs en liens cliquables
function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset lastIndex car le regex est global
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Convertit le texte brut en paragraphes HTML pour Tiptap
function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => `<p>${line || '<br>'}</p>`)
    .join('');
}

// ── Sous-composant : vue lecture seule des annotations avec notes alignées ──
function AnnotatedReadOnly({
  html,
  notes,
}: {
  html: string;
  notes: Record<string, string>;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [paraPositions, setParaPositions] = useState<Array<{ top: number; height: number }>>([]);

  const measure = useCallback(() => {
    const contentEl = contentRef.current;
    const gutterEl = gutterRef.current;
    if (!contentEl || !gutterEl) return;

    const paras = contentEl.querySelectorAll(':scope > p');
    const gutterRect = gutterEl.getBoundingClientRect();

    const positions = Array.from(paras).map(p => {
      const rect = p.getBoundingClientRect();
      return {
        top: rect.top - gutterRect.top,
        height: rect.height,
      };
    });

    setParaPositions(positions);
  }, []);

  useEffect(() => {
    // Mesurer après le premier rendu
    requestAnimationFrame(() => requestAnimationFrame(measure));

    // Re-mesurer si la fenêtre change
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const hasNotes = Object.keys(notes).length > 0;

  return (
    <div className={styles.annotatedLayout}>
      {hasNotes && (
        <div className={styles.notesColumn} ref={gutterRef}>
          {paraPositions.map((pos, index) => {
            const noteText = notes[String(index)];
            if (!noteText) return null;
            return (
              <div
                key={index}
                className={styles.noteSlot}
                style={{ top: pos.top, minHeight: pos.height }}
              >
                <div className={styles.noteDisplay}>
                  <span className={styles.noteDisplayText}>{noteText}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div
        ref={contentRef}
        className={styles.annotatedContent}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── UN VOLET DÉPLIANT PAR RESSOURCE ──
//
// Le professeur peut joindre une image, trois vidéos et un document à la même
// activité : tout déplié, la colonne de droite devenait un rouleau où l'élève
// ne retrouvait rien. Chaque ressource porte donc désormais SON titre (celui
// que le prof lui donne) et s'ouvre à la demande.
//
// Les volets sont INDÉPENDANTS — ouvrir une image ne referme pas le document :
// un élève compare volontiers un texte et l'image dont il parle.
interface VoletRessource {
  cle: string;
  icone: string;
  titre: string;
  contenu: React.ReactNode;
  /**
   * Contenu qu'on ne démonte jamais, seulement caché. L'éditeur d'annotations
   * mesure la position de ses notes dans la marge : le démonter et le
   * remonter ferait sauter la gouttière. Il reste donc monté, replié.
   */
  garderMonte?: boolean;
}

function Volet({
  volet,
  ouvert,
  onBascule,
}: {
  volet: VoletRessource;
  ouvert: boolean;
  onBascule: () => void;
}) {
  return (
    <section className={styles.volet}>
      <button
        type="button"
        className={styles.voletEntete}
        onClick={onBascule}
        aria-expanded={ouvert}
      >
        <span className={styles.voletChevron} aria-hidden="true">
          {ouvert ? '▾' : '▸'}
        </span>
        <span className={styles.voletIcone} aria-hidden="true">{volet.icone}</span>
        <span className={styles.voletTitre}>{volet.titre}</span>
      </button>
      {volet.garderMonte ? (
        <div className={ouvert ? styles.voletCorps : styles.voletCorpsCache}>
          {volet.contenu}
        </div>
      ) : (
        ouvert && <div className={styles.voletCorps}>{volet.contenu}</div>
      )}
    </section>
  );
}

/** Les crans de zoom d'une animation. 1 (taille réelle) est le 4ᵉ. */
const PALIERS_ZOOM = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

export default function RessourcesTab({
  devoir,
  ressourceAnnotations,
  onRessourceAnnotationsChange,
  ressourceNotes,
  onRessourceNotesChange,
  ressourceImageShapes,
  onRessourceImageShapesChange,
  studentRessourceAnnotations,
  studentRessourceNotes,
  studentRessourceImageShapes,
  dictionaryEnabled = false,
  onDictionaryEnabledChange,
}: RessourcesTabProps) {
  // ── LE ZOOM D'UNE ANIMATION ──
  // On ne peut RIEN piloter à l'intérieur du cadre : le bac à sable coupe tout
  // accès au document, et c'est bien ce qu'on veut. Mais le cadre, lui, est à
  // nous : on agrandit la fenêtre interne (`100 / z` %) puis on la remet à la
  // taille du cadre (`scale(z)`). À 70 %, l'animation dispose d'une fenêtre
  // plus large et tient donc en entier ; à 150 %, d'une plus étroite, et le
  // détail devient lisible.
  //
  // Rien n'est enregistré : c'est un réglage de confort, pas une donnée.
  const [zooms, setZooms] = useState<Record<string, number>>({});

  // Ce que l'élève a ouvert ou refermé LUI-MÊME. Une clé absente veut dire
  // « il n'y a pas touché » : le premier volet est alors ouvert, les autres
  // repliés. Rien n'est enregistré — c'est un confort de lecture.
  const [replis, setReplis] = useState<Record<string, boolean>>({});
  const basculer = useCallback((cle: string, ouvertParDefaut: boolean) => {
    setReplis((r) => ({ ...r, [cle]: !(r[cle] ?? ouvertParDefaut) }));
  }, []);
  const zoomer = useCallback((id: string, sens: -1 | 1) => {
    setZooms((z) => {
      const courant = z[id] ?? 1;
      const rang = PALIERS_ZOOM.indexOf(courant);
      const suivant =
        PALIERS_ZOOM[Math.min(PALIERS_ZOOM.length - 1, Math.max(0, (rang < 0 ? 3 : rang) + sens))];
      return { ...z, [id]: suivant };
    });
  }, []);

  // Aide permanente : bloc dictionnaire au-dessus des ressources du prof
  const dictionaryBlock = onDictionaryEnabledChange ? (
    <DictionaryPanel enabled={dictionaryEnabled} onEnabledChange={onDictionaryEnabledChange} />
  ) : null;

  if (!devoir.ressources) {
    return (
      <div className={styles.container}>
        {dictionaryBlock}
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📚</span>
          <p className={styles.emptyText}>Aucune ressource fournie pour ce devoir.</p>
        </div>
      </div>
    );
  }

  // Determine content from new or legacy structure
  const outilsContent = devoir.ressources.outils ?? '';
  const documentContent = devoir.ressources.document ?? '';
  const legacyContent = devoir.ressources.content ?? '';
  const ressourceFiles = devoir.ressources.files ?? [];
  // Deux formes en base (adresse nue, ou objet avec titre) : `normaliserVideos`
  // les ramène à une seule. Voir src/types/devoir.ts.
  const ressourceVideos = normaliserVideos(devoir.ressources.videos).filter((v) =>
    parseYoutubeId(v.url)
  );
  const hasOutils = outilsContent.trim().length > 0;
  const hasDocument = documentContent.trim().length > 0 && documentContent !== '<p></p>';
  const hasLegacy = !hasOutils && !hasDocument && legacyContent.trim().length > 0;
  const hasFiles = ressourceFiles.length > 0;
  const hasVideos = ressourceVideos.length > 0;
  // Contenus interactifs : une page tierce (liste blanche) ou une animation
  // écrite par le professeur. Les adresses refusées sont écartées ICI aussi —
  // le serveur les a déjà filtrées à l'écriture, mais un document antérieur au
  // filtre pourrait en porter une.
  const ressourceInteractifs = (devoir.ressources.interactifs ?? []).filter((it) =>
    it.kind === 'code' ? !!it.code?.trim() : integrationAutorisee(it.url)
  );
  const hasInteractifs = ressourceInteractifs.length > 0;

  if (!hasOutils && !hasDocument && !hasLegacy && !hasFiles && !hasVideos && !hasInteractifs) {
    return (
      <div className={styles.container}>
        {dictionaryBlock}
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📚</span>
          <p className={styles.emptyText}>Aucune ressource fournie pour ce devoir.</p>
        </div>
      </div>
    );
  }

  // ── Images déposées par le prof ──
  // Atelier de tracé pour l'élève (comme le fluorage pour un texte) ; le prof
  // voit les tracés en lecture seule.
  const shapesSource = onRessourceImageShapesChange
    ? ressourceImageShapes
    : studentRessourceImageShapes;

  const volets: VoletRessource[] = [];

  ressourceFiles.forEach((file, index) => {
    const key = file.fileId || String(index);
    volets.push({
      cle: `image-${key}`,
      icone: '🖼️',
      // Sans titre du prof, le nom du fichier fait l'affaire — c'est ce qui
      // s'affichait avant les titres, rien ne se perd.
      titre: file.titre?.trim() || file.name,
      contenu: (
        <>
          {onRessourceImageShapesChange && (
            <p className={styles.filesHint}>
              Utilise les outils pour analyser l&apos;image — tes tracés sont enregistrés
              et visibles par ton professeur.
            </p>
          )}
          <RessourceImageWorkspace
            url={file.url}
            name={file.name}
            shapes={shapesSource?.[key] ?? []}
            onShapesChange={
              onRessourceImageShapesChange
                ? (updater) =>
                    onRessourceImageShapesChange({
                      ...(ressourceImageShapes ?? {}),
                      [key]: updater(ressourceImageShapes?.[key] ?? []),
                    })
                : undefined
            }
          />
        </>
      ),
    });
  });

  // Vidéos YouTube du prof — lecteurs intégrés (variante nocookie)
  ressourceVideos.forEach((video, index) => {
    const id = parseYoutubeId(video.url)!;
    volets.push({
      cle: `video-${id}-${index}`,
      icone: '🎬',
      titre: video.titre?.trim() || `Vidéo ${index + 1}`,
      contenu: (
        <div className={styles.videoFrame}>
          <iframe
            src={youtubeEmbedUrl(id)}
            title={video.titre?.trim() || `Vidéo ${index + 1}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ),
    });
  });

  // ── Contenus interactifs ──
  // ⚠️ Le bac à sable n'est pas décoratif. Une animation du professeur tourne
  // en `srcdoc` avec `allow-scripts` SEUL : y ajouter `allow-same-origin`
  // donnerait au code l'origine de l'application — il pourrait alors lire la
  // session Firebase de l'élève et appeler nos routes en son nom. Une page
  // TIERCE, elle, garde `allow-same-origin` : il désigne SA propre origine,
  // pas la nôtre, et sans lui la plupart des exerciseurs ne fonctionnent pas.
  ressourceInteractifs.forEach((it, index) => {
    const cadre: React.CSSProperties =
      it.kind === 'url' && it.proportions && it.ratio
        ? { aspectRatio: String(it.ratio) }
        : { height: `${it.hauteur || 520}px` };
    // Plafond de largeur — pour une page tierce comme pour une animation.
    if (it.largeur) cadre.maxWidth = `${it.largeur}px`;
    volets.push({
      cle: `interactif-${it.id}`,
      icone: '🧩',
      // La légende servait déjà de nom : elle EST le titre, rien à ressaisir.
      titre: it.legende?.trim() || `Contenu interactif ${index + 1}`,
      contenu: (
        <figure className={styles.interactifFigure}>
          <div className={styles.interactifCadre} style={cadre}>
            {it.kind === 'code' ? (
              <iframe
                srcDoc={it.code}
                title={it.legende || 'Animation'}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                style={{
                  width: `${100 / (zooms[it.id] ?? 1)}%`,
                  height: `${100 / (zooms[it.id] ?? 1)}%`,
                  // La largeur et la hauteur posées ici priment sur `inset: 0` :
                  // on neutralise les deux bords opposés pour que le cadre ne
                  // soit pas contraint des deux côtés à la fois.
                  right: 'auto',
                  bottom: 'auto',
                  transform: `scale(${zooms[it.id] ?? 1})`,
                  transformOrigin: 'top left',
                }}
              />
            ) : (
              <iframe
                src={it.url}
                title={it.legende || 'Contenu interactif'}
                allow="fullscreen; encrypted-media"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          <figcaption className={styles.interactifPied}>
            {/* Ouvrir EN GRAND, dans un onglet à part : une infographie se lit
                mal dans un cadre, et l'élève garde ainsi la page à côté de son
                travail. La page est servie en origine opaque — voir
                /api/ressources/interactif. */}
            {it.kind === 'code' && (
              <span className={styles.interactifZoom}>
                <button
                  type="button"
                  onClick={() => zoomer(it.id, -1)}
                  disabled={(zooms[it.id] ?? 1) === PALIERS_ZOOM[0]}
                  title="Voir l’ensemble"
                  aria-label="Dézoomer"
                >
                  −
                </button>
                <span className={styles.interactifZoomValeur}>
                  {Math.round((zooms[it.id] ?? 1) * 100)}&nbsp;%
                </span>
                <button
                  type="button"
                  onClick={() => zoomer(it.id, 1)}
                  disabled={(zooms[it.id] ?? 1) === PALIERS_ZOOM[PALIERS_ZOOM.length - 1]}
                  title="Voir le détail"
                  aria-label="Zoomer"
                >
                  +
                </button>
              </span>
            )}
            {it.kind === 'code' && (
              <a
                className={styles.interactifAgrandir}
                href={`/api/ressources/interactif/${devoir.id}/${it.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ Ouvrir en grand
              </a>
            )}
          </figcaption>
        </figure>
      ),
    });
  });

  if (hasOutils) {
    volets.push({
      cle: 'outils',
      icone: '🔧',
      titre: devoir.ressources.outilsTitre?.trim() || 'Outils',
      contenu: (
        <div className={styles.outilsText} dangerouslySetInnerHTML={{ __html: outilsContent }} />
      ),
    });
  }

  const titreDocument = devoir.ressources.documentTitre?.trim() || 'Document';

  // Mode eleve interactif with annotation editor: use legacy or document content
  if (onRessourceAnnotationsChange) {
    const textForEditor = hasDocument ? documentContent : legacyContent;
    const initialContent = ressourceAnnotations || (hasDocument ? textForEditor : textToHtml(textForEditor));

    if (hasDocument || hasLegacy) {
      volets.push({
        cle: 'document',
        icone: '📄',
        titre: titreDocument,
        // Jamais démonté : la gouttière de notes mesure sa position.
        garderMonte: true,
        contenu: (
          <RessourceEditor
            initialContent={initialContent}
            onChange={onRessourceAnnotationsChange}
            initialNotes={ressourceNotes || {}}
            onNotesChange={onRessourceNotesChange!}
          />
        ),
      });
    }

    return (
      <div className={styles.container}>
        {dictionaryBlock}
        {volets.map((v, i) => (
          <Volet
            key={v.cle}
            volet={v}
            ouvert={replis[v.cle] ?? i === 0}
            onBascule={() => basculer(v.cle, i === 0)}
          />
        ))}
      </div>
    );
  }

  // Mode lecture seule (prof preview)
  // Si le prof a les annotations de l'eleve, les afficher
  const hasStudentAnnotations = studentRessourceAnnotations && studentRessourceAnnotations.trim().length > 0;
  const hasStudentNotes = studentRessourceNotes && Object.keys(studentRessourceNotes).length > 0;

  if (hasStudentAnnotations || hasStudentNotes) {
    volets.push({
      cle: 'document',
      icone: '📄',
      titre: `${titreDocument} — annotations de l’élève`,
      contenu: (
        <AnnotatedReadOnly
          html={studentRessourceAnnotations || documentContent}
          notes={studentRessourceNotes || {}}
        />
      ),
    });
  } else if (hasDocument) {
    volets.push({
      cle: 'document',
      icone: '📄',
      titre: titreDocument,
      contenu: (
        <div
          className={styles.documentContent}
          dangerouslySetInnerHTML={{ __html: documentContent }}
        />
      ),
    });
  }

  if (hasLegacy && !hasStudentAnnotations) {
    volets.push({
      cle: 'legacy',
      icone: '📄',
      titre: titreDocument,
      contenu: <p className={styles.text}>{linkifyText(legacyContent)}</p>,
    });
  }

  return (
    <div className={styles.container}>
      {dictionaryBlock}
      {volets.map((v, i) => (
        <Volet
          key={v.cle}
          volet={v}
          ouvert={replis[v.cle] ?? i === 0}
          onBascule={() => basculer(v.cle, i === 0)}
        />
      ))}
    </div>
  );
}
