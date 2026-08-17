'use client';

// Constructeur d'œuvre — écran plein depuis la Bibliothèque d'œuvres.
//
//   Sommaire éditable à gauche · la section ouverte à droite
//
// Ce qu'on y fait : ajouter des chapitres et des scènes, écrire le texte,
// poser une vidéo ou une image À L'ENDROIT VOULU, et composer la vérification
// de lecture — qui n'est autre que le questionnaire de lecture habituel
// (LectureQuizBuilder réutilisé tel quel : c'est le même objet, il doit se
// construire pareil).
//
// ENREGISTREMENT EXPLICITE, jamais automatique : la scénarisation a déjà coûté
// une perte de données. Le bouton dit ce qu'il reste à sauver, et quitter une
// section modifiée demande confirmation.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/image-compress';
import { parseYoutubeId } from '@/lib/youtube';
import { decouperBloc, extraireLocuteur, lignesDuBloc } from '@/lib/oeuvre-decoupe';
import {
  accepteCommentaires,
  baliserContenu,
  indicesDepuisOffsets,
  motsDuBloc,
  recalerCommentaires,
} from '@/lib/oeuvre-commentaires';
import commentaireStyles from '@/components/OeuvreReader/BlocCommente.module.css';
import FlipChoice from '@/components/FlipChoice/FlipChoice';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import OeuvreBlocRendu from '@/components/OeuvreReader/OeuvreBlocRendu';
import OeuvreSectionApercu from './OeuvreSectionApercu';
import OeuvreSommaireEditable from './OeuvreSommaireEditable';
import {
  DOMAINES_INTEGRATION,
  blocsDeFace,
  generateBlocId,
  generateChapitreId,
  generateCommentaireId,
  integrationAutorisee,
  urlDepuisIntegration,
  type Oeuvre,
  type OeuvreBloc,
  type OeuvreChapitre,
  type OeuvreCommentaire,
  type OeuvreFace,
  type OeuvreSection,
} from '@/types/oeuvre';

import type { LectureQuiz } from '@/types/lecture';
import styles from './OeuvreBuilder.module.css';

// Le surlignage du prof est EXACTEMENT celui de l'élève : mêmes classes, même
// module CSS. Deux habillages parallèles divergeraient, et le prof poserait
// des commentaires sans voir ce qu'il pose.
const CLASSES_BALISAGE = {
  mot: commentaireStyles.mot,
  marque: commentaireStyles.marque,
  orphelin: commentaireStyles.orphelin,
};

/** Destination « couverture » d'un dépôt de fichier — voir `blocCibleRef`. */
const CIBLE_COUVERTURE = '__couverture__';

/**
 * Ce qu'un trait d'édition peut faire.
 *
 * `couper` ne s'offre qu'À L'INTÉRIEUR d'un bloc : entre deux blocs, il n'y a
 * rien à séparer — ils le sont déjà.
 * `section` renvoie tout ce qui suit dans une NOUVELLE section du chapitre.
 */
type ActionTrait =
  | { quoi: 'couper' }
  | { quoi: 'inserer'; type: OeuvreBloc['type'] }
  | { quoi: 'section' };

type GesteTrait = {
  action: ActionTrait;
  icone: string;
  label: string;
  intraSeulement?: boolean;
};

/**
 * Ce que le trait propose, PAR FACE.
 *
 * L'espace multimédia n'a ni extrait ni découpage de scène : on n'y compose
 * pas de texte suivi, on y dépose des compléments. Lui offrir « Couper ici »
 * ou « Nouvelle section » serait proposer des gestes sans objet.
 */
const ACTIONS_TRAIT: Record<OeuvreFace, GesteTrait[]> = {
  recto: [
    { action: { quoi: 'couper' }, icone: '✂', label: 'Couper ici', intraSeulement: true },
    { action: { quoi: 'inserer', type: 'texte' }, icone: 'ℹ', label: 'Bloc informatif' },
    { action: { quoi: 'inserer', type: 'vers' }, icone: '📝', label: 'Extrait' },
    { action: { quoi: 'inserer', type: 'video' }, icone: '🎬', label: 'Vidéo' },
    { action: { quoi: 'inserer', type: 'image' }, icone: '🖼', label: 'Image' },
    { action: { quoi: 'section' }, icone: '📄', label: 'Nouvelle section' },
  ],
  verso: [
    { action: { quoi: 'inserer', type: 'video' }, icone: '🎬', label: 'Vidéo' },
    { action: { quoi: 'inserer', type: 'image' }, icone: '🖼', label: 'Image' },
    { action: { quoi: 'inserer', type: 'audio' }, icone: '🎧', label: 'Audio' },
    { action: { quoi: 'inserer', type: 'integration' }, icone: '🧩', label: 'Contenu interactif' },
    { action: { quoi: 'inserer', type: 'texte' }, icone: 'ℹ', label: 'Bloc informatif' },
  ],
};

/**
 * Le trait d'édition — invisible jusqu'au survol, mais sa hauteur est
 * RÉSERVÉE en permanence : s'il n'apparaissait qu'au survol, tout le texte
 * sauterait sous la souris et viser une ligne deviendrait impossible.
 */
function Trait({
  intra,
  face,
  onAction,
}: {
  /** À l'intérieur d'un bloc (on peut y couper) ou entre deux blocs */
  intra: boolean;
  face: OeuvreFace;
  onAction: (a: ActionTrait) => void;
}) {
  return (
    <div className={`${styles.trait} ${intra ? '' : styles.traitEntreBlocs}`}>
      <span className={styles.traitBarre} />
      <span className={styles.traitActions}>
        {ACTIONS_TRAIT[face].filter((a) => intra || !a.intraSeulement).map((a) => (
          <button
            key={a.label}
            type="button"
            // Le trait vit DANS un passage cliquable : sans cet arrêt, choisir
            // « Couper ici » ouvrirait aussi le passage en édition.
            onClick={(e) => {
              e.stopPropagation();
              onAction(a.action);
            }}
            title={
              a.action.quoi === 'couper'
                ? 'Séparer le bloc en deux à cet endroit'
                : a.action.quoi === 'section'
                  ? 'Tout ce qui suit part dans une nouvelle section du chapitre'
                  : `Insérer ici : ${a.label}`
            }
          >
            <span aria-hidden="true">{a.icone}</span> {a.label}
          </button>
        ))}
      </span>
      <span className={styles.traitBarre} />
    </div>
  );
}

/**
 * Un passage AU REPOS : le bloc tel qu'il se lit dans le flux, ligne à ligne.
 * Un clic dessus l'ouvre en édition, à sa place (voir PassageOuvert).
 *
 * Un bloc d'une seule ligne s'affiche comme les autres — il n'a simplement pas
 * de trait intérieur. Le remplacer par un message (« ce bloc n'a qu'une
 * ligne… ») cassait la lecture continue de la scène, qui est justement ce qui
 * permet de décider où couper.
 *
 * Le BLOC INFORMATIF porte un habillage à lui (fond ambré, filet à gauche) :
 * c'est une note du professeur, pas du texte d'auteur, et le flux doit le dire
 * d'un coup d'œil.
 */
