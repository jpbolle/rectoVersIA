// Accès serveur aux œuvres — normalisation à la lecture et à l'écriture.
//
// RÈGLE DE VISIBILITÉ PROPRE À CET ATELIER :
// dans la lecture d'une œuvre, le corrigé est OUVERT — l'élève voit la bonne
// réponse dès qu'il répond, « c'est vraiment un outil pour eux » (décision de
// JP du 2026-08-15). On ne filtre donc NI `correctIndex`, NI `reponseIdeale`,
// NI `fluoAttendu`.
//
// ⚠️ Cette exception ne vaut QUE pour les œuvres. Partout ailleurs, le
// dispositif `lire` continue de filtrer côté serveur (src/lib/lecture-server.ts)
// jusqu'à ce que la correction soit rendue disponible. Et elle se décide ICI,
// d'après le document lu — jamais d'après un paramètre envoyé par le
// navigateur, sinon la porte s'ouvrirait pour toutes les activités.

import { adminDb } from '@/lib/firebase/admin';
import type {
  Oeuvre,
  OeuvreBloc,
  OeuvreChapitre,
  OeuvrePartage,
  OeuvreSection,
  OeuvreSectionRef,
} from '@/types/oeuvre';
import type { LectureQuestion } from '@/types/lecture';
import { preparerPresentation } from '@/lib/lecture-server';

type Doc = FirebaseFirestore.DocumentSnapshot;

