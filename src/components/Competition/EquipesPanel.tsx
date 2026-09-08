'use client';

// ═══ Onglet « Équipes » de l'écran prof ═══
//
// Le prof choisit un NOMBRE d'équipes, les tire au sort, puis déplace les
// élèves à la main d'une colonne à l'autre (glisser-déposer natif du
// navigateur, aucune bibliothèque). Chaque dépôt envoie la composition entière
// au serveur : la manche est la seule vérité, l'écran ne garde rien.
//
// Une colonne « Sans équipe » accueille ceux qui ne sont placés nulle part —
// un élève arrivé après le tirage, ou retiré volontairement. Il joue quand
// même, pour lui seul.

import { useState } from 'react';
import type { DragEvent } from 'react';
import { EQUIPES_MAX, EQUIPE_TEINTES } from '@/types/manche';
import type { Equipe, EquipeVue } from '@/types/manche';
import styles from './EquipesPanel.module.css';

interface EquipesPanelProps {
  /** La composition actuelle ; `undefined` = partie individuelle */
  equipes?: EquipeVue[];
  sansEquipe?: { uid: string; nom: string }[];
  /** Effectif connu, pour proposer un nombre d'équipes raisonnable */
  effectif: number;
  onTirer: (nombre: number) => void;
  onRecomposer: (equipes: Equipe[]) => void;
  onSupprimer: () => void;
}

const SANS_EQUIPE = '__sans__';

export default function EquipesPanel({
  equipes,
  sansEquipe = [],
  effectif,
  onTirer,
  onRecomposer,
  onSupprimer,
}: EquipesPanelProps) {
  // Quatre élèves par équipe, c'est la taille d'une table : on part de là.
  const [nombre, setNombre] = useState<number>(() =>
    Math.max(2, Math.min(EQUIPES_MAX, Math.round((effectif || 16) / 4)))
  );
  const [cibleSurvolee, setCibleSurvolee] = useState<string | null>(null);

  const actives = equipes ?? [];

  // ── Glisser-déposer ──
  // La donnée transportée est l'UID ; à l'arrivée on reconstruit toute la
  // composition (l'élève quitte son équipe d'origine, entre dans la cible) et
  // on l'envoie telle quelle.
  const auDepart = (ev: DragEvent, uid: string) => {
    ev.dataTransfer.setData('text/plain', uid);
    ev.dataTransfer.effectAllowed = 'move';
  };

  const deposer = (ev: DragEvent, cibleId: string) => {
    ev.preventDefault();
    setCibleSurvolee(null);
    const uid = ev.dataTransfer.getData('text/plain');
    if (!uid) return;
    const nouvelle: Equipe[] = actives.map((eq) => ({
      id: eq.id,
      nom: eq.nom,
      membres: eq.membres.map((m) => m.uid).filter((u) => u !== uid),
    }));
    if (cibleId !== SANS_EQUIPE) {
      const cible = nouvelle.find((eq) => eq.id === cibleId);
      if (!cible) return;
      cible.membres.push(uid);
    }
    onRecomposer(nouvelle);
  };

  const survoler = (ev: DragEvent, id: string) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (cibleSurvolee !== id) setCibleSurvolee(id);
  };

  const Etiquette = ({ uid, nom }: { uid: string; nom: string }) => (
    <li
      className={styles.etiquette}
      draggable
      onDragStart={(ev) => auDepart(ev, uid)}
      title="Glisser vers une autre équipe"
    >
      {nom}
    </li>
  );

  return (
    <div className={styles.panneau}>
      {/* ── Former ── */}
      <div className={styles.former}>
        <label className={styles.champ}>
          <span>Nombre d’équipes</span>
          <input
            type="number"
            min={1}
            max={EQUIPES_MAX}
            value={nombre}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              if (Number.isFinite(v)) setNombre(Math.max(1, Math.min(EQUIPES_MAX, v)));
            }}
          />
        </label>
        <button type="button" className={styles.btnPrimaire} onClick={() => onTirer(nombre)}>
          {actives.length > 0 ? 'Retirer au sort' : 'Former au hasard'}
        </button>
        {actives.length > 0 && (
          <button type="button" className={styles.btnDiscret} onClick={onSupprimer}>
            Jouer sans équipes
          </button>
        )}
      </div>

      {actives.length === 0 ? (
        <p className={styles.vide}>
          Partie individuelle. Forme des équipes pour que les scores des élèves s’additionnent —
          tu pourras ensuite déplacer chaque élève d’une équipe à l’autre.
        </p>
      ) : (
        <>
          <p className={styles.aide}>Glisse une étiquette d’une colonne à l’autre pour recomposer.</p>
          <div className={styles.colonnes}>
            {actives.map((eq) => (
              <section
                key={eq.id}
                className={`${styles.colonne} ${
                  cibleSurvolee === eq.id ? styles.colonneSurvolee : ''
                }`}
                onDragOver={(ev) => survoler(ev, eq.id)}
                onDragLeave={() => setCibleSurvolee(null)}
                onDrop={(ev) => deposer(ev, eq.id)}
              >
                <h4
                  className={styles.titreColonne}
                  style={{ borderColor: EQUIPE_TEINTES[eq.nom] ?? 'var(--c-border)' }}
                >
                  <i style={{ background: EQUIPE_TEINTES[eq.nom] ?? 'var(--c-text-muted)' }} />
                  {eq.nom}
                  <span className={styles.compte}>{eq.membres.length}</span>
                </h4>
                <ul className={styles.liste}>
                  {eq.membres.map((m) => (
                    <Etiquette key={m.uid} uid={m.uid} nom={m.nom} />
                  ))}
                  {eq.membres.length === 0 && <li className={styles.videColonne}>—</li>}
                </ul>
              </section>
            ))}

            <section
              className={`${styles.colonne} ${styles.colonneSans} ${
                cibleSurvolee === SANS_EQUIPE ? styles.colonneSurvolee : ''
              }`}
              onDragOver={(ev) => survoler(ev, SANS_EQUIPE)}
              onDragLeave={() => setCibleSurvolee(null)}
              onDrop={(ev) => deposer(ev, SANS_EQUIPE)}
            >
              <h4 className={styles.titreColonne}>
                Sans équipe
                <span className={styles.compte}>{sansEquipe.length}</span>
              </h4>
              <ul className={styles.liste}>
                {sansEquipe.map((m) => (
                  <Etiquette key={m.uid} uid={m.uid} nom={m.nom} />
                ))}
                {sansEquipe.length === 0 && <li className={styles.videColonne}>—</li>}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
