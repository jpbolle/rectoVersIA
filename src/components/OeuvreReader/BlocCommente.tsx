'use client';

// Le texte d'un bloc AVEC ses commentaires surlignés.
//
// Un seul composant pour le prof et pour l'élève : le prof doit voir
// exactement ce qu'il pose. Ce qui change entre les deux, ce n'est pas le
// rendu, c'est ce qu'on fait du clic — et les commentaires ORPHELINS, que
// seul le prof voit (l'élève n'a pas à lire une note posée sur des mots qui
// n'existent plus).
//
// Chaque mot est enveloppé dans un `<span data-mot="rang">` : c'est ce qui
// permet au prof de sélectionner « du mot 12 au mot 15 » sans arithmétique
// d'offsets, et à l'élève de cliquer un passage surligné.
//
// ⚠️ Les passages commentés portent `role="button"` : le clic-mot du
// dictionnaire (DictionaryClickLayer) laisse passer ces éléments-là, les deux
// mécanismes ne se marchent donc pas dessus.

import { useMemo } from 'react';
import { baliserContenu, baliserVers } from '@/lib/oeuvre-commentaires';
import type { OeuvreBloc, OeuvreCommentaire } from '@/types/oeuvre';
import styles from './BlocCommente.module.css';

interface Props {
  bloc: OeuvreBloc;
  commentaires: OeuvreCommentaire[];
  /** Vue prof : les orphelins s'affichent, signalés */
  montrerOrphelins?: boolean;
  /** Un passage commenté a été cliqué */
  onCommentaire?: (id: string) => void;
  /** Classes de mise en page du texte lui-même (tirade, prose…) */
  className?: string;
  ligneClassName?: string;
}

const CLASSES = {
  mot: styles.mot,
  marque: styles.marque,
  orphelin: styles.orphelin,
};

export default function BlocCommente({
  bloc,
  commentaires,
  montrerOrphelins = false,
  onCommentaire,
  className,
  ligneClassName,
}: Props) {
  const zones = useMemo(
    () =>
      commentaires
        .filter((c) => c.blocId === bloc.id)
        .filter((c) => montrerOrphelins || !c.orphelin)
        .map((c) => ({ id: c.id, debut: c.debut, fin: c.fin, orphelin: c.orphelin })),
    [commentaires, bloc.id, montrerOrphelins]
  );

  const lignes = useMemo(
    () =>
      bloc.type === 'texte'
        ? [baliserContenu(bloc.contenu || '', true, zones, CLASSES)]
        : baliserVers(bloc.contenu || '', zones, CLASSES),
    [bloc.type, bloc.contenu, zones]
  );

  /**
   * Un clic sur un passage commenté l'ouvre. Une SÉLECTION, elle, ne doit
   * rien ouvrir : c'est le geste par lequel le prof choisit des mots, et il
   * finit forcément par un relâchement de souris sur un mot.
   */
  const auClic = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return;
    const cible = (e.target as HTMLElement).closest('[data-cmt]');
    const id = cible?.getAttribute('data-cmt');
    if (id && onCommentaire) {
      e.stopPropagation();
      onCommentaire(id);
    }
  };

  return (
    <div className={className} onClick={auClic}>
      {bloc.locuteur && <p className={styles.locuteur}>{bloc.locuteur}</p>}
      {lignes.map((html, i) => (
        <div
          key={i}
          className={ligneClassName}
          dangerouslySetInnerHTML={{ __html: html || '&nbsp;' }}
        />
      ))}
    </div>
  );
}
