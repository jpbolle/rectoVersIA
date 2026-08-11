'use client';

// Bloc « Mes élèves » (page Mes Classes) : tous les élèves du prof, toutes
// classes confondues, avec filtre Actifs / Archivés (un élève est archivé
// quand sa classe l'est) et recherche. Clic sur un élève → fiche complète
// (popup EleveProfilModal, ouverte par la page).

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { Classe, Eleve } from '@/types/classe';
import styles from './MesElevesSection.module.css';

interface MesElevesSectionProps {
  classes: Classe[];
  // Incrémenté par la page après ajout/modification/suppression d'un élève
  refreshKey: number;
  onOpenFiche: (eleve: Eleve) => void;
}

export default function MesElevesSection({
  classes,
  refreshKey,
  onOpenFiche,
}: MesElevesSectionProps) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'actifs' | 'archives'>('actifs');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/eleves', { headers });
        const json = await res.json();
        if (!cancelled && json.success) setEleves(json.data);
      } catch (err) {
        console.error('Erreur fetch mes élèves:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getAuthHeaders, refreshKey]);

  const classeById = useMemo(() => {
    const map = new Map<string, Classe>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return eleves
      .filter((e) => {
        const archived = classeById.get(e.classeId)?.archive === true;
        if (filter === 'actifs' ? archived : !archived) return false;
        if (!needle) return true;
        return `${e.prenom} ${e.nom}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
  }, [eleves, classeById, filter, search]);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Mes Élèves</h2>
        <div className={styles.tools}>
          <input
            type="search"
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un élève..."
          />
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${filter === 'actifs' ? styles.tabActive : ''}`}
              onClick={() => setFilter('actifs')}
            >
              Actifs
            </button>
            <button
              type="button"
              className={`${styles.tab} ${filter === 'archives' ? styles.tabActive : ''}`}
              onClick={() => setFilter('archives')}
            >
              Archivés
            </button>
          </div>
        </div>
      </div>
      <p className={styles.hint}>
        Clique sur un élève pour ouvrir sa fiche (profil d&apos;écrilecteur complet).
      </p>

      {isLoading ? (
        <EmptyState icon="hourglass" message="Chargement..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="chart"
          message={
            search.trim()
              ? 'Aucun élève ne correspond à la recherche.'
              : filter === 'actifs'
                ? 'Aucun élève dans les classes actives.'
                : 'Aucun élève dans les classes archivées.'
          }
        />
      ) : (
        <div className={styles.grid}>
          {filtered.map((eleve) => {
            const classe = classeById.get(eleve.classeId);
            return (
              <button
                key={eleve.id}
                type="button"
                className={styles.eleveChip}
                onClick={() => onOpenFiche(eleve)}
                title="Ouvrir la fiche de l'élève"
              >
                <span className={styles.avatar}>
                  {eleve.nom.charAt(0)}
                  {eleve.prenom.charAt(0)}
                </span>
                <span className={styles.eleveInfo}>
                  <span className={styles.eleveName}>
                    {eleve.nom} {eleve.prenom}
                  </span>
                  {classe && (
                    <span className={styles.classeBadge}>
                      {classe.nom}
                      {classe.archive ? ' · archivée' : ''}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
