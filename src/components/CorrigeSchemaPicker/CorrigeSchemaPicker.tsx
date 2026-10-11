'use client';

// ATELIER DE CONCEPTUALISATION — « Contenus de l'activité » › Corrigé du
// professeur (2026-10-11) : choisir un schéma de Mes Ressources ›
// Conceptualisations. Le schéma est COPIÉ dans l'activité au moment du choix ;
// retoucher la bibliothèque ensuite ne change pas cette activité.

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import SchemaApercu from '@/components/SchemaApercu/SchemaApercu';
import { DIAGRAM_TYPE_LABELS, type Diagram } from '@/types/diagram';
import type { SchemaCorrige } from '@/types/devoir';
import type { SchemaPersonnelMeta } from '@/lib/schemas-personnels';
import styles from './CorrigeSchemaPicker.module.css';

interface Props {
  valeur: SchemaCorrige | null;
  onChange: (v: SchemaCorrige | null) => void;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  disabled?: boolean;
}

export default function CorrigeSchemaPicker({ valeur, onChange, getAuthHeaders, disabled }: Props) {
  const [choix, setChoix] = useState(!valeur);
  const [liste, setListe] = useState<SchemaPersonnelMeta[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState<string | null>(null);
  // La loupe : le schéma en grand, à regarder seulement
  const [apercu, setApercu] = useState<{ titre: string; diagram: Diagram } | null>(null);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/schemas/personnel', { headers });
      const json = await res.json();
      setListe(json.success ? (json.data as SchemaPersonnelMeta[]).filter((s) => !s.archive) : []);
    } catch {
      setListe([]);
    }
  }, [getAuthHeaders]);

  // Toujours chargée : la vignette du corrigé choisi vient de la bibliothèque
  useEffect(() => {
    if (liste === null) void charger();
  }, [liste, charger]);

  const lire = async (s: SchemaPersonnelMeta): Promise<{ titre: string; diagram: Diagram } | null> => {
    setLecture(s.id);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error();
      const res = await fetch(`/api/schemas/personnel/${s.id}`, { headers });
      const json = await res.json();
      if (!json.success) throw new Error();
      return { titre: json.data.titre || s.titre, diagram: json.data.diagram as Diagram };
    } catch {
      setErreur('Ce corrigé n’a pas pu être lu. Réessayez.');
      return null;
    } finally {
      setLecture(null);
    }
  };

  const choisir = async (s: SchemaPersonnelMeta) => {
    const lu = await lire(s);
    if (!lu) return;
    onChange({ sourceId: s.id, ...lu });
    setChoix(false);
  };

  const regarder = async (s: SchemaPersonnelMeta) => {
    const lu = await lire(s);
    if (lu) setApercu(lu);
  };

  const vignette = (url: string | null | undefined) => (
    <span className={styles.vignette}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- vignette en data URL
        <img src={url} alt="" />
      ) : (
        <span aria-hidden="true">🧩</span>
      )}
    </span>
  );

  const fenetreApercu = apercu && (
    <SchemaApercu diagram={apercu.diagram} titre={apercu.titre} onClose={() => setApercu(null)} />
  );

  if (valeur && !choix) {
    // La vignette de la bibliothèque si le schéma source existe encore ; la
    // copie, elle, est dans l'activité (la loupe montre ce qui sera corrigé)
    const source = liste?.find((s) => s.id === valeur.sourceId);
    return (
      <div className={styles.choisi}>
        <div className={styles.carteChoisie}>
          {vignette(source?.thumbnail)}
          <button
            type="button"
            className={styles.loupe}
            onClick={() => setApercu({ titre: valeur.titre, diagram: valeur.diagram })}
            title="Voir en grand"
            aria-label="Voir en grand"
          >
            <Search size={15} aria-hidden="true" />
          </button>
          <span className={styles.optionTitre}>✓ {valeur.titre}</span>
          <span className={styles.note}>{DIAGRAM_TYPE_LABELS[valeur.diagram.type]}</span>
        </div>
        <div className={styles.choisiActions}>
          <button type="button" className={styles.lien} onClick={() => setChoix(true)} disabled={disabled}>
            Changer
          </button>
          <button type="button" className={styles.lien} onClick={() => onChange(null)} disabled={disabled}>
            Retirer
          </button>
        </div>
        {fenetreApercu}
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      {liste === null ? (
        <p className={styles.note}>Chargement de vos corrigés…</p>
      ) : liste.length === 0 ? (
        <p className={styles.note}>Aucun corrigé dans Mes Ressources › Conceptualisations pour l’instant.</p>
      ) : (
        <div className={styles.liste}>
          {liste.map((s) => (
            <div
              key={s.id}
              className={`${styles.option} ${valeur?.sourceId === s.id ? styles.optionActive : ''} ${disabled ? styles.optionInactive : ''}`}
              onClick={() => !disabled && lecture === null && void choisir(s)}
              onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && !disabled && void choisir(s)}
              role="button"
              tabIndex={0}
              title={`Choisir « ${s.titre} »`}
            >
              {vignette(s.thumbnail)}
              <button
                type="button"
                className={styles.loupe}
                onClick={(e) => {
                  e.stopPropagation();
                  void regarder(s);
                }}
                disabled={lecture !== null}
                title="Voir en grand"
                aria-label={`Voir « ${s.titre} » en grand`}
              >
                <Search size={15} aria-hidden="true" />
              </button>
              <span className={styles.optionTitre}>{lecture === s.id ? 'Lecture…' : s.titre}</span>
              <span className={styles.note}>{DIAGRAM_TYPE_LABELS[s.type]}</span>
            </div>
          ))}
        </div>
      )}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {fenetreApercu}
      <div className={styles.pied}>
        {/* Une page, dans un nouvel onglet : le formulaire en cours reste ouvert */}
        <a className={styles.lien} href="/mes-ressources/schemas/nouveau" target="_blank" rel="noopener">
          ➕ Dessiner un nouveau corrigé (nouvel onglet)
        </a>
        <button type="button" className={styles.lien} onClick={() => void charger()} disabled={disabled}>
          ↻ Actualiser la liste
        </button>
        {valeur && (
          <button type="button" className={styles.lien} onClick={() => setChoix(false)} disabled={disabled}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
