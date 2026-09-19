import { adminDb } from '@/lib/firebase/admin';
import { hashEmail } from '@/lib/crypto';
import { COLL_ATTENTE, COLL_PERSO, fusionnerMots, type MotPersonnel } from './mots';
import { COLL_RESULTATS, COLL_TRACES } from './write';
import type { DaspalecteStats } from '@/types/daspalecte';

// Stats Daspalecte d'un élève, pour l'onglet Vocabulaire du profil — SERVEUR
// UNIQUEMENT. Tout se recalcule à la lecture, rien n'est stocké. null = aucune
// trace (l'onglet n'affiche alors pas la section).
//
// `uid` vide : élève jamais connecté, ses mots sont encore dans la file d'attente.
export async function chargerStatsDaspalecte(
  email: string,
  uid: string
): Promise<DaspalecteStats | null> {
  const emailHash = hashEmail(email);
  if (!emailHash) return null;

  // Requêtes sur un seul champ, tri en mémoire : aucun index composite requis
  const [sessions, resultats, perso, attente] = await Promise.all([
    adminDb.collection(COLL_TRACES).where('studentEmailHash', '==', emailHash).get(),
    adminDb.collection(COLL_RESULTATS).where('studentEmailHash', '==', emailHash).get(),
    uid ? adminDb.collection(COLL_PERSO).doc(uid).get() : null,
    adminDb.collection(COLL_ATTENTE).doc(emailHash).get(),
  ]);

  // Les mots : ceux qui portent une traduction (cliqués au moins une fois dans
  // Daspalecte), liste personnelle et file d'attente confondues
  const words = fusionnerMots(
    perso?.exists ? (perso.data()?.words as MotPersonnel[]) || [] : [],
    attente.exists ? (attente.data()?.words as MotPersonnel[]) || [] : []
  );
  const mots = words
    .filter((m) => m.word && (m.source === 'daspalecte' || m.clics))
    .map((m) => ({
      word: m.word,
      traduction: m.traduction || '',
      langue: m.langue || '',
      clics: m.clics || 1,
      lastSeenAt: m.lastSeenAt || m.addedAt || null,
    }))
    .sort((a, b) => b.clics - a.clics || (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));

  if (sessions.empty && resultats.empty && mots.length === 0) return null;

  let derniere = 0;
  for (const d of sessions.docs) derniere = Math.max(derniere, d.data().lastActivityAt || 0);

  let score = 0;
  let total = 0;
  let nbExercices = 0;
  const lectures: { at: number; percentage: number }[] = [];
  for (const d of resultats.docs) {
    const r = d.data();
    if (r.kind === 'exercise') {
      nbExercices++;
      score += r.score || 0;
      total += r.total || 0;
    } else if (r.kind === 'reading_test') {
      lectures.push({ at: r.at || 0, percentage: r.percentage || 0 });
    }
  }
  lectures.sort((a, b) => a.at - b.at);

  return {
    sessions: sessions.size,
    derniereActivite: derniere ? new Date(derniere).toISOString() : null,
    mots,
    exercices: {
      nombre: nbExercices,
      reussite: total > 0 ? Math.round((score / total) * 100) : null,
    },
    lectures: {
      nombre: lectures.length,
      moyenne: lectures.length
        ? Math.round(lectures.reduce((s, l) => s + l.percentage, 0) / lectures.length)
        : null,
      dernier: lectures.length ? lectures[lectures.length - 1].percentage : null,
    },
  };
}
