'use client';

// UNE VALEUR ATTRIBUÉE, affichée dans une étape (plan 2026-10-10) : « Le
// sketch » du groupe — une scène d'œuvre (texte servi par
// `/api/portfolio/valeur`, jamais recopié), un lien, une vidéo, une page
// intégrée. Pas encore attribuée : on le dit, simplement.
//
// Œuvre entière : un menu des scènes, une scène affichée à la fois.

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import OeuvreBlocRendu from '@/components/OeuvreReader/OeuvreBlocRendu';
import PortfolioDepotLien from './PortfolioDepotLien';
import type { OeuvreBloc } from '@/types/oeuvre';
import type { ValeurAffichee } from '@/types/portfolio';
import styles from './Portfolio.module.css';

interface Props {
  valeur: ValeurAffichee;
  devoirId: string;
  // Le prof qui lit la copie d'un élève : SON groupe
  eleveUid?: string;
}

interface TexteOeuvre {
  titre?: string;
  oeuvreTitre: string;
  sections: { id: string; titre: string }[];
  section: { id: string; titre: string; blocs: OeuvreBloc[] } | null;
}

export default function PortfolioValeur({ valeur, devoirId, eleveUid }: Props) {
  const { getAuthHeaders } = useAuthContext();
  const [texte, setTexte] = useState<TexteOeuvre | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const v = valeur.valeur;
  const estOeuvre = v?.genre === 'oeuvre';

  useEffect(() => {
    if (!estOeuvre) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const q = new URLSearchParams({ devoirId, valeurId: valeur.valeurId });
        if (sectionId) q.set('sectionId', sectionId);
        if (eleveUid) q.set('eleve', eleveUid);
        const res = await fetch(`/api/portfolio/valeur?${q}`, { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) {
          setTexte(json.data as TexteOeuvre);
          setErreur(null);
        } else setErreur(json.message || 'Texte indisponible');
      } catch {
        if (!annule) setErreur('Texte indisponible');
      }
    })();
    return () => {
      annule = true;
    };
  }, [estOeuvre, devoirId, valeur.valeurId, sectionId, eleveUid, getAuthHeaders, v?.oeuvreId, v?.sectionId]);

  return (
    <div className={styles.valeur}>
      <div className={styles.valeurTete}>
        <span className={styles.valeurNom}>{valeur.nom}</span>
        {v?.titre && <span className={styles.valeurTitre}>{v.titre}</span>}
      </div>
      {!v ? (
        <p className={styles.lectureVide}>Pas encore attribué par ton professeur.</p>
      ) : estOeuvre ? (
        erreur ? (
          <p className={styles.lectureVide}>{erreur}</p>
        ) : !texte ? (
          <p className={styles.lectureVide}>Chargement du texte…</p>
        ) : (
          <>
            {texte.sections.length > 1 && (
              <select
                className={styles.valeurSelect}
                value={texte.section?.id ?? ''}
                onChange={(e) => setSectionId(e.target.value)}
                aria-label="Choisir la scène"
              >
                {texte.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titre}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.valeurTexte}>
              {texte.section?.blocs.map((b) => <OeuvreBlocRendu key={b.id} bloc={b} />)}
            </div>
          </>
        )
      ) : (
        <PortfolioDepotLien valeur={v.url ?? ''} lectureSeule />
      )}
    </div>
  );
}
