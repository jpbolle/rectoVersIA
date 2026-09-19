'use client';

// L'ATELIER d'une séquence FLE — Mes Ressources › Modules FLE › Séquences de
// cours, au clic sur la carte (plan 2026-09-19-fle-sequences-de-cours).
//
// Le serpentin en grand, enregistré AUTOMATIQUEMENT (différé de 800 ms, envoi
// forcé au départ), avec au-dessus le menu « Élèves concernés » — il fournit
// aussi les élèves aux restrictions par étape.
//
// Un clic sur le titre d'un encadré ouvre la ressource SUR PLACE (décision
// JP, 2026-09-19) : un point de théorie dans son éditeur pleine page, une
// activité dans sa popup ✏️. Au retour, les titres affichés sont ceux de la
// ressource, pas ceux recopiés dans l'étape au moment de l'ajout : ils se
// SUPERPOSENT à l'affichage (aucun état à resynchroniser dans un effet), et
// l'étape les enregistre à la prochaine modification du parcours.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ElevesChoix from '@/components/ElevesChoix/ElevesChoix';
import type { EleveAvecClasse } from '@/components/ElevesChoix/ElevesChoix';
import SequenceFleBuilder from '@/components/SequenceFleBuilder/SequenceFleBuilder';
import ModuleFleEditor from '@/components/ModuleFleEditor/ModuleFleEditor';
import EditDevoirModal from '@/components/EditDevoirModal/EditDevoirModal';
import type { Devoir } from '@/types/devoir';
import type { ModuleFle } from '@/types/module-fle';
import { SEQUENCE_FLE_VIDE } from '@/types/sequence-fle';
import type { SequenceFleContenu, SequenceFleEtape } from '@/types/sequence-fle';
import ed from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import styles from './SequencesFlePanel.module.css';

type Etat = 'enregistre' | 'attente' | 'envoi' | 'erreur';

const DELAI_MS = 800;

interface Props {
  sequence: Devoir;
  // Toutes les activités du prof : de quoi ouvrir une étape « activité » et
  // afficher son titre à jour
  devoirs: Devoir[];
  classeNames: string[];
  grilleTypes: string[];
  grilles: { name: string; ateliers: string[] }[];
  enregistrerDevoir: (id: string, data: Partial<Devoir>, silencieux?: boolean) => Promise<boolean>;
  onRetour: () => void;
  // Relire la séquence en base (après la popup ✏️ de ses réglages, qui a pu
  // toucher au parcours ou aux élèves) : le parent remonte l'atelier
  onRecharger: () => void;
}

