'use client';

// Aperçu d'une section — ce que l'élève lira, sans quitter le constructeur.
//
// Le prof compose dans des champs de formulaire ; l'élève lit une PAGE. La
// mise en page (deux colonnes, tirades non justifiées, médias centrés, faces
// recto/verso) ne se voit nulle part dans le formulaire.
//
// Il réutilise le rendu de la liseuse (`OeuvreBlocRendu`) et ses styles :
// c'est la seule façon qu'un aperçu ne devienne pas un mensonge au premier
// ajustement de la liseuse.
//
// Ce qui n'y figure PAS, volontairement : la vérification de lecture. Elle
// s'aperçoit déjà dans le constructeur de questionnaire, et l'y rejouer
// ferait croire qu'on peut y répondre.

import { useEffect, useState } from 'react';
import OeuvreBlocRendu from '@/components/OeuvreReader/OeuvreBlocRendu';
import { blocsDeFace, type OeuvreFace, type OeuvreSection } from '@/types/oeuvre';
import liseuse from '@/components/OeuvreReader/OeuvreReader.module.css';
import styles from './OeuvreBuilder.module.css';

interface Props {
  section: OeuvreSection;
  onFermer: () => void;
}

export default function OeuvreSectionApercu({ section, onFermer }: Props) {
  const [face, setFace] = useState<OeuvreFace>('recto');
  const blocs = blocsDeFace(section.blocs, face);
  const aUnVerso = blocsDeFace(section.blocs, 'verso').length > 0;

  // Échap ferme l'aperçu : on y entre pour un coup d'œil, on doit pouvoir en
  // sortir sans viser une croix.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFermer]);

  return (
    <div
      className={styles.apercuOverlay}
      onClick={(e) => e.target === e.currentTarget && onFermer()}
    >
      <div className={styles.apercuFenetre} role="dialog" aria-modal="true">
        <header className={styles.apercuEntete}>
          <div>
            <h3>Aperçu — vue de l’élève</h3>
            <p className={styles.apercuSous}>
              {section.groupe ? `${section.groupe} · ` : ''}
              {section.titre}
              {section.questions.length > 0 && (
                <> · {section.questions.length} question{section.questions.length > 1 ? 's' : ''} de vérification</>
              )}
            </p>
          </div>
          <button type="button" className={styles.apercuFermer} onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </header>

        {aUnVerso && (
          <div className={styles.apercuFaces}>
            <button
              type="button"
              className={`${styles.face} ${face === 'recto' ? styles.faceActive : ''}`}
              onClick={() => setFace('recto')}
            >
              Espace textuel
            </button>
            <button
              type="button"
              className={`${styles.face} ${face === 'verso' ? styles.faceActive : ''}`}
              onClick={() => setFace('verso')}
            >
              Espace multimédia
            </button>
          </div>
        )}

        <div className={styles.apercuCorps}>
          {face === 'recto' && section.chapeau && (
            <p className={liseuse.chapeau}>{section.chapeau}</p>
          )}

          {blocs.length === 0 ? (
            <p className={styles.aide}>
              {face === 'recto'
                ? 'Cette section n’a encore aucun contenu.'
                : 'Aucun complément multimédia — l’élève ne verra pas cet onglet.'}
            </p>
          ) : (
            <div
              className={
                face === 'recto' && section.colonnes === 2 ? liseuse.texteDeuxColonnes : undefined
              }
            >
              {blocs.map((bloc) => (
                <OeuvreBlocRendu key={bloc.id} bloc={bloc} />
              ))}
            </div>
          )}
        </div>

        <footer className={styles.apercuPied}>
          <span className={styles.apercuNote}>
            Aperçu de la mise en page seule — la vérification de lecture ne s’y joue pas.
          </span>
          <button type="button" className={styles.btnGhost} onClick={onFermer}>
            Fermer l’aperçu
          </button>
        </footer>
      </div>
    </div>
  );
}
