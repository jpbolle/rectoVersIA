'use client';

// ═══ L'ESPACE COURANT : classique ou FLE (JP, 2026-10-08) ═══
//
// Le prof FLE et le prof de français sont souvent la même personne, mais pas
// au même moment : deux postes de travail, un double bouton dans l'en-tête.
// L'espace vaut pour toute l'app (en-tête, Mes Classes, Mes Activités,
// l'accueil) et survit au rechargement : `localStorage`, clé `espace-actif`.
// Défaut : classique — sauf pour un élève dont toutes les classes sont FLE,
// que les pages posent en FLE au premier passage (`initialiserSiVide`).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Espace = 'classique' | 'fle';

const CLE = 'espace-actif';

interface EspaceContextValue {
  espace: Espace;
  // Vrai une fois la valeur relue dans le navigateur (évite un faux départ en SSR)
  pret: boolean;
  setEspace: (e: Espace) => void;
  // Pose un défaut si l'utilisateur n'a encore rien choisi
  initialiserSiVide: (e: Espace) => void;
}

const EspaceContext = createContext<EspaceContextValue | null>(null);

function lire(): Espace | null {
  try {
    const v = window.localStorage.getItem(CLE);
    return v === 'fle' || v === 'classique' ? v : null;
  } catch {
    return null;
  }
}

export function EspaceProvider({ children }: { children: ReactNode }) {
  const [espace, setEspaceState] = useState<Espace>('classique');
  const [pret, setPret] = useState(false);

  useEffect(() => {
    // Lecture du navigateur après le montage : un setState différé, pas synchrone
    const t = setTimeout(() => {
      const v = lire();
      if (v) setEspaceState(v);
      setPret(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const setEspace = useCallback((e: Espace) => {
    setEspaceState(e);
    try {
      window.localStorage.setItem(CLE, e);
    } catch {
      // Navigation privée : l'espace vaut pour la session seulement
    }
  }, []);

  const initialiserSiVide = useCallback(
    (e: Espace) => {
      if (lire() === null) setEspace(e);
    },
    [setEspace]
  );

  return <EspaceContext.Provider value={{ espace, pret, setEspace, initialiserSiVide }}>{children}</EspaceContext.Provider>;
}

export function useEspace(): EspaceContextValue {
  const ctx = useContext(EspaceContext);
  if (!ctx) throw new Error('useEspace doit être utilisé dans un EspaceProvider');
  return ctx;
}