export default function SequenceAtelier({
  sequence,
  devoirs,
  classeNames,
  grilleTypes,
  grilles,
  enregistrerDevoir,
  onRetour,
  onRecharger,
}: Props) {
  const { getAuthHeaders, user } = useAuth();

  const [contenu, setContenu] = useState<SequenceFleContenu>(sequence.sequenceFle ?? SEQUENCE_FLE_VIDE);
  const [eleves, setEleves] = useState<string[] | null>(sequence.eleves ?? null);
  const [elevesDesClasses, setElevesDesClasses] = useState<EleveAvecClasse[]>([]);
  const [etat, setEtat] = useState<Etat>('enregistre');
  const [message, setMessage] = useState<string | null>(null);

  // Ce qui est ouvert par-dessus le serpentin
  const [moduleOuvert, setModuleOuvert] = useState<ModuleFle | null>(null);
  const [activiteOuverte, setActiviteOuverte] = useState<Devoir | null>(null);
  const [reglages, setReglages] = useState(false);
  // Points de théorie relus au retour de leur éditeur : titre et type à jour
  const [modulesFrais, setModulesFrais] = useState<Map<string, ModuleFle>>(new Map());

  // ── Enregistrement automatique ──
  const aEnvoyer = useRef<{ sequenceFle: SequenceFleContenu; eleves: string[] | null } | null>(null);
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
      const res = await fetch(`/api/devoirs/${sequence.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(charge),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
      // Une modification arrivée pendant l'envoi est déjà programmée
      setEtat(aEnvoyer.current ? 'attente' : 'enregistre');
      return true;
    } catch (e) {
      // On la garde pour le prochain essai, plutôt que de la perdre
      aEnvoyer.current ??= charge;
      setEtat('erreur');
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible');
      return false;
    }
  }, [getAuthHeaders, sequence.id]);

  // Envoi forcé si l'atelier disparaît avec une modification en attente
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

  const programmer = (sequenceFle: SequenceFleContenu, elevesChoisis: string[] | null) => {
    aEnvoyer.current = { sequenceFle, eleves: elevesChoisis };
    setEtat('attente');
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => void envoyer(), DELAI_MS);
  };

  const changerContenu = (c: SequenceFleContenu) => {
    setContenu(c);
    programmer(c, eleves);
  };

  const changerEleves = (e: string[] | null) => {
    setEleves(e);
    programmer(contenu, e);
  };

  // ── Titres à jour, superposés à l'affichage ──
  const devoirParId = useMemo(() => new Map(devoirs.map((d) => [d.id, d])), [devoirs]);
  const contenuAffiche = useMemo<SequenceFleContenu>(
    () => ({
      ...contenu,
      etapes: contenu.etapes.map((e) => {
        if (e.nature === 'activite') {
          const d = e.devoirId ? devoirParId.get(e.devoirId) : undefined;
          return d ? { ...e, titre: d.intitule } : e;
        }
        const m = e.moduleId ? modulesFrais.get(e.moduleId) : undefined;
        return m ? { ...e, titre: m.titre, type: m.type } : e;
      }),
    }),
    [contenu, devoirParId, modulesFrais]
  );

  const elevesDeLaSequence =
    eleves === null ? elevesDesClasses : elevesDesClasses.filter((e) => eleves.includes(e.id));

  // ── Ouvrir une étape ──
  const ouvrirEtape = async (e: SequenceFleEtape) => {
    setMessage(null);
    if (e.nature === 'activite') {
      const d = e.devoirId ? devoirParId.get(e.devoirId) : undefined;
      if (d) setActiviteOuverte(d);
      else setMessage('Cette activité est introuvable dans Mes Activités (supprimée, ou d’un collègue).');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/modules-fle/${e.moduleId}`, { headers });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Point de théorie introuvable');
      setModuleOuvert(json.data as ModuleFle);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Point de théorie introuvable');
    }
  };

  const fermerModule = async () => {
    const m = moduleOuvert;
    setModuleOuvert(null);
    if (!m) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/modules-fle/${m.id}`, { headers });
      const json = await res.json();
      if (json.success) {
        const frais = json.data as ModuleFle;
        setModulesFrais((prev) => new Map(prev).set(frais.id, frais));
      }
    } catch {
      // L'encadré garde le titre qu'il avait
    }
  };

  const retour = async () => {
    await envoyer();
    onRetour();
  };

  const ouvrirReglages = async () => {
    // Le parcours en attente part d'abord : la popup lit la séquence en base
    if (await envoyer()) setReglages(true);
  };

  // Un point de théorie ouvert prend toute la place — l'atelier reste monté
  // dessous, avec son état
  if (moduleOuvert) {
    return (
      <ModuleFleEditor
        module={moduleOuvert}
        lectureSeule={moduleOuvert.profId !== user?.uid}
        onFermer={fermerModule}
        onModifie={() => undefined}
        libelleRetour="← Retour à la séquence"
      />
    );
  }

  const libelleEtat: Record<Etat, string> = {
    enregistre: '✓ Enregistré',
    attente: 'Modifications…',
    envoi: 'Enregistrement…',
    erreur: '⚠ Non enregistré',
  };

  return (
    <section className={ed.editeur}>
      <div className={ed.barre}>
        <button type="button" className={ed.retour} onClick={retour}>
          ← Séquences de cours
        </button>
        <span className={ed.barreTitre}>{sequence.intitule}</span>
        <span className={`${styles.etat} ${etat === 'erreur' ? styles.etatErreur : ''}`} role="status">
          {libelleEtat[etat]}
        </span>
        <button type="button" className={styles.reglages} onClick={ouvrirReglages} title="Classes, échéance, consignes…">
          ✏️ Réglages
        </button>
      </div>
      {message && <p className={ed.erreur}>{message}</p>}

      <div className={styles.entete}>
        <p className={styles.classes}>
          <span aria-hidden="true">🎓</span>{' '}
          {sequence.classes.length ? sequence.classes.join(', ') : 'Aucune classe — à choisir dans ✏️ Réglages'}
        </p>
        {sequence.classes.length > 0 && (
          <div className={styles.eleves}>
            <ElevesChoix
              classesNoms={sequence.classes}
              value={eleves}
              onChange={changerEleves}
              onEleves={setElevesDesClasses}
            />
          </div>
        )}
      </div>

      <SequenceFleBuilder
        value={contenuAffiche}
        onChange={changerContenu}
        elevesDeLaSequence={elevesDeLaSequence}
        plusieursClasses={sequence.classes.length > 1}
        onOuvrirEtape={ouvrirEtape}
      />

      {/* Une activité du parcours : sa popup ✏️ habituelle */}
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

      {/* Les réglages de la séquence elle-même */}
      <EditDevoirModal
        devoir={reglages ? sequence : null}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isOpen={reglages}
        onClose={() => {
          setReglages(false);
          onRecharger();
        }}
        onSave={enregistrerDevoir}
        isSaving={false}
        getAuthHeaders={getAuthHeaders}
      />
    </section>
  );
}
