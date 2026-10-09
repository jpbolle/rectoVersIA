'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDevoirs } from '@/hooks/useDevoirs';
import { parEcheance } from '@/lib/devoir-utils';
import { aUneClasseFle, useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import DevoirCard from '@/components/DevoirCard/DevoirCard';
import EmptyState from '@/components/EmptyState/EmptyState';
import OngletsBarre from '@/components/OngletsBarre/OngletsBarre';
import ActivitesEtiquettes from '@/components/ActivitesEtiquettes/ActivitesEtiquettes';
import styles from './activites.module.css';

export default function ActivitesPage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const { devoirs: tousLesDevoirs, isLoading: devoirsLoading } = useDevoirs();
  const { classes, isLoading: classesLoading } = useStudentClasses();
  // Espace classique (2026-10-08) : une activité donnée à une classe FLE est
  // FLE — elle vit dans « Mon cours FLE », pas ici (même règle que chez le prof)
  const nomsFle = new Set(classes.filter((c) => c.type === 'fle').map((c) => c.nom));
  // Par échéance, de la plus proche à la plus éloignée (JP, 2026-10-09)
  const devoirs = (
    role === 'eleve' && aUneClasseFle(classes)
      ? tousLesDevoirs.filter((d) => !d.classes.some((nom) => nomsFle.has(nom)))
      : tousLesDevoirs
  ).slice().sort(parEcheance);

  // Le bloc « Activités classées » et ses quatre onglets (JP, 2026-10-09) ;
  // il s'ouvre sur les activités corrigées
  type Onglet = 'toutes' | 'corrigees' | 'classees' | 'archivees';
  const [onglet, setOnglet] = useState<Onglet>('corrigees');
  const mesNoms = new Set(classes.map((c) => c.nom));
  const nomsArchives = new Set(classes.filter((c) => c.archive).map((c) => c.nom));
  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  // devoirId → visibleParEleve pour les corrections individuelles
  const [correctionVisibility, setCorrectionVisibility] = useState<Record<string, boolean>>({});
  // devoirId → { status, nonRendu } de son travail (classement corrigés / non rendus)
  const [travauxStatus, setTravauxStatus] = useState<Record<string, { status: string; nonRendu: string | null }> | null>(null);

  // Mode prévisualisation pour les profs
  const isPreviewMode = role === 'prof';

  // Charger la visibilité des corrections individuelles + le statut de remise
  // de ses travaux (élève seulement)
  useEffect(() => {
    if (role !== 'eleve' || !isAuthenticated) return;
    getAuthHeaders().then((headers) => {
      if (!headers) return;
      fetch('/api/corrections/mine', { headers })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            const map: Record<string, boolean> = {};
            for (const item of json.data) {
              map[item.devoirId] = item.visibleParEleve;
            }
            setCorrectionVisibility(map);
          }
        })
        .catch(() => {});
      fetch('/api/travaux/status', { headers })
        .then((r) => r.json())
        .then((json) => setTravauxStatus(json.success ? json.data : {}))
        .catch(() => setTravauxStatus({}));
    });
  }, [role, isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ((authLoading && !isAuthenticated) || redirecting) return;
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/login');
      return;
    }
    // Élève sans classe → renvoyer vers login pour rejoindre une classe
    if (role === 'eleve' && !classesLoading && classes.length === 0) {
      setRedirecting(true);
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, role, classes, classesLoading, router, redirecting]);


  if ((authLoading && !isAuthenticated) || redirecting || (role === 'eleve' && classesLoading)) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''} ${isPreviewMode ? styles.previewMode : ''}`}>
      {isPreviewMode && (
        <div className={styles.previewBanner}>
          <span>👁️ Mode prévisualisation élève</span>
          <button
            className={styles.backButton}
            onClick={() => router.push('/dashboard')}
          >
            Retour au tableau de bord
          </button>
        </div>
      )}

      <Header variant="student" topOffset={isPreviewMode ? 44 : 0} avecCoursFle={role === 'eleve' && aUneClasseFle(classes)} />

      <main className={styles.mainContent}>
        {devoirsLoading || (role === 'eleve' && travauxStatus === null) ? (
          <section className={styles.activitesSection}>
            <EmptyState icon="hourglass" message="En cours de chargement" />
          </section>
        ) : (() => {
          const estCorrige = (d: { id: string; corrigeDisponible: boolean }) =>
            d.corrigeDisponible || correctionVisibility[d.id] === true;
          // « Non rendu » = uniquement si le prof l'a coché sur la copie
          const nonRenduOf = (d: { id: string }) =>
            role === 'eleve' ? travauxStatus?.[d.id]?.nonRendu ?? null : null;
          // Un travail marqué « non rendu » par le prof sort de tous les autres
          // blocs, que l'activité soit corrigée ou non.
          // ARCHIVÉE : par le prof (le serveur a déjà replié les sessions), ou
          // parce que toutes MES classes de cette activité sont archivées.
          const archivee = (d: { archive?: boolean; classes: string[] }) => {
            if (d.archive) return true;
            const miennes = d.classes.filter((nom) => mesNoms.has(nom));
            return miennes.length > 0 && miennes.every((nom) => nomsArchives.has(nom));
          };
          // CLASSÉE par le prof (`corrige`, 2026-10-09) : rangée, chez lui comme
          // chez l'élève — qui peut encore l'ouvrir pour relire.
          const classee = (d: { corrige?: boolean }) => d.corrige === true;
          const nonRendus = devoirs.filter((d) => nonRenduOf(d));
          const restantes = devoirs.filter((d) => !nonRenduOf(d));
          const archivees = restantes.filter(archivee);
          const vivantes = restantes.filter((d) => !archivee(d));
          const actives = vivantes.filter((d) => !estCorrige(d) && !classee(d));
          const corrigees = vivantes.filter((d) => estCorrige(d) && !classee(d));
          const classees = vivantes.filter(classee);
          const onglets: { id: Onglet; label: string; n: number }[] = [
            { id: 'toutes', label: 'Toutes', n: corrigees.length + classees.length },
            { id: 'corrigees', label: 'Corrigées', n: corrigees.length },
            { id: 'classees', label: 'Classées', n: classees.length },
            { id: 'archivees', label: 'Archivées', n: archivees.length },
          ];
          // Classées et archivées : des ÉTIQUETTES (le titre), pas des cartes —
          // composant partagé avec le tableau de bord du prof
          const etiquettes = (liste: typeof devoirs, vide: string, titre?: string) => (
            <ActivitesEtiquettes
              devoirs={liste}
              hrefDe={(d) => `/activites/${d.id}`}
              classesDe={(d) => d.classes.filter((nom) => mesNoms.has(nom))}
              vide={vide}
              titre={titre}
              note="Cliquer pour relire"
            />
          );
          const cartes = (liste: typeof devoirs, vide: string) =>
            liste.length === 0 ? (
              <p className={styles.ongletVide}>{vide}</p>
            ) : (
              <div className={styles.activitesGrid}>
                {liste.map((devoir) => (
                  <DevoirCard key={devoir.id} devoir={devoir} variant="student" />
                ))}
              </div>
            );
          const excuseLabel = (d: { id: string }) =>
            nonRenduOf(d) === 'justifie'
              ? 'Non rendu — justifié'
              : 'Non fait — note : 0';
          return (
            <>
              <section className={styles.activitesSection}>
                <h3 className={styles.sectionTitle}>Mes activités en cours</h3>
                <div className={styles.activitesGrid}>
                  {actives.length === 0 ? (
                    <EmptyState
                      icon="📋"
                      message="Aucune activité n'est disponible pour le moment."
                    />
                  ) : (
                    actives.map((devoir) => (
                      <DevoirCard
                        key={devoir.id}
                        devoir={devoir}
                        variant="student"
                      />
                    ))
                  )}
                </div>
              </section>

              <section className={`${styles.activitesSection} ${styles.corrigeesSection}`}>
                <h3 className={styles.sectionTitle}>Activités classées</h3>
                <OngletsBarre onglets={onglets} actif={onglet} onChange={setOnglet} />
                {onglet === 'corrigees' && cartes(corrigees, 'Aucune activité corrigée pour le moment.')}
                {onglet === 'classees' && etiquettes(classees, 'Aucune activité classée pour le moment.')}
                {onglet === 'archivees' && etiquettes(archivees, 'Aucune activité archivée.')}
                {onglet === 'toutes' && (
                  <>
                    {cartes(corrigees, 'Aucune activité corrigée pour le moment.')}
                    {etiquettes(classees, '', 'Classées')}
                  </>
                )}
              </section>

              {nonRendus.length > 0 && (
                <section className={`${styles.activitesSection} ${styles.corrigeesSection}`}>
                  <h3 className={styles.sectionTitle}>Travaux non rendus</h3>
                  <div className={styles.activitesGrid}>
                    {nonRendus.map((devoir) => (
                      <div key={devoir.id} className={styles.nonRenduWrap}>
                        {/* Pas de badge « corrigé disponible » : le corrigé est
                            réservé à ceux qui ont rendu le travail */}
                        <DevoirCard
                          devoir={{ ...devoir, corrigeDisponible: false }}
                          variant="student"
                        />
                        <span className={styles.nonRenduBadge}>{excuseLabel(devoir)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          );
        })()}
      </main>

      <Footer />
    </div>
  );
}
