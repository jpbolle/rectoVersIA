'use client';

// L'éditeur d'un module FLE, pleine page dans l'onglet (comme OeuvreBuilder).
//
// Deux colonnes : à gauche la fiche (titre, description, type, niveau,
// compétences, « Je peux… » du référentiel pour se guider) ; à droite
// l'INTRODUCTION (les indications du prof, éditeur Tiptap) puis les
// RESSOURCES qui portent la théorie elle-même — les cinq onglets du verso
// d'une activité (document, image, vidéo, lien, interactif). Un module ne
// contient pas d'activités (décision JP, 2026-09-14) : sur la ligne du temps
// d'une séquence, l'activité est une étape à part.
//
// Enregistrement EXPLICITE (bouton) : un module se compose, il ne se règle
// pas au curseur. Le bouton dit s'il reste quelque chose à enregistrer.
//
// NOUVEAU point de théorie (`module.id` vide) : l'éditeur s'ouvre d'emblée,
// sans popup préalable (demande JP, 2026-09-19 : « je n'en vois pas
// l'intérêt »). Le document n'est créé (POST) qu'au premier « Enregistrer » —
// quitter sans enregistrer ne laisse aucun module vide dans la bibliothèque.

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { competencesVisibles, descripteursDe, niveauxVisibles } from '@/types/didactique-fle';
import type { DevoirRessource } from '@/types/devoir';
import type { ModuleFle } from '@/types/module-fle';
import DocumentEditor from '@/components/RessourcesInput/DocumentEditor';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import styles from './ModuleFleEditor.module.css';

interface Props {
  module: ModuleFle;
  lectureSeule?: boolean;
  onFermer: () => void;
  onModifie: () => void;
  // Texte du bouton de retour (ouvert depuis l'atelier d'une séquence :
  // « ← Retour à la séquence »)
  libelleRetour?: string;
}

type Brouillon = Pick<ModuleFle, 'titre' | 'description' | 'type' | 'niveau' | 'competences' | 'introduction' | 'ressources'>;

function extraire(m: ModuleFle): Brouillon {
  return {
    titre: m.titre,
    description: m.description ?? '',
    type: m.type,
    niveau: m.niveau,
    competences: m.competences,
    introduction: m.introduction,
    ressources: m.ressources,
  };
}

