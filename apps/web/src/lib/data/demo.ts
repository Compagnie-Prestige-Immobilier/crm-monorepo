import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { DemoCounts, DemoStatus } from '@/lib/types';

export async function fetchDemoStatus(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.GET('/api/v1/admin/demo'));
}

export async function enableDemoMode(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.POST('/api/v1/admin/demo/enable'));
}

export async function disableDemoMode(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.POST('/api/v1/admin/demo/disable'));
}

export function seededAtOrNull(status: { seededAt: string | null | undefined }): string | null {
  const value = status.seededAt;
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export interface DemoBannerState {
  enabled: boolean;
  seededAt: string | null;
}

export function demoBannerState(status: DemoStatus): DemoBannerState {
  return { enabled: status.enabled, seededAt: seededAtOrNull(status) };
}

export const NO_DEMO_BANNER: DemoBannerState = { enabled: false, seededAt: null };

export function totalDemoRows(counts: DemoCounts): number {
  return (
    counts.users +
    counts.representants +
    counts.prospects +
    counts.campaigns +
    counts.campaignCommerciaux +
    counts.callTasks +
    counts.callAttempts +
    counts.bankCases +
    counts.bankCaseTransitions
  );
}

export const DEMO_SEEDED_KINDS = [
  'comptes utilisateurs',
  'représentants',
  'prospects',
  'campagnes d’appels',
  'affectations de campagne',
  'tâches d’appel',
  'tentatives d’appel',
  'dossiers bancaires',
  'transitions de dossier',
] as const;

export type DemoSeededKind = (typeof DEMO_SEEDED_KINDS)[number];

export function demoBreakdown(counts: DemoCounts): { label: DemoSeededKind; value: number }[] {
  const rows: { label: DemoSeededKind; value: number }[] = [
    { label: 'comptes utilisateurs', value: counts.users },
    { label: 'représentants', value: counts.representants },
    { label: 'prospects', value: counts.prospects },
    { label: 'campagnes d’appels', value: counts.campaigns },
    { label: 'affectations de campagne', value: counts.campaignCommerciaux },
    { label: 'tâches d’appel', value: counts.callTasks },
    { label: 'tentatives d’appel', value: counts.callAttempts },
    { label: 'dossiers bancaires', value: counts.bankCases },
    { label: 'transitions de dossier', value: counts.bankCaseTransitions },
  ];
  return rows.filter((row) => row.value > 0);
}

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
