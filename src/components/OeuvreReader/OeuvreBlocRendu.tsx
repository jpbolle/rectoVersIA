'use client';

// Le rendu d'UN bloc d'une section d'œuvre.
//
// Extrait de la liseuse pour une raison précise : l'aperçu du constructeur
// (côté prof) doit montrer EXACTEMENT ce que l'élève lira. Deux rendus
// parallèles divergeraient au premier ajustement, et l'aperçu deviendrait un
// mensonge — ce qui est pire que pas d'aperçu du tout.
//
// Un bloc s'affiche pareil qu'il soit posé dans l'espace textuel ou dans
// l'espace multimédia : ce qui change, c'est seulement l'endroit où le prof
// l'a rangé.

import type { OeuvreBloc, OeuvreCommentaire } from '@/types/oeuvre';
import { youtubeEmbedUrl } from '@/lib/youtube';
import BlocCommente from './BlocCommente';
import styles from './OeuvreReader.module.css';

interface Props {
  bloc: OeuvreBloc;
  /**
   * Le fluorage commenté. Absent ou vide : le rendu ne change pas d'un iota
   * et ne coûte rien — les 67 scènes de Molière n'en portent aucun.
   */
  commentaires?: OeuvreCommentaire[];
  onCommentaire?: (id: string) => void;
}

export default function OeuvreBlocRendu({ bloc, commentaires, onCommentaire }: Props) {
  const commentes = (commentaires ?? []).filter((c) => c.blocId === bloc.id && !c.orphelin);

  if (bloc.type === 'texte') {
    if (commentes.length > 0) {
      return (
        <BlocCommente
          bloc={bloc}
          commentaires={commentes}
          onCommentaire={onCommentaire}
          className={styles.prose}
        />
      );
    }
    return (
      <div className={styles.prose} dangerouslySetInnerHTML={{ __html: bloc.contenu || '' }} />
    );
  }

  if (bloc.type === 'vers') {
    if (commentes.length > 0) {
      return (
        <BlocCommente
          bloc={bloc}
          commentaires={commentes}
          onCommentaire={onCommentaire}
          className={styles.tirade}
          ligneClassName={styles.vers}
        />
      );
    }
    return (
      <div className={styles.tirade}>
        {bloc.locuteur && <p className={styles.locuteur}>{bloc.locuteur}</p>}
        {(bloc.contenu || '').split('\n').map((vers, i) => (
          <p key={i} className={styles.vers}>
            {vers}
          </p>
        ))}
      </div>
    );
  }

  if (bloc.type === 'image') {
    // Les médias ne suivent pas les colonnes du texte : ils se centrent sur
    // toute la largeur, sinon une image tombe dans une demi-colonne.
    return (
      <figure className={styles.media}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bloc.imageUrl} alt={bloc.legende || ''} className={styles.image} />
        {bloc.legende && <figcaption className={styles.legende}>{bloc.legende}</figcaption>}
      </figure>
    );
  }

  if (bloc.type === 'audio') {
    if (!bloc.audioUrl) return null;
    return (
      <figure className={styles.media}>
        <audio controls src={bloc.audioUrl} className={styles.audio} />
        {bloc.legende && <figcaption className={styles.legende}>{bloc.legende}</figcaption>}
      </figure>
    );
  }

  // vidéo — YouTube ou lecteur Drive
  const src = bloc.videoId ? youtubeEmbedUrl(bloc.videoId) : bloc.videoUrl;
  if (!src) return null;
  return (
    <figure className={styles.media}>
      <div className={styles.cadreVideo}>
        <iframe
          src={src}
          title={bloc.legende || 'Vidéo'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      {bloc.legende && <figcaption className={styles.legende}>{bloc.legende}</figcaption>}
    </figure>
  );
}
