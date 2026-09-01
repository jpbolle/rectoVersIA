'use client';

// Les classes d'une activité, une ligne chacune.
//
// RAISON D'ÊTRE : `corrigeDisponible` était un seul drapeau par activité. Un
// diagnostic donné à la 4C et à la 4D livrait donc le corrigé aux deux dès que
// la première avait fini — y compris à celle qui passait l'épreuve le
// lendemain. Ici, chaque classe s'ouvre et se corrige pour elle-même.
//
// Le geste courant reste UN clic : les bascules de la card agissent sur toute
// l'activité et descendent sur ses sessions (voir /api/devoirs/[id]). Cette
// popup ne sert qu'à DISSOCIER — on ne l'ouvre que quand on en a besoin.
//
// Chaque bascule part immédiatement : il n'y a rien à « enregistrer », comme
// les bascules de la card dont elle est le détail.

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import Toggle from '@/components/Toggle/Toggle';
import type { Session } from '@/types/session';
import styles from './SessionsModal.module.css';

interface Props {
  devoirId: string;
  intitule: string;
  onClose: () => void;
  /** Prévient le parent qu'une classe a bougé (rafraîchir la card) */
  onChange?: () => void;
}

export default function SessionsModal({ devoirId, intitule, onClose, onChange }: Props) {
  const { getAuthHeaders } = useAuth();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Classes dont la bascule est en vol — on les fige le temps de l'aller-retour
  const [enCours, setEnCours] = useState<Set<string>>(new Set());

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        // `getAuthHeaders` rend null tant que Firebase n'a pas résolu le jeton
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/sessions?devoirId=${encodeURIComponent(devoirId)}`, {
          headers,
        });
        const json = await res.json();
        if (annule) return;
        if (!json.success) throw new Error(json.message || 'Chargement impossible');
        setSessions(json.data as Session[]);
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Erreur');
      }
    })();
    return () => {
      annule = true;
    };
  }, [devoirId, getAuthHeaders]);

  const basculer = useCallback(
    async (session: Session, champ: 'disponible' | 'corrigeDisponible', valeur: boolean) => {
      setEnCours((s) => new Set(s).add(session.id));
      // Optimiste : la bascule doit répondre tout de suite, sinon on la
      // reclique. En cas d'échec, on remet la valeur d'avant.
      setSessions((liste) =>
        (liste ?? []).map((s) => (s.id === session.id ? { ...s, [champ]: valeur } : s))
      );
      try {
        const headers = await getAuthHeaders();
        if (!headers) throw new Error('Session expirée — rechargez la page');
        const res = await fetch(`/api/sessions/${session.id}`, {
          method: 'PATCH',
          // `getAuthHeaders` porte déjà le Content-Type : le remettre devant
          // le ferait écraser par le sien.
          headers,
          body: JSON.stringify({ [champ]: valeur }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
        onChange?.();
      } catch (e) {
        setSessions((liste) =>
          (liste ?? []).map((s) => (s.id === session.id ? { ...s, [champ]: !valeur } : s))
        );
        setErreur(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setEnCours((s) => {
          const suivant = new Set(s);
          suivant.delete(session.id);
          return suivant;
        });
      }
    },
    [getAuthHeaders, onChange]
  );

  const contenu = (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>Classe par classe</h2>
            <p className={styles.sub}>{intitule}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {erreur && <p className={styles.error}>{erreur}</p>}

          {sessions === null && !erreur && <p className={styles.info}>Chargement…</p>}

          {sessions?.length === 0 && (
            <p className={styles.info}>
              Aucune classe n’est rattachée à cette activité. Ajoutez-en une depuis la
              fiche d’édition : chaque classe recevra alors sa propre ouverture.
            </p>
          )}

          {sessions?.map((s) => (
            <div key={s.id} className={styles.ligne}>
              <span className={styles.classe}>🎓 {s.classeNom}</span>
              <div className={styles.bascules}>
                <Toggle
                  checked={s.disponible}
                  onChange={(v) => basculer(s, 'disponible', v)}
                  labelOn="Travail disponible"
                  labelOff="Travail non disponible"
                  disabled={enCours.has(s.id)}
                />
                <Toggle
                  checked={s.corrigeDisponible}
                  onChange={(v) => basculer(s, 'corrigeDisponible', v)}
                  labelOn="Corrigé disponible"
                  labelOff="Corrigé non disponible"
                  disabled={enCours.has(s.id)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.foot}>
          <span className={styles.aide}>
            Les bascules de la carte agissent sur <b>toutes</b> les classes à la fois.
          </span>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(contenu, document.body);
}
