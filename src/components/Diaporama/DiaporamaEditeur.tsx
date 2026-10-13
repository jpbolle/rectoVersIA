'use client';

// L'ÉDITEUR du diaporama (plan 2026-10-13) — onglet « Diaporama » de « La
// théorie » d'un point de théorie FLE. Transposé de `SlideEditor` (app
// VibeCoding) : le diaporama en haut, l'éditeur de la dia AFFICHÉE en dessous.
//
// Dia HTML : même règle que l'onglet Interactif — l'adresse d'une page est
// ouverte à tous les profs (liste blanche), le code est réservé à
// l'administrateur. Le serveur refait ce contrôle (`sanitizeRessources`).
//
// Rien n'est enregistré ici : chaque geste remonte le diaporama entier à
// `RessourcesInput`, et c'est le bouton « Enregistrer » de l'éditeur du point
// de théorie qui écrit.

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/image-compress';
import { integrationAutorisee, TAILLE_MAX_CODE, urlDepuisIntegration } from '@/lib/integration';
import {
  LIBELLE_BLOC,
  TAILLE_MAX_DIAPORAMA,
  adresseWeb,
  idDia,
  tailleDiaporama,
  texteBrut,
  type Dia,
  type DiaBloc,
  type DiaBlocImage,
  type RessourceDiaporama,
} from '@/types/diaporama';
import type { ModuleFle } from '@/types/module-fle';
import { DiaCadre, DiaporamaVue } from './DiaporamaVue';
import { MarkdownAide, MarkdownEditeur } from './Markdown';
import Molette from './Molette';
import styles from './DiaporamaEditeur.module.css';

