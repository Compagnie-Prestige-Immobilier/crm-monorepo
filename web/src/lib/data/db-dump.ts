import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type EtatDump = components['schemas']['EtatDump'];

export const URL_TELECHARGEMENT_DUMP = '/api/v1/admin/database-dump/download';

export async function fetchDump(): Promise<EtatDump> {
  return unwrap(await apiClient.GET('/api/v1/admin/database-dump'));
}

export async function demanderDump(): Promise<EtatDump> {
  return unwrap(await apiClient.POST('/api/v1/admin/database-dump'));
}

export function dumpEnCours(dump: EtatDump | undefined): boolean {
  return dump?.status === 'queued' || dump?.status === 'running';
}

export function libelleEtatDump(dump: EtatDump | undefined): string {
  switch (dump?.status) {
    case 'queued':
    case 'running':
      return 'Export en cours. Un message vous préviendra dès qu’il sera prêt.';
    case 'ready':
      return 'Export prêt au téléchargement.';
    case 'failed':
      return 'L’export a échoué.';
    case 'expired':
      return 'Aucun export disponible. Le précédent a été téléchargé ou a expiré.';
    default:
      return 'Aucun export n’a encore été demandé.';
  }
}

export function alerteAvisDump(dump: EtatDump | undefined): string | null {
  const statut = dump?.noticeStatus;
  if (statut !== 'NOT_CONFIGURED' && statut !== 'TRANSPORT_ERROR' && statut !== 'FAILED') {
    return null;
  }
  return 'L’avis de fin n’a pas pu être déposé dans la cloche. Téléchargez depuis cet écran plutôt que d’attendre une alerte.';
}

export function formatTailleDump(octets: number | null): string {
  if (octets === null) return '';
  if (octets < 1_024 * 1_024) return `${String(Math.ceil(octets / 1_024))} Ko`;
  return `${(octets / (1_024 * 1_024)).toFixed(1)} Mo`;
}