export default function ModuleFleEditor({
  module,
  lectureSeule = false,
  onFermer,
  onModifie,
  libelleRetour = '← Modules FLE',
}: Props) {
  const { getAuthHeaders } = useAuth();
  const { config } = useDidactiqueFle();

  const [brouillon, setBrouillon] = useState<Brouillon>(() => extraire(module));
  const [enregistre, setEnregistre] = useState<Brouillon>(() => extraire(module));
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Id du module ; vide tant qu'un nouveau n'a pas été enregistré une fois
  const [idModule, setIdModule] = useState(module.id);
  const nouveau = !idModule;

  const modifie = nouveau || JSON.stringify(brouillon) !== JSON.stringify(enregistre);
  const competences = useMemo(() => competencesVisibles(config), [config]);
  const niveaux = useMemo(() => niveauxVisibles(config), [config]);
  const typesVisibles = config.typesModule.filter((t) => t.visible || t.id === brouillon.type);

  // Les « Je peux… » des compétences cochées, au niveau du module — pour se guider
  const descripteurs = useMemo(
    () =>
      brouillon.competences.flatMap((c) =>
        descripteursDe(config, c, brouillon.niveau).map((d) => ({
          ...d,
          competence: competences.find((x) => x.id === c)?.label ?? c,
        }))
      ),
    [config, brouillon.competences, brouillon.niveau, competences]
  );

  const poser = <K extends keyof Brouillon>(cle: K, valeur: Brouillon[K]) =>
    setBrouillon((b) => ({ ...b, [cle]: valeur }));

  const enregistrer = useCallback(async () => {
    if (!brouillon.titre.trim()) {
      setErreur('Le titre est requis.');
      return;
    }
    setOccupe(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(nouveau ? '/api/modules-fle' : `/api/modules-fle/${idModule}`, {
        method: nouveau ? 'POST' : 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(brouillon),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Erreur lors de l'enregistrement");
      if (nouveau) setIdModule((json.data as ModuleFle).id);
      const sauve = extraire(json.data as ModuleFle);
      setEnregistre(sauve);
      setBrouillon(sauve);
      onModifie();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setOccupe(false);
    }
  }, [brouillon, nouveau, idModule, getAuthHeaders, onModifie]);

  return (
    <section className={styles.editeur}>
      {/* ── Barre du haut : retour, titre, enregistrer ── */}
      <div className={styles.barre}>
        <button type="button" className={styles.retour} onClick={onFermer}>
          {libelleRetour}
        </button>
        <span className={styles.barreTitre}>{lectureSeule ? 'Point de théorie (lecture)' : nouveau ? 'Nouveau point de théorie' : 'Modifier le point de théorie'}</span>
        {!lectureSeule && (
          <button
            type="button"
            className={`${styles.btnPrimary} ${modifie ? styles.btnAEnregistrer : ''}`}
            onClick={enregistrer}
            disabled={occupe || !modifie}
          >
            {occupe ? 'Enregistrement…' : modifie ? 'Enregistrer' : 'Enregistré'}
          </button>
        )}
      </div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.colonnes}>
        {/* ── Fiche ── */}
        <div className={styles.fiche}>
          <label className={styles.champ}>
            Titre
            <input
              type="text"
              value={brouillon.titre}
              onChange={(e) => poser('titre', e.target.value)}
              disabled={lectureSeule}
              placeholder="Ex : Le verbe avoir"
            />
          </label>
          <label className={styles.champ}>
            Description
            <textarea
              value={brouillon.description ?? ''}
              onChange={(e) => poser('description', e.target.value)}
              disabled={lectureSeule}
              rows={3}
              placeholder="En une phrase : ce que l’élève saura faire après ce point de théorie."
            />
          </label>
          <div className={styles.deuxChamps}>
            <label className={styles.champ}>
              Type
              <select value={brouillon.type} onChange={(e) => poser('type', e.target.value)} disabled={lectureSeule}>
                <option value="">—</option>
                {typesVisibles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.champ}>
              Niveau
              <select value={brouillon.niveau} onChange={(e) => poser('niveau', e.target.value)} disabled={lectureSeule}>
                <option value="">—</option>
                {niveaux.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.champ}>
            <span>Compétences travaillées</span>
            <div className={styles.puces}>
              {competences.map((c) => {
                const coche = brouillon.competences.includes(c.id);
                return (
                  <label key={c.id} className={`${styles.puce} ${coche ? styles.puceActive : ''}`}>
                    <input
                      type="checkbox"
                      checked={coche}
                      disabled={lectureSeule}
                      onChange={(e) =>
                        poser(
                          'competences',
                          e.target.checked
                            ? [...brouillon.competences, c.id]
                            : brouillon.competences.filter((x) => x !== c.id)
                        )
                      }
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>
          </div>

          {descripteurs.length > 0 && (
            <div className={styles.jePeux}>
              <p className={styles.jePeuxTitre}>« Je peux… » visés à ce niveau</p>
              <ul>
                {descripteurs.map((d) => (
                  <li key={d.id}>
                    <b>{d.competence}</b> — {d.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Introduction + ressources ── */}
        <div className={styles.contenu}>
          <div className={styles.bloc}>
            <p className={styles.blocTitre}>
              Introduction, indications
              <span>Ce que l’élève lit en ouvrant ce point de théorie : de quoi il s’agit, comment s’y prendre.</span>
            </p>
            <DocumentEditor
              content={brouillon.introduction}
              onChange={(html) => poser('introduction', html)}
              disabled={lectureSeule}
              placeholder="Ici, tu vas apprendre à…"
            />
          </div>

          <div className={styles.bloc}>
            <p className={styles.blocTitre}>
              La théorie
              <span>Les ressources qui la portent : document, images, vidéos, liens, contenu interactif.</span>
            </p>
            <RessourcesInput
              ressources={brouillon.ressources}
              onRessourcesChange={(r: DevoirRessource | null) => poser('ressources', r)}
              disabled={lectureSeule}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
