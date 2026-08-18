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

import { integrationAutorisee } from '@/types/oeuvre';
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

  // intégration — une page tierce embarquée (Genially, frise, exerciseur).
  // L'URL est revérifiée à l'affichage : un document écrit avant la liste
  // blanche, ou par une requête forgée, ne doit pas s'afficher pour autant.
  if (bloc.type === 'integration') {
    if (!integrationAutorisee(bloc.integrationUrl)) {
      return (
        <figure className={styles.media}>
          <p className={styles.integrationRefus}>
            Contenu externe non affiché — le domaine n’est pas autorisé.
          </p>
        </figure>
      );
    }
    // ── LA TAILLE DU CADRE ──
    // `integrationLargeur` est un PLAFOND (`maxWidth`), jamais une largeur
    // imposée : sur un Chromebook la colonne est plus étroite, et c'est elle
    // qui doit gagner — sinon le cadre déborde de la page.
    //
    // Quand les proportions d'origine sont conservées, la hauteur n'est pas
    // calculée en pixels mais confiée à `aspect-ratio` : elle suit donc la
    // largeur RÉELLE du cadre après réduction, ce qu'un calcul fait ici ne
    // saurait pas faire (il ignore la largeur de la colonne).
    const proportionnel = bloc.integrationProportions === true && !!bloc.integrationRatio;
    const cadre: React.CSSProperties = proportionnel
      ? { aspectRatio: String(bloc.integrationRatio) }
      : { height: `${bloc.integrationHauteur || 520}px` };
    if (bloc.integrationLargeur) cadre.maxWidth = `${bloc.integrationLargeur}px`;

    return (
      <figure className={styles.media}>
        <div className={styles.cadreIntegration} style={cadre}>
          <iframe
            src={bloc.integrationUrl}
            title={bloc.legende || 'Contenu interactif'}
            allow="fullscreen; encrypted-media"
            allowFullScreen
            // Le contenu tiers tourne en bac à sable : il peut s'exécuter et
            // naviguer, mais n'accède ni au document parent ni à sa session.
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            referrerPolicy="no-referrer"
          />
        </div>
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
