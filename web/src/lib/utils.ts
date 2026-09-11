import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** L'API répond en RFC 9457 (`message`) ; `error` est la forme du relais v1. */
export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null) return fallback;
  const { message, error } = payload as { message?: unknown; error?: unknown };
  const texte = typeof message === 'string' ? message : error;
  return typeof texte === 'string' && texte !== '' ? texte : fallback;
}
