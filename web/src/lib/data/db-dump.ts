import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type DatabaseDump = components['schemas']['EtatDump'];

export async function fetchDatabaseDump(client: ApiClient = getApiClient()): Promise<DatabaseDump> {
  return unwrap(await client.GET('/api/v1/admin/database-dump'));
}

export async function requestDatabaseDump(
  client: ApiClient = getApiClient(),
): Promise<DatabaseDump> {
  return unwrap(await client.POST('/api/v1/admin/database-dump', {}));
}

export const DATABASE_DUMP_DOWNLOAD_URL = '/api/v1/admin/database-dump/download';

export function databaseDumpFileName(now = new Date()): string {
  return `cpi-base-${now.toISOString().slice(0, 10)}.sql.gz`;
}

export function isDumpRunning(dump: DatabaseDump | undefined): boolean {
  return dump?.status === 'queued' || dump?.status === 'running';
}

export function dumpStatusLabel(dump: DatabaseDump | undefined): string {
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

export function dumpNoticeWarning(dump: DatabaseDump | undefined): string | null {
  switch (dump?.noticeStatus) {
    case 'INBOX_ONLY':
      return null;
    case 'NOT_CONFIGURED':
    case 'TRANSPORT_ERROR':
    case 'FAILED':
      return (
        'L’export est prêt, mais l’avis de fin n’a pas pu être déposé dans la ' +
        'cloche du panel. Ne comptez pas sur une alerte : téléchargez depuis cet écran.'
      );
    default:
      return null;
  }
}

export function formatDumpSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1_024 * 1_024) return `${String(Math.ceil(bytes / 1_024))} Ko`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} Mo`;
}
