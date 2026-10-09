'use client';

// L'ATELIER d'une MATRICE de portfolio — Mes Ressources › Portfolios, au clic
// sur la carte. La fiche (titre, tâche finale, description, consignes
// générales) et le serpentin en grand, enregistrés AUTOMATIQUEMENT (différé de
// 800 ms, envoi forcé au départ) — même mécanique que l'atelier d'une séquence
// FLE (`SequenceAtelier`).
//
// C'est ici, et seulement ici, que « Créer une activité » existe dans le « + »
// du serpentin : le formulaire de création prend la page (pas de popups
// empilées), et l'activité créée s'insère comme renvoi à l'endroit choisi.

import { useCallback, useEffect, useRef, useState } from 'react';
import ConsignesEditor from '@/components/ConsignesEditor/ConsignesEditor';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import CreationForm from '@/components/CreationForm/CreationForm';
import EditDevoirModal from '@/components/EditDevoirModal/EditDevoirModal';
import PortfolioBuilder from './PortfolioBuilder';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import { nouvelleEtape, type PortfolioEtape, type PortfolioMatrice } from '@/types/portfolio';
import ed from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import styles from './Portfolio.module.css';

type Etat = 'enregistre' | 'attente' | 'envoi' | 'erreur';
const DELAI_MS = 800;

interface Props {
  matrice: PortfolioMatrice;
  devoirs: Devoir[];
  classeNames: string[];
  grilleTypes: string[];
  grilles: { name: string; ateliers: string[] }[];
  createDevoir: (data: CreateDevoirData) => Promise<{ data?: { id?: string } } | undefined>;
  enregistrerDevoir: (id: string, data: Partial<Devoir>, silencieux?: boolean) => Promise<boolean>;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  onRetour: () => void;
}

type Fiche = Pick<PortfolioMatrice, 'titre' | 'description' | 'tacheFinale' | 'consignes' | 'etapes' | 'ressources'>;

