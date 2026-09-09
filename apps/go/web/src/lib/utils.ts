import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * `payload` est un corps `application/problem+json` (RFC 9457) : `message`
 * porte le texte français à afficher, `detail` reste un détail technique.
 */
export function initials(fullName: string): string {
  const mots = fullName.trim().split(/\s+/).filter(Boolean);
  return mots
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join('');
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('message' in payload)) return fallback;
  const { message } = payload;
  return typeof message === 'string' && message !== '' ? message : fallback;
}
