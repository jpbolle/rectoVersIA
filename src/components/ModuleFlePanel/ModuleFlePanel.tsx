'use client';

// Bibliothèque de modules FLE — onglet « Modules FLE » de Mes Ressources.
//
// Même armature qu'OeuvrePanel : trois paniers (les miens, exemples partagés,
// ceux des collègues à dupliquer), une carte « + », une popup de création
// courte (titre, type, niveau), et l'éditeur pleine page (ModuleFleEditor)
// pour le reste. Pas de `confirm()` : l'archivage passe par une popup.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { niveauxVisibles } from '@/types/didactique-fle';
import EmptyState from '@/components/EmptyState/EmptyState';
import ModuleFleCard from '@/components/ModuleFleCard/ModuleFleCard';
import ModuleFleEditor from '@/components/ModuleFleEditor/ModuleFleEditor';
import type { ModuleFle } from '@/types/module-fle';
import creerStyles from '@/components/OeuvreCard/CreateOeuvreCard.module.css';
import styles from './ModuleFlePanel.module.css';

interface Paniers {
  miens: ModuleFle[];
  exemples: ModuleFle[];
  autres: ModuleFle[];
}

const VIDE: Paniers = { miens: [], exemples: [], autres: [] };

export default function ModuleFlePanel() {
  const { getAuthHeaders, isAdmin } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;
  const { config } = useDidactiqueFle();

  const [paniers, setPaniers] = useState<Paniers>(VIDE);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState<ModuleFle | null>(null);
  const [lectureSeule, setLectureSeule] = useState(false);
  const [creation, setCreation] = useState(false);
  const [aArchiver, setAArchiver] = useState<ModuleFle | null>(null);

  // Brouillon de création
  const [titre, setTitre] = useState('');
  const [type, setType] = useState('');
  const [niveau, setNiveau] = useState('');

  const typesVisibles = config.typesModule.filter((t) => t.visible);
  const niveaux = niveauxVisibles(config);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const headers = await headersRef.current();
      const res = await fetch('/api/modules-fle', { headers: headers || undefined });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Chargement impossible');
      setPaniers({
        miens: json.data || [],
        exemples: json.shared || [],
        autres: json.otherProfs || [],
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  const ouvrirCreation = () => {
    setTitre('');
    setType(typesVisibles[0]?.id ?? '');
    setNiveau(niveaux[1]?.id ?? niveaux[0]?.id ?? '');
    setCreation(true);
  };

  const creer = useCallback(async () => {
    if (!titre.trim()) return;
    try {
      const headers = await headersRef.current();
      const res = await fetch('/api/modules-fle', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: titre.trim(), type, niveau }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setCreation(false);
      // On enchaîne sur l'éditeur : un module sans théorie ni activité n'est
      // qu'un titre
      setLectureSeule(false);
      setEnEdition(json.data);
      charger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur');
    }
  }, [titre, type, niveau, charger]);

  const dupliquer = useCallback(
    async (m: ModuleFle) => {
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/modules-fle/${m.id}/dupliquer`, { method: 'POST', headers: headers || undefined });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setMessage(json.message || 'Module dupliqué');
        charger();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Erreur');
      }
    },
    [charger]
  );

  const archiver = useCallback(async () => {
    if (!aArchiver) return;
    try {
      const headers = await headersRef.current();
      const res = await fetch(`/api/modules-fle/${aArchiver.id}`, { method: 'DELETE', headers: headers || undefined });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setMessage('Module archivé');
      setAArchiver(null);
      charger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur');
    }
  }, [aArchiver, charger]);

  const togglePartage = useCallback(
    async (m: ModuleFle) => {
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/modules-fle/${m.id}`, {
          method: 'PATCH',
          headers: { ...(headers || {}), 'Content-Type': 'application/json' },
          body: JSON.stringify({ shared: !m.shared }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setMessage(m.shared ? 'Retiré des exemples' : 'Proposé comme exemple à tous');
        charger();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Erreur');
      }
    },
    [charger]
  );

  if (enEdition) {
    return (
      <ModuleFleEditor
        module={enEdition}
        lectureSeule={lectureSeule}
        onFermer={() => setEnEdition(null)}
        onModifie={charger}
      />
    );
  }

  const grille = (liste: ModuleFle[], mienne: boolean, avecCarteAjout = false) => (
    <div className={styles.grille}>
      {avecCarteAjout && (
        <article
          className={creerStyles.card}
          onClick={ouvrirCreation}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && ouvrirCreation()}
        >
          <div className={creerStyles.content}>
            <span className={creerStyles.icon}>+</span>
            <h3 className={creerStyles.title}>Créer un module</h3>
          </div>
        </article>
      )}
      {liste.map((m) => (
        <ModuleFleCard
          key={m.id}
          module={m}
          mienne={mienne}
          isAdmin={isAdmin}
          onEditer={(x) => {
            setLectureSeule(false);
            setEnEdition(x);
          }}
          onVoir={(x) => {
            setLectureSeule(true);
            setEnEdition(x);
          }}
          onDupliquer={dupliquer}
          onArchiver={mienne ? (x) => setAArchiver(x) : undefined}
          onTogglePartage={mienne ? togglePartage : undefined}
        />
      ))}
    </div>
  );

  const section = (titreSection: string, aide: string, liste: ModuleFle[]) =>
    liste.length > 0 && (
      <section className={styles.groupe}>
        <div className={styles.groupeEntete}>
          <h2 className={styles.groupeTitre}>{titreSection}</h2>
          <p className={styles.groupeAide}>{aide}</p>
        </div>
        {grille(liste, false)}
      </section>
    );

  return (
    <div className={styles.panneau}>
      {message && (
        <div className={styles.message} onClick={() => setMessage(null)} role="status">
          {message}
        </div>
      )}

      {chargement ? (
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : (
        <>
          <section className={styles.groupe}>
            <div className={styles.groupeEntete}>
              <h2 className={styles.groupeTitre}>Mes modules FLE</h2>
              <p className={styles.groupeAide}>
                Un module = un point de théorie : une introduction et les ressources qui la
                portent (document, images, vidéos…). Sur la ligne du temps d’une « Séquence
                FLE » (Mes Activités), il alterne avec des activités ; un même module sert à
                autant de séquences qu’on veut.
              </p>
            </div>
            {grille(paniers.miens, true, true)}
          </section>

          {section('Modules partagés', 'exemples proposés à tous', paniers.exemples)}
          {section('Modules des professeurs', 'à dupliquer pour les modifier', paniers.autres)}
        </>
      )}

      {/* ── Création ── */}
      {creation && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setCreation(false)}>
          <div className={styles.popup}>
            <header className={styles.popupEntete}>
              <h3>Nouveau module FLE</h3>
              <button type="button" className={styles.popupFermer} onClick={() => setCreation(false)}>
                ✕
              </button>
            </header>
            <div className={styles.popupCorps}>
              <label className={styles.champ}>
                Titre
                <input
                  type="text"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex : Le verbe avoir"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && creer()}
                />
              </label>
              <div className={styles.deuxChamps}>
                <label className={styles.champ}>
                  Type
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    {typesVisibles.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.champ}>
                  Niveau
                  <select value={niveau} onChange={(e) => setNiveau(e.target.value)}>
                    {niveaux.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <footer className={styles.popupPied}>
              <span className={styles.popupNote}>La théorie et les activités se règlent juste après.</span>
              <div className={styles.popupBoutons}>
                <button type="button" className={styles.btnGhost} onClick={() => setCreation(false)}>
                  Annuler
                </button>
                <button type="button" className={styles.btnPrimary} onClick={creer} disabled={!titre.trim()}>
                  Créer
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* ── Archivage ── */}
      {aArchiver && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setAArchiver(null)}>
          <div className={styles.popup}>
            <header className={styles.popupEntete}>
              <h3>Archiver « {aArchiver.titre} » ?</h3>
              <button type="button" className={styles.popupFermer} onClick={() => setAArchiver(null)}>
                ✕
              </button>
            </header>
            <div className={styles.popupCorps}>
              <p className={styles.texte}>
                Le module disparaît de la bibliothèque. Les séquences qui l’utilisent continueront
                de l’ouvrir : rien n’est supprimé.
              </p>
            </div>
            <footer className={styles.popupPied}>
              <span />
              <div className={styles.popupBoutons}>
                <button type="button" className={styles.btnGhost} onClick={() => setAArchiver(null)}>
                  Annuler
                </button>
                <button type="button" className={styles.btnDanger} onClick={archiver}>
                  Archiver
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
