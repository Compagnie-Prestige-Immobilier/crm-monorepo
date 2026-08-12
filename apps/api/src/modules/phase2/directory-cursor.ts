import { BadRequestException } from '@nestjs/common';

/**
 * Curseur de l'annuaire hors ligne.
 *
 * Même mécanique que celle du pull de synchronisation, et pour la même raison :
 * un simple horodatage PERD des lignes. Deux prospects écrits dans la même
 * milliseconde et séparés par une frontière de page se répartissent entre « fin
 * de page 1 » et « strictement après cette milliseconde » — la seconde ligne
 * n'est jamais servie, et le commercial ne le saura jamais. On pagine donc en
 * keyset sur le COUPLE `(updatedAt, id)`, exactement l'index partiel
 * `prospects_phase2_directory`.
 *
 * Le format est délibérément DISTINCT de celui du module de synchronisation.
 * Un curseur partagé lierait deux paginations qui n'ont ni le même filtre, ni
 * le même volume, ni le même rythme d'évolution : le jour où l'une gagne un
 * flux, tous les curseurs de l'autre deviendraient invalides.
 */

export interface DirectoryCursor {
  /** Version du format, pour pouvoir invalider proprement un curseur ancien. */
  v: 1;
  /** `updatedAt` de la dernière ligne servie, en MICROsecondes depuis l'epoch. */
  t: number;
  /** Identifiant de cette ligne, qui départage les ex æquo. */
  id: string;
}

const invalid = (message: string): never => {
  throw new BadRequestException({ code: 'PHASE2_DIRECTORY_CURSOR_INVALID', message });
};

export const toMicros = (date: Date): number => date.getTime() * 1000;
export const fromMicros = (micros: number): Date => new Date(Math.floor(micros / 1000));

export function encodeDirectoryCursor(cursor: DirectoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

/** `undefined` pour un premier appel ; lève un 400 typé pour un curseur abîmé. */
export function decodeDirectoryCursor(raw: string | undefined): DirectoryCursor | undefined {
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return invalid('Curseur d’annuaire illisible. Relancez un téléchargement complet.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return invalid('Curseur d’annuaire illisible.');
  }

  const candidate = parsed as { v?: unknown; t?: unknown; id?: unknown };
  if (candidate.v !== 1) {
    return invalid('Curseur d’annuaire d’une version non prise en charge.');
  }
  if (typeof candidate.t !== 'number' || !Number.isFinite(candidate.t)) {
    return invalid('Position de curseur illisible.');
  }
  if (typeof candidate.id !== 'string' || candidate.id === '') {
    return invalid('Position de curseur illisible.');
  }

  return { v: 1, t: candidate.t, id: candidate.id };
}
