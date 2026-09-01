'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/image-compress';
import { parseYoutubeId, youtubeEmbedUrl } from '@/lib/youtube';
import { normaliserVideos } from '@/types/devoir';
import type {
  DevoirRessource,
  RessourceFile,
  RessourceInteractif,
  RessourceVideo,
} from '@/types/devoir';
import {
  integrationAutorisee,
  proportionsDepuisIntegration,
  TAILLE_MAX_CODE,
  urlDepuisIntegration,
} from '@/lib/integration';
import styles from './RessourcesInput.module.css';

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

const DocumentEditor = dynamic<EditorProps>(
  () => import('./DocumentEditor'),
  { ssr: false, loading: () => <div className={styles.editorLoading}>Chargement...</div> }
);

type RessourceTab = 'fichier' | 'lien' | 'texte' | 'video' | 'interactif';

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp';

interface RessourcesInputProps {
  ressources: DevoirRessource | null;
  onRessourcesChange: (ressources: DevoirRessource | null) => void;
  disabled?: boolean;
}

// Vide si aucun texte réel (une liste à puces vide ou un paragraphe vide comptent comme vides)
function isEmptyHtml(html: string): boolean {
  if (!html) return true;
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

// ── Conversion du champ Lien (une URL par ligne) ↔ HTML stocké ──

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// HTML stocké (liste ou paragraphes) → une ligne par entrée pour le textarea
function htmlToLines(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(li|p)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

// Lignes du textarea → liste à puces HTML, chaque URL devient un lien cliquable
function linesToHtml(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const items = lines.map((line) => {
    const isUrl = /^https?:\/\//i.test(line) || /^www\./i.test(line);
    if (isUrl) {
      const href = /^https?:\/\//i.test(line) ? line : `https://${line}`;
      return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="editor-link">${escapeHtml(line)}</a></li>`;
    }
    return `<li>${escapeHtml(line)}</li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

/** Une ligne d'interactif est-elle alimentée ? (adresse ou code saisi) */
function interactifRempli(it: RessourceInteractif): boolean {
  return it.kind === 'code' ? !!it.code?.trim() : !!(it.url ?? '').trim();
}

function nouvelInteractif(): RessourceInteractif {
  return {
    id: `INT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'url',
    url: '',
    hauteur: 520,
  };
}

// Reconstruit l'objet ressources — null si tous les onglets sont vides
function buildRessource(
  outils: string,
  document: string,
  files: RessourceFile[],
  videos: RessourceVideo[],
  interactifs: RessourceInteractif[] = [],
  titres: { outils?: string; document?: string } = {},
): DevoirRessource | null {
  const outilsEmpty = isEmptyHtml(outils);
  const docEmpty = isEmptyHtml(document);
  if (
    outilsEmpty &&
    docEmpty &&
    files.length === 0 &&
    videos.length === 0 &&
    interactifs.length === 0
  ) {
    return null;
  }
  // Firestore refuse `undefined` : un titre vide n'est tout simplement pas posé.
  return {
    type: 'text',
    content: outilsEmpty ? '' : outils,
    outils: outilsEmpty ? '' : outils,
    document: docEmpty ? '' : document,
    files,
    videos,
    interactifs,
    ...(titres.outils?.trim() ? { outilsTitre: titres.outils.trim() } : {}),
    ...(titres.document?.trim() ? { documentTitre: titres.document.trim() } : {}),
  };
}

export default function RessourcesInput({
  ressources,
  onRessourcesChange,
  disabled = false,
}: RessourcesInputProps) {
  const { getAuthHeaders, isAdmin } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<RessourceTab>('fichier');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Image affichée en grand dans la popup (null = fermée)
  const [previewFile, setPreviewFile] = useState<RessourceFile | null>(null);

  const outilsValue = ressources?.outils ?? ressources?.content ?? '';
  const documentValue = ressources?.document ?? '';
  const filesValue = ressources?.files ?? [];
  // Normalisées à la lecture : une activité d'avant les titres porte de
  // simples adresses (cf. `normaliserVideos`). On n'écrit plus que des objets.
  // Mémoïsé : `normaliserVideos` rend un tableau NEUF à chaque appel, et ce
  // tableau est dans les dépendances d'une dizaine de callbacks (cf. la règle
  // des objets instables, AGENTS.md).
  const videosValue = useMemo(() => normaliserVideos(ressources?.videos), [ressources?.videos]);
  const outilsTitre = ressources?.outilsTitre ?? '';
  const documentTitre = ressources?.documentTitre ?? '';
  const interactifsValue = ressources?.interactifs ?? [];

  const hasFichier = filesValue.length > 0;
  const hasLien = !isEmptyHtml(outilsValue);
  const hasTexte = !isEmptyHtml(documentValue);
  const hasVideo = videosValue.length > 0;
  const hasInteractif = interactifsValue.length > 0;

  // Champ Lien : texte brut du textarea (une URL par ligne), resynchronisé
  // quand la valeur externe change (réinitialisation, ouverture du modal)
  const [lienText, setLienText] = useState(() => htmlToLines(outilsValue));
  const lienTextRef = useRef(lienText);
  lienTextRef.current = lienText;

  useEffect(() => {
    const external = htmlToLines(outilsValue);
    const localNormalized = htmlToLines(linesToHtml(lienTextRef.current));
    if (external !== localNormalized) {
      setLienText(external);
    }
  }, [outilsValue]);

  const handleLienChange = useCallback(
    (text: string) => {
      setLienText(text);
      onRessourcesChange(
        buildRessource(linesToHtml(text), documentValue, filesValue, videosValue, interactifsValue, { outils: outilsTitre, document: documentTitre })
      );
    },
    [onRessourcesChange, documentValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre]
  );

  const handleDocumentChange = useCallback(
    (html: string) => {
      onRessourcesChange(
        buildRessource(outilsValue, html, filesValue, videosValue, interactifsValue, { outils: outilsTitre, document: documentTitre })
      );
    },
    [onRessourcesChange, outilsValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre]
  );

  // ── Contenus interactifs ──
  // Ce que le prof colle est TRANSFORMÉ à la volée : le bouton « Intégrer » de
  // Genially ou d'une frise donne un bloc `<iframe …>`, pas une adresse. On en
  // garde le `src` et, s'il les annonce, les proportions d'origine — aller
  // pêcher l'adresse à la main dans le code n'est pas un geste de prof.
  const majInteractifs = useCallback(
    (suivants: RessourceInteractif[]) => {
      onRessourcesChange(
        buildRessource(outilsValue, documentValue, filesValue, videosValue, suivants, { outils: outilsTitre, document: documentTitre })
      );
    },
    [onRessourcesChange, outilsValue, documentValue, filesValue, videosValue, outilsTitre, documentTitre]
  );

  // ── LA LIGNE VIERGE ──
  // Elle est toujours là, en bas de la liste, prête à recevoir une adresse ou
  // du code : cliquer sur « Ajouter » pour faire apparaître un formulaire vide
  // était une étape pour rien.
  //
  // Mais elle est tenue LOCALEMENT tant qu'elle est vide. Rangée dans
  // l'activité, elle allumerait la pastille « ressource présente » pour un
  // formulaire jamais rempli — et le serveur, qui écarte les entrées vides,
  // la ferait disparaître sous les doigts du professeur au premier
  // enregistrement.
  const [brouillon, setBrouillon] = useState<RessourceInteractif>(nouvelInteractif);

  const majInteractif = useCallback(
    (id: string, partial: Partial<RessourceInteractif>) => {
      if (id === brouillon.id) {
        const suivant = { ...brouillon, ...partial };
        // Remplie, la ligne rejoint l'activité — et une nouvelle vierge la
        // remplace. Sa clé React ne change pas : le curseur reste dans le champ.
        if (interactifRempli(suivant)) {
          majInteractifs([...interactifsValue, suivant]);
          setBrouillon(nouvelInteractif());
        } else {
          setBrouillon(suivant);
        }
        return;
      }
      majInteractifs(interactifsValue.map((it) => (it.id === id ? { ...it, ...partial } : it)));
    },
    [majInteractifs, interactifsValue, brouillon]
  );

  const retirerInteractif = useCallback(
    (id: string) => {
      if (id === brouillon.id) {
        setBrouillon(nouvelInteractif());
        return;
      }
      majInteractifs(interactifsValue.filter((x) => x.id !== id));
    },
    [majInteractifs, interactifsValue, brouillon.id]
  );

  // Ce que l'onglet affiche : ce qui est rangé, puis la ligne vierge.
  const lignesInteractif = [...interactifsValue, brouillon];

  const collerIntegration = useCallback(
    (id: string, saisie: string) => {
      const prop = proportionsDepuisIntegration(saisie);
      majInteractif(id, {
        url: urlDepuisIntegration(saisie),
        ...(prop
          ? { largeur: prop.largeur, ratio: prop.ratio, proportions: true }
          : { proportions: false, ratio: undefined }),
      });
    },
    [majInteractif]
  );

  // ── Champ Vidéo : une URL YouTube par ligne, resynchronisé comme le champ Lien ──
  const [videoText, setVideoText] = useState(() => videosValue.join('\n'));
  const videoTextRef = useRef(videoText);
  videoTextRef.current = videoText;

  useEffect(() => {
    const external = videosValue.join('\n');
    const localNormalized = videoTextRef.current
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    if (external !== localNormalized) {
      setVideoText(external);
    }
  }, [videosValue]);

  const handleVideoChange = useCallback(
    (text: string) => {
      setVideoText(text);
      // Le titre suit SON adresse : retirer une ligne du bloc ne doit pas
      // décaler les titres des vidéos restées en place.
      const titresParUrl = new Map(videosValue.map((v) => [v.url, v.titre]));
      const videos: RessourceVideo[] = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((url) => {
          const titre = titresParUrl.get(url);
          return titre ? { url, titre } : { url };
        });
      onRessourcesChange(
        buildRessource(outilsValue, documentValue, filesValue, videos, interactifsValue, {
          outils: outilsTitre,
          document: documentTitre,
        })
      );
    },
    [onRessourcesChange, outilsValue, documentValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre]
  );

  // ── Les titres, un par ressource ──
  // C'est le titre qui nomme le volet dépliant chez l'élève ; sans lui, on
  // retombe sur le nom du fichier ou « Vidéo 1 ». Rien n'est obligatoire.
  const majTitreVideo = useCallback(
    (url: string, titre: string) => {
      const videos: RessourceVideo[] = videosValue.map((v) =>
        v.url === url ? (titre.trim() ? { url: v.url, titre: titre.trim() } : { url: v.url }) : v
      );
      onRessourcesChange(
        buildRessource(outilsValue, documentValue, filesValue, videos, interactifsValue, {
          outils: outilsTitre,
          document: documentTitre,
        })
      );
    },
    [onRessourcesChange, outilsValue, documentValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre]
  );

  const majTitreImage = useCallback(
    (cible: RessourceFile, titre: string) => {
      const files: RessourceFile[] = filesValue.map((f) => {
        if (f !== cible) return f;
        // Firestore refuse `undefined` : un titre effacé disparaît de l'objet.
        const reste = { ...f };
        delete reste.titre;
        return titre.trim() ? { ...reste, titre: titre.trim() } : reste;
      });
      onRessourcesChange(
        buildRessource(outilsValue, documentValue, files, videosValue, interactifsValue, {
          outils: outilsTitre,
          document: documentTitre,
        })
      );
    },
    [onRessourcesChange, outilsValue, documentValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre]
  );

  const majTitreBloc = useCallback(
    (quoi: 'outils' | 'document', titre: string) => {
      onRessourcesChange(
        buildRessource(outilsValue, documentValue, filesValue, videosValue, interactifsValue, {
          outils: quoi === 'outils' ? titre : outilsTitre,
          document: quoi === 'document' ? titre : documentTitre,
        })
      );
    },
    [onRessourcesChange, outilsValue, documentValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre]
  );

  // Aperçus des vidéos reconnues (les lignes invalides sont signalées)
  const videoLines = videoText.split('\n').map((l) => l.trim()).filter(Boolean);
  const invalidVideoLines = videoLines.filter((l) => !parseYoutubeId(l));

  // ── Upload d'images (compressées dans le navigateur, stockées en Firestore) ──

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || disabled || isUploading) return;

      const files = Array.from(fileList);
      const notImage = files.find((f) => !f.type.startsWith('image/'));
      if (notImage) {
        setUploadError(
          `Format non accepté : ${notImage.name} — images uniquement. Pour un PDF ou un document long, utilisez l'onglet Lien.`
        );
        return;
      }

      const headers = await getAuthHeaders();
      if (!headers) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        // Compression avant envoi (limite Firestore : ~700 Ko par image)
        const formData = new FormData();
        for (const f of files) {
          const compressed = await compressImage(f);
          if (!compressed) {
            setUploadError(`Impossible de réduire ${f.name} sous 700 Ko — réduisez l'image ou utilisez l'onglet Lien.`);
            setIsUploading(false);
            if (inputRef.current) inputRef.current.value = '';
            return;
          }
          formData.append('files', compressed.blob, compressed.name);
        }

        // Ne garder que l'Authorization : le navigateur fixe lui-même le
        // Content-Type multipart (avec sa boundary)
        const res = await fetch('/api/ressources/upload', {
          method: 'POST',
          headers: { Authorization: headers.Authorization },
          body: formData,
        });
        const json = await res.json();

        if (json.success && json.data?.files) {
          onRessourcesChange(
            buildRessource(
              outilsValue,
              documentValue,
              [...filesValue, ...json.data.files],
              videosValue,
              interactifsValue,
              { outils: outilsTitre, document: documentTitre }
            )
          );
        } else {
          setUploadError(json.message || "Erreur lors de l'upload");
        }
      } catch (err) {
        console.error('Erreur upload ressource:', err);
        setUploadError('Erreur de connexion pendant l’upload');
      } finally {
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [disabled, isUploading, getAuthHeaders, onRessourcesChange, outilsValue, documentValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre]
  );

  const handleRemoveFile = useCallback(
    async (file: RessourceFile) => {
      onRessourcesChange(
        buildRessource(
          outilsValue,
          documentValue,
          filesValue.filter((f) => f !== file),
          videosValue,
          interactifsValue,
          { outils: outilsTitre, document: documentTitre }
        )
      );

      // Suppression de l'image stockée (silencieuse en cas d'échec)
      if (file.fileId) {
        const headers = await getAuthHeaders();
        if (!headers) return;
        fetch(`/api/ressources/upload?id=${encodeURIComponent(file.fileId)}`, {
          method: 'DELETE',
          headers: { Authorization: headers.Authorization },
        }).catch((err) => console.error('Erreur suppression Drive:', err));
      }
    },
    [onRessourcesChange, outilsValue, documentValue, filesValue, videosValue, interactifsValue, outilsTitre, documentTitre, getAuthHeaders]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className={styles.container}>
      {/* ── Onglets Fichier / Lien / Texte (contenus cumulables) ── */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'fichier' ? styles.tabActive : hasFichier ? styles.tabRempli : ''}`}
          onClick={() => setActiveTab('fichier')}
        >
          Image {hasFichier && <span className={styles.tabDot} />}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'lien' ? styles.tabActive : hasLien ? styles.tabRempli : ''}`}
          onClick={() => setActiveTab('lien')}
        >
          Lien {hasLien && <span className={styles.tabDot} />}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'texte' ? styles.tabActive : hasTexte ? styles.tabRempli : ''}`}
          onClick={() => setActiveTab('texte')}
        >
          Texte {hasTexte && <span className={styles.tabDot} />}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'video' ? styles.tabActive : hasVideo ? styles.tabRempli : ''}`}
          onClick={() => setActiveTab('video')}
        >
          Vidéo {hasVideo && <span className={styles.tabDot} />}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'interactif' ? styles.tabActive : hasInteractif ? styles.tabRempli : ''}`}
          onClick={() => setActiveTab('interactif')}
        >
          Interactif {hasInteractif && <span className={styles.tabDot} />}
        </button>
      </div>

      {/* ── Onglet Image : dépôt d'images (compressées, stockées en Firestore) ── */}
      {activeTab === 'fichier' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Images uniquement, compressées automatiquement. Pour un PDF ou un document long,
            collez son lien dans l&apos;onglet Lien.
          </p>
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
            onClick={() => !disabled && !isUploading && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isUploading
              ? 'Envoi en cours...'
              : 'Glissez une image ici, ou cliquez pour parcourir (JPG, PNG, GIF, WebP)'}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || isUploading}
          />
          {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
          {filesValue.length > 0 && (
            <div className={styles.thumbGrid}>
              {filesValue.map((file, index) => (
                <figure key={file.fileId || index} className={styles.thumbItem}>
                  <button
                    type="button"
                    className={styles.thumbButton}
                    onClick={() => setPreviewFile(file)}
                    title="Voir en grand"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.url} alt={file.name} className={styles.thumbImage} />
                  </button>
                  {!disabled && (
                    <button
                      type="button"
                      className={styles.thumbRemove}
                      onClick={() => handleRemoveFile(file)}
                      title="Retirer cette image"
                    >
                      ✕
                    </button>
                  )}
                  <figcaption className={styles.thumbCaption}>
                    <input
                      type="text"
                      className={styles.titreInput}
                      value={file.titre ?? ''}
                      onChange={(e) => majTitreImage(file, e.target.value)}
                      placeholder="Titre de la ressource"
                      disabled={disabled}
                      title={`Titre affiché aux élèves — à défaut : ${file.name}`}
                    />
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popup de visualisation en grand (clic hors de l'image pour fermer) */}
      {previewFile && (
        <div
          className={styles.lightbox}
          onClick={() => setPreviewFile(null)}
          role="dialog"
          aria-label={previewFile.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewFile.url}
            alt={previewFile.name}
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setPreviewFile(null)}
            title="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Onglet Lien : une URL par ligne, converties en liens cliquables ── */}
      {activeTab === 'lien' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Une URL par ligne — chaque ligne devient une puce cliquable pour les élèves.
          </p>
          <input
            type="text"
            className={styles.titreBloc}
            value={outilsTitre}
            onChange={(e) => majTitreBloc('outils', e.target.value)}
            placeholder="Titre de la ressource"
            disabled={disabled}
            title="Titre affiché aux élèves — à défaut : Outils"
          />
          <textarea
            className={styles.lienTextarea}
            value={lienText}
            onChange={(e) => handleLienChange(e.target.value)}
            placeholder={'https://exemple.com\nhttps://autre-site.be'}
            rows={5}
            disabled={disabled}
            spellCheck={false}
          />
        </div>
      )}

      {/* ── Onglet Vidéo : une URL YouTube par ligne, lecteur intégré côté élève ── */}
      {activeTab === 'video' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Une URL YouTube par ligne — chaque vidéo apparaît en lecteur intégré dans
            l&apos;onglet Ressources des élèves.
          </p>
          <textarea
            className={styles.lienTextarea}
            value={videoText}
            onChange={(e) => handleVideoChange(e.target.value)}
            placeholder={'https://www.youtube.com/watch?v=...\nhttps://youtu.be/...'}
            rows={3}
            disabled={disabled}
            spellCheck={false}
          />
          {invalidVideoLines.length > 0 && (
            <p className={styles.uploadError}>
              URL non reconnue comme vidéo YouTube :{' '}
              {invalidVideoLines.join(', ')}
            </p>
          )}
          {videoLines.some((l) => parseYoutubeId(l)) && (
            <div className={styles.videoGrid}>
              {videoLines.map((line, index) => {
                const id = parseYoutubeId(line);
                if (!id) return null;
                const titre = videosValue.find((v) => v.url === line)?.titre ?? '';
                return (
                  <div key={`${id}-${index}`} className={styles.videoItem}>
                    <iframe
                      src={youtubeEmbedUrl(id)}
                      title={titre || `Vidéo ${index + 1}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    <input
                      type="text"
                      className={styles.titreInput}
                      value={titre}
                      onChange={(e) => majTitreVideo(line, e.target.value)}
                      placeholder="Titre de la ressource"
                      disabled={disabled}
                      title={`Titre affiché aux élèves — à défaut : Vidéo ${index + 1}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Interactif : une page tierce, ou une animation maison ──
          Deux natures dans un seul onglet : c'est le même geste pour le prof
          — « je pose quelque chose qui bouge » — et la barre en compte déjà
          quatre. Voir `src/types/devoir.ts` pour ce qui les sépare. */}
      {activeTab === 'interactif' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Une page à intégrer&nbsp;: Genially, une frise, un exerciseur, un carnet
            LearningApps…{' '}
            {isAdmin && 'Ou votre propre animation HTML/CSS/JS. '}
            Le contenu s’affiche dans l’onglet Ressources de l’élève.
          </p>

          {lignesInteractif.map((it, index) => {
            const trop = (it.code ?? '').length > TAILLE_MAX_CODE;
            const urlKo = it.kind === 'url' && !!it.url && !integrationAutorisee(it.url);
            return (
              <div key={it.id} className={styles.interactifItem}>
                <div className={styles.interactifHead}>
                  <span className={styles.interactifRang}>{index + 1}</span>

                  {/* Le choix de la nature n'apparaît qu'à l'administrateur :
                      déposer du code exécutable est une porte à part. */}
                  {isAdmin && (
                    <span className={styles.interactifKind}>
                      <button
                        type="button"
                        className={it.kind === 'url' ? styles.kindOn : styles.kindOff}
                        onClick={() => majInteractif(it.id, { kind: 'url' })}
                        disabled={disabled}
                      >
                        Adresse
                      </button>
                      <button
                        type="button"
                        className={it.kind === 'code' ? styles.kindOn : styles.kindOff}
                        onClick={() => majInteractif(it.id, { kind: 'code' })}
                        disabled={disabled}
                      >
                        Code
                      </button>
                    </span>
                  )}

                  <input
                    type="text"
                    className={styles.interactifLegende}
                    value={it.legende ?? ''}
                    onChange={(e) => majInteractif(it.id, { legende: e.target.value })}
                    placeholder="Titre de la ressource"
                    disabled={disabled}
                  />

                  <button
                    type="button"
                    className={styles.interactifDel}
                    onClick={() => retirerInteractif(it.id)}
                    disabled={disabled || (it.id === brouillon.id && !interactifRempli(it))}
                    title="Retirer ce contenu"
                  >
                    ✕
                  </button>
                </div>

                {it.kind === 'code' ? (
                  <>
                    <textarea
                      className={styles.interactifCode}
                      rows={10}
                      value={it.code ?? ''}
                      onChange={(e) => majInteractif(it.id, { code: e.target.value })}
                      placeholder="Collez ici la page complète : <style>…</style>, le HTML, <script>…</script>"
                      disabled={disabled}
                      spellCheck={false}
                    />
                    <p className={trop ? styles.interactifKo : styles.interactifNote}>
                      {trop
                        ? `Trop long : ${Math.round((it.code ?? '').length / 1000)} Ko pour ${Math.round(TAILLE_MAX_CODE / 1000)} Ko permis. Sortez les images de votre code et déposez-les dans l’onglet Image.`
                        : `${Math.round((it.code ?? '').length / 1000)} Ko sur ${Math.round(TAILLE_MAX_CODE / 1000)} — l’animation tourne isolée : elle n’a accès ni à la page, ni au compte de l’élève.`}
                    </p>
                  </>
                ) : (
                  <>
                    <textarea
                      className={styles.interactifUrl}
                      rows={2}
                      value={it.url ?? ''}
                      onChange={(e) => collerIntegration(it.id, e.target.value)}
                      placeholder="Collez l’adresse, ou le code « Intégrer » du site — on en extrait l’adresse"
                      disabled={disabled}
                      spellCheck={false}
                    />
                    {urlKo && (
                      <p className={styles.interactifKo}>
                        Ce site n’est pas dans la liste des domaines autorisés — le contenu
                        ne s’affichera pas. Signalez-le-moi pour l’ajouter.
                      </p>
                    )}
                  </>
                )}

                {/* ── LA TAILLE DU CADRE ──
                    Mêmes réglages que dans l'atelier « Lecture d'une œuvre » :
                    c'est le même objet, il doit se régler pareil.
                    La largeur est un PLAFOND, jamais une largeur imposée : sur
                    le Chromebook d'un élève, la colonne est plus étroite et
                    c'est elle qui gagne. */}
                <div className={styles.interactifTaille}>
                  <label className={styles.interactifHauteur}>
                    Largeur maximale
                    <input
                      type="number"
                      min={200}
                      max={2000}
                      step={20}
                      value={it.largeur ?? 900}
                      onChange={(e) =>
                        majInteractif(it.id, {
                          largeur: Math.max(200, Math.min(2000, Number(e.target.value) || 900)),
                        })
                      }
                      disabled={disabled}
                    />
                    px
                  </label>

                  {/* La case ne se propose que si les proportions sont
                      CONNUES — le code collé les annonçait. Une case sans
                      effet est pire qu'une case absente. */}
                  {it.kind === 'url' && it.ratio ? (
                    <label className={styles.interactifCase}>
                      <input
                        type="checkbox"
                        checked={it.proportions === true}
                        onChange={(e) => majInteractif(it.id, { proportions: e.target.checked })}
                        disabled={disabled}
                      />
                      Conserver les proportions d’origine (
                      {it.ratio.toFixed(2).replace(/\.?0+$/, '')} : 1)
                    </label>
                  ) : null}

                  {it.kind === 'url' && it.proportions && it.ratio ? (
                    <span className={styles.interactifNote}>
                      Hauteur déduite de la largeur — le cadre se réduit
                      proportionnellement, sans déformation ni bandes vides.
                    </span>
                  ) : (
                    <label className={styles.interactifHauteur}>
                      Hauteur du cadre
                      <input
                        type="number"
                        min={200}
                        max={1200}
                        step={20}
                        value={it.hauteur ?? 520}
                        onChange={(e) =>
                          majInteractif(it.id, {
                            hauteur: Math.max(200, Math.min(1200, Number(e.target.value) || 520)),
                          })
                        }
                        disabled={disabled}
                      />
                      px
                    </label>
                  )}
                </div>

                {/* Aperçu : c'est le seul moyen de savoir si ça marche avant
                    de le donner aux élèves. Le cadre est le MÊME qu'à
                    l'écran de l'élève, bac à sable compris. */}
                {it.kind === 'code' && (it.code ?? '').trim() && !trop && (
                  <iframe
                    className={styles.interactifApercu}
                    style={{ height: `${it.hauteur ?? 520}px`, maxWidth: `${it.largeur ?? 900}px` }}
                    srcDoc={it.code}
                    title={it.legende || 'Aperçu de l’animation'}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                  />
                )}
                {it.kind === 'url' && integrationAutorisee(it.url) && (
                  <iframe
                    className={styles.interactifApercu}
                    style={{
                      ...(it.proportions && it.ratio
                        ? { aspectRatio: String(it.ratio) }
                        : { height: `${it.hauteur ?? 520}px` }),
                      maxWidth: `${it.largeur ?? 900}px`,
                    }}
                    src={it.url}
                    title={it.legende || 'Aperçu du contenu'}
                    allow="fullscreen; encrypted-media"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            );
          })}

        </div>
      )}

      {/* ── Onglet Texte : document mis en forme ── */}
      {activeTab === 'texte' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Rédigez un document mis en forme à destination des élèves.
          </p>
          <input
            type="text"
            className={styles.titreBloc}
            value={documentTitre}
            onChange={(e) => majTitreBloc('document', e.target.value)}
            placeholder="Titre de la ressource"
            disabled={disabled}
            title="Titre affiché aux élèves — à défaut : Document"
          />
          <DocumentEditor
            content={documentValue}
            onChange={handleDocumentChange}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
