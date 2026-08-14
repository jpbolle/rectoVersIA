'use client';

// Sélection des habiletés travaillées dans UNE activité, en deux temps.
//
//  1. « Toutes les habiletés » est coché par défaut : l'activité porte tout ce
//     qui est rattaché à son atelier, le prof n'a rien à faire.
//  2. Décoché, la liste des GESTES apparaît. Cocher un geste sélectionne ses
//     habiletés et les affiche ; le prof peut ensuite en retirer.
//
// Le PLIAGE et la SÉLECTION sont deux choses distinctes : la case coche les
// habiletés du geste, le chevron ouvre ou referme la liste. Replier un geste
// ne perd donc rien — le compteur rappelle ce qui reste coché dessous.
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

  return (
    <div className={styles.picker}>
      <label className={styles.allRow}>
        <input
          type="checkbox"
          checked={toutes}
          disabled={disabled}
          // Décocher part d'une ardoise vierge : on choisit d'abord les gestes
          onChange={(e) => onChange(e.target.checked ? null : [])}
        />
        <span>
          Toutes les habiletés
          {atelier && <> de l&apos;{findAtelier(atelier)?.label.toLowerCase()}</>}
          <span className={styles.count}>
            {toutes ? `${items.length}` : `${selected.size} / ${items.length}`}
          </span>
        </span>
      </label>

      {fallback && (
        <p className={styles.note}>
          Aucune habileté n&apos;est encore rattachée à cet atelier : ce sont celles du
          mode principal qui sont proposées. Le rattachement se fait dans
          Administration du site → Gestion didactique.
        </p>
      )}

      {!toutes && (
        <div className={styles.list}>
          <p className={styles.lead}>
            Cochez un geste pour retenir ses habiletés ; la flèche déplie la liste
            pour en retirer. Replier ne perd rien.
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
