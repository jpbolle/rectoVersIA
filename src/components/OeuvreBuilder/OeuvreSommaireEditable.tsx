'use client';

// Sommaire éditable — la colonne de gauche du constructeur d'œuvre.
//
// ─── Le problème que cet écran résout ───
// L'anthologie Molière fait 11 chapitres et 67 scènes. Déroulée à plat, la
// liste faisait près de 3 000 px : toutes les lignes du même poids, et le
// chapitre où l'on travaille perdu au milieu. Or le prof n'édite jamais qu'UNE
// scène à la fois, et il y revient par deux chemins seulement :
//
//   1. il PARCOURT      → les chapitres se replient, seul celui où il est
//                         reste ouvert ;
//   2. il SAIT le titre → un champ de recherche filtre les 67 scènes d'un
//                         coup et déplie ce qui correspond.
//
// Tout le reste de l'écran découle de ces deux chemins. Les outils (monter,
// descendre, supprimer) n'apparaissent qu'au survol ou au clavier : présents
// en permanence, ils faisaient 201 boutons dans une colonne de 296 px.

import { useMemo, useState } from 'react';
import type { OeuvreChapitre } from '@/types/oeuvre';
import styles from './OeuvreSommaireEditable.module.css';

// Icônes dessinées, d'un seul trait — pas de flèches typographiques, qui ne
// s'alignent pas et changent de taille d'une police à l'autre.
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const IcoChevron = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true">
    <path d="M6 4l4 4-4 4" />
  </svg>
);
const IcoPlus = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true">
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
);
const IcoHaut = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true">
    <path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />
  </svg>
);
const IcoBas = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true">
    <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
  </svg>
);
const IcoCorbeille = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true">
    <path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" />
  </svg>
);
const IcoCrayon = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true">
    <path d="M11.2 2.8a1.6 1.6 0 0 1 2.3 2.3L5.6 13 2.5 13.5 3 10.4z" />
  </svg>
);
const IcoLoupe = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden="true">
    <circle cx="7" cy="7" r="4.2" />
    <path d="M10.2 10.2L13.5 13.5" />
  </svg>
);

interface Props {
  chapitres: OeuvreChapitre[];
  sectionCourante: string | null;
  occupe: boolean;
  /** Couverture du livre — le premier élément qu'on dépose, avant les chapitres */
  couverture?: { url: string; fileId: string } | null;
  onDeposerCouverture?: () => void;
  onRetirerCouverture?: () => void;
  onOuvrirSection: (id: string) => void;
  onAjouterChapitre: () => void;
  onRenommerChapitre: (id: string) => void;
  onAjouterSection: (chapitreId: string) => void;
  onDeplacerSection: (chapitreId: string, index: number, sens: -1 | 1) => void;
  onSupprimerSection: (id: string) => void;
}

