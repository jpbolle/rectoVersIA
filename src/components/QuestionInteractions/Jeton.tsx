'use client';

// Le contenu d'un jeton — texte, image ou audio.
// Partagé par les quatre types manipulés : sans ce composant, l'appariement
// et les ensembles afficheraient une image de deux tailles différentes au
// premier ajustement.

import type { LectureJeton } from '@/types/lecture';

export default function JetonContenu({ jeton }: { jeton: LectureJeton }) {
  if (jeton.kind === 'image' && jeton.media) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={jeton.media.url} alt={jeton.texte || 'Illustration'} />
        {jeton.texte && <span>{jeton.texte}</span>}
      </>
    );
  }

  if (jeton.kind === 'audio' && jeton.media) {
    return (
      <>
        {/* Pas de limite d'écoutes ici : un appariement sonore qu'on ne peut
            réécouter en comparant les items n'a pas de sens. La limite reste
            réservée à l'audio de la QUESTION (dictée, compréhension). */}
        <audio
          controls
          preload="none"
          src={jeton.media.url}
          style={{ height: 32, maxWidth: 200 }}
          // Le lecteur ne doit pas déclencher le glisser du jeton
          onPointerDown={(e) => e.stopPropagation()}
        />
        {jeton.texte && <span>{jeton.texte}</span>}
      </>
    );
  }

  return <span>{jeton.texte}</span>;
}
