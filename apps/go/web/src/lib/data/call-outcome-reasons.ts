import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type MotifIssue = components['schemas']['ReferentielsMotif'];
export type CreerMotif = components['schemas']['ReferentielsCreerMotifInputBody'];
export type ModifierMotif = components['schemas']['ReferentielsModifierMotifInputBody'];
export type EffetMotif = MotifIssue['effect'];

export const EFFETS_MOTIF: readonly EffetMotif[] = [
  'CLOSE_METHOD',
  'CLOSE_REFUSED',
  'CLOSE_WRONG_NUMBER',
  'KEEP_OPEN',
  'SCHEDULE_CALLBACK',
];

export const LIBELLES_EFFET_MOTIF: Record<EffetMotif, string> = {
  CLOSE_METHOD: 'Clôt, méthode obtenue',
  CLOSE_REFUSED: 'Clôt, refus',
  CLOSE_WRONG_NUMBER: 'Clôt, faux numéro',
  KEEP_OPEN: 'Laisse le prospect à rappeler',
  SCHEDULE_CALLBACK: 'Planifie un rappel daté',
};

/** Les rôles du design system que le panneau sait peindre. */
export const COULEURS_MOTIF = ['success', 'info', 'warning', 'danger', 'neutral'] as const;

export type CouleurMotif = (typeof COULEURS_MOTIF)[number];

export const LIBELLES_COULEUR: Record<CouleurMotif, string> = {
  success: 'Vert · réussite',
  info: 'Bleu · information',
  warning: 'Orange · vigilance',
  danger: 'Rouge · échec',
  neutral: 'Gris · neutre',
};

export async function fetchMotifsAdministration(): Promise<MotifIssue[]> {
  const sortie = unwrap(await apiClient.GET('/api/v1/call-outcome-reasons/administration'));
  return sortie.items ?? [];
}

export async function creerMotif(body: CreerMotif): Promise<MotifIssue> {
  return unwrap(await apiClient.POST('/api/v1/call-outcome-reasons', { body }));
}

export async function modifierMotif(id: string, body: ModifierMotif): Promise<MotifIssue> {
  return unwrap(
    await apiClient.PATCH('/api/v1/call-outcome-reasons/{id}', { params: { path: { id } }, body }),
  );
}

export async function activerMotif(id: string, isActive: boolean): Promise<MotifIssue> {
  return unwrap(
    await apiClient.POST('/api/v1/call-outcome-reasons/{id}/active', {
      params: { path: { id } },
      body: { isActive },
    }),
  );
}
