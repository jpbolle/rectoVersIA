'use client';

// Bibliothèque d'œuvres — onglet de « Mes Ressources » (page /grilles).
//
// Une œuvre est une ressource RÉUTILISABLE, pas le contenu d'une activité : on
// l'encode une fois, on la donne à autant de classes qu'on veut, année après
// année.
//
// ─── DEUX PARTAGES, à ne jamais confondre ───
//
//   « Œuvres des professeurs »  → je vois celle d'un collègue et je la
//                                 DUPLIQUE. Je repars avec ma copie ; la
//                                 sienne ne bouge pas. (Modèle des grilles.)
//
//   « Partagées avec moi »      → un collègue m'a désigné NOMMÉMENT. J'accède
//                                 au MÊME livre, en lecture ou en co-édition.
//                                 Rien n'est copié.
//
// Les cartes reprennent le gabarit de GrilleCard et VocabCard : trois familles
// voisines dans une même page ne peuvent pas se ressembler « à peu près ».

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import OeuvreBuilder from '@/components/OeuvreBuilder/OeuvreBuilder';
import OeuvreCard from '@/components/OeuvreCard/OeuvreCard';
import CreateOeuvreCard from '@/components/OeuvreCard/CreateOeuvreCard';
import OeuvrePartageModal from '@/components/OeuvreCard/OeuvrePartageModal';
import { partageDe } from '@/types/oeuvre';
import type { Oeuvre } from '@/types/oeuvre';
import styles from './OeuvrePanel.module.css';

interface Paniers {
  miennes: Oeuvre[];
  partagees: Oeuvre[];
  exemples: Oeuvre[];
  autres: Oeuvre[];
}

const VIDE: Paniers = { miennes: [], partagees: [], exemples: [], autres: [] };

function compterSections(o: Oeuvre): number {
  return o.chapitres.reduce((n, c) => n + c.sections.length, 0);
}

