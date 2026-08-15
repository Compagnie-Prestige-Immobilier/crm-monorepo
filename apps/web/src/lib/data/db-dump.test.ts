import { describe, expect, it } from 'vitest';

import {
  DATABASE_DUMP_DOWNLOAD_URL,
  databaseDumpFileName,
  dumpNoticeWarning,
  dumpStatusLabel,
  formatDumpSize,
  isDumpRunning,
  type DatabaseDump,
} from '@/lib/data/db-dump';

/**
 * L'état de l'export intégral, tel que l'écran le LIT.
 *
 * Ces quatre fonctions décident de ce que l'administrateur voit pendant les
 * minutes où il attend, et de ce qu'il croit devoir faire ensuite. Elles sont
 * séparées du composant pour être exerçables : un `expired` présenté comme une
 * erreur le ferait relancer un export inutile, et une absence d'avis passée
 * sous silence le ferait attendre un e-mail qui ne viendra jamais.
 */

const dump = (overrides: Partial<DatabaseDump>): DatabaseDump => ({
  id: 'job-1',
  status: 'ready',
  requestedByName: 'Admin CPI',
  requestedAt: '2026-08-15T09:00:00.000Z',
  finishedAt: '2026-08-15T09:02:00.000Z',
  fileSize: 2_048,
  sha256: 'a'.repeat(64),
  expiresAt: '2026-08-15T15:02:00.000Z',
  failureReason: null,
  noticeStatus: 'SENT',
  noticeDetail: null,
  downloadable: true,
  ...overrides,
});

describe('isDumpRunning', () => {
  it('ne considère en cours que « queued » et « running »', () => {
    expect(isDumpRunning(dump({ status: 'queued' }))).toBe(true);
    expect(isDumpRunning(dump({ status: 'running' }))).toBe(true);
    expect(isDumpRunning(dump({ status: 'ready' }))).toBe(false);
    expect(isDumpRunning(dump({ status: 'failed' }))).toBe(false);
    expect(isDumpRunning(dump({ status: 'expired' }))).toBe(false);
    expect(isDumpRunning(dump({ status: 'idle' }))).toBe(false);
  });

  /**
   * Le premier rendu n'a pas encore de données. Sans ce cas, le chargeur
   * s'afficherait à l'ouverture de l'écran, avant même qu'on sache si un export
   * existe.
   */
  it('ne tourne pas quand rien n’a encore été chargé', () => {
    expect(isDumpRunning(undefined)).toBe(false);
  });
});

describe('dumpStatusLabel', () => {
  it('annonce l’attente et le message à venir pendant l’export', () => {
    expect(dumpStatusLabel(dump({ status: 'running' }))).toContain('en cours');
    expect(dumpStatusLabel(dump({ status: 'queued' }))).toContain('préviendra');
  });

  /**
   * `expired` N'EST PAS une erreur : c'est l'aboutissement normal du cycle,
   * après téléchargement ou après échéance. Le présenter comme un échec ferait
   * relancer un export de la base entière pour rien.
   */
  it('ne présente pas « expired » comme un échec', () => {
    const label = dumpStatusLabel(dump({ status: 'expired' }));
    expect(label).not.toMatch(/échou|erreur/iu);
    expect(label).toContain('téléchargé');
  });

  it('dit franchement qu’un export a échoué', () => {
    expect(dumpStatusLabel(dump({ status: 'failed' }))).toContain('échoué');
  });

  it('distingue l’absence d’export de l’export expiré', () => {
    expect(dumpStatusLabel(dump({ status: 'idle' }))).not.toBe(
      dumpStatusLabel(dump({ status: 'expired' })),
    );
  });
});

describe('dumpNoticeWarning', () => {
  /**
   * LE cas qui motive cette fonction. Sans transport e-mail, l'export aboutit
   * mais aucun message ne part : l'administrateur attendrait indéfiniment.
   * L'écran doit le dire, sinon la panne est silencieuse.
   */
  it('avertit quand aucun service d’e-mail n’est configuré', () => {
    const warning = dumpNoticeWarning(dump({ noticeStatus: 'NOT_CONFIGURED' }));
    expect(warning).not.toBeNull();
    expect(warning).toContain('cloche');
  });

  it('avertit quand l’avis n’a pas pu partir', () => {
    expect(dumpNoticeWarning(dump({ noticeStatus: 'TRANSPORT_ERROR' }))).not.toBeNull();
    expect(dumpNoticeWarning(dump({ noticeStatus: 'FAILED' }))).not.toBeNull();
  });

  /**
   * Contre-épreuve : un e-mail parti n'a pas à occuper une ligne à l'écran.
   * Sans elle, une fonction qui avertirait TOUJOURS passerait les tests
   * ci-dessus, et l'avertissement perdrait tout sens.
   */
  it('ne dit rien quand l’avis est parti', () => {
    expect(dumpNoticeWarning(dump({ noticeStatus: 'SENT' }))).toBeNull();
    expect(dumpNoticeWarning(dump({ noticeStatus: null }))).toBeNull();
    expect(dumpNoticeWarning(undefined)).toBeNull();
  });
});

describe('téléchargement', () => {
  /**
   * L'URL ne porte AUCUN paramètre : le fichier servi est celui de l'export
   * courant, nommé par la base. Rien de ce que le navigateur envoie n'entre
   * dans un chemin côté serveur.
   */
  it('vise une route sans paramètre', () => {
    expect(DATABASE_DUMP_DOWNLOAD_URL).toBe('/api/v1/admin/database-dump/download');
    expect(DATABASE_DUMP_DOWNLOAD_URL).not.toContain('?');
  });

  it('propose un nom de fichier daté et compressé', () => {
    expect(databaseDumpFileName(new Date('2026-08-15T10:00:00.000Z'))).toBe(
      'cpi-base-2026-08-15.sql.gz',
    );
  });
});

describe('formatDumpSize', () => {
  it('exprime les petites archives en kilo-octets', () => {
    expect(formatDumpSize(2_048)).toBe('2 Ko');
  });

  it('exprime les grandes archives en méga-octets', () => {
    expect(formatDumpSize(5 * 1_024 * 1_024)).toBe('5.0 Mo');
  });

  it('ne rend rien quand la taille est inconnue', () => {
    expect(formatDumpSize(null)).toBe('');
  });
});
