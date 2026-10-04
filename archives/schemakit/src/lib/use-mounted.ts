'use client';

/**
 * `true` une fois le composant monté dans le navigateur, `false` pendant le rendu
 * serveur et l'hydratation. Permet de lire le stockage local dans un composant enfant
 * monté seulement côté client, sans décalage entre serveur et client.
 */
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
