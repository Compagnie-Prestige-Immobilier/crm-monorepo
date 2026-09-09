import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type StatutQualification = components['schemas']['ReferentielsStatut'];
export type CreerStatut = components['schemas']['ReferentielsCreerStatutInputBody'];
export type ModifierStatut = components['schemas']['ReferentielsModifierStatutInputBody'];
export type EffetStatut = StatutQualification['effect'];
export type PrioriteStatut = StatutQualification['priorite'];
/** `null` en base vaut « ne tranche pas », que le corps d'écriture nomme `INCONNU`. */
export type RelationStatut = NonNullable<StatutQualification['relationStatus']>;

export const EFFETS_STATUT: readonly EffetStatut[] = [
  'REACHED',
  'REFUSED',
  'SCHEDULE_CALLBACK',
  'UNREACHABLE',
  'WRONG_NUMBER',
];

export const LIBELLES_EFFET_STATUT: Record<EffetStatut, string> = {
  REACHED: 'Appel abouti',
  REFUSED: 'Appel abouti, refus',
  SCHEDULE_CALLBACK: 'Appel abouti, rappel daté',
  UNREACHABLE: 'Appel non abouti',
  WRONG_NUMBER: 'Appel abouti, mauvais numéro',
};

export const PRIORITES_STATUT: readonly PrioriteStatut[] = ['HAUTE', 'NORMALE', 'BASSE'];

export const LIBELLES_PRIORITE: Record<PrioriteStatut, string> = {
  HAUTE: 'Haute',
  NORMALE: 'Normale',
  BASSE: 'Basse',
};

export const LIBELLES_RELATION: Record<RelationStatut, string> = {
  INCONNU: 'Ne tranche pas',
  CONTACTE: 'Contacté',
  AMBASSADEUR: 'Ambassadeur',
  REFUS: 'Refus',
};

/** Les délais proposés d'office après un numéro qui n'a pas répondu. */
export const REESSAIS_STATUT: readonly { value: string; label: string }[] = [
  { value: '0', label: 'Aucun' },
  { value: '60', label: 'Dans 1 h' },
  { value: '180', label: 'Dans 3 h' },
  { value: '1440', label: 'Le lendemain' },
];

/** La branche du script se DÉDUIT de l'effet, comme côté serveur. */
export function estAbouti(effect: EffetStatut): boolean {
  return effect !== 'UNREACHABLE';
}

export async function fetchStatutsAdministration(): Promise<StatutQualification[]> {
  const sortie = unwrap(await apiClient.GET('/api/v1/statuts-qualification/administration'));
  return sortie.items ?? [];
}

export async function creerStatut(body: CreerStatut): Promise<StatutQualification> {
  return unwrap(await apiClient.POST('/api/v1/statuts-qualification', { body }));
}

export async function modifierStatut(
  id: string,
  body: ModifierStatut,
): Promise<StatutQualification> {
  return unwrap(
    await apiClient.PATCH('/api/v1/statuts-qualification/{id}', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function activerStatut(id: string, isActive: boolean): Promise<StatutQualification> {
  return unwrap(
    await apiClient.POST('/api/v1/statuts-qualification/{id}/active', {
      params: { path: { id } },
      body: { isActive },
    }),
  );
}

/** Vocabulaire de SAISIE : actifs seulement, servis dans l'ordre dicté. */
export async function fetchStatutsSaisie(): Promise<StatutQualification[]> {
  const sortie = unwrap(await apiClient.GET('/api/v1/statuts-qualification'));
  return sortie.items ?? [];
}

/**
 * En base, le libellé porte sa famille parce qu'il y est unique. À l'écran,
 * l'en-tête de branche la dit déjà.
 */
const LIBELLES_ABREGES: Record<string, string> = {
  AUTRE_JOINT: 'Autre',
  AUTRE_NON_JOINT: 'Autre',
};

export function libelleStatut(statut: Pick<StatutQualification, 'code' | 'label'>): string {
  return LIBELLES_ABREGES[statut.code] ?? statut.label;
}

export function statutsDeLaBranche(
  statuts: readonly StatutQualification[],
  abouti: boolean,
): StatutQualification[] {
  return statuts.filter((statut) => estAbouti(statut.effect) === abouti);
}

export function exigeMotif(statut: StatutQualification): boolean {
  return statut.requiresComment;
}

/** Les deux statuts que la question du script pose seule : ils ne se choisissent plus. */
const STATUTS_DE_LA_QUESTION = { oui: 'ACCEPTE', non: 'REFUSE' } as const;

export function statutDuSouhait(
  statuts: readonly StatutQualification[],
  souhaite: boolean | null,
): StatutQualification | null {
  if (souhaite === null) return null;
  const code = souhaite ? STATUTS_DE_LA_QUESTION.oui : STATUTS_DE_LA_QUESTION.non;
  return statuts.find((statut) => statut.code === code) ?? null;
}

/**
 * Le serveur refuse une relation qui contredit le statut posé
 * (`REP_RELATION_STATUT_MISMATCH`) : choisir le statut doit poser la réponse.
 */
export function souhaitDuStatut(statut: Pick<StatutQualification, 'code'> | null): boolean | null {
  if (statut === null) return null;
  if (statut.code === STATUTS_DE_LA_QUESTION.oui) return true;
  if (statut.code === STATUTS_DE_LA_QUESTION.non) return false;
  return null;
}
