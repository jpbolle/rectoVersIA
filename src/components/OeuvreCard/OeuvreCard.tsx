'use client';

// Carte d'une œuvre — sur le gabarit commun RessourceCard (plan 2026-10-11) :
// plus de ✏️, la carte s'ouvre au clic (éditeur si je peux l'éditer, sommaire
// sinon). L'archivage a son icône d'archive : la 🗑️ faisait croire à une
// suppression.

import type { Oeuvre } from '@/types/oeuvre';
import RessourceCard from '@/components/RessourceCard/RessourceCard';

interface OeuvreCardProps {
  oeuvre: Oeuvre;
  /** Œuvre de l'utilisateur : il l'édite, la partage, l'archive */
  mienne: boolean;
  /** Œuvre d'un collègue partagée EN CO-ÉDITION : éditable sans être à moi */
  coEditable?: boolean;
  /** Mode de partage dont je bénéficie, pour l'afficher */
  partageRecu?: 'lecture' | 'edition' | null;
  onVoir: (o: Oeuvre) => void;
  onEditer?: (o: Oeuvre) => void;
  onPartager?: (o: Oeuvre) => void;
  onDupliquer: (o: Oeuvre) => void;
  onArchiver?: (o: Oeuvre) => void;
  /** « Utiliser pour une classe » — absent = pas de bouton */
  onUtiliser?: (o: Oeuvre) => void;
}

function compterSections(o: Oeuvre): number {
  return o.chapitres.reduce((n, c) => n + c.sections.length, 0);
}

/**
 * Sections portant une vérification de lecture.
 *
 * `aQuestions` vit déjà dans le sommaire : le compteur ne coûte donc aucune
 * requête supplémentaire — les questions elles-mêmes, elles, dorment dans la
 * sous-collection.
 */
function compterFormulaires(o: Oeuvre): number {
  return o.chapitres.reduce((n, c) => n + c.sections.filter((s) => s.aQuestions).length, 0);
}

export default function OeuvreCard({
  oeuvre,
  mienne,
  coEditable = false,
  partageRecu = null,
  onVoir,
  onEditer,
  onPartager,
  onDupliquer,
  onArchiver,
  onUtiliser,
}: OeuvreCardProps) {
  const sections = compterSections(oeuvre);
  const formulaires = compterFormulaires(oeuvre);
  const nbChapitres = oeuvre.chapitres.length;
  const nbPartages = oeuvre.partages?.length ?? 0;
  const editable = (mienne || coEditable) && !oeuvre.archive;

  const etiquettes = [
    `${nbChapitres} chapitre${nbChapitres > 1 ? 's' : ''}`,
    `${sections} section${sections > 1 ? 's' : ''}`,
    // Ce que le livre demande à l'élève : le seul compteur qui dise si l'œuvre
    // est déjà exploitable en classe ou s'il reste à écrire les vérifications.
    `${formulaires} vérification${formulaires > 1 ? 's' : ''}`,
  ];
  if (oeuvre.archive) etiquettes.push('Archivée');
  const pastilles = [
    ...etiquettes,
    ...(mienne && nbPartages > 0
      ? [
          <span key="partages" title={oeuvre.partages!.map((p) => p.nom || p.email).join(', ')}>
            Partagée ×{nbPartages}
          </span>,
        ]
      : []),
    ...(partageRecu ? [partageRecu === 'edition' ? 'Co-édition' : 'Lecture seule'] : []),
    // Repère sur mes propres œuvres : celle-ci ne sort pas de chez moi
    ...(mienne && oeuvre.prive ? ['🔒 Privé'] : []),
  ];

  // L'auteur ne se répète pas s'il est déjà dans le titre
  // (« Molière — Anthologie comique »)
  const auteur =
    oeuvre.auteur && !oeuvre.titre.toLowerCase().includes(oeuvre.auteur.toLowerCase()) ? oeuvre.auteur : null;
  const sousTitre = [auteur, !mienne && oeuvre.profName ? `de ${oeuvre.profName}` : null].filter(Boolean).join(' · ');

  return (
    <RessourceCard
      icone="📖"
      titre={oeuvre.titre}
      etiquettes={pastilles}
      sousTitre={sousTitre || undefined}
      // La couverture se reconnaît d'un coup d'œil, là où douze « 📖 »
      // identiques ne se départagent qu'en lisant les titres
      visuel={
        oeuvre.couverture ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={oeuvre.couverture.url} alt="" />
        ) : undefined
      }
      archivee={oeuvre.archive}
      // Clic : ce que faisait ✏️ (œuvre éditable) ou l'œil (sinon)
      onOuvrir={editable && onEditer ? () => onEditer(oeuvre) : () => onVoir(oeuvre)}
      titreOuvrir={editable ? (coEditable ? 'Éditer (co-édition)' : 'Éditer le contenu') : 'Voir le sommaire'}
      // L'œil seulement sur une œuvre qu'on ne peut PAS éditer : sur les
      // siennes, il ferait double emploi avec l'ouverture en modifiable
      onVoir={!editable ? () => onVoir(oeuvre) : undefined}
      onPartager={mienne && !oeuvre.archive && onPartager ? () => onPartager(oeuvre) : undefined}
      partagee={nbPartages > 0}
      titrePartager={
        nbPartages > 0
          ? `Partagée avec ${nbPartages} collègue${nbPartages > 1 ? 's' : ''} — modifier`
          : 'Partager avec un collègue'
      }
      onDupliquer={() => onDupliquer(oeuvre)}
      // Archiver seulement (le panneau n'a pas de « restaurer ») : pas de bouton
      // sur une œuvre déjà archivée
      onArchiver={mienne && !oeuvre.archive && onArchiver ? () => onArchiver(oeuvre) : undefined}
      principale={onUtiliser ? { libelle: 'Utiliser pour une classe', onClick: () => onUtiliser(oeuvre) } : undefined}
      // Œuvre d'un collègue que je ne peux pas éditer : Voir + « Dupliquer »
      lectureSeule={!mienne && !editable}
    />
  );
}
