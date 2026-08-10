import { adminDb } from '@/lib/firebase/admin';
import { generateTravailId } from '@/lib/travail-utils';
import { decrypt, encrypt, hashEmail } from '@/lib/crypto';

/**
 * Pre-cree les travaux pour tous les eleves des classes assignees a un devoir.
 * Idempotent : ne cree que les travaux manquants (comparaison par email).
 *
 * @returns nombre de travaux nouvellement crees
 */
export async function ensureTravaux(devoirId: string, profId: string): Promise<number> {
  // 1. Recuperer le devoir
  const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
  if (!devoirSnap.exists) return 0;
  const devoirData = devoirSnap.data()!;
  const classNames: string[] = devoirData.classes || [];
  if (classNames.length === 0) return 0;

  // 2. Resoudre noms de classes -> IDs (Firestore 'in' limite a 30)
  const classesSnap = await adminDb
    .collection('classes')
    .where('profId', '==', profId)
    .where('nom', 'in', classNames.slice(0, 30))
    .get();

  const classeIds = classesSnap.docs.map(doc => doc.id);
  if (classeIds.length === 0) return 0;

  // 3. Recuperer tous les eleves de ces classes (chunked par 30)
  const allEleves: Array<{ id: string; nom: string; prenom: string; email: string }> = [];
  for (let i = 0; i < classeIds.length; i += 30) {
    const chunk = classeIds.slice(i, i + 30);
    const elevesSnap = await adminDb
      .collection('eleves')
      .where('classeId', 'in', chunk)
      .get();
    elevesSnap.docs.forEach(doc => {
      const data = doc.data();
      allEleves.push({
        id: doc.id,
        nom: decrypt(data.nom) || '',
        prenom: decrypt(data.prenom) || '',
        email: (decrypt(data.email) || '').toLowerCase(),
      });
    });
  }

  if (allEleves.length === 0) return 0;

  // 4. Recuperer les travaux existants pour ce devoir
  const existingSnap = await adminDb
    .collection('travaux')
    .where('devoirId', '==', devoirId)
    .get();

  // Set des emails qui ont deja un travail
  const existingEmails = new Set<string>();
  existingSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.studentEmail) {
      existingEmails.add(decrypt(data.studentEmail).toLowerCase());
    }
  });

  // 5. Creer les travaux manquants en batch
  const now = new Date().toISOString();
  let createdCount = 0;
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const eleve of allEleves) {
    if (existingEmails.has(eleve.email)) continue;

    const travailId = generateTravailId(devoirId, eleve.id);
    const travailRef = adminDb.collection('travaux').doc(travailId);

    batch.set(travailRef, {
      id: travailId,
      devoirId,
      studentId: eleve.id,
      studentEmail: encrypt(eleve.email),
      studentEmailHash: hashEmail(eleve.email),
      studentName: encrypt(`${eleve.prenom} ${eleve.nom}`.trim()),
      content: '',
      status: 'draft',
      selfEvaluation: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
    });

    createdCount++;
    batchCount++;

    // Firestore batch limite a 500 operations
    if (batchCount >= 499) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return createdCount;
}
