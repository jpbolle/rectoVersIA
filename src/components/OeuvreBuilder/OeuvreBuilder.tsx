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
import SaisieBlocModal from './SaisieBlocModal';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import OeuvreSectionApercu from './OeuvreSectionApercu';
import OeuvreSommaireEditable from './OeuvreSommaireEditable';
import {
  blocsDeFace,
  generateBlocId,
  generateChapitreId,
  type Oeuvre,
  type OeuvreBloc,
  type OeuvreChapitre,
  type OeuvreFace,
  type OeuvreSection,
} from '@/types/oeuvre';
import type { LectureQuiz } from '@/types/lecture';
import styles from './OeuvreBuilder.module.css';

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

const ACTIONS_TRAIT: {
  action: ActionTrait;
  icone: string;
  label: string;
  intraSeulement?: boolean;
}[] = [
  { action: { quoi: 'couper' }, icone: '✂', label: 'Couper ici', intraSeulement: true },
  { action: { quoi: 'inserer', type: 'texte' }, icone: 'ℹ', label: 'Bloc informatif' },
  { action: { quoi: 'inserer', type: 'vers' }, icone: '📝', label: 'Extrait' },
  { action: { quoi: 'inserer', type: 'video' }, icone: '🎬', label: 'Vidéo' },
  { action: { quoi: 'inserer', type: 'image' }, icone: '🖼', label: 'Image' },
  { action: { quoi: 'section' }, icone: '📄', label: 'Nouvelle section' },
];

/**
 * Le trait d'édition — invisible jusqu'au survol, mais sa hauteur est
 * RÉSERVÉE en permanence : s'il n'apparaissait qu'au survol, tout le texte
 * sauterait sous la souris et viser une ligne deviendrait impossible.
 */
