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

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/image-compress';
import { parseYoutubeId } from '@/lib/youtube';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import {
  generateBlocId,
  generateChapitreId,
  type Oeuvre,
  type OeuvreBloc,
  type OeuvreChapitre,
  type OeuvreSection,
} from '@/types/oeuvre';
import type { LectureQuiz } from '@/types/lecture';
import styles from './OeuvreBuilder.module.css';

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

  const fichierRef = useRef<HTMLInputElement>(null);
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
      majSection({ blocs: [...section.blocs, { id: generateBlocId(), type, contenu: '' }] });
    },
    [section, majSection]
  );

  const deplacerBloc = useCallback(
    (index: number, sens: -1 | 1) => {
      if (!section) return;
      const cible = index + sens;
      if (cible < 0 || cible >= section.blocs.length) return;
      const blocs = [...section.blocs];
      [blocs[index], blocs[cible]] = [blocs[cible], blocs[index]];
      majSection({ blocs });
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

  // Dépôt d'image : même chaîne que les questionnaires (compression puis
  // /api/ressources/upload), jamais d'URL externe.
  const deposerImage = useCallback(
    async (fichier: File | undefined) => {
      const blocId = blocCibleRef.current;
      if (!fichier || !blocId) return;
      setOccupe(true);
      try {
        const compresse = await compressImage(fichier);
        if (!compresse) throw new Error('Image incompressible');
        const form = new FormData();
        form.append('files', compresse.blob, compresse.name);
        const h = await headersRef.current();
        // Content-Type laissé au navigateur : il pose lui-même sa boundary
        const res = await fetch('/api/ressources/upload', {
          method: 'POST',
          headers: h?.Authorization ? { Authorization: h.Authorization } : undefined,
          body: form,
        });
        const json = await res.json();
        if (!json.success || !json.data?.files?.[0]) throw new Error(json.message || 'Dépôt refusé');
        majBloc(blocId, { imageUrl: json.data.files[0].url, imageFileId: json.data.files[0].fileId });
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Dépôt impossible');
      } finally {
        setOccupe(false);
        blocCibleRef.current = null;
        if (fichierRef.current) fichierRef.current.value = '';
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

  return (
    <div className={styles.plein}>
      <header className={styles.entete}>
        <div>
          <h2>{oeuvre.titre}</h2>
          <p className={styles.sous}>
            {oeuvre.chapitres.length} chapitres ·{' '}
            {oeuvre.chapitres.reduce((n, c) => n + c.sections.length, 0)} sections
          </p>
        </div>
        <div className={styles.enteteActions}>
          {modifiee && <span className={styles.pastilleModifiee}>modifications non enregistrées</span>}
          <button type="button" className={styles.btnGhost} onClick={fermer}>
            Fermer
          </button>
        </div>
      </header>

      {message && <div className={styles.message}>{message}</div>}

      <div className={styles.corps}>
        {/* ── Sommaire éditable ── */}
        <aside className={styles.sommaire}>
          <div className={styles.sommaireBarre}>
            <span>Sommaire</span>
            <button type="button" className={styles.btnMini} onClick={ajouterChapitre}>
              + chapitre
            </button>
          </div>

          <div className={styles.sommaireListe}>
            {oeuvre.chapitres.map((c) => (
              <section key={c.id} className={styles.chapitre}>
                <div className={styles.chapitreEntete}>
                  <button
                    type="button"
                    className={styles.chapitreTitre}
                    onClick={() => renommerChapitre(c.id)}
                    title="Renommer"
                  >
                    {c.titre}
                  </button>
                  <button
                    type="button"
                    className={styles.btnMini}
                    onClick={() => ajouterSection(c.id)}
                    disabled={occupe}
                  >
                    + section
                  </button>
                </div>

                {c.sections.map((s, i) => {
                  const precedent = i > 0 ? c.sections[i - 1].groupe : undefined;
                  return (
                    <div key={s.id}>
                      {s.groupe && s.groupe !== precedent && (
                        <div className={styles.acte}>{s.groupe}</div>
                      )}
                      <div
                        className={`${styles.ligneSection} ${
                          s.id === sectionId ? styles.ligneActive : ''
                        }`}
                      >
                        <button
                          type="button"
                          className={styles.lienSection}
                          onClick={() => ouvrirSection(s.id)}
                        >
                          {s.titre}
                          {s.aQuestions && <span className={styles.pastille}>✓</span>}
                        </button>
                        <span className={styles.ligneOutils}>
                          <button type="button" onClick={() => deplacerSection(c.id, i, -1)} title="Monter">
                            ↑
                          </button>
                          <button type="button" onClick={() => deplacerSection(c.id, i, 1)} title="Descendre">
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimerSection(s.id)}
                            title="Supprimer"
                            className={styles.outilDanger}
                          >
                            ✕
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {c.sections.length === 0 && <p className={styles.aide}>Aucune section.</p>}
              </section>
            ))}

            {oeuvre.chapitres.length === 0 && (
              <p className={styles.aide}>
                Commence par un chapitre — une pièce, une partie, un acte selon ton découpage.
              </p>
            )}
          </div>
        </aside>

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

              {/* ── Blocs ── */}
              <h3 className={styles.titreSection}>Contenu</h3>

              {section.blocs.map((bloc, index) => (
                <div key={bloc.id} className={styles.bloc}>
                  <div className={styles.blocEntete}>
                    <span className={styles.blocType}>
                      {bloc.type === 'texte' && 'Prose'}
                      {bloc.type === 'vers' && 'Vers'}
                      {bloc.type === 'video' && 'Vidéo'}
                      {bloc.type === 'image' && 'Image'}
                    </span>
                    <span className={styles.blocOutils}>
                      <button type="button" onClick={() => deplacerBloc(index, -1)} title="Monter">
                        ↑
                      </button>
                      <button type="button" onClick={() => deplacerBloc(index, 1)} title="Descendre">
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
                          fichierRef.current?.click();
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
                </div>
              ))}

              <div className={styles.ajoutBlocs}>
                <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('texte')}>
                  + Prose
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('vers')}>
                  + Vers
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('video')}>
                  + Vidéo
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => ajouterBloc('image')}>
                  + Image
                </button>
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
        ref={fichierRef}
        type="file"
        accept="image/*"
        className={styles.inputCache}
        onChange={(e) => deposerImage(e.target.files?.[0])}
      />
    </div>
  );
}
