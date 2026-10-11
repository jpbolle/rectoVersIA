'use client';

// Carte d'une ACTIVITÉ FLE (Mes ressources FLE) ou d'une SÉQUENCE (tableau de
// bord, espace FLE) — sur le gabarit commun RessourceCard (plan 2026-10-11).
// Ses actions propres passent par `actionsEnPlus`, en tête du pied :
// « Voir les copies » / « Ouvrir la ligne du temps » (même geste que le clic),
// « Modifier » (la popup de réglages, distincte de l'ouverture) et, pour une
// activité FLE, la bascule « Corrigé visible », qui n'a pas d'autre endroit.
// L'ouverture d'une séquence aux élèves se règle dans Mes Activités (ou par
// « Modifier »).

import type { MouseEvent } from 'react';
import { BookCheck, Compass, Inbox, Pencil } from 'lucide-react';
import type { Devoir } from '@/types/devoir';
import { atelierLabel } from '@/types/didactique';
import { iconeAtelier } from '@/types/sequence-fle';
import RessourceCard from '@/components/RessourceCard/RessourceCard';
import rc from '@/components/RessourceCard/RessourceCard.module.css';

interface Props {
  devoir: Devoir;
  // Clic sur la carte et bouton principal : les copies d'une activité,
  // l'atelier d'une séquence
  onOuvrir: (d: Devoir) => void;
  onEditer: (d: Devoir) => void;
  onDupliquer: (d: Devoir) => void;
  onToggleArchive: (id: string, archive: boolean) => void;
  // Activité FLE seulement
  onToggleCorrigeDisponible?: (id: string, corrigeDisponible: boolean) => void;
  // Activité d'un COLLÈGUE (bloc « des professeurs ») : on la lit, on la duplique, rien d'autre
  lectureSeule?: boolean;
}

export default function ActiviteRessourceCard({
  devoir,
  onOuvrir,
  onEditer,
  onDupliquer,
  onToggleArchive,
  onToggleCorrigeDisponible,
  lectureSeule = false,
}: Props) {
  const sequence = devoir.typeTravail === 'sequence';
  const nbEtapes = devoir.sequenceFle?.etapes.length ?? 0;
  const certificatif = devoir.evaluation === 'certificatif';
  const nbCopies = devoir.submittedCount ?? 0;
  // Les boutons ont leur propre geste : ne pas ouvrir la carte en plus
  const action = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const etiquettes = [
    sequence ? 'Séquence' : atelierLabel(devoir.atelier ?? '', true),
    certificatif ? 'Certificatif' : 'Formatif',
    ...(sequence ? [devoir.disponible ? 'Ouverte' : 'Fermée'] : devoir.corrigeDisponible ? ['Corrigé visible'] : []),
    ...(devoir.archive ? ['Archivé'] : []),
  ];

  const description = sequence
    ? `🎓 ${devoir.classes.length ? devoir.classes.join(', ') : 'aucune classe'} · 🪜 ${nbEtapes} étape${nbEtapes > 1 ? 's' : ''}`
    : `📥 ${nbCopies} copie${nbCopies > 1 ? 's remises' : ' remise'}`;

  const titreOuvrir = sequence ? 'Ouvrir la ligne du temps' : 'Voir les copies';
  const actionsEnPlus = lectureSeule ? undefined : (
    <>
      <button type="button" className={rc.btnIcone} onClick={action(() => onOuvrir(devoir))} title={titreOuvrir} aria-label={titreOuvrir}>
        {sequence ? <Compass size={16} aria-hidden="true" /> : <Inbox size={16} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className={rc.btnIcone}
        onClick={action(() => onEditer(devoir))}
        title={sequence ? 'Réglages de la séquence' : 'Modifier'}
        aria-label={sequence ? 'Réglages de la séquence' : 'Modifier'}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      {!sequence && onToggleCorrigeDisponible && (
        <button
          type="button"
          className={`${rc.btnIcone} ${devoir.corrigeDisponible ? rc.btnActif : ''}`}
          onClick={action(() => onToggleCorrigeDisponible(devoir.id, !devoir.corrigeDisponible))}
          title={devoir.corrigeDisponible ? 'Corrigé visible des élèves — cliquer pour le masquer' : 'Corrigé masqué — cliquer pour le rendre visible'}
          aria-label="Corrigé visible"
          aria-pressed={devoir.corrigeDisponible}
        >
          <BookCheck size={16} aria-hidden="true" />
        </button>
      )}
    </>
  );

  return (
    <RessourceCard
      icone={iconeAtelier(devoir.atelier)}
      titre={devoir.intitule}
      etiquettes={etiquettes}
      description={description}
      archivee={devoir.archive}
      onOuvrir={lectureSeule ? undefined : () => onOuvrir(devoir)}
      titreOuvrir={titreOuvrir}
      actionsEnPlus={actionsEnPlus}
      onDupliquer={() => onDupliquer(devoir)}
      onArchiver={lectureSeule ? undefined : () => onToggleArchive(devoir.id, !devoir.archive)}
      // Activité d'un collègue : on la duplique, rien d'autre
      lectureSeule={lectureSeule}
    />
  );
}