function Trait({
  intra,
  onAction,
}: {
  /** À l'intérieur d'un bloc (on peut y couper) ou entre deux blocs */
  intra: boolean;
  onAction: (a: ActionTrait) => void;
}) {
  return (
    <div className={`${styles.trait} ${intra ? '' : styles.traitEntreBlocs}`}>
      <span className={styles.traitBarre} />
      <span className={styles.traitActions}>
        {ACTIONS_TRAIT.filter((a) => intra || !a.intraSeulement).map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onAction(a.action)}
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
 * Un bloc affiché EN LECTURE pendant l'édition, ligne à ligne.
 *
 * Un bloc d'une seule ligne s'affiche comme les autres — il n'a simplement pas
 * de trait intérieur. Le remplacer par un message (« ce bloc n'a qu'une
 * ligne… ») cassait la lecture continue de la scène, qui est justement ce qui
 * permet de décider où couper.
 */
function BlocEnLecture({
  bloc,
  vide,
  onAction,
  onSupprimer,
}: {
  bloc: OeuvreBloc;
  /** Aucun contenu d'aucune sorte : il ne coûte rien de le jeter */
  vide: boolean;
  onAction: (indexLigne: number, a: ActionTrait) => void;
  onSupprimer: () => void;
}) {
  const lignes = lignesDuBloc(bloc);

  // Un bloc vide n'a rien à montrer, mais il occupe une place dans la scène :
  // on l'annonce et on offre de le jeter sur-le-champ. Sans cela il faudrait
  // quitter l'outil d'édition pour aller le supprimer dans la liste.
  if (vide) {
    return (
      <p className={styles.blocVide}>
        {LIBELLE_BLOC[bloc.type]} vide
        <button type="button" onClick={onSupprimer} title="Supprimer ce bloc vide">
          ✕ Supprimer
        </button>
      </p>
    );
  }

  // Les médias n'ont pas de lignes : on les annonce quand même, sans quoi le
  // prof perd le fil de sa scène là où il a posé une vidéo.
  if (lignes.length === 0) {
    return (
      <p className={styles.decoupeMedia}>
        {LIBELLE_BLOC[bloc.type]}
        {bloc.legende ? ` — ${bloc.legende}` : ''}
      </p>
    );
  }

  return (
    <div className={styles.blocEnLecture}>
      {bloc.locuteur && <p className={styles.decoupeLocuteur}>{bloc.locuteur}</p>}
      {lignes.map((ligne, i) => (
        <Fragment key={i}>
          {i > 0 && <Trait intra onAction={(a) => onAction(i, a)} />}
          {bloc.type === 'texte' ? (
            <div className={styles.decoupeLigne} dangerouslySetInnerHTML={{ __html: ligne }} />
          ) : (
            <p className={styles.decoupeLigne}>{ligne || ' '}</p>
          )}
        </Fragment>
      ))}
    </div>
  );
}

// Les deux faces de la liseuse, côté prof. Le libellé DOIT être celui que
// l'élève lit, sinon le prof compose à l'aveugle.
const FACES: { id: OeuvreFace; label: string; aide: string }[] = [
  {
    id: 'recto',
    label: 'Espace textuel',
    aide: 'Le texte de la scène. Une image ou une vidéo peut s’y intercaler à l’endroit voulu.',
  },
  {
    id: 'verso',
    label: 'Espace multimédia',
    aide: 'Les compléments : vidéos, images, enregistrements. L’élève y bascule d’un onglet — ils n’apparaissent que si tu en déposes.',
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
  // Face en cours d'édition — le prof compose une face à la fois, comme
  // l'élève en lit une à la fois.
  const [face, setFace] = useState<OeuvreFace>('recto');
  // Aperçu : la section telle que l'élève la verra, sans quitter l'édition
  const [apercu, setApercu] = useState(false);
  // Mode découpe : on colle une scène entière dans un bloc, puis on la débite
  // de l'intérieur. Les éditeurs se retirent le temps de la découpe.
  const [modeDecoupe, setModeDecoupe] = useState(false);
  // Popup de saisie ouverte pour une insertion en attente : on demande le
  // contenu AVANT de poser le bloc.
  const [saisie, setSaisie] = useState<{
    positionFace: number;
    indexLigne: number | null;
    type: OeuvreBloc['type'];
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
      // La découpe est un moment de travail, pas un réglage : on ouvre toujours
      // une scène dans son éditeur, jamais dans les ciseaux.
      setModeDecoupe(false);
      try {
        const res = await fetch(`/api/oeuvres/${initiale.id}/sections/${id}`, {
          headers: await entetes(),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setSection(json.data);
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
      const res = await fetch(`/api/oeuvres/${initiale.id}/sections/${section.id}`, {
        method: 'PUT',
        headers: await entetesJson(),
        body: JSON.stringify(section),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setSection(json.data);
      setModifiee(false);
      setMessage('Section enregistrée');
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

  const ajouterBloc = useCallback(
    (type: OeuvreBloc['type']) => {
      if (!section) return;
      majSection({
        blocs: [
          ...section.blocs,
          // `face` n'est écrite que pour le verso : absente = recto, ce qui
          // laisse intactes les œuvres encodées avant l'existence des faces.
          { id: generateBlocId(), type, contenu: '', ...(face === 'verso' ? { face } : {}) },
        ],
      });
    },
    [section, majSection, face]
  );

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
    async (
      positionFace: number,
      indexLigne: number | null,
      action: ActionTrait,
      /** Contenu déjà saisi dans la popup — `undefined` = il reste à demander */
      contenuSaisi?: string
    ) => {
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
        // Le prof colle son contenu LÀ OÙ il vient de décider de le poser.
        // Poser un bloc vide l'obligeait à quitter l'outil, retrouver le bloc
        // dans la liste, coller, puis revenir — quatre gestes pour un collage.
        if (contenuSaisi === undefined && action.type !== 'image' && action.type !== 'audio') {
          setSaisie({ positionFace, indexLigne, type: action.type });
          return;
        }

        let bloc = neuf(action.type);
        if (contenuSaisi?.trim()) {
          if (action.type === 'video') {
            const brut = contenuSaisi.trim();
            const yt = parseYoutubeId(brut);
            // YouTube : on ne garde que l'identifiant. Drive : le lecteur
            // intégré (/preview), seul format affichable.
            bloc = yt
              ? { ...bloc, videoId: yt }
              : { ...bloc, videoUrl: brut.replace('/view', '/preview') };
          } else {
            bloc = { ...bloc, contenu: contenuSaisi };
            // Un extrait collé porte souvent son personnage en première ligne
            if (action.type === 'vers') bloc = extraireLocuteur(bloc);
          }
        }

        blocs.splice(iApresCoupe, 0, bloc);
        majSection({ blocs });

        // L'image n'a pas de champ à remplir : son « champ », c'est le
        // sélecteur de fichier. On l'ouvre dans la foulée.
        if (action.type === 'image') {
          blocCibleRef.current = bloc.id;
          imageRef.current?.click();
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
        const restants = blocs.slice(0, iApresCoupe);
        const resA = await fetch(`/api/oeuvres/${initiale.id}/sections/${section.id}`, {
          method: 'PUT',
          headers: await entetesJson(),
          body: JSON.stringify({ ...section, blocs: restants }),
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
          body: JSON.stringify({ ...nouvelle, blocs: partants }),
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

        setSection({ ...section, blocs: restants });
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

  // Blocs de la face en cours — le prof n'édite jamais les deux à la fois
  const blocsFace = useMemo(
    () => (section ? blocsDeFace(section.blocs, face) : []),
    [section, face]
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

              <label className={styles.champLarge}>
                Chapeau — la phrase de présentation, en italique avant le texte
                <textarea
                  rows={2}
                  value={section.chapeau || ''}
                  onChange={(e) => majSection({ chapeau: e.target.value })}
                />
              </label>

              {/* ── Blocs, face par face ──
                  Le prof compose une face à la fois, comme l'élève en lit une
                  à la fois : mêler les deux dans une seule liste rendrait
                  impossible de savoir ce que l'élève verra d'abord. */}
              <h3 className={styles.titreSection}>Contenu</h3>

              {/* ── Barre des faces + outil d'édition ──
                  COLLANTE : sur une scène de trente répliques, le bouton
                  disparaissait dès qu'on faisait défiler, et on ne pouvait
                  plus quitter l'outil d'édition sans remonter tout en haut. */}
              <div className={styles.barreOnglets}>
                <div className={styles.faces} role="tablist">
                  {FACES.map((f) => {
                    const combien = blocsDeFace(section.blocs, f.id).length;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={face === f.id}
                        className={`${styles.face} ${face === f.id ? styles.faceActive : ''}`}
                        onClick={() => setFace(f.id)}
                      >
                        {f.label}
                        <span className={styles.faceCompteur}>{combien}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Un INTERRUPTEUR et non un bouton : l'outil d'édition est un
                    état dans lequel on entre et dont on sort, pas une action
                    qu'on déclenche. La forme doit le dire. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={modeDecoupe}
                  className={`${styles.bascule} ${modeDecoupe ? styles.basculeActive : ''}`}
                  onClick={() => setModeDecoupe((m) => !m)}
                  title="Permet le découpage d’un bloc de texte en plusieurs, l’ajout de commentaires ou de documents"
                >
                  <span className={styles.basculeTexte}>✂ Outil d’édition</span>
                  <span className={styles.basculeRail} aria-hidden="true">
                    <span className={styles.basculeBouton} />
                  </span>
                </button>
              </div>

              <p className={styles.aide}>
                {modeDecoupe
                  ? 'Passe entre deux lignes ou entre deux blocs, puis choisis ce qui s’insère là. Les noms de personnages en capitales deviennent le locuteur des extraits.'
                  : FACES.find((f) => f.id === face)?.aide}
              </p>

              {blocsFace.length === 0 && (
                <p className={styles.aide}>
                  {face === 'recto'
                    ? 'Aucun contenu — commence par un bloc informatif ou un extrait.'
                    : 'Aucun complément. Tant que cet espace reste vide, l’élève ne voit aucun onglet : il lit simplement le texte.'}
                </p>
              )}

              {/* ── MODE ÉDITION : un flux continu ──
                  Les cartes de blocs et leurs en-têtes hachent le texte ; or
                  c'est justement la lecture suivie de la scène qui permet de
                  décider où couper. En édition, on affiche donc la scène d'un
                  seul tenant, avec un trait entre chaque ligne ET entre chaque
                  bloc — les frontières de blocs restent visibles par le trait
                  lui-même, légèrement marqué au repos. */}
              {modeDecoupe && (
                <div className={styles.fluxEdition}>
                  <Trait
                    intra={false}
                    onAction={(a) => actionTrait(0, null, a)}
                  />
                  {blocsFace.map((bloc, i) => (
                    <Fragment key={bloc.id}>
                      {i > 0 && (
                        <Trait intra={false} onAction={(a) => actionTrait(i, null, a)} />
                      )}
                      <BlocEnLecture
                        bloc={bloc}
                        vide={blocEstVide(bloc)}
                        onAction={(indexLigne, a) => actionTrait(i, indexLigne, a)}
                        onSupprimer={() => supprimerBloc(bloc.id)}
                      />
                    </Fragment>
                  ))}
                  {blocsFace.length > 0 && (
                    <Trait
                      intra={false}
                      onAction={(a) => actionTrait(blocsFace.length, null, a)}
                    />
                  )}
                </div>
              )}

              {!modeDecoupe && blocsFace.map((bloc, index) => (
                <div key={bloc.id} className={styles.bloc}>
                  <div className={styles.blocEntete}>
                    <span className={styles.blocType}>{LIBELLE_BLOC[bloc.type]}</span>
                    <span className={styles.blocOutils}>
                      <button
                        type="button"
                        onClick={() => changerFaceBloc(bloc.id, face === 'recto' ? 'verso' : 'recto')}
                        title={
                          face === 'recto'
                            ? 'Déplacer vers l’espace multimédia'
                            : 'Ramener dans l’espace textuel'
                        }
                      >
                        {face === 'recto' ? '⇥' : '⇤'}
                      </button>
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
                        onClick={() => supprimerBloc(bloc.id)}
                        className={styles.outilDanger}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </span>
                  </div>

                  {bloc.type === 'texte' && (
                    <TexteEditor
                      content={bloc.contenu || ''}
                      onChange={(html: string) => majBloc(bloc.id, { contenu: html })}
                      placeholder="Le texte, l’analyse, la présentation…"
                    />
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
                      <textarea
                        className={styles.zoneVers}
                        rows={6}
                        placeholder="Un vers par ligne — ils ne seront ni coupés ni justifiés."
                        value={bloc.contenu || ''}
                        onChange={(e) => majBloc(bloc.id, { contenu: e.target.value })}
                      />
                    </>
                  )}

                  {bloc.type === 'video' && (
                    <>
                      <input
                        type="text"
                        placeholder="Lien YouTube ou Google Drive"
                        value={bloc.videoId ? `https://youtu.be/${bloc.videoId}` : bloc.videoUrl || ''}
                        onChange={(e) => {
                          const brut = e.target.value.trim();
                          const yt = parseYoutubeId(brut);
                          // YouTube : on ne garde que l'identifiant. Drive : le
                          // lecteur intégré (/preview), seul format affichable.
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
                </div>
              ))}

              {/* Les types proposés suivent la face : composer un extrait dans
                  l'espace multimédia n'aurait aucun sens, et l'inverse
                  encombrerait le texte. */}
              <div className={styles.ajoutBlocs}>
                {face === 'recto' && (
                  <>
                    <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('texte')}>
                      + Bloc informatif
                    </button>
                    <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('vers')}>
                      + Extrait
                    </button>
                  </>
                )}
                <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('video')}>
                  + Vidéo
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('image')}>
                  + Image
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('audio')}>
                  + Audio
                </button>
                {face === 'verso' && (
                  <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('texte')}>
                    + Bloc informatif
                  </button>
                )}
              </div>

              {/* ── Vérification de lecture ──
                  Le questionnaire de lecture, tel quel : c'est le même objet,
                  il se construit avec le même outil. */}
              <h3 className={styles.titreSection}>Vérification de lecture</h3>
              <p className={styles.aide}>
                Facultative. Ce sont ces vérifications que l’élève complète — c’est elles qui
                comptent dans son total, pas les pages ouvertes. Le corrigé lui est montré
                immédiatement : dans cet atelier, rien n’est noté.
              </p>
              <LectureQuizBuilder
                value={{ mode: 'worksheet', questions: section.questions }}
                onChange={(quiz: LectureQuiz) => majSection({ questions: quiz.questions })}
                getAuthHeaders={headersRef.current}
              />

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

      {/* Saisie du contenu au moment de l'insertion (voir SaisieBlocModal) */}
      {saisie && (
        <SaisieBlocModal
          type={saisie.type}
          onAnnuler={() => setSaisie(null)}
          onValider={(contenu) => {
            const s = saisie;
            setSaisie(null);
            actionTrait(s.positionFace, s.indexLigne, { quoi: 'inserer', type: s.type }, contenu);
          }}
        />
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
