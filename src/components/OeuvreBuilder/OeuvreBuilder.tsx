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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/image-compress';
import { parseYoutubeId } from '@/lib/youtube';
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

  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
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
        majBloc(
          blocId,
          quoi === 'image'
            ? { imageUrl: f.url, imageFileId: f.fileId }
            : { audioUrl: f.url, audioFileId: f.fileId }
        );
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Dépôt impossible');
      } finally {
        setOccupe(false);
        blocCibleRef.current = null;
        if (input.current) input.current.value = '';
      }
    },
    [majBloc]
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
          onOuvrirSection={ouvrirSection}
          onAjouterChapitre={ajouterChapitre}
          onRenommerChapitre={renommerChapitre}
          onAjouterSection={ajouterSection}
          onDeplacerSection={deplacerSection}
          onSupprimerSection={supprimerSection}
        />

        {/* ── Section ouverte ── */}
        <main className={styles.editeur}>
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
              <p className={styles.aide}>{FACES.find((f) => f.id === face)?.aide}</p>

              {blocsFace.length === 0 && (
                <p className={styles.aide}>
                  {face === 'recto'
                    ? 'Aucun contenu — commence par un bloc informatif ou un extrait.'
                    : 'Aucun complément. Tant que cet espace reste vide, l’élève ne voit aucun onglet : il lit simplement le texte.'}
                </p>
              )}

              {blocsFace.map((bloc, index) => (
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
            </>
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
