import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Extrait le message d'un corps d'erreur JSON.
 *
 * L'appelant reçoit un `unknown` : la réponse peut être un 502 d'un proxy, une
 * page HTML ou un corps vide, pas seulement le `{ error: string }` attendu.
 * On ne fait donc confiance à rien et on retombe sur un texte affichable.
 */
export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return fallback;
  const { error } = payload;
  return typeof error === 'string' && error !== '' ? error : fallback;
}
