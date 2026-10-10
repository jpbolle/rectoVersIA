'use client';

// La partie IMAGE d'un dépôt de portfolio (plan 2026-10-10, séance c) :
// l'élève choisit une image (photo d'affiche, selfie-BD, carte mentale…),
// compressée dans le navigateur, envoyée à `/api/portfolio/image`.
//
// ⚠️ L'image est servie par une route AUTHENTIFIÉE (image d'élève, RGPD) : une
// balise <img src="/api/…"> n'enverrait pas le jeton. On la télécharge donc
// avec `fetch` + en-têtes, et on l'affiche depuis une adresse locale au
// navigateur (`URL.createObjectURL`), libérée quand l'image change.
//
// Le même composant sert à la lecture de la copie par le prof (`lectureSeule`).

import { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import { compressImage } from '@/lib/image-compress';
import styles from './Portfolio.module.css';

interface Props {
  // L'identifiant de l'image déposée ('' = aucune)
  valeur: string;
  lectureSeule?: boolean;
  // Dépôt (élève) : la copie et l'emplacement du dépôt
  travailId?: string;
  etapeId?: string;
  depotId?: string;
  onChange?: (imageId: string) => void;
}

export default function PortfolioDepotImage({ valeur, lectureSeule = false, travailId, etapeId, depotId, onChange }: Props) {
  const { getAuthHeaders } = useAuthContext();
  const [apercu, setApercu] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  // Télécharger l'image déposée (avec le jeton) et l'afficher
  useEffect(() => {
    if (!valeur) {
      setApercu(null);
      return;
    }
    let annule = false;
    let adresse: string | null = null;
    setChargement(true);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/portfolio/image/${encodeURIComponent(valeur)}`, { headers });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (annule) return;
        adresse = URL.createObjectURL(blob);
        setApercu(adresse);
        setErreur(null);
      } catch {
        if (!annule) setErreur('Impossible d’afficher l’image.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [valeur, getAuthHeaders]);

  const envoyer = async (fichier: File) => {
    if (!travailId || !etapeId || !depotId) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const compresse = await compressImage(fichier);
      if (!compresse) {
        setErreur('Cette image est trop lourde, même compressée (maximum 700 Ko).');
        return;
      }
      const headers = await getAuthHeaders();
      if (!headers) return;
      const form = new FormData();
      form.append('file', new File([compresse.blob], compresse.name, { type: compresse.mimeType }));
      form.append('travailId', travailId);
      form.append('etapeId', etapeId);
      form.append('depotId', depotId);
      // Pas de Content-Type JSON : le navigateur pose celui du formulaire
      const res = await fetch('/api/portfolio/image', {
        method: 'POST',
        headers: { Authorization: headers.Authorization },
        body: form,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setErreur(json?.message || 'L’envoi de l’image a échoué.');
        return;
      }
      onChange?.(json.data.id);
    } catch {
      setErreur('L’envoi de l’image a échoué.');
    } finally {
      setEnvoi(false);
      if (champ.current) champ.current.value = '';
    }
  };

  const retirer = async () => {
    if (!valeur) return;
    setEnvoi(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/portfolio/image/${encodeURIComponent(valeur)}`, { method: 'DELETE', headers });
      if (!res.ok) {
        setErreur('Impossible de retirer l’image.');
        return;
      }
      onChange?.('');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className={styles.imageDepot}>
      {valeur && (
        <div className={styles.imageCadre}>
          {apercu ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu} alt="Image déposée" />
          ) : (
            <span className={styles.imageAttente}>{chargement ? 'Chargement de l’image…' : ''}</span>
          )}
        </div>
      )}
      {lectureSeule && !valeur && <p className={styles.lectureVide}>Aucune image.</p>}
      {!lectureSeule && (
        <div className={styles.imageActions}>
          <input
            ref={champ}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void envoyer(f);
            }}
          />
          <button type="button" className={styles.imageBouton} onClick={() => champ.current?.click()} disabled={envoi}>
            {envoi ? 'Envoi…' : valeur ? '🖼️ Remplacer l’image' : '🖼️ Choisir une image'}
          </button>
          {valeur && (
            <button type="button" className={styles.imageRetirer} onClick={() => void retirer()} disabled={envoi}>
              Retirer
            </button>
          )}
        </div>
      )}
      {erreur && <p className={styles.lienErreur}>{erreur}</p>}
    </div>
  );
}
