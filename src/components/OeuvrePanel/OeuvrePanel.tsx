'use client';

// Bibliothèque d'œuvres — onglet de « Mes Ressources » (page /grilles).
//
// Une œuvre est une ressource RÉUTILISABLE, pas le contenu d'une activité : on
// l'encode une fois, on la donne à autant de classes qu'on veut, année après
// année. Le partage suit le modèle des grilles : chacun voit celles des autres
// et peut en dupliquer une pour la remanier — on ne modifie jamais l'œuvre
// d'un collègue.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import OeuvreBuilder from '@/components/OeuvreBuilder/OeuvreBuilder';
import type { Oeuvre } from '@/types/oeuvre';
import styles from './OeuvrePanel.module.css';

interface Paniers {
  miennes: Oeuvre[];
  partagees: Oeuvre[];
  autres: Oeuvre[];
}

const VIDE: Paniers = { miennes: [], partagees: [], autres: [] };

function compterSections(o: Oeuvre): number {
  return o.chapitres.reduce((n, c) => n + c.sections.length, 0);
}

export default function OeuvrePanel() {
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const [paniers, setPaniers] = useState<Paniers>(VIDE);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  // Consultation (œuvre d'un collègue) vs construction (la mienne) : on ne
  // modifie jamais l'œuvre d'un autre, on la duplique.
  const [ouverte, setOuverte] = useState<Oeuvre | null>(null);
  const [enConstruction, setEnConstruction] = useState<Oeuvre | null>(null);
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
        partagees: json.shared || [],
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

  const carte = (o: Oeuvre, mienne: boolean) => (
    <article key={o.id} className={`${styles.carte} ${o.archive ? styles.carteArchivee : ''}`}>
      <header className={styles.carteEntete}>
        <h3 className={styles.carteTitre}>{o.titre}</h3>
        {o.auteur && !o.titre.toLowerCase().includes(o.auteur.toLowerCase()) && (
          <span className={styles.carteAuteur}>{o.auteur}</span>
        )}
      </header>

      <p className={styles.carteChiffres}>
        {o.chapitres.length} chapitre{o.chapitres.length > 1 ? 's' : ''} ·{' '}
        {compterSections(o)} section{compterSections(o) > 1 ? 's' : ''}
      </p>

      {o.description && <p className={styles.carteDescription}>{o.description}</p>}

      {!mienne && o.profName && <p className={styles.carteProf}>de {o.profName}</p>}
      {o.archive && <p className={styles.carteProf}>Archivée</p>}

      <div className={styles.carteActions}>
        {mienne && !o.archive ? (
          <button type="button" className={styles.btnPrimary} onClick={() => ouvrir(o.id, true)}>
            Construire
          </button>
        ) : null}
        <button type="button" className={styles.btnGhost} onClick={() => ouvrir(o.id, false)}>
          Voir le sommaire
        </button>
        <button type="button" className={styles.btnGhost} onClick={() => dupliquer(o)}>
          Dupliquer
        </button>
        {mienne && !o.archive && (
          <button type="button" className={styles.btnDanger} onClick={() => archiver(o)}>
            Archiver
          </button>
        )}
      </div>
    </article>
  );

  const groupe = (titre: string, aide: string, liste: Oeuvre[], miennes: boolean) =>
    liste.length > 0 && (
      <section className={styles.groupe}>
        <h2 className={styles.groupeTitre}>
          {titre} <span className={styles.groupeAide}>{aide}</span>
        </h2>
        <div className={styles.grille}>{liste.map((o) => carte(o, miennes))}</div>
      </section>
    );

  if (enConstruction) {
    return (
      <OeuvreBuilder
        oeuvre={enConstruction}
        onFermer={() => setEnConstruction(null)}
        onModifie={charger}
      />
    );
  }

  return (
    <div className={styles.panneau}>
      <div className={styles.barre}>
        <p className={styles.intro}>
          Une œuvre s’encode <strong>une fois</strong> et se donne à autant de classes qu’on veut.
          Celle d’un collègue ne se modifie pas : on la duplique.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={() => setCreation(true)}>
          + Nouvelle œuvre
        </button>
      </div>

      {message && (
        <div className={styles.message} onClick={() => setMessage(null)} role="status">
          {message}
        </div>
      )}

      {chargement ? (
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : paniers.miennes.length + paniers.partagees.length + paniers.autres.length === 0 ? (
        <EmptyState
          icon="📚"
          message="Aucune œuvre pour le moment. Une œuvre, c’est un texte long découpé en chapitres et en sections, que les élèves lisent à leur rythme."
        />
      ) : (
        <>
          {groupe('Mes œuvres', '', paniers.miennes, true)}
          {groupe('Œuvres partagées', 'exemples', paniers.partagees, false)}
          {groupe('Œuvres des professeurs', 'à dupliquer pour les modifier', paniers.autres, false)}
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
                Pour modifier le contenu, ouvre l’œuvre avec « Construire ». Celle d’un
                collègue se duplique d’abord.
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
