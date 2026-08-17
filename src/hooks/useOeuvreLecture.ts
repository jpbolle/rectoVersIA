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
  COUVERTURE_ID,
  emptyProgression,
  estCouverture,
  parseOeuvreProgression,
  sectionsAPlat,
  type Oeuvre,
  type OeuvreChapitre,
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

  /**
   * Le parcours de lecture — LA COUVERTURE EN TÊTE.
   *
   * Elle est traitée comme une page du livre (voir COUVERTURE_ID) : les
   * flèches précédent/suivant, le sommaire et la reprise de lecture n'ont
   * ainsi qu'un seul cas à connaître. Elle n'existe que si le prof a déposé
   * une image — un livre sans couverture s'ouvre sur sa première scène.
   */
  const parcours = useMemo(() => {
    if (!oeuvre) return [];
    const sections = sectionsAPlat(oeuvre);
    if (!oeuvre.couverture) return sections;
    const chapitreFictif: OeuvreChapitre = { id: COUVERTURE_ID, titre: '', sections: [] };
    return [
      {
        chapitre: chapitreFictif,
        section: { id: COUVERTURE_ID, titre: 'Couverture', aQuestions: false },
      },
      ...sections,
    ];
  }, [oeuvre]);

  // Première ouverture : on reprend là où l'élève s'est arrêté — la dernière
  // section vue, à défaut la première page, qui est la couverture quand il y
  // en a une. Un élève qui revient ne repasse donc pas par elle.
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

  /**
   * L'élève a FAIT quelque chose sur cette scène — pas seulement l'ouvrir.
   * Appelé au passage sur le verso, au clic dictionnaire, à l'ouverture d'un
   * commentaire du professeur.
   *
   * Écrit UNE SEULE FOIS par scène : c'est un premier signal, pas un compteur
   * de clics. Sans ce garde-fou, chaque mot cliqué déclencherait une écriture
   * dans `travail.content` — et l'élève en clique beaucoup.
   */
  const marquerActivite = useCallback(
    (id: string) => {
      const p = progressionRef.current;
      if (p.sections[id]?.agiLe) return;
      ecrire((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          [id]: {
            ...prev.sections[id],
            vueLe: prev.sections[id]?.vueLe || new Date().toISOString(),
            agiLe: new Date().toISOString(),
          },
        },
      }));
    },
    [ecrire]
  );

  /**
   * L'élève a ouvert un commentaire du professeur.
   *
   * On garde son id — savoir CE QU'IL est allé chercher renseigne plus que le
   * fait qu'il ait tourné la page (demande de JP). Un id déjà connu ne
   * réécrit rien : sans cette garde, chaque réouverture déclencherait une
   * sauvegarde, comme le piège déjà rencontré avec `agiLe`.
   */
  const marquerCommentaireOuvert = useCallback(
    (id: string, commentaireId: string) => {
      const dejaVus = progressionRef.current.sections[id]?.commentairesOuverts ?? [];
      if (dejaVus.includes(commentaireId)) return;
      ecrire((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          [id]: {
            ...prev.sections[id],
            commentairesOuverts: [
              ...(prev.sections[id]?.commentairesOuverts ?? []),
              commentaireId,
            ],
          },
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
    marquerActivite,
    marquerCommentaireOuvert,
    marquerTerminee,
    // La couverture n'est pas une scène : elle ne compte pas dans le parcours
    nbSections: parcours.filter(({ section }) => !estCouverture(section.id)).length,
  };
}
