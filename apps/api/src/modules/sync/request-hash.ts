import { createHash } from 'node:crypto';

/**
 * Empreinte canonique du corps d'une requête.
 *
 * Elle sert à détecter la réutilisation d'une clé d'idempotence avec une
 * charge utile DIFFÉRENTE : c'est un bug client, et renvoyer silencieusement la
 * réponse mémorisée d'un autre lot ferait croire à l'appareil que des écritures
 * qu'il n'a jamais envoyées ont abouti.
 *
 * `JSON.stringify` ne convient pas tel quel : l'ordre des clés d'un objet
 * dépend de l'ordre d'insertion, donc deux corps sémantiquement identiques
 * produiraient deux empreintes et un rejeu légitime serait refusé en 422. On
 * sérialise donc en triant les clés à chaque niveau. L'ordre des TABLEAUX est
 * conservé : dans `operations`, il porte du sens.
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      // `undefined` disparaît de JSON.stringify : l'éliminer ici évite qu'un
      // champ explicitement absent et un champ à undefined divergent.
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return Object.fromEntries(entries.map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export const requestHash = (body: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize(body)))
    .digest('hex');