function Passage({
  bloc,
  vide,
  face,
  commentaires,
  onAction,
  onOuvrir,
  onSupprimer,
  onSelection,
  onCommentaire,
}: {
  bloc: OeuvreBloc;
  /** Aucun contenu d'aucune sorte : il ne coûte rien de le jeter */
  vide: boolean;
  face: OeuvreFace;
  commentaires: OeuvreCommentaire[];
  onAction: (indexLigne: number, a: ActionTrait) => void;
  onOuvrir: () => void;
  onSupprimer: () => void;
  /** Des mots viennent d'être sélectionnés : on propose de les commenter */
  onSelection: (blocId: string, debut: number, fin: number, rect: DOMRect) => void;
  /** Un passage déjà commenté a été cliqué : on rouvre son commentaire */
  onCommentaire: (id: string) => void;
}) {
  const info = bloc.type === 'texte';

  // Le texte, avec chaque mot enveloppé et les passages commentés surlignés.
  // On balise le contenu ENTIER puis on le recoupe en lignes : le rang des
  // mots court d'une ligne à l'autre, le remettre à zéro à chaque ligne
  // ancrerait les commentaires n'importe où. Le découpage tient parce que le
  // balisage n'ajoute que des balises équilibrées.
  const lignes = useMemo(() => {
    if (!accepteCommentaires(bloc)) return lignesDuBloc(bloc);
    const zones = commentaires
      .filter((c) => c.blocId === bloc.id)
      .map((c) => ({ id: c.id, debut: c.debut, fin: c.fin, orphelin: c.orphelin }));
    const balise = baliserContenu(bloc.contenu || '', info, zones, CLASSES_BALISAGE);
    return lignesDuBloc({ ...bloc, contenu: balise });
  }, [bloc, commentaires, info]);

  /**
   * Le geste distingue les deux intentions, sans remettre un mode :
   * CLIQUER un passage l'ouvre en édition, SÉLECTIONNER des mots propose de
   * les commenter. Un clic qui suit une sélection ne doit donc rien ouvrir.
   */
  const auRelachement = (e: React.MouseEvent) => {
    if (!accepteCommentaires(bloc)) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;
    const plage = selection.getRangeAt(0);

    // ── On prend TOUS LES MOTS QUE LA PLAGE TRAVERSE ──
    // Et non les mots des deux extrémités : les espaces entre les mots sont
    // des nœuds de texte nus, sans `data-mot`. Une sélection qui commence ou
    // finit sur une espace — c'est-à-dire presque toutes — n'avait donc aucune
    // extrémité identifiable, et le bouton n'apparaissait jamais.
    const rangs: number[] = [];
    (e.currentTarget as HTMLElement).querySelectorAll('[data-mot]').forEach((span) => {
      if (!plage.intersectsNode(span)) return;
      // `intersectsNode` est vrai pour un voisin qui ne fait qu'effleurer la
      // plage : on écarte ceux dont aucun caractère n'est réellement dedans.
      const r = document.createRange();
      r.selectNodeContents(span);
      const commenceAvantLaFinDuMot = plage.compareBoundaryPoints(Range.END_TO_START, r) < 0;
      const finitApresLeDebutDuMot = plage.compareBoundaryPoints(Range.START_TO_END, r) > 0;
      if (commenceAvantLaFinDuMot && finitApresLeDebutDuMot) {
        rangs.push(Number(span.getAttribute('data-mot')));
      }
    });
    if (rangs.length === 0) return;

    // Le rectangle de la sélection : c'est là que se posera le bouton, à
    // portée de la souris qui vient de relâcher.
    const rect = plage.getBoundingClientRect();
    e.stopPropagation();
    onSelection(bloc.id, Math.min(...rangs), Math.max(...rangs), rect);
  };

  const auClic = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return;
    const cible = (e.target as HTMLElement).closest('[data-cmt]');
    const id = cible?.getAttribute('data-cmt');
    if (id) {
      e.stopPropagation();
      onCommentaire(id);
      return;
    }
    onOuvrir();
  };

  // Un bloc vide n'a rien à montrer, mais il occupe une place dans la scène :
  // on l'annonce et on offre de le jeter sur-le-champ.
  if (vide) {
    return (
      <p className={styles.blocVide} onClick={onOuvrir}>
        {LIBELLE_BLOC[bloc.type]} vide — clique pour le remplir
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSupprimer();
          }}
          title="Supprimer ce bloc vide"
        >
          ✕ Supprimer
        </button>
      </p>
    );
  }

  // ── LES MÉDIAS SE MONTRENT ──
  // Une ligne « Vidéo » ne dit pas quelle vidéo : le prof ne pouvait vérifier
  // ni son extrait, ni sa gravure, sans ouvrir le bloc un par un. On rend donc
  // le média TEL QUE L'ÉLÈVE LE VERRA — c'est `OeuvreBlocRendu`, le rendu
  // partagé, jamais une seconde version qui divergerait.
  // Le bouton est nécessaire : un cadre YouTube avale les clics, et un média
  // qu'on ne pourrait pas jouer dans le constructeur ne se vérifierait pas.
  if (lignes.length === 0) {
    return (
      <div className={styles.passageMedia}>
        <div className={styles.passageMediaBarre}>
          <span>{LIBELLE_BLOC[bloc.type]}</span>
          <button type="button" onClick={onOuvrir} title="Modifier ce média">
            ✏️ Modifier
          </button>
        </div>
        <OeuvreBlocRendu bloc={bloc} />
      </div>
    );
  }

  return (
    <div
      className={`${styles.passage} ${info ? styles.passageInfo : ''}`}
      onClick={auClic}
      onMouseUp={auRelachement}
      title="Cliquer pour modifier · sélectionner des mots pour les commenter"
    >
      {info && <p className={styles.infoEtiquette}>Bloc informatif</p>}
      {bloc.locuteur && <p className={styles.decoupeLocuteur}>{bloc.locuteur}</p>}
      {lignes.map((ligne, i) => (
        <Fragment key={i}>
          {i > 0 && <Trait intra face={face} onAction={(a) => onAction(i, a)} />}
          {/* Le contenu est balisé (mots enveloppés) : même pour un extrait en
              texte brut, c'est donc du HTML — `baliserContenu` échappe ce qui
              vient du prof. */}
          <div className={styles.decoupeLigne} dangerouslySetInnerHTML={{ __html: ligne || '&nbsp;' }} />
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Les TROIS onglets de la section.
 *
 * Les deux premiers sont les faces de la liseuse — leur libellé DOIT être
 * celui que l'élève lit, sinon le prof compose à l'aveugle. Le troisième est
 * la vérification de lecture : elle vivait au bas de la scène, donc après
 * trente répliques, donc invisible.
 */
type Onglet = OeuvreFace | 'eval';

const ONGLETS: { id: Onglet; label: string; aide: string }[] = [
  {
    id: 'recto',
    label: 'Espace textuel',
    aide: 'Clique sur un passage pour le modifier · sélectionne des mots pour y attacher un commentaire que l’élève ouvrira d’un clic · passe entre deux lignes pour insérer, couper, ou renvoyer la suite dans une nouvelle section.',
  },
  {
    id: 'verso',
    label: 'Espace multimédia',
    aide: 'Les compléments : vidéos, images, enregistrements. L’élève y bascule d’un onglet — ils n’apparaissent que si tu en déposes.',
  },
  {
    id: 'eval',
    label: 'Évaluation de la compréhension',
    aide: 'Facultative. Ce sont ces vérifications que l’élève complète — c’est elles qui comptent dans son total, pas les pages ouvertes. Le corrigé lui est montré immédiatement : dans cet atelier, rien n’est noté.',
  },
];

// Libellés des blocs — ce que le prof lit dans le constructeur.
// « Bloc informatif » et « Extrait » plutôt que « Prose » et « Vers » : on
// nomme la FONCTION pédagogique du bloc, pas sa forme littéraire (une consigne
// n'est pas de la prose, un extrait n'est pas toujours en vers).
const LIBELLE_BLOC: Record<OeuvreBloc['type'], string> = {
  texte: 'Bloc informatif',
  vers: 'Extrait',
  video: 'Vidéo',
  image: 'Image',
  audio: 'Audio',
  integration: 'Contenu interactif',
};

const TexteEditor = dynamic(() => import('@/components/RessourcesInput/DocumentEditor'), {
  ssr: false,
  loading: () => <div className={styles.aide}>Chargement de l’éditeur…</div>,
});

interface OeuvreBuilderProps {
  oeuvre: Oeuvre;
  onFermer: () => void;
  /** Le sommaire a bougé : la bibliothèque doit se rafraîchir */
  onModifie: () => void;
}

export default function OeuvreBuilder({ oeuvre: initiale, onFermer, onModifie }: OeuvreBuilderProps) {
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const [oeuvre, setOeuvre] = useState<Oeuvre>(initiale);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [section, setSection] = useState<OeuvreSection | null>(null);
  const [modifiee, setModifiee] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Onglet en cours — le prof compose une face à la fois, comme l'élève en lit
  // une à la fois.
  const [onglet, setOnglet] = useState<Onglet>('recto');
  // La face éditée découle de l'onglet : sur l'onglet Évaluation, il n'y a pas
  // de flux à afficher, la valeur n'est simplement pas lue.
  const face: OeuvreFace = onglet === 'verso' ? 'verso' : 'recto';
  // Aperçu : la section telle que l'élève la verra, sans quitter l'édition
  const [apercu, setApercu] = useState(false);
  // Le passage ouvert en édition — un seul à la fois : deux champs ouverts
  // dans un même flux, et on ne sait plus lequel on modifie.
  const [blocOuvert, setBlocOuvert] = useState<string | null>(null);
  // Texte collé dans une section vide, avant d'être posé dans la scène
  const [collage, setCollage] = useState('');
  // Des mots sélectionnés, en attente : le bouton « Commenter » flotte au-
  // dessus d'eux tant qu'on ne l'a pas pris ou quitté.
  const [selectionMots, setSelectionMots] = useState<{
    blocId: string;
    debut: number;
    fin: number;
    mots: string;
    x: number;
    y: number;
    /**
     * D'où vient la sélection. ⚠️ Une sélection faite DANS UN CHAMP n'apparaît
     * PAS dans `window.getSelection()` : la surveiller comme celle du texte au
     * repos ferait disparaître le bouton à l'instant où il se pose.
     */
    source: 'repos' | 'champ';
  } | null>(null);
  // Le commentaire en cours de rédaction — soit une sélection fraîche, soit un
  // commentaire existant qu'on rouvre.
  const [redaction, setRedaction] = useState<{
    id: string | null;
    blocId: string;
    debut: number;
    fin: number;
    mots: string;
    texte: string;
  } | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  // Destination du fichier déposé : l'id d'un bloc, ou la couverture du livre.
  // Un id de bloc ne peut pas commencer par « __ » (voir generateBlocId), la
  // sentinelle ne peut donc pas entrer en collision.
  const blocCibleRef = useRef<string | null>(null);

  const entetes = useCallback(async () => (await headersRef.current()) || undefined, []);

  const entetesJson = useCallback(async () => {
    const h = await headersRef.current();
    return { ...(h || {}), 'Content-Type': 'application/json' };
  }, []);

  // ── Sommaire ──

  const enregistrerSommaire = useCallback(
    async (chapitres: OeuvreChapitre[]) => {
      setOeuvre((o) => ({ ...o, chapitres }));
      try {
        await fetch(`/api/oeuvres/${initiale.id}`, {
          method: 'PATCH',
          headers: await entetesJson(),
          body: JSON.stringify({ chapitres }),
        });
        onModifie();
      } catch {
        setMessage('Le sommaire n’a pas pu être enregistré');
      }
    },
    [initiale.id, entetesJson, onModifie]
  );

  const retirerCouverture = useCallback(async () => {
    setOeuvre((o) => ({ ...o, couverture: null }));
    await fetch(`/api/oeuvres/${initiale.id}`, {
      method: 'PATCH',
      headers: await entetesJson(),
      body: JSON.stringify({ couverture: null }),
    });
    onModifie();
  }, [initiale.id, entetesJson, onModifie]);

  const ajouterChapitre = useCallback(() => {
    const titre = prompt('Titre du chapitre (une pièce, une partie…)');
    if (!titre?.trim()) return;
    enregistrerSommaire([
      ...oeuvre.chapitres,
      { id: generateChapitreId(), titre: titre.trim(), sections: [] },
    ]);
  }, [oeuvre.chapitres, enregistrerSommaire]);

  const renommerChapitre = useCallback(
    (id: string) => {
      const chapitre = oeuvre.chapitres.find((c) => c.id === id);
      const titre = prompt('Titre du chapitre', chapitre?.titre || '');
      if (!titre?.trim()) return;
      enregistrerSommaire(
        oeuvre.chapitres.map((c) => (c.id === id ? { ...c, titre: titre.trim() } : c))
      );
    },
    [oeuvre.chapitres, enregistrerSommaire]
  );

  const deplacerSection = useCallback(
    (chapitreId: string, index: number, sens: -1 | 1) => {
      const chapitres = oeuvre.chapitres.map((c) => {
        if (c.id !== chapitreId) return c;
        const cible = index + sens;
        if (cible < 0 || cible >= c.sections.length) return c;
        const sections = [...c.sections];
        [sections[index], sections[cible]] = [sections[cible], sections[index]];
        return { ...c, sections };
      });
      enregistrerSommaire(chapitres);
    },
    [oeuvre.chapitres, enregistrerSommaire]
  );

  const ajouterSection = useCallback(
    async (chapitreId: string) => {
      const titre = prompt('Titre de la section (une scène, un passage…)');
      if (!titre?.trim()) return;
      setOccupe(true);
      try {
        const res = await fetch(`/api/oeuvres/${initiale.id}/sections`, {
          method: 'POST',
          headers: await entetesJson(),
          body: JSON.stringify({ chapitreId, titre: titre.trim() }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setOeuvre((o) => ({
          ...o,
          chapitres: o.chapitres.map((c) =>
            c.id === chapitreId
              ? {
                  ...c,
                  sections: [
                    ...c.sections,
                    { id: json.data.id, titre: json.data.titre, groupe: json.data.groupe, aQuestions: false },
                  ],
                }
              : c
          ),
        }));
        setSectionId(json.data.id);
        setSection(json.data);
        setModifiee(false);
        onModifie();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setOccupe(false);
      }
    },
    [initiale.id, entetesJson, onModifie]
  );

  const supprimerSection = useCallback(
    async (id: string) => {
      if (!confirm('Supprimer cette section et tout son contenu ?')) return;
      try {
        await fetch(`/api/oeuvres/${initiale.id}/sections/${id}`, {
          method: 'DELETE',
          headers: await entetes(),
        });
        setOeuvre((o) => ({
          ...o,
          chapitres: o.chapitres.map((c) => ({
            ...c,
            sections: c.sections.filter((s) => s.id !== id),
          })),
        }));
        if (sectionId === id) {
          setSectionId(null);
          setSection(null);
        }
        onModifie();
      } catch {
        setMessage('Suppression impossible');
      }
    },
    [initiale.id, entetes, sectionId, onModifie]
  );

  // ── Section ouverte ──

  const ouvrirSection = useCallback(
    async (id: string) => {
      if (modifiee && !confirm('Cette section a des modifications non enregistrées. Les abandonner ?')) {
        return;
      }
      setSectionId(id);
      setSection(null);
      setModifiee(false);
      // On ouvre une scène sur son texte, jamais sur ses questions — et jamais
      // avec un passage resté ouvert de la scène précédente.
      setOnglet('recto');
      setBlocOuvert(null);
      setCollage('');
      try {
        const res = await fetch(`/api/oeuvres/${initiale.id}/sections/${id}`, {
          headers: await entetes(),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setSection(json.data);
        // On ouvre la scène sur l'espace que l'élève verra en premier
        setOnglet(json.data?.facesInversees ? 'verso' : 'recto');
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Erreur');
      }
    },
    [initiale.id, entetes, modifiee]
  );

  const majSection = useCallback((champs: Partial<OeuvreSection>) => {
    setSection((s) => (s ? { ...s, ...champs } : s));
    setModifiee(true);
  }, []);

  const enregistrerSection = useCallback(async () => {
    if (!section) return;
    setOccupe(true);
    try {
      // ── RECALAGE DES COMMENTAIRES ──
      // C'est le seul moment où le texte a pu changer. Un commentaire ancré
      // sur des rangs de mots devient faux dès qu'on ajoute une ligne
      // au-dessus de lui : on le fait donc se retrouver lui-même, et on
      // l'annonce quand il n'y parvient pas.
      const commentaires = recalerCommentaires(section.blocs, section.commentaires ?? []);
      const aRecoller = commentaires.filter((c) => c.orphelin).length;
      const aSauver = { ...section, commentaires };

      const res = await fetch(`/api/oeuvres/${initiale.id}/sections/${section.id}`, {
        method: 'PUT',
        headers: await entetesJson(),
        body: JSON.stringify(aSauver),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setSection(json.data);
      setModifiee(false);
      setMessage(
        aRecoller > 0
          ? `Section enregistrée — ${aRecoller} commentaire${aRecoller > 1 ? 's' : ''} à replacer : le texte qu'${aRecoller > 1 ? 'ils surlignaient' : 'il surlignait'} a disparu.`
          : 'Section enregistrée'
      );
      // Le titre et la pastille « vérification » se répercutent au sommaire
      setOeuvre((o) => ({
        ...o,
        chapitres: o.chapitres.map((c) => ({
          ...c,
          sections: c.sections.map((s) =>
            s.id === json.data.id
              ? {
                  ...s,
                  titre: json.data.titre,
                  groupe: json.data.groupe,
                  aQuestions: json.data.questions.length > 0,
                }
              : s
          ),
        })),
      }));
      onModifie();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setOccupe(false);
    }
  }, [section, initiale.id, entetesJson, onModifie]);

  // ── Blocs ──

  const majBloc = useCallback(
    (id: string, champs: Partial<OeuvreBloc>) => {
      if (!section) return;
      majSection({ blocs: section.blocs.map((b) => (b.id === id ? { ...b, ...champs } : b)) });
    },
    [section, majSection]
  );

  /**
   * Le premier geste sur une scène vide : coller le texte d'un seul tenant.
   *
   * UN SEUL BLOC, jamais un découpage automatique. Où commence une réplique,
   * où finit une tirade, ce qui est didascalie : la machine se tromperait, et
   * le prof passerait plus de temps à défaire qu'à découper lui-même. Le
   * locuteur en capitales, lui, ne trompe personne — d'où `extraireLocuteur`.
   */
  const poserCollage = useCallback(() => {
    const texte = collage.trim();
    if (!section || !texte) return;
    const bloc = extraireLocuteur({ id: generateBlocId(), type: 'vers', contenu: texte });
    majSection({ blocs: [...section.blocs, bloc] });
    setCollage('');
    setBlocOuvert(null);
  }, [collage, section, majSection]);

  // Le déplacement se fait DANS la face affichée : l'index vu par le prof
  // n'est pas celui du tableau complet, qui mêle les deux faces.
  const deplacerBloc = useCallback(
    (blocId: string, sens: -1 | 1) => {
      if (!section) return;
      const memeFace = section.blocs.filter((b) => (b.face ?? 'recto') === face);
      const rang = memeFace.findIndex((b) => b.id === blocId);
      const cible = rang + sens;
      if (rang < 0 || cible < 0 || cible >= memeFace.length) return;

      // On permute les deux blocs à leurs positions réelles dans le tableau
      const iA = section.blocs.findIndex((b) => b.id === memeFace[rang].id);
      const iB = section.blocs.findIndex((b) => b.id === memeFace[cible].id);
      const blocs = [...section.blocs];
      [blocs[iA], blocs[iB]] = [blocs[iB], blocs[iA]];
      majSection({ blocs });
    },
    [section, majSection, face]
  );

  // Faire passer un bloc d'une face à l'autre — le geste manquerait sinon à
  // qui a encodé sa vidéo dans le texte et la veut en complément.
  const changerFaceBloc = useCallback(
    (blocId: string, cible: OeuvreFace) => {
      if (!section) return;
      majSection({
        blocs: section.blocs.map((b) =>
          b.id === blocId ? { ...b, face: cible === 'verso' ? 'verso' : undefined } : b
        ),
      });
    },
    [section, majSection]
  );

  // ── LE FLUORAGE COMMENTÉ ──

  /**
   * Des mots viennent d'être sélectionnés : on POSE UN BOUTON, on n'ouvre pas
   * la fenêtre.
   *
   * Ouvrir d'autorité à chaque sélection interromprait tous les autres usages
   * de la sélection — relire une réplique, copier un vers. Le bouton, lui,
   * apparaît là où la souris vient de relâcher : il se voit sans rien
   * imposer, et c'est lui qui apprend au prof que le geste existe.
   */
  const proposerCommentaire = useCallback(
    (blocId: string, debut: number, fin: number, rect: DOMRect) => {
      if (!section) return;
      const bloc = section.blocs.find((b) => b.id === blocId);
      if (!bloc) return;
      const mots = motsDuBloc(bloc).slice(debut, fin + 1).join(' ');
      if (!mots) return;
      setSelectionMots({
        blocId,
        debut,
        fin,
        mots,
        x: rect.left + rect.width / 2,
        y: rect.top,
        source: 'repos',
      });
    },
    [section]
  );

  /**
   * Des mots sélectionnés DANS LE CHAMP d'un passage ouvert.
   *
   * C'est le cas courant, et il était le seul à ne pas marcher : le champ n'a
   * pas de mots balisés, `window.getSelection()` n'y renvoie rien
   * d'exploitable. On passe donc par les offsets de caractères.
   *
   * Le bouton se pose au-dessus du champ (et non au point de la souris) : un
   * double-clic ne donne pas de coordonnées de relâchement fiables, et un
   * bouton qui saute d'un endroit à l'autre se cherche.
   */
  const selectionDansChamp = useCallback(
    (bloc: OeuvreBloc, champ: HTMLTextAreaElement) => {
      const bornes = indicesDepuisOffsets(
        bloc.contenu || '',
        champ.selectionStart ?? 0,
        champ.selectionEnd ?? 0
      );
      if (!bornes) {
        setSelectionMots(null);
        return;
      }
      const mots = motsDuBloc(bloc).slice(bornes.debut, bornes.fin + 1).join(' ');
      if (!mots) return;
      const rect = champ.getBoundingClientRect();
      setSelectionMots({
        blocId: bloc.id,
        debut: bornes.debut,
        fin: bornes.fin,
        mots,
        x: rect.left + rect.width / 2,
        y: rect.top,
        source: 'champ',
      });
    },
    []
  );

  /** Un passage déjà commenté a été cliqué : on rouvre son commentaire. */
  const ouvrirCommentaire = useCallback(
    (id: string) => {
      const c = (section?.commentaires ?? []).find((x) => x.id === id);
      if (!c) return;
      setRedaction({ ...c, id: c.id });
    },
    [section]
  );

  const enregistrerCommentaire = useCallback(() => {
    if (!section || !redaction) return;
    const texte = redaction.texte.trim();
    // Un commentaire vide n'est pas un commentaire : on le retire plutôt que
    // de laisser un surlignage qui n'ouvre rien.
    if (!texte) {
      if (redaction.id) {
        majSection({
          commentaires: (section.commentaires ?? []).filter((c) => c.id !== redaction.id),
        });
      }
      setRedaction(null);
      return;
    }
    const existants = section.commentaires ?? [];
    const commentaire: OeuvreCommentaire = {
      id: redaction.id ?? generateCommentaireId(),
      blocId: redaction.blocId,
      debut: redaction.debut,
      fin: redaction.fin,
      mots: redaction.mots,
      texte,
    };
    majSection({
      commentaires: redaction.id
        ? existants.map((c) => (c.id === redaction.id ? commentaire : c))
        : [...existants, commentaire],
    });
    setRedaction(null);
  }, [section, redaction, majSection]);

  const supprimerCommentaire = useCallback(
    (id: string) => {
      if (!section) return;
      majSection({ commentaires: (section.commentaires ?? []).filter((c) => c.id !== id) });
      setRedaction(null);
    },
    [section, majSection]
  );

  const supprimerBloc = useCallback(
    (id: string) => {
      if (!section) return;
      majSection({ blocs: section.blocs.filter((b) => b.id !== id) });
    },
    [section, majSection]
  );

  /** Un bloc sans contenu d'aucune sorte — donc supprimable sans rien perdre. */
  const blocEstVide = (b: OeuvreBloc) =>
    !b.contenu?.trim() && !b.imageUrl && !b.audioUrl && !b.videoId && !b.videoUrl && !b.locuteur?.trim();

  /**
   * ── OUTIL D'ÉDITION ──
   *
   * Le trait entre deux lignes (ou entre deux blocs) porte cinq gestes. Ils
   * partagent tous la même mécanique : on calcule la liste de blocs qui
   * remplace l'ancienne, et on la pose. Cinq fonctions séparées auraient
   * divergé sur la face, sur le locuteur ou sur l'ordre.
   *
   * `indexLigne` à `null` = le trait est ENTRE deux blocs : rien à couper,
   * on insère seulement.
   */
  const actionTrait = useCallback(
    async (positionFace: number, indexLigne: number | null, action: ActionTrait) => {
      if (!section) return;
      const memeFace = section.blocs.filter((b) => (b.face ?? 'recto') === face);
      const blocs = [...section.blocs];

      // Où insérer dans le tableau COMPLET (les deux faces y cohabitent) :
      // juste avant le bloc de la face qui occupe cette position, ou à la fin.
      const ancre = memeFace[positionFace];
      const iInsertion = ancre ? blocs.findIndex((b) => b.id === ancre.id) : blocs.length;

      const neuf = (type: OeuvreBloc['type']): OeuvreBloc => ({
        id: generateBlocId(),
        type,
        contenu: '',
        ...(face === 'verso' ? { face } : {}),
      });

      // ── 1. Couper le bloc en deux, si le trait est à l'intérieur ──
      // Le résultat sert aux trois gestes : couper, insérer, nouvelle section.
      let iApresCoupe = iInsertion;
      if (indexLigne !== null && ancre) {
        const r = decouperBloc(
          ancre,
          indexLigne,
          null,
          generateBlocId
        );
        if (!r) return;
        blocs.splice(iInsertion, 1, r.haut, r.bas);
        // Ce qui suit le trait commence désormais au bloc « bas »
        iApresCoupe = iInsertion + 1;
      }

      if (action.quoi === 'couper') {
        majSection({ blocs });
        return;
      }

      if (action.quoi === 'inserer') {
        // Le bloc neuf est posé À SA PLACE et s'ouvre aussitôt en édition :
        // le prof écrit là où il vient de décider d'écrire. C'est ce qui a
        // remplacé la popup de saisie — un intermédiaire de plus entre
        // l'intention et le texte.
        const bloc = neuf(action.type);
        blocs.splice(iApresCoupe, 0, bloc);
        majSection({ blocs });
        setBlocOuvert(bloc.id);

        // Image et audio n'ont pas de champ à remplir : leur « champ », c'est
        // le sélecteur de fichier. On l'ouvre dans la foulée.
        if (action.type === 'image' || action.type === 'audio') {
          blocCibleRef.current = bloc.id;
          (action.type === 'image' ? imageRef : audioRef).current?.click();
        }
        return;
      }

      // ── 2. Nouvelle section : tout ce qui suit le trait s'en va ──
      // « Ce qui suit » se compte dans le tableau COMPLET : un complément
      // multimédia posé après ce point part avec le texte auquel il se
      // rapporte. Le laisser derrière le séparerait de sa scène.
      const partants = blocs.slice(iApresCoupe);
      if (partants.length === 0) {
        setMessage('Rien à déplacer : le trait est au bout de la scène.');
        return;
      }
      const titre = prompt(
        'Titre de la nouvelle section',
        `${section.titre} (suite)`
      );
      if (!titre?.trim()) return;

      setOccupe(true);
      try {
        // a. La scène courante, réduite à ce qui reste AVANT le trait. Les
        //    questions ne bougent pas : la vérification porte sur la scène
        //    telle que le prof l'a conçue, pas sur un découpage matériel.
        //    Les COMMENTAIRES, eux, suivent leur bloc : ils sont ancrés sur
        //    ses mots, les laisser derrière les rendrait tous orphelins.
        const restants = blocs.slice(0, iApresCoupe);
        const idsRestants = new Set(restants.map((b) => b.id));
        const tousCommentaires = section.commentaires ?? [];
        const cmtRestants = tousCommentaires.filter((c) => idsRestants.has(c.blocId));
        const cmtPartants = tousCommentaires.filter((c) => !idsRestants.has(c.blocId));

        const resA = await fetch(`/api/oeuvres/${initiale.id}/sections/${section.id}`, {
          method: 'PUT',
          headers: await entetesJson(),
          body: JSON.stringify({ ...section, blocs: restants, commentaires: cmtRestants }),
        });
        if (!(await resA.json()).success) throw new Error('La scène courante n’a pas pu être enregistrée');

        // b. La nouvelle section — créée en fin de chapitre par la route…
        const resB = await fetch(`/api/oeuvres/${initiale.id}/sections`, {
          method: 'POST',
          headers: await entetesJson(),
          body: JSON.stringify({
            chapitreId: section.chapitreId,
            titre: titre.trim(),
            groupe: section.groupe || '',
            colonnes: section.colonnes ?? 1,
          }),
        });
        const jsonB = await resB.json();
        if (!jsonB.success) throw new Error(jsonB.message || 'Création impossible');
        const nouvelle: OeuvreSection = jsonB.data;

        // c. …puis remplie de ce qui suivait le trait
        const resC = await fetch(`/api/oeuvres/${initiale.id}/sections/${nouvelle.id}`, {
          method: 'PUT',
          headers: await entetesJson(),
          body: JSON.stringify({ ...nouvelle, blocs: partants, commentaires: cmtPartants }),
        });
        if (!(await resC.json()).success) throw new Error('Le contenu déplacé n’a pas pu être écrit');

        // d. …et remontée JUSTE APRÈS la scène courante. La route l'a posée en
        //    fin de chapitre : la laisser là mettrait la suite du texte à
        //    trente scènes de son début.
        const chapitres = oeuvre.chapitres.map((c) => {
          if (c.id !== section.chapitreId) return c;
          const sansNouvelle = c.sections.filter((s) => s.id !== nouvelle.id);
          const iCourante = sansNouvelle.findIndex((s) => s.id === section.id);
          const ref = {
            id: nouvelle.id,
            titre: nouvelle.titre,
            groupe: nouvelle.groupe,
            aQuestions: false,
          };
          sansNouvelle.splice(iCourante + 1, 0, ref);
          return { ...c, sections: sansNouvelle };
        });
        await enregistrerSommaire(chapitres);

        setSection({ ...section, blocs: restants, commentaires: cmtRestants });
        setModifiee(false);
        setMessage(`« ${titre.trim()} » créée juste après cette scène.`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Découpage en section impossible');
      } finally {
        setOccupe(false);
      }
    },
    [section, majSection, face, initiale.id, entetesJson, oeuvre.chapitres, enregistrerSommaire]
  );

  // Dépôt d'image ou d'audio : même chaîne que les questionnaires
  // (compression pour l'image, puis /api/ressources/upload), jamais d'URL
  // externe et jamais de Storage — le fichier vit en base64 dans
  // `ressourceImages`, d'où la limite de 700 Ko.
  const deposerFichier = useCallback(
    async (fichier: File | undefined, quoi: 'image' | 'audio') => {
      const blocId = blocCibleRef.current;
      const input = quoi === 'image' ? imageRef : audioRef;
      if (!fichier || !blocId) return;
      setOccupe(true);
      // La couverture emprunte la même chaîne que les blocs (compression →
      // /api/ressources/upload → ressourceImages) : dupliquer l'upload pour
      // une seule image, c'est dupliquer aussi sa gestion d'erreur.
      const versCouverture = blocId === CIBLE_COUVERTURE;
      try {
        let aEnvoyer: Blob = fichier;
        let nom = fichier.name;
        if (quoi === 'image') {
          const compresse = await compressImage(fichier);
          if (!compresse) throw new Error('Image incompressible');
          aEnvoyer = compresse.blob;
          nom = compresse.name;
        } else if (fichier.size > 700_000) {
          // Pas de compression audio côté navigateur : on refuse tôt plutôt
          // que de laisser Firestore rejeter le document (limite de 1 Mo).
          throw new Error('Audio trop lourd (700 Ko maximum, soit 2 à 3 minutes)');
        }

        const form = new FormData();
        form.append('files', aEnvoyer, nom);
        const h = await headersRef.current();
        // Content-Type laissé au navigateur : il pose lui-même sa boundary
        const res = await fetch('/api/ressources/upload', {
          method: 'POST',
          headers: h?.Authorization ? { Authorization: h.Authorization } : undefined,
          body: form,
        });
        const json = await res.json();
        if (!json.success || !json.data?.files?.[0]) throw new Error(json.message || 'Dépôt refusé');
        const f = json.data.files[0];
        if (versCouverture) {
          const couverture = { url: f.url, fileId: f.fileId };
          setOeuvre((o) => ({ ...o, couverture }));
          // Enregistrement immédiat : la couverture n'appartient à aucune
          // section, elle n'est donc pas emportée par la sauvegarde de la
          // section en cours. La laisser en attente, c'est la perdre au
          // premier changement de scène.
          await fetch(`/api/oeuvres/${initiale.id}`, {
            method: 'PATCH',
            headers: await entetesJson(),
            body: JSON.stringify({ couverture }),
          });
          onModifie();
        } else {
          majBloc(
            blocId,
            quoi === 'image'
              ? { imageUrl: f.url, imageFileId: f.fileId }
              : { audioUrl: f.url, audioFileId: f.fileId }
          );
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Dépôt impossible');
      } finally {
        setOccupe(false);
        blocCibleRef.current = null;
        if (input.current) input.current.value = '';
      }
    },
    [majBloc, initiale.id, entetesJson, onModifie]
  );

  // Quitter le constructeur sans rien perdre
  const fermer = useCallback(() => {
    if (modifiee && !confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
    onFermer();
  }, [modifiee, onFermer]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // Changer de passage, d'onglet ou de scène emporte la sélection en attente :
  // le bouton désignerait des mots qui ne sont plus à l'écran.
  useEffect(() => {
    setSelectionMots(null);
  }, [blocOuvert, onglet, sectionId]);

  /**
   * Le bouton « Commenter » suit la sélection : il disparaît dès qu'elle
   * n'existe plus (clic ailleurs) ou dès que la page défile — laissé en
   * place, il désignerait des mots qui ne sont plus sous lui.
   */
  useEffect(() => {
    if (!selectionMots) return;
    const fermer = () => setSelectionMots(null);
    // Dans un champ, c'est `onSelect` qui fait le ménage : la sélection d'un
    // `<textarea>` n'existe pas pour `window.getSelection()`.
    if (selectionMots.source === 'champ') {
      window.addEventListener('scroll', fermer, true);
      return () => window.removeEventListener('scroll', fermer, true);
    }
    // `selectionchange` plutôt que `mousedown` : au moment du mousedown, le
    // navigateur n'a pas encore défait la sélection, et on lirait l'ancienne.
    const siPlusRienDeSelectionne = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.toString().trim()) fermer();
    };
    document.addEventListener('selectionchange', siPlusRienDeSelectionne);
    window.addEventListener('scroll', fermer, true);
    return () => {
      document.removeEventListener('selectionchange', siPlusRienDeSelectionne);
      window.removeEventListener('scroll', fermer, true);
    };
  }, [selectionMots]);

  // Blocs de la face en cours — le prof n'édite jamais les deux à la fois
  const blocsFace = useMemo(
    () => (section ? blocsDeFace(section.blocs, face) : []),
    [section, face]
  );

  // Les commentaires que le recalage n'a pas su replacer — ils n'apparaissent
  // dans aucun passage, il faut donc les montrer à part.
  const orphelins = useMemo(
    () => (section?.commentaires ?? []).filter((c) => c.orphelin),
    [section?.commentaires]
  );

  // Les onglets suivent l'ordre d'arrivée choisi pour la scène : le prof doit
  // les voir dans l'ordre où l'élève les verra, sinon il compose à l'envers.
  const ongletsOrdonnes = useMemo(
    () => (section?.facesInversees ? [ONGLETS[1], ONGLETS[0], ONGLETS[2]] : ONGLETS),
    [section?.facesInversees]
  );

  return (
    <div className={styles.plein}>
      <header className={styles.entete}>
        {/* Le constructeur est un écran plein : sans ces deux repères, on n'a
            plus aucun moyen de revenir — ni au tableau de bord, ni à la
            bibliothèque. */}
        <Link href="/dashboard" className={styles.logoLien} title="Retour à l’accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logoRecto.png" alt="Recto-VersIA" className={styles.logo} />
        </Link>

        <button
          type="button"
          className={styles.btnRetour}
          onClick={fermer}
          title="Revenir à la bibliothèque d’œuvres"
        >
          ← Retour
        </button>

        <div className={styles.enteteTitre}>
          <h2>{oeuvre.titre}</h2>
          <p className={styles.sous}>
            {oeuvre.chapitres.length} chapitres ·{' '}
            {oeuvre.chapitres.reduce((n, c) => n + c.sections.length, 0)} sections
          </p>
        </div>

        <div className={styles.enteteActions}>
          {modifiee && <span className={styles.pastilleModifiee}>modifications non enregistrées</span>}
          {section && (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setApercu(true)}
              title="Voir cette section telle que l’élève la lira"
            >
              👁 Prévisualiser
            </button>
          )}
          <button type="button" className={styles.btnGhost} onClick={fermer}>
            Fermer
          </button>
        </div>
      </header>

      {message && <div className={styles.message}>{message}</div>}

      <div className={styles.corps}>
        <OeuvreSommaireEditable
          chapitres={oeuvre.chapitres}
          sectionCourante={sectionId}
          occupe={occupe}
          couverture={oeuvre.couverture ?? null}
          onDeposerCouverture={() => {
            blocCibleRef.current = CIBLE_COUVERTURE;
            imageRef.current?.click();
          }}
          onRetirerCouverture={retirerCouverture}
          onOuvrirSection={ouvrirSection}
          onAjouterChapitre={ajouterChapitre}
          onRenommerChapitre={renommerChapitre}
          onAjouterSection={ajouterSection}
          onDeplacerSection={deplacerSection}
          onSupprimerSection={supprimerSection}
        />

        {/* ── Section ouverte ── */}
        <main className={styles.editeur}>
          {/* La zone qui DÉFILE. Le pied « Enregistrer » est volontairement en
              dehors : une barre collante dans un conteneur à marge intérieure
              et à `gap` a trop de façons de mal se caler — hors du défilement,
              elle ne peut plus se tromper. */}
          <div className={styles.editeurScroll}>
          {!sectionId && (
            <p className={styles.aideCentre}>
              Choisis une section à gauche, ou crée-en une.
            </p>
          )}

          {sectionId && !section && <p className={styles.aideCentre}>Chargement…</p>}

          {section && (
            <>
              <div className={styles.champsSection}>
                <label className={styles.champ}>
                  Titre
                  <input
                    type="text"
                    value={section.titre}
                    onChange={(e) => majSection({ titre: e.target.value })}
                  />
                </label>
                <label className={styles.champ}>
                  Acte / regroupement
                  <input
                    type="text"
                    value={section.groupe || ''}
                    placeholder="Ex : Acte I"
                    onChange={(e) => majSection({ groupe: e.target.value })}
                  />
                </label>
                <label className={styles.champ}>
                  Mise en page
                  <select
                    value={section.colonnes === 2 ? '2' : '1'}
                    onChange={(e) => majSection({ colonnes: e.target.value === '2' ? 2 : 1 })}
                  >
                    <option value="1">Une colonne</option>
                    <option value="2">Deux colonnes</option>
                  </select>
                </label>
              </div>

              {/* Quel espace l'élève trouve en arrivant. Même sélecteur que
                  la création d'une activité d'écriture (FlipChoice) : c'est
                  le même geste, il doit avoir la même forme. Rien ne déménage
                  pour autant — les blocs gardent leur face, seul l'ordre
                  d'arrivée change. */}
              <FlipChoice
                label="Espaces de la scène"
                faces={['✏️ Espace textuel', '🎬 Espace multimédia']}
                inverse={section.facesInversees === true}
                onChange={(inverse) => {
                  majSection({ facesInversees: inverse });
                  setOnglet(inverse ? 'verso' : 'recto');
                }}
                hint="Le recto est la face affichée à l’ouverture de la scène par l’élève."
                disabled={occupe}
              />

              <label className={styles.champLarge}>
                Chapeau — la phrase de présentation, en italique avant le texte
                <textarea
                  rows={2}
                  value={section.chapeau || ''}
                  onChange={(e) => majSection({ chapeau: e.target.value })}
                />
              </label>

              {/* ── LES TROIS ONGLETS ──
                  Le prof compose une face à la fois, comme l'élève en lit une
                  à la fois. Le troisième onglet porte la vérification de
                  lecture : au bas de la scène, elle arrivait après trente
                  répliques, donc jamais.
                  La barre est COLLANTE : sur une longue scène, changer
                  d'onglet obligeait sinon à remonter tout en haut. */}
              <div className={styles.barreOnglets}>
                <div className={styles.faces} role="tablist">
                  {ongletsOrdonnes.map((o) => {
                    const combien =
                      o.id === 'eval'
                        ? section.questions.length
                        : blocsDeFace(section.blocs, o.id).length;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="tab"
                        aria-selected={onglet === o.id}
                        className={`${styles.face} ${onglet === o.id ? styles.faceActive : ''}`}
                        onClick={() => {
                          setOnglet(o.id);
                          setBlocOuvert(null);
                        }}
                      >
                        {o.label}
                        <span className={styles.faceCompteur}>{combien}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className={styles.aide}>{ONGLETS.find((o) => o.id === onglet)?.aide}</p>

              {/* ══ Onglet Évaluation ══
                  Le questionnaire de lecture, tel quel : c'est le même objet,
                  il se construit avec le même outil. */}
              {onglet === 'eval' && (
                <LectureQuizBuilder
                  value={{ mode: 'worksheet', questions: section.questions }}
                  onChange={(quiz: LectureQuiz) => majSection({ questions: quiz.questions })}
                  getAuthHeaders={headersRef.current}
                />
              )}

              {/* ══ Onglets de contenu : LE FLUX, toujours modifiable ══
                  Il n'y a plus deux modes (lire / éditer) : les cartes de
                  blocs hachaient le texte, et c'est la lecture suivie de la
                  scène qui permet de décider où couper. Un clic ouvre le
                  passage à sa place ; le trait insère entre deux lignes. */}
              {onglet !== 'eval' && (
                <>
                  {/* Une scène vide s'ouvre sur une zone de collage : le
                      premier geste du prof, c'est de coller le texte d'un
                      seul tenant. Il le débitera ensuite de l'intérieur. */}
                  {face === 'recto' && blocsFace.length === 0 && (
                    <div className={styles.zoneCollage}>
                      <h4>Colle ici le texte de la scène</h4>
                      <p>
                        D’un seul tenant — tu le découperas ensuite ligne à ligne, sans quitter
                        cette page. Un nom de personnage en capitales sur la première ligne
                        devient le locuteur.
                      </p>
                      <textarea
                        value={collage}
                        onChange={(e) => setCollage(e.target.value)}
                        placeholder="Colle le texte…"
                        rows={8}
                      />
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={!collage.trim()}
                        onClick={poserCollage}
                      >
                        Poser ce texte dans la scène
                      </button>
                    </div>
                  )}

                  {face === 'verso' && blocsFace.length === 0 && (
                    <p className={styles.aide}>
                      Aucun complément. Tant que cet espace reste vide, l’élève ne voit aucun
                      onglet : il lit simplement le texte.
                    </p>
                  )}

                  {/* Un clic dans le vide du flux referme le passage ouvert —
                      d'où le test sur la cible : un clic SUR un passage ne
                      doit pas le refermer aussitôt. */}
                  <div
                    className={styles.fluxEdition}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setBlocOuvert(null);
                    }}
                  >
                    <Trait intra={false} face={face} onAction={(a) => actionTrait(0, null, a)} />

                    {blocsFace.map((bloc, index) => (
                      <Fragment key={bloc.id}>
                        {index > 0 && (
                          <Trait
                            intra={false}
                            face={face}
                            onAction={(a) => actionTrait(index, null, a)}
                          />
                        )}

                        {blocOuvert === bloc.id ? (
                          /* ══ LE PASSAGE OUVERT ══
                             Le champ prend la place exacte du texte : le prof
                             écrit là où il lisait. */
                          <div
                            className={`${styles.passageOuvert} ${
                              bloc.type === 'texte' ? styles.passageInfo : ''
                            }`}
                          >
                            {bloc.type === 'texte' && (
                              <>
                                <p className={styles.infoEtiquette}>Bloc informatif</p>
                                {/* Éditeur riche, et non un simple champ : ces
                                    blocs portent du gras, des listes, des
                                    liens — les réduire à du texte brut
                                    perdrait tout ce qui est déjà encodé. */}
                                <TexteEditor
                                  content={bloc.contenu || ''}
                                  onChange={(html: string) => majBloc(bloc.id, { contenu: html })}
                                  placeholder="Une note, une consigne, une présentation…"
                                />
                              </>
                            )}

                            {bloc.type === 'vers' && (
                              <>
                                <input
                                  type="text"
                                  className={styles.champLocuteur}
                                  placeholder="Personnage qui parle (facultatif)"
                                  value={bloc.locuteur || ''}
                                  onChange={(e) => majBloc(bloc.id, { locuteur: e.target.value })}
                                />
                                {/* La sélection DANS le champ est le vrai geste
                                    du prof : cliquer un passage l'ouvre, il
                                    ne lit donc plus jamais le texte au repos.
                                    `onSelect` couvre tout — glisser, double-
                                    clic, Maj+flèches. */}
                                <textarea
                                  className={styles.zoneVers}
                                  rows={Math.max(3, (bloc.contenu || '').split('\n').length + 1)}
                                  autoFocus
                                  placeholder="Un vers par ligne — ils ne seront ni coupés ni justifiés."
                                  value={bloc.contenu || ''}
                                  onChange={(e) => majBloc(bloc.id, { contenu: e.target.value })}
                                  onSelect={(e) => selectionDansChamp(bloc, e.currentTarget)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setBlocOuvert(null);
                                  }}
                                />
                              </>
                            )}

                            {bloc.type === 'video' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Lien YouTube ou Google Drive"
                                  autoFocus
                                  value={
                                    bloc.videoId ? `https://youtu.be/${bloc.videoId}` : bloc.videoUrl || ''
                                  }
                                  onChange={(e) => {
                                    const brut = e.target.value.trim();
                                    const yt = parseYoutubeId(brut);
                                    // YouTube : on ne garde que l'identifiant.
                                    // Drive : le lecteur intégré (/preview),
                                    // seul format affichable.
                                    if (yt) majBloc(bloc.id, { videoId: yt, videoUrl: undefined });
                                    else {
                                      const drive = brut.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
                                      majBloc(bloc.id, {
                                        videoId: undefined,
                                        videoUrl: drive
                                          ? `https://drive.google.com/file/d/${drive[1]}/preview`
                                          : brut,
                                      });
                                    }
                                  }}
                                />
                                <input
                                  type="text"
                                  placeholder="Légende (facultatif)"
                                  value={bloc.legende || ''}
                                  onChange={(e) => majBloc(bloc.id, { legende: e.target.value })}
                                />
                              </>
                            )}

                            {bloc.type === 'image' && (
                              <>
                                {bloc.imageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={bloc.imageUrl} alt="" className={styles.apercuImage} />
                                )}
                                <button
                                  type="button"
                                  className={styles.btnGhost}
                                  disabled={occupe}
                                  onClick={() => {
                                    blocCibleRef.current = bloc.id;
                                    imageRef.current?.click();
                                  }}
                                >
                                  {bloc.imageUrl ? 'Remplacer l’image' : 'Déposer une image'}
                                </button>
                                <input
                                  type="text"
                                  placeholder="Légende (facultatif)"
                                  value={bloc.legende || ''}
                                  onChange={(e) => majBloc(bloc.id, { legende: e.target.value })}
                                />
                              </>
                            )}

                            {/* Contenu interactif : une page tierce embarquée.
                                Le domaine est vérifié à la frappe ET côté
                                serveur — une iframe exécute du code étranger
                                dans une page vue par des mineurs. */}
                            {bloc.type === 'integration' && (
                              <>
                                {/* On accepte le bloc `<iframe …>` du bouton
                                    « Intégrer » aussi bien que l'adresse nue :
                                    c'est le premier qu'on colle naturellement.
                                    Le `type` reste `text` — un champ `url`
                                    refuserait le collage avant qu'on ait pu en
                                    extraire l'adresse. */}
                                <input
                                  type="text"
                                  placeholder="Colle l’adresse ou le code &lt;iframe&gt; de l’outil"
                                  value={bloc.integrationUrl || ''}
                                  onChange={(e) =>
                                    majBloc(bloc.id, {
                                      integrationUrl: urlDepuisIntegration(e.target.value),
                                    })
                                  }
                                />
                                {bloc.integrationUrl &&
                                  !integrationAutorisee(bloc.integrationUrl) && (
                                    <p className={styles.aideRefus}>
                                      Domaine non autorisé. Admis : {DOMAINES_INTEGRATION.slice(0, 8).join(', ')}…
                                      Demande l’ajout d’un domaine si le tien manque.
                                    </p>
                                  )}
                                <label className={styles.champHauteur}>
                                  Hauteur du cadre
                                  <input
                                    type="number"
                                    min={200}
                                    max={1200}
                                    step={20}
                                    value={bloc.integrationHauteur || 520}
                                    onChange={(e) =>
                                      majBloc(bloc.id, {
                                        integrationHauteur: Math.max(
                                          200,
                                          Math.min(1200, Number(e.target.value) || 520)
                                        ),
                                      })
                                    }
                                  />
                                  px
                                </label>
                                <input
                                  type="text"
                                  placeholder="Légende (facultatif)"
                                  value={bloc.legende || ''}
                                  onChange={(e) => majBloc(bloc.id, { legende: e.target.value })}
                                />
                              </>
                            )}

                            {bloc.type === 'audio' && (
                              <>
                                {bloc.audioUrl && (
                                  <audio controls src={bloc.audioUrl} className={styles.apercuAudio} />
                                )}
                                <button
                                  type="button"
                                  className={styles.btnGhost}
                                  disabled={occupe}
                                  onClick={() => {
                                    blocCibleRef.current = bloc.id;
                                    audioRef.current?.click();
                                  }}
                                >
                                  {bloc.audioUrl ? 'Remplacer l’audio' : 'Déposer un audio'}
                                </button>
                                <input
                                  type="text"
                                  placeholder="Légende (facultatif)"
                                  value={bloc.legende || ''}
                                  onChange={(e) => majBloc(bloc.id, { legende: e.target.value })}
                                />
                              </>
                            )}

                            <div className={styles.outilsPassage}>
                              <button
                                type="button"
                                onClick={() => deplacerBloc(bloc.id, -1)}
                                title="Monter"
                                disabled={index === 0}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => deplacerBloc(bloc.id, 1)}
                                title="Descendre"
                                disabled={index === blocsFace.length - 1}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  changerFaceBloc(bloc.id, face === 'recto' ? 'verso' : 'recto')
                                }
                                title={
                                  face === 'recto'
                                    ? 'Déplacer vers l’espace multimédia'
                                    : 'Ramener dans l’espace textuel'
                                }
                              >
                                {face === 'recto' ? '⇥ Multimédia' : '⇤ Texte'}
                              </button>
                              <button type="button" onClick={() => setBlocOuvert(null)}>
                                ✓ Terminé
                              </button>
                              <button
                                type="button"
                                className={styles.outilDanger}
                                onClick={() => {
                                  supprimerBloc(bloc.id);
                                  setBlocOuvert(null);
                                }}
                                title="Supprimer ce passage"
                              >
                                ✕ Supprimer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <Passage
                            bloc={bloc}
                            vide={blocEstVide(bloc)}
                            face={face}
                            commentaires={section.commentaires ?? []}
                            onAction={(indexLigne, a) => actionTrait(index, indexLigne, a)}
                            onOuvrir={() => setBlocOuvert(bloc.id)}
                            onSupprimer={() => supprimerBloc(bloc.id)}
                            onSelection={proposerCommentaire}
                            onCommentaire={ouvrirCommentaire}
                          />
                        )}
                      </Fragment>
                    ))}

                    {blocsFace.length > 0 && (
                      <Trait
                        intra={false}
                        face={face}
                        onAction={(a) => actionTrait(blocsFace.length, null, a)}
                      />
                    )}
                  </div>

                  {/* ── Les commentaires à replacer ──
                      Un commentaire dont le bloc a disparu ne s'affiche nulle
                      part : sans cette liste, il serait ni réparable ni
                      supprimable, et compterait pourtant dans la section. */}
                  {orphelins.length > 0 && (
                    <div className={styles.orphelins}>
                      <h4>
                        {orphelins.length} commentaire{orphelins.length > 1 ? 's' : ''} à replacer
                      </h4>
                      <p className={styles.aide}>
                        Le texte qu’ils surlignaient a été modifié ou supprimé. Ils ne sont plus
                        montrés à l’élève. Repose-les sur les bons mots, ou jette-les.
                      </p>
                      {orphelins.map((c) => (
                        <div key={c.id} className={styles.orphelinLigne}>
                          <span className={styles.orphelinMots}>« {c.mots} »</span>
                          <span className={styles.orphelinTexte}>{c.texte}</span>
                          <button type="button" onClick={() => supprimerCommentaire(c.id)}>
                            ✕ Supprimer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

            </>
          )}
          </div>

          {section && (
            <div className={styles.piedEditeur}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={enregistrerSection}
                disabled={occupe || !modifiee}
              >
                {occupe ? 'Enregistrement…' : modifiee ? 'Enregistrer la section' : 'Enregistré'}
              </button>
            </div>
          )}
        </main>
      </div>

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className={styles.inputCache}
        onChange={(e) => deposerFichier(e.target.files?.[0], 'image')}
      />
      <input
        ref={audioRef}
        type="file"
        accept="audio/*"
        className={styles.inputCache}
        onChange={(e) => deposerFichier(e.target.files?.[0], 'audio')}
      />

      {/* ── Le bouton qui flotte au-dessus des mots sélectionnés ──
          C'est LUI qui apprend le geste : sans rien à l'écran, il fallait
          deviner qu'une sélection ouvrait quelque chose. Il se pose au milieu
          de la sélection, juste au-dessus. */}
      {selectionMots && (
        <button
          type="button"
          className={styles.boutonCommenter}
          style={{ left: selectionMots.x, top: selectionMots.y - 10 }}
          onMouseDown={(e) => e.preventDefault()} // garder la sélection visible
          onClick={() => {
            setRedaction({
              id: null,
              blocId: selectionMots.blocId,
              debut: selectionMots.debut,
              fin: selectionMots.fin,
              mots: selectionMots.mots,
              texte: '',
            });
            setSelectionMots(null);
          }}
        >
          🖍 Commenter ces mots
        </button>
      )}

      {/* ── Saisie d'un commentaire sur des mots ──
          Le prof voit les mots qu'il surligne en tête de la fenêtre : sans
          eux, il écrit à l'aveugle et découvre son erreur chez l'élève. */}
      {redaction && (
        <div
          className={styles.cmtOverlay}
          onClick={(e) => e.target === e.currentTarget && setRedaction(null)}
        >
          <div className={styles.cmtFenetre} role="dialog" aria-modal="true">
            <header className={styles.cmtEntete}>
              <h3>Commentaire sur des mots</h3>
              <button type="button" onClick={() => setRedaction(null)} aria-label="Fermer">
                ✕
              </button>
            </header>
            <div className={styles.cmtCorps}>
              <p className={styles.cmtMots}>« {redaction.mots} »</p>
              <textarea
                className={styles.cmtChamp}
                rows={5}
                autoFocus
                value={redaction.texte}
                placeholder="Ce que l’élève lira en cliquant sur ces mots…"
                onChange={(e) => setRedaction({ ...redaction, texte: e.target.value })}
              />
            </div>
            <div className={styles.cmtPied}>
              {redaction.id && (
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => supprimerCommentaire(redaction.id!)}
                >
                  Supprimer
                </button>
              )}
              <button type="button" className={styles.btnGhost} onClick={() => setRedaction(null)}>
                Annuler
              </button>
              <button type="button" className={styles.btnPrimary} onClick={enregistrerCommentaire}>
                {redaction.id ? 'Modifier' : 'Commenter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Aperçu de la section en cours ──
          Le prof compose dans des champs de formulaire ; l'élève lit une page.
          Sans cet aperçu, la mise en page (deux colonnes, tirades, médias
          centrés) ne se découvre qu'en ouvrant l'activité côté élève. */}
      {apercu && section && (
        <OeuvreSectionApercu section={section} onFermer={() => setApercu(false)} />
      )}
    </div>
  );
}
