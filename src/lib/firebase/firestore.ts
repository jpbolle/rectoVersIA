import { getFirestore, collection, doc, type Firestore } from 'firebase/firestore';
import { getFirebaseApp } from './config';

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getFirebaseApp());
  }
  return _db;
}

export { getDb as db };

export function usersCollection() {
  return collection(getDb(), 'users');
}

export function evaluationsCollection() {
  return collection(getDb(), 'evaluations');
}

export function userDoc(uid: string) {
  return doc(getDb(), 'users', uid);
}

export function evaluationDoc(idEval: string) {
  return doc(getDb(), 'evaluations', idEval);
}