export default function DiaporamaEditeur({
  diaporama,
  onChange,
  disabled = false,
}: {
  diaporama: RessourceDiaporama | null;
  onChange: (d: RessourceDiaporama | null) => void;
  disabled?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const dias = diaporama?.dias ?? [];
  const nb = dias.length;
  const courant = Math.min(index, Math.max(nb - 1, 0));
  const dia = dias[courant];
  const poids = tailleDiaporama(diaporama);

  const poserDias = (suivantes: Dia[]) =>
    onChange(suivantes.length ? { titre: diaporama?.titre ?? '', dias: suivantes } : null);
  const majDia = (d: Dia) => poserDias(dias.map((x) => (x.id === d.id ? d : x)));
  const inserer = (d: Dia) => {
    const suivantes = [...dias];
    suivantes.splice(nb ? courant + 1 : 0, 0, d);
    poserDias(suivantes);
    setIndex(nb ? courant + 1 : 0);
  };

  // Pas encore de dia : une seule action, créer la première
  if (nb === 0) {
    return (
      <div className={styles.videBloc}>
        <p className={styles.videTexte}>
          Un diaporama explique le point de théorie <b>une idée par écran</b> : texte, images, liens, formes à
          retenir. L’élève le parcourt à son rythme ; vous pouvez le projeter en plein écran.
        </p>
        {!disabled && (
          <div className={styles.videActions}>
            <button
              type="button"
              className={styles.boutonPrincipal}
              onClick={() => onChange({ titre: '', dias: [{ id: idDia(), titre: 'Nouvelle dia', blocs: [] }] })}
            >
              + Créer la première dia
            </button>
            <ReprendreDia onInserer={(d) => onChange({ titre: '', dias: [d] })} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.editeur}>
      <label className={styles.champ}>
        <span className={styles.champLabel}>Titre du diaporama (nomme le volet chez l’élève)</span>
        <input
          value={diaporama?.titre ?? ''}
          onChange={(e) => onChange({ titre: e.target.value, dias })}
          placeholder="Diaporama"
          disabled={disabled}
          className={styles.input}
        />
      </label>

      <DiaporamaVue dias={dias} index={courant} onIndex={setIndex} />

      {poids > TAILLE_MAX_DIAPORAMA && (
        <p className={styles.alerte}>
          Diaporama trop lourd ({Math.round(poids / 1000)} Ko sur {TAILLE_MAX_DIAPORAMA / 1000} permis) : il ne sera
          pas enregistré. Allégez le code des dias HTML.
        </p>
      )}

      {!disabled && dia && (
        <EditeurDia
          key={dia.id}
          dia={dia}
          position={courant}
          nb={nb}
          onChange={majDia}
          onAjouter={(html) =>
            inserer(
              html
                ? { id: idDia(), titre: 'Page HTML', blocs: [], html: {} }
                : { id: idDia(), titre: 'Nouvelle dia', blocs: [] }
            )
          }
          onSupprimer={() => {
            poserDias(dias.filter((x) => x.id !== dia.id));
            setIndex(Math.max(0, courant - 1));
          }}
          onDeplacer={(delta) => {
            const vers = courant + delta;
            if (vers < 0 || vers >= nb) return;
            const suivantes = [...dias];
            [suivantes[courant], suivantes[vers]] = [suivantes[vers], suivantes[courant]];
            poserDias(suivantes);
            setIndex(vers);
          }}
        />
      )}
      {!disabled && (
        <div className={styles.reprendreLigne}>
          <ReprendreDia onInserer={inserer} />
        </div>
      )}
    </div>
  );
}

// ————— L'éditeur de la dia affichée —————

function EditeurDia({
  dia,
  position,
  nb,
  onChange,
  onAjouter,
  onSupprimer,
  onDeplacer,
}: {
  dia: Dia;
  position: number;
  nb: number;
  onChange: (d: Dia) => void;
  onAjouter: (html?: boolean) => void;
  onSupprimer: () => void;
  onDeplacer: (delta: number) => void;
}) {
  // Suppression en deux temps, sans popup (consigne : pas de `confirm()`)
  const [aConfirmer, setAConfirmer] = useState(false);

  const poserBlocs = (blocs: DiaBloc[]) => onChange({ ...dia, blocs });
  const majBloc = (b: DiaBloc) => poserBlocs(dia.blocs.map((x) => (x.id === b.id ? b : x)));
  const ajouterBloc = (kind: DiaBloc['kind']) => {
    const id = idDia();
    const bloc: DiaBloc =
      kind === 'texte'
        ? { id, kind, texte: '' }
        : kind === 'encadre'
          ? { id, kind, label: '', valeur: '' }
          : kind === 'lien'
            ? { id, kind, label: '', url: '' }
            : { id, kind, src: '', alt: '' };
    poserBlocs([...dia.blocs, bloc]);
  };

  // Ordre des blocs : glisser-déposer par la poignée (souris, doigt ou clavier)
  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const auDepot = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const de = dia.blocs.findIndex((b) => b.id === active.id);
    const vers = dia.blocs.findIndex((b) => b.id === over.id);
    poserBlocs(arrayMove(dia.blocs, de, vers));
  };

  return (
    <div className={styles.panneau}>
      <div className={styles.panneauEntete}>
        <p className={styles.panneauTitre}>Modifier la dia {position + 1}</p>
        <PetitBouton onClick={() => onDeplacer(-1)} disabled={position === 0}>
          ← Déplacer
        </PetitBouton>
        <PetitBouton onClick={() => onDeplacer(1)} disabled={position >= nb - 1}>
          Déplacer →
        </PetitBouton>
        <PetitBouton onClick={() => onAjouter()}>+ Nouvelle dia</PetitBouton>
        <PetitBouton onClick={() => onAjouter(true)}>+ Dia HTML</PetitBouton>
        {aConfirmer ? (
          <>
            <PetitBouton onClick={onSupprimer} danger>
              Oui, supprimer
            </PetitBouton>
            <PetitBouton onClick={() => setAConfirmer(false)}>Annuler</PetitBouton>
          </>
        ) : (
          <PetitBouton onClick={() => setAConfirmer(true)} danger>
            Supprimer la dia
          </PetitBouton>
        )}
      </div>

      <div className={styles.pile}>
        <input
          value={dia.titre}
          onChange={(e) => onChange({ ...dia, titre: e.target.value })}
          aria-label="Titre de la dia"
          placeholder={dia.html ? 'Titre (non affiché : il sert à la navigation)' : 'Titre de la dia'}
          className={`${styles.input} ${styles.inputTitre}`}
        />
        {dia.html ? (
          <ChampHtml dia={dia} onChange={onChange} />
        ) : (
          <>
            <DndContext id="dia-blocs" sensors={capteurs} collisionDetection={closestCenter} onDragEnd={auDepot}>
              <SortableContext items={dia.blocs.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.pile}>
                  {dia.blocs.map((b) => (
                    <LigneBloc
                      key={b.id}
                      bloc={b}
                      onChange={majBloc}
                      onRetirer={() => poserBlocs(dia.blocs.filter((x) => x.id !== b.id))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className={styles.ajouts}>
              <PetitBouton onClick={() => ajouterBloc('texte')}>+ Texte</PetitBouton>
              <PetitBouton onClick={() => ajouterBloc('image')}>+ Image</PetitBouton>
              <PetitBouton onClick={() => ajouterBloc('lien')}>+ Lien</PetitBouton>
              <PetitBouton onClick={() => ajouterBloc('encadre')}>+ Encadré</PetitBouton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Un bloc : poignée de déplacement, type, champs, bouton Retirer
function LigneBloc({
  bloc: b,
  onChange,
  onRetirer,
}: {
  bloc: DiaBloc;
  onChange: (b: DiaBloc) => void;
  onRetirer: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.bloc} ${isDragging ? styles.blocGlisse : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Déplacer le bloc ${LIBELLE_BLOC[b.kind]}`}
        title="Glisser pour changer l’ordre"
        className={styles.poignee}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden>
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      <span className={styles.blocType}>{LIBELLE_BLOC[b.kind]}</span>
      <div className={styles.blocChamps}>
        {b.kind === 'encadre' && (
          // Une seule ligne : étiquette, forme à retenir, puis la largeur en
          // bouton à tourner (JP, 2026-10-13 — « J' … ai » se lit mieux resserré)
          <div className={styles.ligneEncadre}>
            <input
              value={b.label}
              onChange={(e) => onChange({ ...b, label: e.target.value })}
              placeholder="Étiquette (ex. avoir, 1re personne)"
              className={styles.input}
            />
            <input
              value={b.valeur}
              onChange={(e) => onChange({ ...b, valeur: e.target.value })}
              placeholder="À retenir (ex. j’ai)"
              className={`${styles.input} ${styles.inputFort}`}
            />
            <Molette
              valeur={b.largeur ?? 100}
              min={20}
              max={100}
              pas={5}
              defaut={100}
              unite={'\u202F%'}
              label="Largeur de l’encadré"
              onChange={(largeur) => onChange({ ...b, largeur })}
            />
          </div>
        )}
        {b.kind === 'texte' && (
          <>
            <MarkdownEditeur
              valeur={b.texte}
              lignes={Math.min(10, Math.max(3, b.texte.split('\n').length + 1))}
              onChange={(texte) => onChange({ ...b, texte })}
            />
            <MarkdownAide />
          </>
        )}
        {b.kind === 'lien' && (
          <div className={styles.deuxColonnesLien}>
            <input
              value={b.label}
              onChange={(e) => onChange({ ...b, label: e.target.value })}
              placeholder="Texte du lien (ex. Exercices en ligne)"
              className={styles.input}
            />
            <input
              type="url"
              value={b.url}
              onChange={(e) => onChange({ ...b, url: e.target.value })}
              placeholder="https://…"
              className={`${styles.input} ${b.url && !adresseWeb(b.url) ? styles.inputErreur : ''}`}
            />
          </div>
        )}
        {b.kind === 'image' && <ChampImage bloc={b} onChange={onChange} />}
      </div>
      <button type="button" onClick={onRetirer} aria-label="Retirer ce bloc" className={styles.retirer}>
        ✕
      </button>
    </div>
  );
}

// Image : déposée comme celles de l'onglet Image (compressée, adresse rendue
// par /api/ressources/upload) ; taille ; au clic → lien, texte ou agrandissement
function ChampImage({ bloc, onChange }: { bloc: DiaBlocImage; onChange: (b: DiaBloc) => void }) {
  const { getAuthHeaders } = useAuth();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const comportement = bloc.lien !== undefined ? 'lien' : bloc.fenetre ? 'fenetre' : bloc.agrandir ? 'agrandir' : 'rien';

  const changerComportement = (c: string) => {
    const base: DiaBlocImage = {
      id: bloc.id,
      kind: 'image',
      src: bloc.src,
      alt: bloc.alt,
      ...(bloc.taille ? { taille: bloc.taille } : {}),
    };
    onChange(
      c === 'lien'
        ? { ...base, lien: '' }
        : c === 'fenetre'
          ? { ...base, fenetre: { titre: '', corps: '' } }
          : c === 'agrandir'
            ? { ...base, agrandir: true }
            : base
    );
  };

  const auFichier = async (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    if (!fichier.type.startsWith('image/')) {
      setErreur('Images uniquement.');
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      const compresse = await compressImage(fichier);
      if (!compresse) throw new Error('Impossible de réduire l’image sous 700 Ko.');
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée.');
      const formData = new FormData();
      formData.append('files', compresse.blob, compresse.name);
      // Ne garder que l'Authorization : le navigateur fixe lui-même le
      // Content-Type multipart (avec sa boundary)
      const res = await fetch('/api/ressources/upload', {
        method: 'POST',
        headers: { Authorization: headers.Authorization },
        body: formData,
      });
      const json = await res.json();
      const url = json?.data?.files?.[0]?.url as string | undefined;
      if (!json.success || !url) throw new Error(json.message || 'Envoi impossible.');
      onChange({ ...bloc, src: url, alt: bloc.alt || fichier.name.replace(/\.[^.]+$/, '') });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className={styles.image}>
      <span className={styles.imageApercu}>
        {bloc.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu
          <img src={bloc.src} alt="" />
        ) : (
          <span>Aucune</span>
        )}
      </span>
      <div className={styles.imageChamps}>
        <label className={styles.boutonFichier}>
          {envoi ? 'Envoi…' : bloc.src ? 'Remplacer l’image' : 'Choisir une image'}
          <input type="file" accept="image/*" onChange={auFichier} className={styles.srOnly} disabled={envoi} />
        </label>
        <input
          value={bloc.alt}
          onChange={(e) => onChange({ ...bloc, alt: e.target.value })}
          placeholder="Description de l’image (lecteurs d’écran)"
          className={styles.input}
        />
        {erreur && <p className={styles.erreur}>{erreur}</p>}
        <label className={styles.reglage}>
          Taille
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={bloc.taille ?? 100}
            onChange={(e) => onChange({ ...bloc, taille: Number(e.target.value) })}
            className={styles.curseur}
            aria-label="Taille de l’image dans la dia, en pourcentage"
          />
          <span className={styles.valeur}>{bloc.taille ?? 100}&#8239;%</span>
        </label>
        <label className={styles.reglage}>
          Au clic sur l’image :
          <select value={comportement} onChange={(e) => changerComportement(e.target.value)} className={styles.select}>
            <option value="rien">rien</option>
            <option value="lien">ouvrir un lien</option>
            <option value="fenetre">afficher un texte</option>
            <option value="agrandir">agrandir l’image</option>
          </select>
        </label>
        {comportement === 'lien' && (
          <input
            value={bloc.lien ?? ''}
            onChange={(e) => onChange({ ...bloc, lien: e.target.value })}
            placeholder="https://…"
            className={`${styles.input} ${bloc.lien && !adresseWeb(bloc.lien) ? styles.inputErreur : ''}`}
          />
        )}
        {comportement === 'fenetre' && bloc.fenetre && (
          <div className={styles.pile}>
            <input
              value={bloc.fenetre.titre}
              onChange={(e) => onChange({ ...bloc, fenetre: { ...bloc.fenetre!, titre: e.target.value } })}
              placeholder="Titre de la fenêtre"
              className={styles.input}
            />
            <MarkdownEditeur
              valeur={bloc.fenetre.corps}
              lignes={8}
              onChange={(corps) => onChange({ ...bloc, fenetre: { ...bloc.fenetre!, corps } })}
              placeholder="Texte de la fenêtre, en Markdown"
            />
            <MarkdownAide />
          </div>
        )}
      </div>
    </div>
  );
}

// Dia HTML : l'adresse d'une page (liste blanche, tous les profs) OU du code
// (administrateur seulement). Le code collé ou importé tourne isolé.
function ChampHtml({ dia, onChange }: { dia: Dia; onChange: (d: Dia) => void }) {
  const { isAdmin } = useAuth();
  const url = dia.html?.url ?? '';
  const code = dia.html?.code ?? '';
  const urlRefusee = !!url.trim() && !integrationAutorisee(url);
  const trop = code.length > TAILLE_MAX_CODE;
  const poser = (html: Dia['html']) => onChange({ ...dia, html });

  const auFichier = async (e: ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (fichier) poser({ ...dia.html, code: await fichier.text() });
  };

  return (
    <div className={styles.pile}>
      <input
        type="url"
        value={url}
        // Le bouton « Intégrer » de Genially donne un bloc <iframe> : on en garde l'adresse
        onChange={(e) => poser({ ...dia.html, url: urlDepuisIntegration(e.target.value) })}
        placeholder={
          isAdmin
            ? 'Adresse d’une page (Genially, LearningApps…), ou collez du code ci-dessous'
            : 'Adresse d’une page (Genially, LearningApps, Wordwall…) ou son code d’intégration'
        }
        aria-label="Adresse d’une page en ligne"
        className={`${styles.input} ${urlRefusee ? styles.inputErreur : ''}`}
      />
      {urlRefusee ? (
        <p className={styles.erreur}>
          Ce site n’est pas sur la liste des sites autorisés (Genially, LearningApps, Wordwall, Padlet, Google
          Docs…) : la dia ne sera pas enregistrée.
        </p>
      ) : (
        url && (
          <p className={styles.aide}>
            Cette page est affichée à la place du code. Certains sites refusent d’être affichés dans une autre
            page&#8239;: vérifiez la dia.
          </p>
        )
      )}
      {isAdmin && (
        <>
          <textarea
            value={code}
            onChange={(e) => poser({ ...dia.html, code: e.target.value })}
            spellCheck={false}
            placeholder="Code HTML complet (<!DOCTYPE html>…), CSS et JavaScript compris."
            aria-label="Code HTML"
            className={`${styles.code} ${url ? styles.codeInactif : ''}`}
          />
          <p className={trop ? styles.erreur : styles.aide}>
            {Math.round(code.length / 1000)} Ko sur {Math.round(TAILLE_MAX_CODE / 1000)} — le code tourne isolé :
            il n’a accès ni à la page, ni au compte de l’élève.
          </p>
        </>
      )}
      <div className={styles.ligneReglages}>
        {isAdmin && (
          <label className={styles.boutonFichier}>
            Importer un fichier .html
            <input type="file" accept=".html,.htm,text/html" onChange={auFichier} className={styles.srOnly} />
          </label>
        )}
        <label className={styles.reglage}>
          Taille
          <input
            type="range"
            min={25}
            max={200}
            step={5}
            value={dia.zoom ?? 100}
            onChange={(e) => onChange({ ...dia, zoom: Number(e.target.value) })}
            onDoubleClick={() => onChange({ ...dia, zoom: 100 })}
            title="Double-clic : revenir à 100 %"
            aria-label="Taille d’affichage du contenu, en pourcentage"
            className={styles.curseur}
          />
          <span className={styles.valeur}>{dia.zoom ?? 100}&#8239;%</span>
        </label>
        {isAdmin && (
          <label className={`${styles.reglage} ${url ? styles.reglageInactif : ''}`}>
            <input
              type="checkbox"
              checked={!!dia.centrer}
              disabled={!!url}
              onChange={(e) => onChange({ ...dia, centrer: e.target.checked })}
            />
            Centrer dans la dia
            {url && <span className={styles.aide}>(code seulement)</span>}
          </label>
        )}
      </div>
    </div>
  );
}

// ————— Reprendre une dia —————
//
// Copie INDÉPENDANTE d'une dia de mes autres points de théorie (décision JP,
// 2026-10-13 : les miens seulement). Choix dans une fenêtre de miniatures ;
// modifier la copie ne touche pas l'original.

function ReprendreDia({ onInserer }: { onInserer: (d: Dia) => void }) {
  const { getAuthHeaders } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [modules, setModules] = useState<ModuleFle[] | null>(null);

  useEffect(() => {
    if (!ouvert || modules) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/modules-fle', { headers: headers || undefined });
        const json = await res.json();
        if (!annule) setModules(Array.isArray(json.data) ? (json.data as ModuleFle[]) : []);
      } catch {
        if (!annule) setModules([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [ouvert, modules, getAuthHeaders]);

  useEffect(() => {
    if (!ouvert) return;
    const auClavier = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [ouvert]);

  const groupes = (modules ?? []).filter((m) => (m.ressources?.diaporama?.dias.length ?? 0) > 0);

  const choisir = (d: Dia) => {
    onInserer({
      ...structuredClone(d),
      id: idDia(),
      blocs: d.blocs.map((b) => ({ ...structuredClone(b), id: idDia() })),
    });
    setOuvert(false);
  };

  return (
    <>
      <PetitBouton onClick={() => setOuvert(true)}>+ Reprendre une dia de mes points de théorie…</PetitBouton>
      {ouvert && (
        <div className={styles.voile} onClick={() => setOuvert(false)}>
          <div
            className={styles.fenetre}
            role="dialog"
            aria-modal="true"
            aria-label="Reprendre une dia"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.fenetreEntete}>
              <h3 className={styles.fenetreTitre}>Reprendre une dia</h3>
              <span className={styles.aide}>Cliquez sur une miniature : une copie est insérée après la dia affichée.</span>
              <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer" className={styles.fermer}>
                ✕
              </button>
            </div>
            <div className={styles.fenetreCorps}>
              {modules === null ? (
                <p className={styles.aide}>Chargement…</p>
              ) : groupes.length === 0 ? (
                <p className={styles.aide}>Aucun de vos points de théorie n’a encore de diaporama.</p>
              ) : (
                groupes.map((m) => (
                  <section key={m.id} className={styles.groupe}>
                    <h4 className={styles.groupeTitre}>{m.titre}</h4>
                    <div className={styles.miniatures}>
                      {m.ressources!.diaporama!.dias.map((d, i) => (
                        <button key={d.id} type="button" onClick={() => choisir(d)} className={styles.miniature}>
                          <span inert className={styles.miniatureCadre}>
                            <DiaCadre dia={d} miniature />
                          </span>
                          <span className={styles.miniatureLegende}>
                            Dia {i + 1}
                            {d.html ? ' · HTML' : ''} — {texteBrut(d.titre) || 'sans titre'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PetitBouton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles.petitBouton} ${danger ? styles.petitBoutonDanger : ''}`}
    >
      {children}
    </button>
  );
}