export default function OeuvreSommaireEditable({
  chapitres,
  sectionCourante,
  occupe,
  couverture = null,
  onDeposerCouverture,
  onRetirerCouverture,
  onOuvrirSection,
  onAjouterChapitre,
  onRenommerChapitre,
  onAjouterSection,
  onDeplacerSection,
  onSupprimerSection,
}: Props) {
  const [filtre, setFiltre] = useState('');
  // Chapitres explicitement repliés par l'utilisateur. On mémorise les FERMÉS
  // et non les ouverts : à l'arrivée, tout est fermé sauf le chapitre courant,
  // et un chapitre créé ensuite doit s'ouvrir sans qu'on ait à le prévoir.
  const [replies, setReplies] = useState<Set<string>>(new Set());

  const chapitreCourant =
    chapitres.find((c) => c.sections.some((s) => s.id === sectionCourante))?.id ?? null;

  // Le chapitre en cours d'édition suit l'utilisateur : il ouvre une scène,
  // son chapitre s'ouvre. Ajustement pendant le rendu (et non dans un effet,
  // qui provoquerait un second rendu en cascade).
  const [suivi, setSuivi] = useState<string | null>(chapitreCourant);
  if (chapitreCourant && chapitreCourant !== suivi) {
    setSuivi(chapitreCourant);
    setReplies((prev) => {
      if (!prev.has(chapitreCourant)) return prev;
      const next = new Set(prev);
      next.delete(chapitreCourant);
      return next;
    });
  }

  const recherche = filtre.trim().toLowerCase();

  // À la recherche, on ne replie plus rien : le filtre EST la navigation.
  const resultats = useMemo(() => {
    if (!recherche) return null;
    let total = 0;
    const parChapitre = new Map<string, Set<string>>();
    for (const c of chapitres) {
      const ids = new Set(
        c.sections
          .filter((s) => `${s.titre} ${s.groupe ?? ''}`.toLowerCase().includes(recherche))
          .map((s) => s.id)
      );
      if (ids.size) {
        parChapitre.set(c.id, ids);
        total += ids.size;
      }
    }
    return { parChapitre, total };
  }, [recherche, chapitres]);

  const totalSections = chapitres.reduce((n, c) => n + c.sections.length, 0);

  const basculer = (id: string) =>
    setReplies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <aside className={styles.sommaire}>
      {/* ── LA COUVERTURE : UNE VIGNETTE, EN PREMIÈRE LIGNE DU SOMMAIRE ──
          Elle se dépose une fois pour toute la vie du livre, mais mangeait la
          moitié de la colonne sur un petit écran, où c'est justement la liste
          des scènes qu'on veut voir. Réduite à une vignette, elle prend la
          forme de ce qu'elle est côté élève depuis 2026-08-17 : la PREMIÈRE
          PAGE du livre, une entrée du sommaire comme les autres. */}
      {onDeposerCouverture && (
        <div className={styles.couvLigne}>
          {couverture ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={couverture.url} alt="Couverture du livre" className={styles.couvVignette} />
          ) : (
            <span className={`${styles.couvVignette} ${styles.couvVignetteVide}`}>🖼</span>
          )}
          {/* « Couverture » suffit : dire en dessous qu'elle est la première
              page du livre répétait le mot avec d'autres mots. */}
          <span className={styles.couvTexte}>
            <strong>Couverture</strong>
          </span>
          <span className={styles.couvOutils}>
            <button
              type="button"
              onClick={onDeposerCouverture}
              disabled={occupe}
              title={couverture ? 'Remplacer l’image' : 'Déposer une couverture'}
            >
              {couverture ? '⤴' : '+'}
            </button>
            {couverture && onRetirerCouverture && (
              <button
                type="button"
                onClick={onRetirerCouverture}
                disabled={occupe}
                title="Retirer la couverture"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      )}

      {/* ── En-tête : il ne bouge pas, c'est de là qu'on cherche et qu'on ajoute ── */}
      <header className={styles.entete}>
        <div className={styles.enteteHaut}>
          <h2 className={styles.enteteTitre}>Sommaire</h2>
          <span className={styles.enteteChiffres}>
            {chapitres.length} chap. · {totalSections} sect.
          </span>
          <button
            type="button"
            className={styles.btnIcone}
            onClick={onAjouterChapitre}
            title="Ajouter un chapitre"
            aria-label="Ajouter un chapitre"
          >
            <IcoPlus />
          </button>
        </div>

        {/* La recherche n'apparaît qu'à partir du moment où elle sert : sur une
            œuvre de six scènes, elle n'est qu'un champ de plus à ignorer. */}
        {totalSections > 12 && (
          <div className={styles.champRecherche}>
            <span className={styles.champIcone} aria-hidden="true">
              <IcoLoupe />
            </span>
            <input
              type="search"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Chercher une scène…"
              aria-label="Chercher une scène"
            />
          </div>
        )}

        {resultats && (
          <p className={styles.resultats}>
            {resultats.total === 0
              ? 'Aucune scène ne correspond'
              : `${resultats.total} scène${resultats.total > 1 ? 's' : ''} trouvée${resultats.total > 1 ? 's' : ''}`}
          </p>
        )}
      </header>

      <div className={styles.liste}>
        {chapitres.map((chapitre) => {
          const trouvees = resultats?.parChapitre.get(chapitre.id);
          // Pendant une recherche, un chapitre sans résultat disparaît : le
          // garder replié à zéro résultat ne dit rien d'utile.
          if (resultats && !trouvees) return null;

          const deplie = resultats ? true : !replies.has(chapitre.id);
          const sections = trouvees
            ? chapitre.sections.filter((s) => trouvees.has(s.id))
            : chapitre.sections;
          const porteLaCourante = chapitre.id === chapitreCourant;

          return (
            <section
              key={chapitre.id}
              className={`${styles.chapitre} ${porteLaCourante ? styles.chapitreCourant : ''}`}
            >
              <div className={styles.chapitreEntete}>
                <button
                  type="button"
                  className={`${styles.chapitreBtn} ${deplie ? styles.chapitreBtnOuvert : ''}`}
                  onClick={() => !resultats && basculer(chapitre.id)}
                  aria-expanded={deplie}
                  disabled={!!resultats}
                >
                  <span className={styles.chevron} aria-hidden="true">
                    <IcoChevron />
                  </span>
                  <span className={styles.chapitreTitre}>{chapitre.titre}</span>
                  <span className={styles.chapitreCompteur}>{chapitre.sections.length}</span>
                </button>

                <span className={styles.chapitreOutils}>
                  <button
                    type="button"
                    className={styles.btnIcone}
                    onClick={() => onRenommerChapitre(chapitre.id)}
                    title="Renommer le chapitre"
                    aria-label={`Renommer ${chapitre.titre}`}
                  >
                    <IcoCrayon />
                  </button>
                </span>
              </div>

              {deplie && (
                <div className={styles.sections}>
                  {sections.map((s) => {
                    // L'index RÉEL dans le chapitre : pendant une recherche, la
                    // position affichée n'est pas la position dans le livre, et
                    // « monter » doit déplacer dans le livre.
                    const index = chapitre.sections.findIndex((x) => x.id === s.id);
                    const precedent = index > 0 ? chapitre.sections[index - 1].groupe : undefined;
                    const nouvelActe = !resultats && s.groupe && s.groupe !== precedent;
                    const active = s.id === sectionCourante;

                    return (
                      <div key={s.id}>
                        {nouvelActe && <div className={styles.acte}>{s.groupe}</div>}

                        <div className={`${styles.ligne} ${active ? styles.ligneActive : ''}`}>
                          <button
                            type="button"
                            className={styles.lienSection}
                            onClick={() => onOuvrirSection(s.id)}
                            aria-current={active ? 'true' : undefined}
                          >
                            <span className={styles.numero}>{index + 1}</span>
                            <span className={styles.titreSection}>
                              {s.titre}
                              {/* Sous la recherche, l'acte n'a plus d'intertitre :
                                  il se rappelle sur la ligne, sinon on ne sait
                                  plus d'où vient la scène trouvée. */}
                              {resultats && s.groupe && (
                                <span className={styles.acteInline}>{s.groupe}</span>
                              )}
                            </span>
                            {s.aQuestions && (
                              <span
                                className={styles.marqueVerif}
                                title="Cette scène porte une vérification de lecture"
                                aria-label="vérification de lecture"
                              />
                            )}
                          </button>

                          <span className={styles.outils}>
                            <button
                              type="button"
                              className={styles.btnOutil}
                              onClick={() => onDeplacerSection(chapitre.id, index, -1)}
                              disabled={index === 0}
                              title="Monter"
                              aria-label={`Monter ${s.titre}`}
                            >
                              <IcoHaut />
                            </button>
                            <button
                              type="button"
                              className={styles.btnOutil}
                              onClick={() => onDeplacerSection(chapitre.id, index, 1)}
                              disabled={index === chapitre.sections.length - 1}
                              title="Descendre"
                              aria-label={`Descendre ${s.titre}`}
                            >
                              <IcoBas />
                            </button>
                            <button
                              type="button"
                              className={`${styles.btnOutil} ${styles.btnOutilDanger}`}
                              onClick={() => onSupprimerSection(s.id)}
                              title="Supprimer"
                              aria-label={`Supprimer ${s.titre}`}
                            >
                              <IcoCorbeille />
                            </button>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* L'ajout vit AU BOUT de la liste qu'il allonge, pas dans
                      l'en-tête du chapitre : c'est là que le geste se fait. */}
                  {!resultats && (
                    <button
                      type="button"
                      className={styles.ajouterSection}
                      onClick={() => onAjouterSection(chapitre.id)}
                      disabled={occupe}
                    >
                      <span className={styles.ajouterIcone} aria-hidden="true">
                        <IcoPlus />
                      </span>
                      {chapitre.sections.length === 0 ? 'Première section' : 'Ajouter une section'}
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {chapitres.length === 0 && (
          <div className={styles.vide}>
            <p>Cette œuvre est vide.</p>
            <p className={styles.videAide}>
              Commence par un chapitre — une pièce, une partie, ce que ton découpage appelle.
            </p>
            <button type="button" className={styles.videBtn} onClick={onAjouterChapitre}>
              <IcoPlus />
              Créer le premier chapitre
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
