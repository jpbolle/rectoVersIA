// Le pictogramme d'un statut IA (images de JP, public/ia-statut/). Une simple
// <img> : fichier statique de quelques Ko, rien à optimiser par next/image.

import { STATUT_IA_LABELS, type StatutIA } from '@/types/portfolio';

interface Props {
  statut: StatutIA;
  className?: string;
  // Vide quand l'intitulé est écrit à côté (sinon il serait lu deux fois)
  alt?: string;
}

export default function IaPicto({ statut, className, alt = '' }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={STATUT_IA_LABELS[statut].image} alt={alt} className={className} />;
}
