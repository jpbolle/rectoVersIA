'use client';

// ─── « Prendre un extrait dans une œuvre » ───
//
// Demande de JP du 2026-08-15, dans le rollup de l'atelier Œuvre :
//
//   « JP veut pouvoir monter EN APPOINT une interrogation de lecture
//     classique en tirant un ou plusieurs extraits de l'œuvre au lieu de les
//     recopier. »
//
// Une œuvre vit en RESSOURCE réutilisable : l'anthologie Molière tient 67
// scènes déjà encodées. Recopier une tirade dans un questionnaire, c'est
// dupliquer un texte qu'on a déjà, et laisser les deux copies diverger dès la
// première correction de coquille.
//
// Ce que le sélecteur rend : du TEXTE BRUT, pas une référence vivante. Une
// citation dans une interrogation notée ne doit pas changer sous les pieds de
// l'élève parce que le prof a retouché l'anthologie entre-temps. C'est un
// copier-coller assisté, et c'est le bon niveau d'engagement.

import { useCallback, useEffect, useState } from 'react';
import { useOeuvres } from '@/hooks/useOeuvres';
import type { Oeuvre, OeuvreBloc, OeuvreSection } from '@/types/oeuvre';
import styles from './ExtraitOeuvreModal.module.css';

interface Props {
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  /** Reçoit le texte des blocs retenus, déjà mis en forme */
  onInserer: (texte: string) => void;
  onFermer: () => void;
}

/** Les blocs dont on peut tirer du texte. Une vidéo ne se cite pas. */
function estCitable(b: OeuvreBloc): boolean {
  return (b.type === 'texte' || b.type === 'vers') && !!b.contenu?.trim();
}

/** Un bloc en texte brut, prêt à coller dans un champ de questionnaire. */
function blocEnTexte(b: OeuvreBloc): string {
  // Les blocs « texte » sont du HTML (Tiptap), les « vers » du texte brut où
  // un saut de ligne est un vers. On ramène les deux au même dénominateur.
  const corps =
    b.type === 'texte'
      ? (b.contenu ?? '')
          .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      : (b.contenu ?? '').trim();
  // Le locuteur fait partie de l'extrait : une tirade sans son personnage
  // perd la moitié de ce qu'elle apprend.
  return b.locuteur?.trim() ? `${b.locuteur.trim()}\n${corps}` : corps;
}

function apercu(b: OeuvreBloc): string {
  const t = blocEnTexte(b).replace(/\s+/g, ' ');
  return t.length > 160 ? `${t.slice(0, 160)}…` : t;
}

