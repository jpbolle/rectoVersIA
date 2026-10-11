'use client';

// Le DÉPÔT « SCÈNE D'UNE ŒUVRE » côté élève (JP, 2026-10-11) : deux menus, la
// pièce puis la scène, dans l'œuvre fixée par le prof — plus de champ libre où
// l'on se trompe de texte. Une fois choisie, la scène s'affiche dans l'onglet
// Ressources (`PortfolioSceneTexte`) et un encadré demande d'y vérifier que
// c'est bien le bon texte.

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import OeuvreBlocRendu from '@/components/OeuvreReader/OeuvreBlocRendu';
import type { OeuvreBloc } from '@/types/oeuvre';
import styles from './Portfolio.module.css';

interface Piece {
  titre: string;
  scenes: { id: string; titre: string }[];
}

interface Donnees {
  oeuvreTitre: string;
  pieces: Piece[];
  section: { id: string; titre: string; blocs: OeuvreBloc[] } | null;
}

// Une lecture de la route du dépôt (table des pièces, et la scène si demandée)
function useSceneDuDepot(devoirId: string, etapeId: string, depotId: string, sectionId: string | null) {
  const { getAuthHeaders } = useAuthContext();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const q = new URLSearchParams({ devoirId, etapeId, depotId });
        if (sectionId) q.set('sectionId', sectionId);
        const json = await (await fetch(`/api/portfolio/scene?${q}`, { headers })).json();
        if (annule) return;
        if (json.success) {
          setDonnees(json.data as Donnees);
          setErreur(null);
        } else setErreur(json.message || 'Œuvre indisponible');
      } catch {
        if (!annule) setErreur('Œuvre indisponible');
      }
    })();
    return () => {
      annule = true;
    };
  }, [devoirId, etapeId, depotId, sectionId, getAuthHeaders]);
  return { donnees, erreur };
}

interface Props {
  devoirId: string; // le portfolio
  etapeId: string;
  depotId: string;
  valeur: string; // l'id de la scène choisie, '' sinon
  onChange: (sectionId: string) => void;
  lectureSeule?: boolean;
  onOuvrirRessources?: () => void;
}

export default function PortfolioDepotScene({ devoirId, etapeId, depotId, valeur, onChange, lectureSeule = false, onOuvrirRessources }: Props) {
  const { donnees, erreur } = useSceneDuDepot(devoirId, etapeId, depotId, null);
  // La pièce affichée : celle de la scène choisie, ou celle que l'élève vient d'ouvrir
  const [piece, setPiece] = useState<string>('');
  const pieceDeLaScene = donnees?.pieces.find((p) => p.scenes.some((s) => s.id === valeur))?.titre ?? '';
  const pieceCourante = piece || pieceDeLaScene;
  const scenes = donnees?.pieces.find((p) => p.titre === pieceCourante)?.scenes ?? [];

  if (erreur) return <p className={styles.lectureVide}>{erreur}</p>;
  if (!donnees) return <p className={styles.depotAide}>Chargement de l’œuvre…</p>;

  return (
    <div>
      <div className={styles.sceneChoix}>
        <select
          className={styles.valeurSelect}
          value={pieceCourante}
          onChange={(e) => {
            setPiece(e.target.value);
            // Changer de pièce efface la scène d'une autre pièce
            if (valeur && e.target.value !== pieceDeLaScene) onChange('');
          }}
          disabled={lectureSeule}
          aria-label="Choisir la pièce"
        >
          <option value="">— Choisis la pièce —</option>
          {donnees.pieces.map((p) => (
            <option key={p.titre} value={p.titre}>
              {p.titre}
            </option>
          ))}
        </select>
        {pieceCourante && (
          <select
            className={styles.valeurSelect}
            value={valeur}
            onChange={(e) => onChange(e.target.value)}
            disabled={lectureSeule}
            aria-label="Choisir la scène"
          >
            <option value="">— Choisis la scène —</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titre}
              </option>
            ))}
          </select>
        )}
      </div>
      {valeur && (
        <div className={styles.sceneVerif}>
          <span aria-hidden="true">📖</span>
          <p>
            <b>Vérifie dans l’onglet Ressources que c’est bien le bon texte.</b> Ta scène s’y affiche en entier.
          </p>
          {onOuvrirRessources && (
            <button type="button" className={styles.btn} onClick={onOuvrirRessources}>
              Voir le texte
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Le texte de la scène choisie — dans l'onglet Ressources (« Ta scène »). */
export function PortfolioSceneTexte({
  devoirId,
  etapeId,
  depotId,
  sectionId,
  nom = 'Ta scène',
}: {
  devoirId: string;
  etapeId: string;
  depotId: string;
  sectionId: string;
  nom?: string;
}) {
  const { donnees, erreur } = useSceneDuDepot(devoirId, etapeId, depotId, sectionId);
  return (
    <div className={styles.valeur}>
      <div className={styles.valeurTete}>
        <span className={styles.valeurNom}>{nom}</span>
        {donnees?.section && <span className={styles.valeurTitre}>{donnees.section.titre}</span>}
      </div>
      {erreur ? (
        <p className={styles.lectureVide}>{erreur}</p>
      ) : !donnees ? (
        <p className={styles.lectureVide}>Chargement du texte…</p>
      ) : !donnees.section ? (
        <p className={styles.lectureVide}>Scène introuvable : choisis-la à nouveau.</p>
      ) : (
        <div className={styles.valeurTexte}>
          {donnees.section.blocs.map((b) => (
            <OeuvreBlocRendu key={b.id} bloc={b} />
          ))}
        </div>
      )}
    </div>
  );
}
