import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

/**
 * Export intégral de la base : demande, sondage, téléchargement.
 *
 * La forme vient du contrat engendré, jamais redéclarée ici : deux
 * déclarations d'un même contrat finissent toujours par diverger, et c'est
 * celle qui n'est pas engendrée qui a tort, sans que rien ne le signale.
 */
export type DatabaseDump = components['schemas']['DatabaseDumpJobDto'];

export async function fetchDatabaseDump(client: ApiClient = getApiClient()): Promise<DatabaseDump> {
  return unwrap(await client.GET('/api/v1/admin/database-dump'));
}

/**
 * Demande un export. Rend tout de suite, avec un état à sonder.
 *
 * Un export DÉJÀ en cours est renvoyé tel quel par l'API : recliquer ne lance
 * pas un second `pg_dump`, et n'a donc pas à être empêché ici.
 */
export async function requestDatabaseDump(
  client: ApiClient = getApiClient(),
): Promise<DatabaseDump> {
  return unwrap(await client.POST('/api/v1/admin/database-dump', {}));
}

/**
 * L'URL de téléchargement, servie par le relais `/api/v1/*`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE N'EST PAS UN `<a href download>`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La réponse peut être une erreur JSON : session expirée, export échu entre
 * l'affichage et le clic, fichier déjà téléchargé. Un lien nu enregistrerait
 * alors un `.sql.gz` contenant du texte d'erreur, que l'administrateur
 * archiverait en croyant tenir une copie de la base. `useFileDownload` récupère
 * la réponse, vérifie le statut, et ne déclenche l'enregistrement qu'ensuite.
 *
 * Aucun paramètre : le fichier servi est celui de l'export courant, nommé par
 * la base. Rien de ce que le navigateur envoie n'entre dans un chemin.
 */
export const DATABASE_DUMP_DOWNLOAD_URL = '/api/v1/admin/database-dump/download';

/** Nom de fichier daté, pour ne pas empiler dix archives homonymes. */
export function databaseDumpFileName(now = new Date()): string {
  return `cpi-base-${now.toISOString().slice(0, 10)}.sql.gz`;
}

/**
 * L'export court-il encore ? Ce qui décide du sondage et du chargeur.
 *
 * Isolé et testé à part parce que trois éléments d'écran en dépendent (le
 * chargeur, la phrase d'attente, le verrouillage du bouton) et que les voir
 * diverger produirait un chargeur qui tourne sur un export terminé.
 */
export function isDumpRunning(dump: DatabaseDump | undefined): boolean {
  return dump?.status === 'queued' || dump?.status === 'running';
}

/**
 * La phrase d'état, en français, pour chaque cas.
 *
 * Écrite ici et non dans le composant pour être exerçable : c'est la seule
 * chose que l'administrateur lit pendant les minutes où il attend, et un
 * `expired` présenté comme une erreur le ferait relancer un export inutile.
 */
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

/**
 * Ce que l'avis de fin est devenu, dit à quelqu'un qui n'a pas le code.
 *
 * `null` quand il n'y a rien à signaler : un e-mail parti n'a pas à occuper
 * une ligne à l'écran. Ce qui doit se voir, c'est l'ABSENCE d'avis, sinon un
 * export prêt attend indéfiniment un message qui ne viendra jamais.
 */
export function dumpNoticeWarning(dump: DatabaseDump | undefined): string | null {
  switch (dump?.noticeStatus) {
    case 'NOT_CONFIGURED':
      return (
        'Aucun service d’e-mail n’est configuré : l’export est prêt, mais aucun ' +
        'message n’est parti. Seule la cloche du panel le signale.'
      );
    case 'TRANSPORT_ERROR':
    case 'FAILED':
      return (
        'L’export est prêt, mais l’avis n’a pas pu être envoyé. Ne comptez pas ' +
        'sur l’e-mail : téléchargez depuis cet écran.'
      );
    default:
      return null;
  }
}

/** Taille lisible de l'archive. */
export function formatDumpSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1_024 * 1_024) return `${String(Math.ceil(bytes / 1_024))} Ko`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} Mo`;
}