export default function OeuvrePanel() {
  const { getAuthHeaders, user } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;
  // `user` est un objet instable (règle AGENTS.md) : on n'en garde que l'email,
  // et seulement pour savoir quel partage me concerne.
  const monEmail = (user?.email || '').toLowerCase();

  const [paniers, setPaniers] = useState<Paniers>(VIDE);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<Oeuvre | null>(null);
  const [enConstruction, setEnConstruction] = useState<Oeuvre | null>(null);
  const [aPartager, setAPartager] = useState<Oeuvre | null>(null);
  const [creation, setCreation] = useState(false);
  const [nouveauTitre, setNouveauTitre] = useState('');
  const [nouvelAuteur, setNouvelAuteur] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const headers = await headersRef.current();
      const res = await fetch('/api/oeuvres', { headers: headers || undefined });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Chargement impossible');
      setPaniers({
        miennes: json.data || [],
        partagees: json.partagees || [],
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

  // Le sommaire complet n'arrive qu'à l'ouverture : la liste n'a besoin que
  // des compteurs, et une anthologie fait 67 sections.
  const ouvrir = useCallback(async (id: string, pourModifier: boolean) => {
    try {
      const headers = await headersRef.current();
      const res = await fetch(`/api/oeuvres/${id}`, { headers: headers || undefined });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Œuvre introuvable');
      if (pourModifier) setEnConstruction(json.data);
      else setOuverte(json.data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur');
    }
  }, []);

  const creer = useCallback(async () => {
    if (!nouveauTitre.trim()) return;
    try {
      const headers = await headersRef.current();
      const res = await fetch('/api/oeuvres', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: nouveauTitre.trim(), auteur: nouvelAuteur.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setMessage(json.message || 'Œuvre créée');
      setCreation(false);
      setNouveauTitre('');
      setNouvelAuteur('');
      charger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur');
    }
  }, [nouveauTitre, nouvelAuteur, charger]);

  const dupliquer = useCallback(
    async (o: Oeuvre) => {
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/oeuvres/${o.id}/dupliquer`, {
          method: 'POST',
          headers: headers || undefined,
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setMessage(json.message || 'Œuvre dupliquée');
        charger();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Erreur');
      }
    },
    [charger]
  );

  const archiver = useCallback(
    async (o: Oeuvre) => {
      // Une œuvre peut être donnée à des activités en cours : on archive,
      // on ne supprime jamais.
      if (!confirm(`Archiver « ${o.titre} » ? Les activités qui l’utilisent continueront de l’ouvrir.`)) {
        return;
      }
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/oeuvres/${o.id}`, {
          method: 'DELETE',
          headers: headers || undefined,
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setMessage('Œuvre archivée');
        if (ouverte?.id === o.id) setOuverte(null);
        charger();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Erreur');
      }
    },
    [charger, ouverte]
  );

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  if (enConstruction) {
    return (
      <OeuvreBuilder
        oeuvre={enConstruction}
        onFermer={() => setEnConstruction(null)}
        onModifie={charger}
      />
    );
  }

  const grille = (
    liste: Oeuvre[],
    options: { mienne: boolean; avecCarteAjout?: boolean }
  ) => (
    <div className={styles.grille}>
      {options.avecCarteAjout && <CreateOeuvreCard onClick={() => setCreation(true)} />}
      {liste.map((o) => {
        const recu = options.mienne ? null : partageDe(o, monEmail);
        return (
          <OeuvreCard
            key={o.id}
            oeuvre={o}
            mienne={options.mienne}
            coEditable={recu?.mode === 'edition'}
            partageRecu={recu?.mode ?? null}
            onVoir={(x) => ouvrir(x.id, false)}
            onEditer={(x) => ouvrir(x.id, true)}
            onPartager={options.mienne ? (x) => setAPartager(x) : undefined}
            onDupliquer={dupliquer}
            onArchiver={options.mienne ? archiver : undefined}
          />
        );
      })}
    </div>
  );

  const section = (titre: string, aide: string, liste: Oeuvre[], mienne: boolean) =>
    liste.length > 0 && (
      <section className={styles.groupe}>
        <div className={styles.groupeEntete}>
          <h2 className={styles.groupeTitre}>{titre}</h2>
          <p className={styles.groupeAide}>{aide}</p>
        </div>
        {grille(liste, { mienne })}
      </section>
    );

  return (
    <div className={styles.panneau}>
      <p className={styles.intro}>
        Une œuvre s’encode <strong>une fois</strong> et se donne à autant de classes qu’on veut.
        Pour qu’un collègue accède au <strong>même</strong> livre, partage-la ; pour qu’il reparte
        avec sa propre version, il la duplique.
      </p>

      {message && (
        <div className={styles.message} onClick={() => setMessage(null)} role="status">
          {message}
        </div>
      )}

      {chargement ? (
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : (
        <>
          {/* Mes œuvres : la carte « + » ouvre le groupe, même vide */}
          <section className={styles.groupe}>
            <div className={styles.groupeEntete}>
              <h2 className={styles.groupeTitre}>Mes œuvres</h2>
              <p className={styles.groupeAide}>
                Une œuvre s’encode une fois et se donne à autant de classes qu’on veut
              </p>
            </div>
            {grille(paniers.miennes, { mienne: true, avecCarteAjout: true })}
          </section>

          {section(
            'Partagées avec moi',
            'le même livre que celui du collègue — rien n’est copié',
            paniers.partagees,
            false
          )}
          {section('Œuvres partagées', 'exemples proposés à tous', paniers.exemples, false)}
          {section(
            'Œuvres des professeurs',
            'à dupliquer pour les modifier',
            paniers.autres,
            false
          )}
        </>
      )}

      {/* ── Création ── */}
      {creation && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setCreation(false)}>
          <div className={styles.popup}>
            <header className={styles.popupEntete}>
              <h3>Nouvelle œuvre</h3>
              <button type="button" className={styles.popupFermer} onClick={() => setCreation(false)}>
                ✕
              </button>
            </header>
            <div className={styles.popupCorps}>
              <label className={styles.champ}>
                Titre
                <input
                  type="text"
                  value={nouveauTitre}
                  onChange={(e) => setNouveauTitre(e.target.value)}
                  placeholder="Ex : Molière — Anthologie comique"
                  autoFocus
                />
              </label>
              <label className={styles.champ}>
                Auteur
                <input
                  type="text"
                  value={nouvelAuteur}
                  onChange={(e) => setNouvelAuteur(e.target.value)}
                  placeholder="Ex : Molière"
                />
              </label>
            </div>
            <footer className={styles.popupPied}>
              <button type="button" className={styles.btnGhost} onClick={() => setCreation(false)}>
                Annuler
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={creer}
                disabled={!nouveauTitre.trim()}
              >
                Créer
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Partage ── */}
      {aPartager && (
        <OeuvrePartageModal
          oeuvre={aPartager}
          onFermer={() => setAPartager(null)}
          onEnregistre={() => {
            setMessage('Partages enregistrés');
            charger();
          }}
        />
      )}

      {/* ── Sommaire d'une œuvre ── */}
      {ouverte && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setOuverte(null)}>
          <div className={`${styles.popup} ${styles.popupLarge}`}>
            <header className={styles.popupEntete}>
              <div>
                <h3>{ouverte.titre}</h3>
                <p className={styles.popupSous}>
                  {ouverte.chapitres.length} chapitres · {compterSections(ouverte)} sections
                </p>
              </div>
              <button type="button" className={styles.popupFermer} onClick={() => setOuverte(null)}>
                ✕
              </button>
            </header>

            <div className={styles.popupCorps}>
              {ouverte.chapitres.map((c) => (
                <section key={c.id} className={styles.chapitre}>
                  <h4 className={styles.chapitreTitre}>
                    {c.titre}
                    {c.sousTitre && <span className={styles.chapitreDate}>{c.sousTitre}</span>}
                  </h4>
                  {c.sections.map((s, i) => {
                    const precedent = i > 0 ? c.sections[i - 1].groupe : undefined;
                    const nouvelActe = s.groupe && s.groupe !== precedent;
                    return (
                      <div key={s.id}>
                        {nouvelActe && <div className={styles.acte}>{s.groupe}</div>}
                        <div className={styles.section}>
                          <span>{s.titre}</span>
                          {s.aQuestions && <span className={styles.pastille}>vérification</span>}
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>

            <footer className={styles.popupPied}>
              <span className={styles.popupNote}>
                Pour modifier le contenu, ouvre l’œuvre avec ✏️. Celle d’un collègue se duplique
                d’abord — sauf s’il te l’a partagée en co-édition.
              </span>
              <button type="button" className={styles.btnGhost} onClick={() => setOuverte(null)}>
                Fermer
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
