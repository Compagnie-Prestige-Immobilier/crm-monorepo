import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { DemoCounts, DemoStatus } from '@/lib/types';

/**
 * Mode démonstration — `GET|POST /admin/demo`. ADMIN uniquement.
 *
 * C'est l'action la plus conséquente du panel : elle crée ou supprime des
 * milliers de lignes. Toute la logique de garde vit ici, en fonctions pures,
 * pour qu'elle soit éprouvable sans navigateur — l'écran ne fait que la rendre.
 */

export async function fetchDemoStatus(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.GET('/api/v1/admin/demo'));
}

export async function enableDemoMode(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.POST('/api/v1/admin/demo/enable'));
}

export async function disableDemoMode(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.POST('/api/v1/admin/demo/disable'));
}

/**
 * Date d'ensemencement affichable.
 *
 * L'API renvoie `seededAt: ""` — et non `null` — quand le mode n'a jamais été
 * activé. Constaté sur la pile de développement. Une chaîne vide passée à
 * `parseISO` produit `Invalid Date`, puis un plantage de rendu dans
 * `date-fns/format`. On normalise donc ici, à l'entrée, plutôt que de laisser
 * chaque écran s'en souvenir.
 */
export function seededAtOrNull(status: { seededAt: string | null | undefined }): string | null {
  const value = status.seededAt;
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * `campaignCommerciaux` — rattachements commercial↔campagne.
 *
 * TODO(api-client) : le champ EXISTE côté API (`DemoCountsDto`, et la réponse
 * live le renvoie), mais `apps/api/openapi.json` n'a pas été régénéré depuis
 * son ajout, donc le type engendré l'ignore. On le lit sans le déclarer plutôt
 * que d'élargir le type à la main : le jour où le document est régénéré, cette
 * fonction disparaît au profit de `counts.campaignCommerciaux`, et rien
 * d'autre ne bouge.
 */
export function campaignCommerciauxCount(counts: DemoCounts): number {
  const value = (counts as { campaignCommerciaux?: unknown }).campaignCommerciaux;
  return typeof value === 'number' ? value : 0;
}

/** Somme des compteurs — ce que la désactivation supprimera, et rien d'autre. */
export function totalDemoRows(counts: DemoCounts): number {
  return (
    counts.users +
    counts.representants +
    counts.prospects +
    counts.campaigns +
    campaignCommerciauxCount(counts) +
    counts.callTasks +
    counts.callAttempts +
    counts.bankCases +
    counts.bankCaseTransitions
  );
}

/**
 * Détail affiché dans la confirmation de désactivation.
 *
 * Les entrées à zéro sont ÉCARTÉES : lister « 0 dossier bancaire » à côté de
 * « 4 210 prospects » dilue le seul chiffre qui compte, et allonge une boîte de
 * dialogue qu'il faut pouvoir lire d'un coup d'œil.
 */
export function demoBreakdown(counts: DemoCounts): { label: string; value: number }[] {
  const rows: { label: string; value: number }[] = [
    { label: 'comptes utilisateurs', value: counts.users },
    { label: 'représentants', value: counts.representants },
    { label: 'prospects', value: counts.prospects },
    { label: 'campagnes d’appels', value: counts.campaigns },
    { label: 'affectations de campagne', value: campaignCommerciauxCount(counts) },
    { label: 'tâches d’appel', value: counts.callTasks },
    { label: 'tentatives d’appel', value: counts.callAttempts },
    { label: 'dossiers bancaires', value: counts.bankCases },
    { label: 'transitions de dossier', value: counts.bankCaseTransitions },
  ];
  return rows.filter((row) => row.value > 0);
}

/**
 * Décision d'affichage du bouton de bascule. Un seul endroit, testé.
 *
 * `canToggle: false` ne produit JAMAIS un bouton grisé sans explication : le
 * contrat fournit `reason` précisément pour être affichée. Un administrateur
 * devant un bouton mort et muet ouvre un ticket ; devant la phrase « la bascule
 * est interdite en production tant que DEMO_MODE_ALLOWED ne vaut pas true », il
 * sait quoi faire.
 */
export type DemoControl =
  { kind: 'enable' } | { kind: 'disable' } | { kind: 'blocked'; reason: string };

export function demoControl(status: DemoStatus): DemoControl {
  if (!status.canToggle) {
    return {
      kind: 'blocked',
      reason:
        status.reason !== null && status.reason.trim() !== ''
          ? status.reason
          : 'Bascule désactivée sur cet environnement.',
    };
  }
  return status.enabled ? { kind: 'disable' } : { kind: 'enable' };
}

/**
 * La désactivation part-elle ?
 *
 * TROIS conditions, et non une seule :
 *  - l'environnement autorise la bascule ;
 *  - le mode est effectivement actif ;
 *  - la confirmation explicite a été donnée dans la boîte de dialogue.
 *
 * `pending` bloque en plus le second clic. Sans lui, un double-clic envoie deux
 * suppressions concurrentes : la seconde ne détruirait rien de réel — l'API ne
 * supprime que ce qu'elle a enregistré — mais afficherait une erreur au moment
 * où la première vient de réussir, ce qui se lit comme un échec.
 */
export function canSubmitDisable(input: {
  status: DemoStatus;
  confirmed: boolean;
  pending: boolean;
}): boolean {
  if (input.pending) return false;
  if (!input.confirmed) return false;
  if (!input.status.canToggle) return false;
  return input.status.enabled;
}

export function canSubmitEnable(input: { status: DemoStatus; pending: boolean }): boolean {
  if (input.pending) return false;
  if (!input.status.canToggle) return false;
  return !input.status.enabled;
}
