'use client';

// Champ à pastilles éditable sur place : les valeurs s'affichent comme du
// texte, un clic ouvre la liste à cocher. Pas d'icône crayon, pas de fenêtre :
// c'est la règle de l'écran d'encodage.
//
// Le menu est rendu dans un PORTAIL, à la racine du document. Placé dans la
// cellule du tableau, son bas se trouvait rogné par la ligne suivante : aucun
// z-index n'y pouvait rien, un tableau crée son propre contexte d'empilement.
// Le portail le met à l'avant-plan et le fait suivre le champ.
//
// Les options peuvent être GROUPÉES (par famille de gestes : lecture,
// écriture…) : on voit d'abord les grandes familles, on déplie celle qu'on
// veut — même logique que le sélecteur d'habiletés de la création d'activité.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ScenarisationPanel.module.css';

interface Option {
  id: string;
  label: string;
  // Famille d'appartenance — quand elle est là, le menu se groupe
  groupe?: string;
}

interface Props {
  value: string[];
  options: Option[];
  onChange: (value: string[]) => void;
  // Libellé court affiché dans la pastille (défaut : le label de l'option)
  labelCourt?: (id: string, label: string) => string;
  // Au-delà de 2 valeurs, on résume plutôt que d'empiler les pastilles
  resume?: (n: number) => string;
  variant?: 'methode';
  footer?: string;
  placeholder?: string;
}

export default function TagField({
  value,
  options,
  onChange,
  labelCourt,
  resume,
  variant,
  footer,
  placeholder,
}: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(new Set());

  // Position du menu sous le champ, recalculée à l'ouverture puis au défilement
  useLayoutEffect(() => {
    if (!ouvert) return;
    const placer = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const largeur = Math.max(r.width, 230);
      const hauteurMax = 320;
      // Sous le champ, sauf s'il n'y a plus la place : alors au-dessus
      const dessous = window.innerHeight - r.bottom > 180;
      setPos({
        top: dessous ? r.bottom + 4 : Math.max(8, r.top - Math.min(hauteurMax, 260) - 4),
        left: Math.min(r.left, window.innerWidth - largeur - 10),
        width: largeur,
      });
    };
    placer();
    window.addEventListener('scroll', placer, true);
    window.addEventListener('resize', placer);
    return () => {
      window.removeEventListener('scroll', placer, true);
      window.removeEventListener('resize', placer);
    };
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const onDocClick = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (!ref.current?.contains(cible) && !menuRef.current?.contains(cible)) setOuvert(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [ouvert]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const libelle = (id: string) => {
    const opt = options.find((o) => o.id === id);
    return labelCourt ? labelCourt(id, opt?.label ?? id) : (opt?.label ?? id);
  };

  const trop = resume && value.length > 2;

  // Regroupement par famille, dans l'ordre d'apparition des options
  const groupes: [string, Option[]][] = [];
  options.forEach((o) => {
    const cle = o.groupe ?? '';
    const trouve = groupes.find(([g]) => g === cle);
    if (trouve) trouve[1].push(o);
    else groupes.push([cle, [o]]);
  });
  const groupe = groupes.length > 1 || (groupes[0]?.[0] ?? '') !== '';

  const ligne = (o: Option) => (
    <label key={o.id} className={styles.tagItem}>
      <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
      {o.label}
    </label>
  );

  return (
    <div className={styles.tagWrap} ref={ref}>
      {/* Un <div onClick> rendait ce champ — coeur de la saisie didactique —
          inatteignable au clavier. Il annonce désormais ce qu'il est. */}
      <div
        className={`${styles.tagField} ${ouvert ? styles.tagFieldOpen : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOuvert((v) => !v);
          } else if (e.key === 'Escape' && ouvert) {
            setOuvert(false);
          }
        }}
      >
        {value.length === 0 && placeholder && (
          <span className={styles.tagPlaceholder}>{placeholder}</span>
        )}
        {trop ? (
          <span className={`${styles.tg} ${variant === 'methode' ? styles.tgMeth : ''}`}>
            {resume!(value.length)}
          </span>
        ) : (
          value.map((id) => (
            <span
              key={id}
              className={`${styles.tg} ${variant === 'methode' ? styles.tgMeth : ''}`}
              title={libelle(id)}
            >
              {libelle(id)}
            </span>
          ))
        )}
        <span className={styles.tgAdd}>＋</span>
      </div>

      {ouvert &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.tagMenu}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {options.length === 0 && (
              <span className={styles.tagEmpty}>
                Aucune valeur disponible — à gérer dans Administration du site.
              </span>
            )}

            {!groupe && options.map(ligne)}

            {groupe &&
              groupes.map(([nom, items]) => {
                const coches = items.filter((o) => value.includes(o.id)).length;
                const deplie = groupesOuverts.has(nom) || coches > 0;
                return (
                  <div key={nom} className={styles.tagGroup}>
                    <button
                      type="button"
                      className={styles.tagGroupHead}
                      onClick={() =>
                        setGroupesOuverts((prev) => {
                          const next = new Set(prev);
                          if (next.has(nom)) next.delete(nom);
                          else next.add(nom);
                          return next;
                        })
                      }
                    >
                      <span className={styles.tagGroupName}>{nom || 'Autres'}</span>
                      <span className={styles.tagGroupCount}>
                        {coches > 0 ? `${coches}/${items.length}` : items.length}
                      </span>
                      <span className={deplie ? styles.chevronOpen : styles.chevron}>▾</span>
                    </button>
                    {deplie && <div className={styles.tagGroupBody}>{items.map(ligne)}</div>}
                  </div>
                );
              })}

            {footer && <span className={styles.tagFooter}>{footer}</span>}
          </div>,
          document.body
        )}
    </div>
  );
}
