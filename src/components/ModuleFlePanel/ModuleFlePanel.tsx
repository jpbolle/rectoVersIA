'use client';

// Bibliothèque des POINTS DE THÉORIE FLE (collection `modulesFle`) —
// Mes Ressources › Modules FLE › Points de théorie. Le mot « module » reste dans le
// code et les données ; à l'écran, c'est « point de théorie » (JP, 2026-09-19).
//
// Même armature qu'OeuvrePanel : trois paniers (les miens, exemples partagés,
// ceux des collègues à dupliquer), une carte « + » qui ouvre DIRECTEMENT
// l'éditeur pleine page (ModuleFleEditor) sur un point vierge — la popup
// titre-type-niveau qui le précédait a été retirée (JP, 2026-09-19).
// Pas de `confirm()` : l'archivage passe par une popup.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { niveauxVisibles } from '@/types/didactique-fle';
import EmptyState from '@/components/EmptyState/EmptyState';
import ModuleFleCard from '@/components/ModuleFleCard/ModuleFleCard';
import ModuleFleEditor from '@/components/ModuleFleEditor/ModuleFleEditor';
import type { ModuleFle } from '@/types/module-fle';
import CreateOeuvreCard from '@/components/OeuvreCard/CreateOeuvreCard';
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
  const [aArchiver, setAArchiver] = useState<ModuleFle | null>(null);

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

  // Un point de théorie VIERGE, ouvert tout de suite dans l'éditeur : il ne
  // naîtra en base qu'au premier « Enregistrer » (id vide = nouveau)
  const ouvrirCreation = () => {
    const niveaux = niveauxVisibles(config);
    setLectureSeule(false);
    setEnEdition({
      id: '',
      titre: '',
      description: '',
      type: config.typesModule.find((t) => t.visible)?.id ?? '',
      niveau: niveaux[1]?.id ?? niveaux[0]?.id ?? '',
      competences: [],
      introduction: '',
      ressources: null,
      profId: '',
      shared: false,
      archive: false,
      anneeScolaire: '',
      createdAt: '',
      updatedAt: '',
    });
  };

  const dupliquer = useCallback(
    async (m: ModuleFle) => {
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/modules-fle/${m.id}/dupliquer`, { method: 'POST', headers: headers || undefined });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setMessage('Point de théorie dupliqué');
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
      setMessage('Point de théorie archivé');
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
        <CreateOeuvreCard onClick={ouvrirCreation} libelle="Créer un point de théorie" />
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
              <h2 className={styles.groupeTitre}>Mes points de théorie</h2>
              <p className={styles.groupeAide}>
                Une introduction et les ressources qui portent la théorie (document, images,
                vidéos…). Sur la ligne du temps d’une « Séquence FLE » (Mes Activités), un point
                de théorie alterne avec des activités ; il sert à autant de séquences qu’on veut.
              </p>
            </div>
            {grille(paniers.miens, true, true)}
          </section>

          {section('Points de théorie partagés', 'exemples proposés à tous', paniers.exemples)}
          {section('Points de théorie des professeurs', 'à dupliquer pour les modifier', paniers.autres)}
        </>
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
                Le point de théorie disparaît de la bibliothèque. Les séquences qui l’utilisent continueront
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
