'use client';

// Sélection des habiletés travaillées dans UNE activité, en deux temps.
//
//  1. « Toutes les habiletés » est coché par défaut : l'activité porte tout ce
//     qui est rattaché à son atelier, le prof n'a rien à faire.
//  2. Décoché, la liste des GESTES apparaît. Cocher un geste sélectionne ses
//     habiletés et les affiche ; le prof peut ensuite en retirer.
//
// LE PLIAGE N'EST PAS LA SÉLECTION — à tous les niveaux.
// Le bloc entier se replie par son CHEVRON, jamais par la case à cocher. Avant
// le 2026-08-15, le seul moyen de refermer la liste était de recocher « Toutes
// les habiletés » : replier pour alléger l'écran effaçait donc la sélection, et
// le prof se retrouvait avec tout de coché. Le libellé lui-même basculait la
// case, puisque toute la ligne était un <label>.
// Désormais : la case coche, le reste de la ligne replie. Et le bloc s'ouvre
// REPLIÉ, avec un résumé de ce qui est retenu.
//
// Tant qu'aucune habileté n'a été rattachée à l'atelier dans /admin, on
// propose celles du mode principal et on le dit — cf. habiletesPourAtelier.

import { useMemo, useState } from 'react';
import { useDidactique } from '@/hooks/useDidactique';
import { findAtelier, habileteLabel, habileteObjets, habiletesPourAtelier } from '@/types/didactique';
import type { Habilete, TypeModal } from '@/types/didactique';
import styles from './HabiletesPicker.module.css';

interface Props {
  atelier: string | undefined;
  modePrincipal: TypeModal | undefined;
  value: string[] | null; // null = toutes celles de l'atelier
  onChange: (value: string[] | null) => void;
  disabled?: boolean;
}

export default function HabiletesPicker({
  atelier,
  modePrincipal,
  value,
  onChange,
  disabled,
}: Props) {
  const { config } = useDidactique();

  const { items, fallback } = useMemo(
    () => habiletesPourAtelier(config, atelier, modePrincipal),
    [config, atelier, modePrincipal]
  );

  // Regroupement par geste : 28 habiletés à plat seraient illisibles
  const groups = useMemo(() => {
    const map = new Map<string, Habilete[]>();
    items.forEach((h) => {
      if (!map.has(h.geste)) map.set(h.geste, []);
      map.get(h.geste)!.push(h);
    });
    return [...map];
  }, [items]);

  // Gestes dépliés — indépendant de ce qui est coché
  const [openGestes, setOpenGestes] = useState<Set<string>>(new Set());
  // Le bloc entier : REPLIÉ à l'ouverture du formulaire, pour ne pas encombrer
  const [ouvert, setOuvert] = useState(false);

  const toutes = value === null;
  const selected = new Set(value ?? []);

  const gesteSelection = (list: Habilete[]) => list.filter((h) => selected.has(h.id)).length;

  const toggleOpen = (geste: string) => {
    setOpenGestes((prev) => {
      const next = new Set(prev);
      if (next.has(geste)) next.delete(geste);
      else next.add(geste);
      return next;
    });
  };

  const toggleGeste = (geste: string, list: Habilete[], checked: boolean) => {
    const next = new Set(selected);
    list.forEach((h) => (checked ? next.add(h.id) : next.delete(h.id)));
    onChange([...next]);
    // Cocher un geste montre ce qu'on vient de sélectionner
    if (checked) setOpenGestes((prev) => new Set(prev).add(geste));
  };

  const toggleHabilete = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  if (!items.length) {
    return (
      <p className={styles.empty}>
        Aucune habileté disponible — à rattacher dans Administration du site →
        Gestion didactique.
      </p>
    );
  }

  // Ce que dit la ligne quand tout est replié
  const resume = toutes
    ? `Toutes les habiletés${atelier ? ` de l’${findAtelier(atelier)?.label.toLowerCase()}` : ''}`
    : selected.size === 0
      ? 'Aucune habileté retenue'
      : `${selected.size} habileté${selected.size > 1 ? 's' : ''} retenue${selected.size > 1 ? 's' : ''}`;

  return (
    <div className={styles.picker}>
      <div className={styles.allRow}>
        {/* La case à cocher est SEULE à décider « toutes ou certaines ». Le
            reste de la ligne replie — sinon un clic pour ranger l'écran
            resélectionnait tout. */}
        <input
          type="checkbox"
          checked={toutes}
          disabled={disabled}
          title={toutes ? 'Décocher pour choisir les habiletés' : 'Cocher pour toutes les reprendre'}
          // Décocher part d'une ardoise vierge : on choisit d'abord les gestes,
          // et on ouvre le bloc puisqu'il y a désormais quelque chose à y faire
          onChange={(e) => {
            const tout = e.target.checked;
            onChange(tout ? null : []);
            setOuvert(!tout);
          }}
        />
        <button
          type="button"
          className={styles.allToggle}
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          title={ouvert ? 'Replier' : 'Déplier'}
        >
          <span className={styles.allLabel}>{resume}</span>
          <span className={styles.count}>
            {toutes ? `${items.length}` : `${selected.size} / ${items.length}`}
          </span>
          <span className={`${styles.mainChevron} ${ouvert ? styles.mainChevronOpen : ''}`}>▾</span>
        </button>
      </div>

      {ouvert && fallback && (
        <p className={styles.note}>
          Aucune habileté n&apos;est encore rattachée à cet atelier : ce sont celles du
          mode principal qui sont proposées. Le rattachement se fait dans
          Administration du site → Gestion didactique.
        </p>
      )}

      {ouvert && !toutes && (
        <div className={styles.list}>
          <p className={styles.lead}>
            Cochez un geste pour retenir ses habiletés ; la flèche déplie la liste
            pour en retirer. <strong>Replier ne perd rien</strong> — ni ici, ni pour le
            bloc entier.
          </p>
          {groups.map(([geste, list]) => {
            const n = gesteSelection(list);
            const coche = n > 0;
            const ouvert = openGestes.has(geste);
            return (
              <div key={geste} className={styles.group}>
                <div className={`${styles.gesteRow} ${coche ? styles.gesteRowOn : ''}`}>
                  <input
                    type="checkbox"
                    checked={coche}
                    disabled={disabled}
                    onChange={(e) => toggleGeste(geste, list, e.target.checked)}
                  />
                  <button
                    type="button"
                    className={styles.gesteToggle}
                    onClick={() => toggleOpen(geste)}
                    aria-expanded={ouvert}
                  >
                    <span className={styles.gesteLabel}>{geste}</span>
                    <span className={styles.gesteCount}>
                      {coche ? `${n}/${list.length}` : list.length}
                    </span>
                    <span className={`${styles.chevron} ${ouvert ? styles.chevronOpen : ''}`}>
                      ▾
                    </span>
                  </button>
                </div>

                {ouvert && (
                  <div className={styles.items}>
                    {list.map((h) => (
                      <label key={h.id} className={styles.item}>
                        <input
                          type="checkbox"
                          checked={selected.has(h.id)}
                          disabled={disabled}
                          onChange={() => toggleHabilete(h.id)}
                        />
                        <span>
                          {habileteLabel(h)}
                          {habileteObjets(h).length > 0 && (
                            <em className={styles.objet}> — {habileteObjets(h).join(', ')}</em>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