export default function PortfolioAtelier({
  matrice,
  devoirs,
  classeNames,
  grilleTypes,
  grilles,
  createDevoir,
  enregistrerDevoir,
  getAuthHeaders,
  onRetour,
}: Props) {
  const [fiche, setFiche] = useState<Fiche>({
    titre: matrice.titre,
    description: matrice.description,
    tacheFinale: matrice.tacheFinale,
    consignes: matrice.consignes,
    etapes: matrice.etapes,
    ressources: matrice.ressources,
  });
  const [ressourcesOuvertes, setRessourcesOuvertes] = useState(!!matrice.ressources);
  const [etat, setEtat] = useState<Etat>('enregistre');
  const [message, setMessage] = useState<string | null>(null);
  // « Créer une activité » : la position où l'insérer, le formulaire prend la page
  const [creationA, setCreationA] = useState<number | null>(null);
  const [envoiCreation, setEnvoiCreation] = useState(false);
  const [activiteOuverte, setActiviteOuverte] = useState<Devoir | null>(null);

  // ── Enregistrement automatique ──
  const aEnvoyer = useRef<Partial<Fiche> | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const envoyer = useCallback(async () => {
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
    const charge = aEnvoyer.current;
    if (!charge) return true;
    aEnvoyer.current = null;
    setEtat('envoi');
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch(`/api/portfolios/${matrice.id}`, { method: 'PATCH', headers, body: JSON.stringify(charge) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
      setEtat(aEnvoyer.current ? 'attente' : 'enregistre');
      return true;
    } catch (e) {
      aEnvoyer.current = { ...charge, ...(aEnvoyer.current ?? {}) };
      setEtat('erreur');
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible');
      return false;
    }
  }, [getAuthHeaders, matrice.id]);

  const envoyerRef = useRef(envoyer);
  useEffect(() => {
    envoyerRef.current = envoyer;
  });
  useEffect(
    () => () => {
      if (aEnvoyer.current) void envoyerRef.current();
    },
    []
  );

  const poser = (patch: Partial<Fiche>) => {
    setFiche((f) => ({ ...f, ...patch }));
    aEnvoyer.current = { ...(aEnvoyer.current ?? {}), ...patch };
    setEtat('attente');
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => void envoyer(), DELAI_MS);
  };

  const retour = async () => {
    await envoyer();
    onRetour();
  };

  // ── Créer une activité sur place ──
  const creerActivite = async (data: CreateDevoirData) => {
    setEnvoiCreation(true);
    try {
      const json = await createDevoir(data);
      const id = json?.data?.id;
      if (id && creationA !== null) {
        const liste = [...fiche.etapes];
        const precedente = liste[creationA - 1];
        liste.splice(
          creationA,
          0,
          nouvelleEtape({
            nature: 'activite',
            devoirId: id,
            titre: data.intitule,
            atelier: data.atelier,
            typeTravail: data.typeTravail,
            section: precedente?.section ?? '',
          })
        );
        poser({ etapes: liste });
      }
      setCreationA(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setEnvoiCreation(false);
    }
  };

  const ouvrirActivite = (devoirId: string) => {
    const d = devoirs.find((x) => x.id === devoirId);
    if (d) setActiviteOuverte(d);
    else setMessage('Cette activité est introuvable dans Mes Activités (supprimée, ou d’un collègue).');
  };

  if (creationA !== null) {
    return (
      <CreationForm
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isVisible
        onSubmit={creerActivite}
        isSubmitting={envoiCreation}
        onClose={() => setCreationA(null)}
        getAuthHeaders={getAuthHeaders}
      />
    );
  }

  const libelleEtat: Record<Etat, string> = {
    enregistre: '✓ Enregistré',
    attente: 'Modifications…',
    envoi: 'Enregistrement…',
    erreur: '⚠ Non enregistré',
  };

  // Les titres des renvois suivent l'activité (si elle est dans la liste)
  const etapesAffichees: PortfolioEtape[] = fiche.etapes.map((e) => {
    if (e.nature !== 'activite' || !e.devoirId) return e;
    const d = devoirs.find((x) => x.id === e.devoirId);
    return d ? { ...e, titre: d.intitule, atelier: d.atelier, typeTravail: d.typeTravail } : e;
  });

  return (
    <section className={ed.editeur}>
      <div className={ed.barre}>
        <button type="button" className={ed.retour} onClick={retour}>
          ← Portfolios
        </button>
        <span className={ed.barreTitre}>{fiche.titre}</span>
        <span className={`${styles.etat} ${etat === 'erreur' ? styles.etatErreur : ''}`} role="status">
          {libelleEtat[etat]}
        </span>
      </div>
      {message && (
        <p className={ed.erreur} onClick={() => setMessage(null)}>
          {message}
        </p>
      )}

      <div className={styles.fiche}>
        <input
          className={styles.ficheTitre}
          value={fiche.titre}
          onChange={(e) => poser({ titre: e.target.value })}
          placeholder="Titre du portfolio"
          aria-label="Titre du portfolio"
        />
        <label className={styles.lab} htmlFor="pfo-tache">Tâche finale</label>
        <textarea
          id="pfo-tache"
          className={`${styles.input} ${styles.textarea}`}
          value={fiche.tacheFinale}
          onChange={(e) => poser({ tacheFinale: e.target.value })}
          placeholder="Ce vers quoi toutes les étapes mènent (« Mettre en scène un extrait de Molière… »)"
          rows={2}
        />
        <label className={styles.lab} htmlFor="pfo-desc">Description <span className={styles.labNote}>— pour vous, sur la carte</span></label>
        <input
          id="pfo-desc"
          className={styles.input}
          value={fiche.description}
          onChange={(e) => poser({ description: e.target.value })}
          placeholder="Certification de Noël, 4ᵉ…"
        />
        <label className={styles.lab}>
          Consignes générales <span className={styles.labNote}>— en tête du sommaire de l’élève, une ligne par consigne</span>
        </label>
        <ConsignesEditor value={fiche.consignes} onChange={(v) => poser({ consignes: v })} />
        <label className={styles.lab}>
          Ressources du portfolio <span className={styles.labNote}>— anthologie, base documentaire… reprises par l’activité</span>
        </label>
        {ressourcesOuvertes ? (
          <RessourcesInput ressources={fiche.ressources} onRessourcesChange={(r) => poser({ ressources: r })} />
        ) : (
          <button type="button" className={styles.ajout} onClick={() => setRessourcesOuvertes(true)}>
            + Ajouter des ressources
          </button>
        )}
      </div>

      <PortfolioBuilder
        etapes={etapesAffichees}
        onChange={(etapes) => poser({ etapes })}
        onCreerActivite={setCreationA}
        onOuvrirActivite={ouvrirActivite}
      />

      <EditDevoirModal
        devoir={activiteOuverte}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isOpen={activiteOuverte !== null}
        onClose={() => setActiviteOuverte(null)}
        onSave={enregistrerDevoir}
        isSaving={false}
        getAuthHeaders={getAuthHeaders}
      />
    </section>
  );
}
