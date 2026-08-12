'use client';

// Encadré « Didactique du français » de la page /admin : gestion des UAA et
// des gestes (lecture, écriture, recherche). Chaque liste : œil pour masquer /
// afficher, poubelle pour supprimer, champ + bouton « + » pour ajouter.
// Masquer retire l'élément des nouveaux formulaires sans toucher aux contenus
// existants — préférer masquer quand l'élément a déjà servi.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { setDidactiqueCache } from '@/hooks/useDidactique';
import { DEFAULT_DIDACTIQUE, DIDACTIQUE_CATEGORIES } from '@/types/didactique';
import type { DidactiqueConfig, DidactiqueItem } from '@/types/didactique';
import styles from './DidactiquePanel.module.css';

// Slug court pour un nouveau geste
function generateGesteId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

const GESTE_PREFIX: Partial<Record<keyof DidactiqueConfig, string>> = {
  gestesLecture: 'GL',
  gestesEcriture: 'GE',
  gestesParole: 'GP',
  gestesRecherche: 'GR',
};

export default function DidactiquePanel() {
  const { getAuthHeaders } = useAuth();
  const [config, setConfig] = useState<DidactiqueConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Champs « ajouter » par catégorie
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Catégorie dont le + a été cliqué à vide — déclenche le message d'aide
  const [hintKey, setHintKey] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/didactique', { headers });
        const json = await res.json();
        setConfig(json.success && json.data ? json.data : DEFAULT_DIDACTIQUE);
      } catch {
        setConfig(DEFAULT_DIDACTIQUE);
        setError('Impossible de charger la configuration.');
      }
    };
    load();
  }, [getAuthHeaders]);

  // Enregistre la configuration complète (optimiste : l'état est déjà à jour)
  const save = async (next: DidactiqueConfig) => {
    const previous = config;
    setConfig(next);
    setIsSaving(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/didactique', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDidactiqueCache(json.data);
      } else {
        setConfig(previous);
        setError(json.message || "Erreur lors de l'enregistrement.");
      }
    } catch {
      setConfig(previous);
      setError("Erreur de connexion pendant l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCategory = (key: keyof DidactiqueConfig, items: DidactiqueItem[]) => {
    if (!config) return;
    save({ ...config, [key]: items });
  };

  const toggleVisible = (key: keyof DidactiqueConfig, id: string) => {
    if (!config) return;
    updateCategory(
      key,
      config[key].map((item) => (item.id === id ? { ...item, visible: !item.visible } : item))
    );
  };

  const removeItem = (key: keyof DidactiqueConfig, item: DidactiqueItem) => {
    if (!config) return;
    const ok = window.confirm(
      `Supprimer « ${item.label} » ?\n\nSi cet élément a déjà été utilisé dans des grilles ou des questionnaires, préférez le masquer (œil) : la suppression ne modifie pas les contenus existants, mais leur libellé ne sera plus retrouvé.`
    );
    if (!ok) return;
    updateCategory(key, config[key].filter((i) => i.id !== item.id));
  };

  const addItem = (key: keyof DidactiqueConfig) => {
    if (!config) return;
    const label = (drafts[key] ?? '').trim();
    if (!label) {
      // Clic à vide : guider vers le champ au lieu de rester muet
      setHintKey(key);
      inputRefs.current[key]?.focus();
      return;
    }
    setHintKey(null);
    // UAA : identifiant numérique suivant ; gestes : slug généré
    const id =
      key === 'uaa'
        ? String(Math.max(-1, ...config.uaa.map((u) => Number(u.id) || 0)) + 1)
        : generateGesteId(GESTE_PREFIX[key] ?? 'G');
    updateCategory(key, [...config[key], { id, label, visible: true }]);
    setDrafts((d) => ({ ...d, [key]: '' }));
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Didactique du français</h2>
        {isSaving && <span className={styles.saving}>Enregistrement...</span>}
      </div>
      <p className={styles.hint}>
        Ces listes alimentent les formulaires : UAA des grilles, gestes des
        questionnaires. L&apos;œil masque un élément des nouveaux formulaires sans
        toucher aux contenus qui l&apos;utilisent déjà.
      </p>
      {error && <p className={styles.error}>{error}</p>}

      {!config ? (
        <p className={styles.hint}>Chargement...</p>
      ) : (
        <div className={styles.grid}>
          {DIDACTIQUE_CATEGORIES.map(({ key, title }) => (
            <div key={key} className={styles.block}>
              <h3 className={styles.blockTitle}>{title}</h3>
              {config[key].length === 0 && (
                <p className={styles.empty}>Aucun élément — ajoutez-en un ci-dessous.</p>
              )}
              <ul className={styles.list}>
                {config[key].map((item) => (
                  <li
                    key={item.id}
                    className={`${styles.item} ${!item.visible ? styles.itemHidden : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.itemBtn}
                      onClick={() => toggleVisible(key, item.id)}
                      title={item.visible ? 'Masquer dans les formulaires' : 'Afficher dans les formulaires'}
                    >
                      {item.visible ? '👁' : '🚫'}
                    </button>
                    <span className={styles.itemLabel}>
                      {key === 'uaa' ? `UAA ${item.id} — ${item.label}` : item.label}
                    </span>
                    <button
                      type="button"
                      className={`${styles.itemBtn} ${styles.itemDelete}`}
                      onClick={() => removeItem(key, item)}
                      title="Supprimer définitivement"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.addRow}>
                <input
                  type="text"
                  ref={(el) => {
                    inputRefs.current[key] = el;
                  }}
                  className={`${styles.addInput} ${hintKey === key ? styles.addInputHint : ''}`}
                  value={drafts[key] ?? ''}
                  onChange={(e) => {
                    if (hintKey === key) setHintKey(null);
                    setDrafts((d) => ({ ...d, [key]: e.target.value }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem(key);
                    }
                  }}
                  placeholder={key === 'uaa' ? 'Intitulé de la nouvelle UAA...' : 'Nouveau geste...'}
                />
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => addItem(key)}
                  disabled={isSaving}
                  title="Ajouter"
                >
                  +
                </button>
              </div>
              {hintKey === key && (
                <p className={styles.addHint}>
                  Tapez d&apos;abord l&apos;intitulé dans le champ, puis cliquez sur + (ou Entrée).
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
