import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt } from '@/lib/crypto';
import type { ACorrigerProf, AccueilProf, EcheanceProf, RetardProf } from '@/types/accueil';

// GET ?espace=classique|fle — l'accueil du prof (2026-10-08) : ce qui l'attend
// sur ses classes de l'espace courant. Rien n'est stocké : tout se lit sur les
// sessions (classe × activité), les copies et les corrections rendues.

const JOURS_ECHEANCES = 14;
const JOURS_RETARDS = 30;

function toDate(v: unknown): Date | null {
  const d = v as { toDate?: () => Date } | null;
  if (d && typeof d.toDate === 'function') return d.toDate();
  if (typeof v === 'string' && v) return new Date(v);
  return null;
}

function joursEntre(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ success: false, message: 'Accès réservé aux professeurs' }, { status: 403 });
  const espace = new URL(request.url).searchParams.get('espace') === 'fle' ? 'fle' : 'classique';

  try {
    // 1. Mes classes actives, de l'espace courant
    const classesSnap = await adminDb.collection('classes').where('profId', '==', auth.uid).get();
    const classes = new Map<string, string>();
    // Noms de TOUTES mes classes FLE (archivées comprises) : une activité
    // donnée à l'une d'elles est FLE, même si elle l'est aussi à une classe de
    // français — même règle que le tableau de bord (« plus rien de FLE en
    // classique », JP, 2026-10-08 ; constaté le 09/10 sur « Lecture du cours »).
    const nomsFle = new Set<string>();
    classesSnap.docs.forEach((d) => {
      const data = d.data();
      const fle = data.type === 'fle';
      if (fle) nomsFle.add(String(data.nom ?? ''));
      if (data.archive === true) return;
      if (fle === (espace === 'fle')) classes.set(d.id, String(data.nom ?? ''));
    });
    const vide: AccueilProf = { aCorriger: [], echeances: [], retards: [] };
    if (classes.size === 0) return NextResponse.json({ success: true, data: vide });

    // 2. Les sessions de ces classes (classe × activité), non archivées
    const sessionsSnap = await adminDb.collection('sessions').where('profId', '==', auth.uid).get();
    const sessions = sessionsSnap.docs
      .map((d) => d.data())
      .filter((s) => classes.has(String(s.classeId)) && s.archive !== true);
    if (sessions.length === 0) return NextResponse.json({ success: true, data: vide });

    // 3. Les activités, lues une fois chacune (supprimées : ignorées)
    const devoirIds = [...new Set(sessions.map((s) => String(s.devoirId)))];
    // Une activité CLASSÉE (« travail corrigé ») ou archivée n'est plus en
    // cours : rien à corriger, personne en retard (JP, 2026-10-08)
    // Une activité est FLE si elle porte le référentiel FLE ou si UNE de ses
    // classes est FLE : elle n'appartient alors qu'à l'espace FLE.
    const devoirs = new Map<string, { intitule: string; enCours: boolean; fle: boolean }>();
    await Promise.all(
      devoirIds.map(async (id) => {
        const d = await adminDb.collection('devoirs').doc(id).get();
        if (d.exists) {
          const data = d.data()!;
          const classesDevoir: string[] = Array.isArray(data.classes) ? data.classes.map(String) : [];
          devoirs.set(id, {
            intitule: String(data.intitule ?? ''),
            enCours: data.corrige !== true && data.archive !== true,
            fle: data.referentiel === 'fle' || classesDevoir.some((nom) => nomsFle.has(nom)),
          });
        }
      })
    );

    const aujourdhui = new Date();
    const aCorriger: ACorrigerProf[] = [];
    const echeances: EcheanceProf[] = [];
    const retards: RetardProf[] = [];

    await Promise.all(
      sessions.map(async (s) => {
        const devoir = devoirs.get(String(s.devoirId));
        if (!devoir || !devoir.enCours) return;
        if (devoir.fle !== (espace === 'fle')) return;
        const classeNom = classes.get(String(s.classeId)) ?? '';
        const copies = await adminDb
          .collection('travaux')
          .where('sessionId', '==', String(s.id))
          .select('status', 'nonRendu', 'studentEmailHash', 'studentEmail', 'studentId')
          .get();
        const remises = copies.docs.filter((c) => c.data().status === 'submitted' && !c.data().nonRendu);

        // À corriger : remises sans correction rendue
        if (remises.length > 0) {
          const ids = remises.map((c) => `CORR-${c.id}`);
          let rendues = 0;
          for (let i = 0; i < ids.length; i += 30) {
            const snap = await adminDb.collection('corrections').where('__name__', 'in', ids.slice(i, i + 30)).get();
            rendues += snap.docs.filter((d) => d.data().visibleParEleve === true).length;
          }
          const nb = remises.length - rendues;
          if (nb > 0) aCorriger.push({ devoirId: String(s.devoirId), intitule: devoir.intitule, classeNom, nb });
        }

        const echeance = toDate(s.dateRemise);
        if (!echeance) return;
        const jours = joursEntre(echeance, aujourdhui); // > 0 = passée

        // Échéances à venir (session ouverte)
        if (jours <= 0 && -jours <= JOURS_ECHEANCES && s.disponible === true) {
          echeances.push({
            devoirId: String(s.devoirId),
            intitule: devoir.intitule,
            classeNom,
            dateRemise: echeance.toISOString(),
            remises: remises.length,
            total: copies.size,
          });
        }

        // Élèves en retard : échéance passée, activité ouverte, pas de copie remise.
        // Une copie se reconnaît par l'empreinte d'email, l'uid ou l'email en
        // clair (copies d'avant le chiffrement) : il faut les trois pour ne
        // compter en retard que ceux qui n'ont vraiment rien remis.
        // Le prof peut cocher « vu » : la session n'y revient plus.
        if (jours > 0 && jours <= JOURS_RETARDS && s.disponible === true && s.retardsVus !== true) {
          const remisCles = new Set<string>();
          remises.forEach((c) => {
            const d = c.data();
            if (d.studentEmailHash) remisCles.add(`h:${d.studentEmailHash}`);
            if (d.studentId) remisCles.add(`u:${d.studentId}`);
            const email = decrypt(d.studentEmail).trim().toLowerCase();
            if (email) remisCles.add(`e:${email}`);
          });
          const roster = await adminDb.collection('eleves').where('classeId', '==', String(s.classeId)).get();
          const eleves = roster.docs
            .filter((e) => {
              const d = e.data();
              const email = decrypt(d.email).trim().toLowerCase();
              return !(
                (d.emailHash && remisCles.has(`h:${d.emailHash}`)) ||
                (d.firebaseUid && remisCles.has(`u:${d.firebaseUid}`)) ||
                (email && remisCles.has(`e:${email}`))
              );
            })
            .map((e) => `${decrypt(e.data().prenom)} ${decrypt(e.data().nom)}`.trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
          if (eleves.length > 0) {
            retards.push({
              devoirId: String(s.devoirId),
              sessionId: String(s.id),
              intitule: devoir.intitule,
              classeNom,
              dateRemise: echeance.toISOString(),
              joursDeRetard: jours,
              eleves,
            });
          }
        }
      })
    );

    aCorriger.sort((a, b) => b.nb - a.nb);
    echeances.sort((a, b) => a.dateRemise.localeCompare(b.dateRemise));
    retards.sort((a, b) => a.joursDeRetard - b.joursDeRetard);
    return NextResponse.json({ success: true, data: { aCorriger, echeances, retards } satisfies AccueilProf });
  } catch (error) {
    console.error('Erreur GET /api/accueil-prof:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
