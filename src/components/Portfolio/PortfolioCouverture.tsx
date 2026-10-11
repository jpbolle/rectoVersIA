'use client';

// L'IMAGE DE COUVERTURE de l'introduction d'un portfolio (JP, 2026-10-11) —
// dans la popup d'étape : un aperçu ROND (l'image recadrée comme dans le
// serpentin), « Choisir une image », « Retirer ».
//
// Même circuit que les images des ressources : compression dans le navigateur
// (≤ 700 Ko), `POST /api/ressources/upload` → `ressourceImages`, servie par
// `/api/ressources/image/{id}`. Ce n'est pas une donnée d'élève.
//
// CADRAGE (JP, 2026-10-11 : « permettre le travail de la taille de l'image ») :
// on fait GLISSER l'image dans l'aperçu pour choisir ce qui est visible
// (souris ou doigt — événements « pointer »), le curseur « Taille » l'agrandit
// ou la RÉDUIT (jusqu'à la voir en entier) autour de ce point. Les calculs se
// font sur l'image ENTIÈRE (ses proportions sont relevées au chargement) —
// jamais sur une image déjà rognée au carré. Stocké sur l'étape
// (`couvertureCadrage`), appliqué partout par `styleCouverture`.
//
// « Retirer » ne SUPPRIME pas l'image en base : une matrice dupliquée ou
// donnée à une classe garde le même id — la supprimer casserait leur couverture.

import { useRef, useState, type PointerEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/image-compress';
import {
  cadrageBorne,
  CADRAGE_CENTRE,
  largeurCouverture,
  styleCouverture,
  urlCouverture,
  ZOOM_COUVERTURE_MAX,
  ZOOM_COUVERTURE_MIN,
  type CadrageCouverture,
} from '@/types/portfolio';
import styles from './Portfolio.module.css';

interface Props {
  valeur: string | null | undefined;
  onChange: (id: string | null) => void;
  cadrage: CadrageCouverture | null | undefined;
  onCadrage: (c: CadrageCouverture | null) => void;
  // Ce que le disque affiche sans image : le titre du portfolio
  titrePortfolio?: string;
  disabled?: boolean;
}

export default function PortfolioCouverture({ valeur, onChange, cadrage, onCadrage, titrePortfolio, disabled = false }: Props) {
  const { getAuthHeaders } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const url = urlCouverture(valeur);
  // Les proportions de l'image, relevées à son chargement : sans elles, pas
  // de cadrage possible (l'image remplirait le cercle, rognée)
  const [ratio, setRatio] = useState<number | null>(cadrage?.ratio ?? null);
  const c = cadrageBorne({ ...(cadrage ?? CADRAGE_CENTRE), ratio });
  const poserCadrage = (patch: Partial<CadrageCouverture>) => onCadrage(cadrageBorne({ ...c, ...patch, ratio }));

  // Le glisser : on retient le point de départ (pointeur + cadrage)
  const depart = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null);
  const saisir = (e: PointerEvent<HTMLDivElement>) => {
    if (!url || disabled || !ratio) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    depart.current = { px: e.clientX, py: e.clientY, x: c.x, y: c.y, w: r.width, h: r.height };
  };
  const deplacer = (e: PointerEvent<HTMLDivElement>) => {
    const d = depart.current;
    if (!d) return;
    // L'image suit le doigt : un glisser de N px déplace le point visé de N px
    // DE L'IMAGE (sa taille rendue = largeur % du cercle), en sens inverse
    const { largeur, hauteur } = largeurCouverture(c);
    const x = d.x - ((e.clientX - d.px) / ((d.w * largeur) / 100)) * 100;
    const y = d.y - ((e.clientY - d.py) / ((d.h * hauteur) / 100)) * 100;
    poserCadrage({ x, y });
  };
  const lacher = () => {
    depart.current = null;
  };

  const choisir = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur(null);
    if (!fichier.type.startsWith('image/')) {
      setErreur('Choisis une image (JPG, PNG, WebP).');
      return;
    }
    setEnvoi(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const compressee = await compressImage(fichier);
      if (!compressee) {
        setErreur('Impossible de réduire cette image sous 700 Ko.');
        return;
      }
      const formData = new FormData();
      formData.append('files', compressee.blob, compressee.name);
      // Le navigateur fixe lui-même le Content-Type multipart
      const res = await fetch('/api/ressources/upload', {
        method: 'POST',
        headers: { Authorization: headers.Authorization },
        body: formData,
      });
      const json = await res.json();
      const id = json.success ? (json.data?.files?.[0]?.fileId as string | undefined) : undefined;
      if (id) {
        onChange(id);
        // Nouvelle image : cadrage remis au centre, proportions à relever
        setRatio(null);
        onCadrage(null);
      }
      else setErreur(json.message || 'Envoi impossible.');
    } catch {
      setErreur('Erreur de connexion pendant l’envoi.');
    } finally {
      setEnvoi(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={styles.couvertureChoix}>
      <div
        className={`${styles.couvertureApercu} ${url && !disabled ? styles.couvertureApercuMobile : ''}`}
        onPointerDown={saisir}
        onPointerMove={deplacer}
        onPointerUp={lacher}
        onPointerCancel={lacher}
        title={url ? 'Faire glisser l’image pour choisir ce qui est visible' : undefined}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className={styles.couvertureImage}
            style={styleCouverture(ratio ? c : null)}
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w > 0 && h > 0) setRatio(Math.round((w / h) * 1000) / 1000);
            }}
          />
        ) : (
          <span className={styles.couvertureTitre}>{titrePortfolio?.trim() || 'Introduction'}</span>
        )}
      </div>
      <div className={styles.couvertureActions}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => void choisir(e.target.files?.[0])}
        />
        <button
          type="button"
          className={styles.ajout}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || envoi}
        >
          {envoi ? 'Envoi…' : url ? 'Changer l’image' : '+ Choisir une image'}
        </button>
        {url && !disabled && (
          <button
            type="button"
            className={styles.depotType}
            onClick={() => {
              onChange(null);
              setRatio(null);
              onCadrage(null);
            }}
            disabled={envoi}
          >
            Retirer l’image
          </button>
        )}
        {url && (
          <div className={styles.couvertureTaille}>
            <label htmlFor="couverture-zoom">Taille</label>
            <input
              id="couverture-zoom"
              type="range"
              min={ZOOM_COUVERTURE_MIN}
              max={ZOOM_COUVERTURE_MAX}
              step={0.05}
              value={c.zoom}
              onChange={(e) => poserCadrage({ zoom: Number(e.target.value) })}
              disabled={disabled || !ratio}
            />
            <span className={styles.couvertureZoom}>{Math.round(c.zoom * 100)} %</span>
            {!disabled && (c.zoom !== 1 || c.x !== 50 || c.y !== 50) && (
              <button type="button" className={styles.depotType} onClick={() => poserCadrage({ zoom: 1, x: 50, y: 50 })}>
                Recentrer
              </button>
            )}
          </div>
        )}
        <p className={styles.hint}>
          {url
            ? 'Fais glisser l’image dans le cercle pour choisir ce qui est visible ; « Taille » l’agrandit ou la réduit.'
            : 'Sans image, le cercle montre le titre du portfolio.'}
        </p>
        {erreur && <p className={styles.lienErreur}>{erreur}</p>}
      </div>
    </div>
  );
}