export default function ExtraitOeuvreModal({ getAuthHeaders, onInserer, onFermer }: Props) {
  const { oeuvres, loading } = useOeuvres(true);

  const [oeuvre, setOeuvre] = useState<Oeuvre | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [section, setSection] = useState<OeuvreSection | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retenus, setRetenus] = useState<Set<string>>(new Set());
  const [filtre, setFiltre] = useState('');

  const chargerSection = useCallback(
    async (oeuvreId: string, id: string) => {
      setChargement(true);
      setErreur(null);
      setRetenus(new Set());
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/oeuvres/${oeuvreId}/sections/${id}`, {
          headers: headers || undefined,
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Section illisible');
        setSection(json.data as OeuvreSection);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Erreur');
        setSection(null);
      } finally {
        setChargement(false);
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (oeuvre && sectionId) chargerSection(oeuvre.id, sectionId);
  }, [oeuvre, sectionId, chargerSection]);

  const citables = (section?.blocs ?? []).filter(estCitable);

  const basculer = (id: string) =>
    setRetenus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const inserer = () => {
    // Dans l'ordre du LIVRE, pas dans l'ordre des clics : un extrait dont les
    // tirades seraient interverties ne veut plus rien dire.
    const texte = citables
      .filter((b) => retenus.has(b.id))
      .map(blocEnTexte)
      .join('\n\n');
    if (texte) onInserer(texte);
    onFermer();
  };

  const recherche = filtre.trim().toLowerCase();

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true">
        <header className={styles.entete}>
          <h3>Prendre un extrait dans une œuvre</h3>
          <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </header>

        <div className={styles.corps}>
          {/* ── 1. Le livre ── */}
          {!oeuvre && (
            <div className={styles.etape}>
              <p className={styles.aide}>Dans quel livre&nbsp;?</p>
              {loading && <p className={styles.aide}>Chargement de la bibliothèque…</p>}
              {!loading && oeuvres.length === 0 && (
                <p className={styles.aide}>
                  Aucune œuvre dans votre bibliothèque. Elles se construisent dans
                  «&nbsp;Mes Ressources&nbsp;», onglet Bibliothèque.
                </p>
              )}
              <div className={styles.livres}>
                {oeuvres.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={styles.livre}
                    onClick={() => {
                      setOeuvre(o);
                      setSectionId(null);
                      setSection(null);
                    }}
                  >
                    {o.couverture ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={o.couverture.url} alt="" />
                    ) : (
                      <span className={styles.livreIcone}>📖</span>
                    )}
                    <span className={styles.livreTitre}>{o.titre}</span>
                    <span className={styles.livreMeta}>
                      {o.chapitres.reduce((n, c) => n + c.sections.length, 0)} sections
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 2. La scène ── */}
          {oeuvre && (
            <div className={styles.fil}>
              <button type="button" className={styles.filLien} onClick={() => setOeuvre(null)}>
                ← {oeuvre.titre}
              </button>
              {section && <span className={styles.filCourant}>{section.titre}</span>}
            </div>
          )}

          {oeuvre && !sectionId && (
            <div className={styles.etape}>
              <input
                type="search"
                className={styles.recherche}
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                placeholder="Filtrer les scènes…"
              />
              <div className={styles.sections}>
                {oeuvre.chapitres.map((c) => {
                  const trouvees = c.sections.filter(
                    (s) =>
                      !recherche ||
                      `${s.titre} ${s.groupe ?? ''}`.toLowerCase().includes(recherche)
                  );
                  if (trouvees.length === 0) return null;
                  return (
                    <div key={c.id}>
                      <p className={styles.chapitre}>{c.titre}</p>
                      {trouvees.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={styles.section}
                          onClick={() => setSectionId(s.id)}
                        >
                          {s.groupe && <span className={styles.groupe}>{s.groupe}</span>}
                          {s.titre}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3. Les passages ── */}
          {oeuvre && sectionId && (
            <div className={styles.etape}>
              <button
                type="button"
                className={styles.filLien}
                onClick={() => {
                  setSectionId(null);
                  setSection(null);
                }}
              >
                ← Choisir une autre scène
              </button>

              {chargement && <p className={styles.aide}>Chargement de la scène…</p>}
              {erreur && <p className={styles.erreur}>{erreur}</p>}

              {!chargement && !erreur && citables.length === 0 && (
                <p className={styles.aide}>
                  Cette scène ne contient aucun passage de texte — seulement des médias.
                </p>
              )}

              {citables.length > 0 && (
                <>
                  <p className={styles.aide}>
                    Cochez un ou plusieurs passages. Ils seront collés dans l&apos;ordre du livre.
                  </p>
                  <div className={styles.blocs}>
                    {citables.map((b) => (
                      <label
                        key={b.id}
                        className={`${styles.bloc} ${retenus.has(b.id) ? styles.blocOn : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={retenus.has(b.id)}
                          onChange={() => basculer(b.id)}
                        />
                        <span>
                          {b.locuteur && <strong className={styles.locuteur}>{b.locuteur} — </strong>}
                          {apercu(b)}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <footer className={styles.pied}>
          <span className={styles.compteur}>
            {retenus.size > 0
              ? `${retenus.size} passage${retenus.size > 1 ? 's' : ''} retenu${retenus.size > 1 ? 's' : ''}`
              : ''}
          </span>
          <button type="button" className={styles.btnGhost} onClick={onFermer}>
            Annuler
          </button>
          <button
            type="button"
            className={styles.btnPrimaire}
            onClick={inserer}
            disabled={retenus.size === 0}
          >
            Insérer
          </button>
        </footer>
      </div>
    </div>
  );
}