function toIso(v: unknown): string {
  if (typeof v === 'string') return v;
  const maybe = v as { toDate?: () => Date };
  if (maybe && typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  return '';
}

function normaliserSectionRef(raw: unknown): OeuvreSectionRef | null {
  const s = raw as Partial<OeuvreSectionRef>;
  if (!s || typeof s.id !== 'string' || !s.id) return null;
  return {
    id: s.id,
    titre: typeof s.titre === 'string' ? s.titre : 'Sans titre',
    groupe: typeof s.groupe === 'string' && s.groupe ? s.groupe : undefined,
    aQuestions: s.aQuestions === true,
  };
}

function normaliserChapitre(raw: unknown): OeuvreChapitre | null {
  const c = raw as Partial<OeuvreChapitre>;
  if (!c || typeof c.id !== 'string' || !c.id) return null;
  return {
    id: c.id,
    titre: typeof c.titre === 'string' ? c.titre : 'Sans titre',
    sousTitre: typeof c.sousTitre === 'string' && c.sousTitre ? c.sousTitre : undefined,
    sections: Array.isArray(c.sections)
      ? c.sections.map(normaliserSectionRef).filter((s): s is OeuvreSectionRef => !!s)
      : [],
  };
}

export function normaliserPartages(raw: unknown): OeuvrePartage[] {
  if (!Array.isArray(raw)) return [];
  const vus = new Set<string>();
  const out: OeuvrePartage[] = [];
  for (const item of raw) {
    const p = item as Partial<OeuvrePartage>;
    const email = typeof p?.email === 'string' ? p.email.toLowerCase().trim() : '';
    if (!email || vus.has(email)) continue;
    vus.add(email);
    out.push({
      email,
      // Jamais `undefined` : Firestore le refuse, et ces objets sont réécrits
      nom: typeof p.nom === 'string' ? p.nom : '',
      mode: p.mode === 'edition' ? 'edition' : 'lecture',
    });
  }
  return out;
}

export function docToOeuvre(doc: Doc): Oeuvre {
  const d = doc.data() || {};
  return {
    id: d.id || doc.id,
    titre: d.titre || '',
    auteur: d.auteur || '',
    description: d.description || '',
    // `null` et non `undefined` : ce document est relu puis réécrit par les
    // routes de partage et d'archivage, et Firestore refuse `undefined`.
    couverture:
      d.couverture?.url && d.couverture?.fileId
        ? { url: d.couverture.url, fileId: d.couverture.fileId }
        : null,
    chapitres: Array.isArray(d.chapitres)
      ? d.chapitres.map(normaliserChapitre).filter((c): c is OeuvreChapitre => !!c)
      : [],
    profId: d.profId || '',
    profName: d.profName || '',
    shared: d.shared ?? false,
    partages: normaliserPartages(d.partages),
    archive: d.archive ?? false,
    anneeScolaire: d.anneeScolaire || '',
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

const TYPES_BLOC: OeuvreBloc['type'][] = ['texte', 'vers', 'video', 'image', 'audio'];

function normaliserBloc(raw: unknown): OeuvreBloc | null {
  const b = raw as Partial<OeuvreBloc>;
  if (!b || typeof b.id !== 'string' || !b.id) return null;
  const type = b.type;
  if (!type || !TYPES_BLOC.includes(type)) return null;
  return {
    id: b.id,
    type,
    // `face` n'est posée QUE si elle vaut verso : absente = recto, et c'est ce
    // qui laisse intactes les œuvres encodées avant l'existence du verso.
    face: b.face === 'verso' ? 'verso' : undefined,
    contenu: typeof b.contenu === 'string' ? b.contenu : undefined,
    locuteur: typeof b.locuteur === 'string' && b.locuteur ? b.locuteur : undefined,
    videoId: typeof b.videoId === 'string' ? b.videoId : undefined,
    videoUrl: typeof b.videoUrl === 'string' ? b.videoUrl : undefined,
    imageUrl: typeof b.imageUrl === 'string' ? b.imageUrl : undefined,
    imageFileId: typeof b.imageFileId === 'string' ? b.imageFileId : undefined,
    audioUrl: typeof b.audioUrl === 'string' ? b.audioUrl : undefined,
    audioFileId: typeof b.audioFileId === 'string' ? b.audioFileId : undefined,
    legende: typeof b.legende === 'string' && b.legende ? b.legende : undefined,
  };
}

/**
 * Pendant de `chapitresPourFirestore` pour les blocs — même piège, déjà payé
 * deux fois : Firestore REFUSE `undefined`, et un bloc relu puis réécrit en
 * porte sur chaque champ vide. Toute route qui écrit des blocs passe par ici.
 */
export function blocsPourFirestore(blocs: unknown): OeuvreBloc[] {
  if (!Array.isArray(blocs)) return [];
  return blocs
    .map(normaliserBloc)
    .filter((b): b is OeuvreBloc => !!b)
    .map((b) => {
      const net: Record<string, unknown> = { id: b.id, type: b.type };
      if (b.face === 'verso') net.face = 'verso';
      if (b.contenu !== undefined) net.contenu = b.contenu;
      if (b.locuteur) net.locuteur = b.locuteur;
      if (b.videoId) net.videoId = b.videoId;
      if (b.videoUrl) net.videoUrl = b.videoUrl;
      if (b.imageUrl) net.imageUrl = b.imageUrl;
      if (b.imageFileId) net.imageFileId = b.imageFileId;
      if (b.audioUrl) net.audioUrl = b.audioUrl;
      if (b.audioFileId) net.audioFileId = b.audioFileId;
      if (b.legende) net.legende = b.legende;
      return net as unknown as OeuvreBloc;
    });
}

export function docToSection(doc: Doc): OeuvreSection {
  const d = doc.data() || {};
  const colonnes = d.colonnes === 2 ? 2 : 1;
  return {
    id: d.id || doc.id,
    chapitreId: d.chapitreId || '',
    titre: d.titre || '',
    groupe: d.groupe || undefined,
    chapeau: d.chapeau || undefined,
    colonnes,
    blocs: Array.isArray(d.blocs)
      ? d.blocs.map(normaliserBloc).filter((b): b is OeuvreBloc => !!b)
      : [],
    // Les questions partent TELLES QUELLES vers l'élève — corrigé compris.
    // Voir l'avertissement en tête de fichier.
    //
    // Seule retouche : `preparerPresentation`, qui MÉLANGE les jetons d'une
    // remise en ordre et la réserve d'une image annotée. Ce n'est pas un
    // filtrage — rien n'est caché, le corrigé reste ouvert. C'est qu'un
    // exercice servi déjà résolu n'est plus un exercice.
    questions: Array.isArray(d.questions)
      ? (d.questions as LectureQuestion[]).map(preparerPresentation)
      : [],
  };
}

/**
 * Firestore REFUSE les champs `undefined`. Or la normalisation à la lecture
 * pose `undefined` sur les valeurs vides (`sousTitre`, `groupe`) — parfait pour
 * le rendu, fatal pour la réécriture. Toute route qui RENVOIE un sommaire en
 * base doit donc le repasser par ici.
 */
export function chapitresPourFirestore(chapitres: OeuvreChapitre[]) {
  return chapitres.map((c) => ({
    id: c.id,
    titre: c.titre || 'Sans titre',
    sousTitre: c.sousTitre || '',
    sections: c.sections.map((s) => ({
      id: s.id,
      titre: s.titre || 'Sans titre',
      groupe: s.groupe || '',
      aQuestions: s.aQuestions === true,
    })),
  }));
}

// Le sommaire est reconstruit depuis les sections réellement en base : c'est
// lui qui fait foi pour `aQuestions`, jamais ce que le formulaire a déclaré.
export async function rafraichirSommaire(oeuvreId: string): Promise<OeuvreChapitre[]> {
  const oeuvreDoc = await adminDb.collection('oeuvres').doc(oeuvreId).get();
  if (!oeuvreDoc.exists) return [];
  const oeuvre = docToOeuvre(oeuvreDoc);

  const snap = await adminDb.collection('oeuvres').doc(oeuvreId).collection('sections').get();
  const parId = new Map(snap.docs.map((d) => [d.id, docToSection(d)]));

  return oeuvre.chapitres.map((c) => ({
    ...c,
    sections: c.sections.map((ref) => {
      const s = parId.get(ref.id);
      return s
        ? { id: s.id, titre: s.titre, groupe: s.groupe, aQuestions: s.questions.length > 0 }
        : ref;
    }),
  }));
}
