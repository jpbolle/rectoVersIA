'use client';

// Pilote une activité « lecture d'une œuvre » côté élève : le sommaire, la
// scène courante, la navigation et la progression.
//
// Le sommaire seul est chargé au démarrage (des titres, quelques kilo-octets) ;
// le contenu d'une scène arrive quand on l'ouvre (OeuvreReader s'en charge).
//
// La progression tient dans `travail.content`, comme les réponses d'un
// questionnaire — on ne crée pas de collection pour ça. Deux choses seulement
// y sont suivies, puisque rien n'est noté : les JOURS de lecture (fréquence) et
// les VÉRIFICATIONS complétées.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  emptyProgression,
  parseOeuvreProgression,
  sectionsAPlat,
  type Oeuvre,
  type OeuvreProgression,
} from '@/types/oeuvre';
import type { Devoir } from '@/types/devoir';

interface Options {
  devoir: Devoir | null;
  /** Contenu du travail — la progression y est sérialisée */
  content: string | null | undefined;
  /** Sauvegarde (debounce assuré par useTravail) ; absent = lecture seule */
  onProgression?: (json: string) => void;
}

export function useOeuvreLecture({ devoir, content, onProgression }: Options) {
  const [oeuvre, setOeuvre] = useState<Oeuvre | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);

  // getAuthHeaders et devoir sont des objets INSTABLES : les mettre en
  // dépendances déclencherait une boucle de requêtes (gotcha du projet).
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const oeuvreId = devoir?.oeuvreId || null;
  // Sérialisé pour servir de dépendance stable : un tableau change d'identité
  // à chaque rendu, sa version texte non.
  const chapitresDemandes = (devoir?.oeuvreChapitres || []).join(',');

  // ── Sommaire ──
  useEffect(() => {
    if (!oeuvreId) {
      setOeuvre(null);
      return;
    }
    let annule = false;
    setChargement(true);
    setErreur(null);

    (async () => {
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/oeuvres/${oeuvreId}`, { headers: headers || undefined });
        const json = await res.json();
        if (annule) return;
        if (!json.success) throw new Error(json.message || 'Œuvre introuvable');

        // Le prof peut n'avoir donné qu'une partie des chapitres
        const demandes = chapitresDemandes ? chapitresDemandes.split(',') : [];
        const data: Oeuvre = json.data;
        setOeuvre(
          demandes.length
            ? { ...data, chapitres: data.chapitres.filter((c) => demandes.includes(c.id)) }
            : data
        );
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!annule) setChargement(false);
      }
    })();

    return () => {
      annule = true;
    };
  }, [oeuvreId, chapitresDemandes]);

  const progression = useMemo(
    () => parseOeuvreProgression(content) ?? emptyProgression(),
    [content]
  );

  const parcours = useMemo(() => (oeuvre ? sectionsAPlat(oeuvre) : []), [oeuvre]);

  // Première ouverture : on reprend là où l'élève s'est arrêté — la dernière
  // section vue, à défaut la première du parcours.
  useEffect(() => {
    if (sectionId || !parcours.length) return;
    const derniere = [...parcours]
      .reverse()
      .find(({ section }) => progression.sections[section.id]?.vueLe);
    setSectionId(derniere?.section.id ?? parcours[0].section.id);
  }, [parcours, progression, sectionId]);

  const index = parcours.findIndex(({ section }) => section.id === sectionId);
  const courante = index >= 0 ? parcours[index] : null;

  // La progression écrite doit toujours partir de la DERNIÈRE version connue :
  // deux gestes rapprochés (ouvrir une scène puis répondre) se sauvegardent
  // avec un debounce, et repartir d'une copie périmée en perdrait un.
  const progressionRef = useRef(progression);
  progressionRef.current = progression;

  const ecrire = useCallback(
    (transformer: (p: OeuvreProgression) => OeuvreProgression) => {
      if (!onProgression) return;
      onProgression(JSON.stringify(transformer(progressionRef.current)));
    },
    [onProgression]
  );

  const marquerVue = useCallback(
    (id: string) => {
      const p = progressionRef.current;
      const jour = new Date().toISOString().slice(0, 10);
      const dejaVue = !!p.sections[id]?.vueLe;
      const jourConnu = p.jours.includes(jour);
      // Rien de neuf : ne pas réécrire pour écrire la même chose
      if (dejaVue && jourConnu) return;

      ecrire((prev) => ({
        ...prev,
        jours: jourConnu ? prev.jours : [...prev.jours, jour],
        sections: {
          ...prev.sections,
          [id]: { ...prev.sections[id], vueLe: prev.sections[id]?.vueLe || new Date().toISOString() },
        },
      }));
    },
    [ecrire]
  );

  const marquerTerminee = useCallback(
    (id: string, reponses: Record<string, unknown>) => {
      ecrire((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          [id]: {
            ...prev.sections[id],
            vueLe: prev.sections[id]?.vueLe || new Date().toISOString(),
            reponses,
            termineLe: prev.sections[id]?.termineLe || new Date().toISOString(),
          },
        },
      }));
    },
    [ecrire]
  );

  return {
    oeuvre,
    chargement,
    erreur,
    progression,
    sectionId,
    sectionCourante: courante?.section ?? null,
    allerA: setSectionId,
    peutReculer: index > 0,
    peutAvancer: index >= 0 && index < parcours.length - 1,
    reculer: () => index > 0 && setSectionId(parcours[index - 1].section.id),
    avancer: () =>
      index >= 0 && index < parcours.length - 1 && setSectionId(parcours[index + 1].section.id),
    marquerVue,
    marquerTerminee,
    nbSections: parcours.length,
  };
}
