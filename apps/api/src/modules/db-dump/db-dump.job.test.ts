import { describe, expect, it } from 'vitest';

import {
  DUMP_CLOCK_SKEW_TOLERANCE_MS,
  DUMP_MAX_RUNTIME_MS,
  DUMP_TTL_MS,
  dumpFileName,
  effectiveStatus,
  isInFlight,
  type DumpJob,
} from './db-dump.job.js';
import { InvalidDatabaseUrlError, pgEnvironmentFrom } from './pg-connection.js';

const NOW = new Date('2026-08-15T10:00:00.000Z');

const job = (overrides: Partial<DumpJob>): DumpJob => ({
  id: 'job-1',
  status: 'ready',
  requestedById: 'adm-1',
  requestedByName: 'Admin CPI',
  requestedAt: '2026-08-15T09:00:00.000Z',
  startedAt: '2026-08-15T09:00:01.000Z',
  finishedAt: '2026-08-15T09:02:00.000Z',
  fileName: 'cpi-base-20260815T090200-job-1.sql.gz',
  fileSize: 1_024,
  sha256: 'a'.repeat(64),
  expiresAt: null,
  reservedAt: null,
  downloadedAt: null,
  failureReason: null,
  noticeStatus: 'SENT',
  noticeDetail: null,
  ...overrides,
});

describe('effectiveStatus', () => {
  it('laisse un export prêt et non échu à « ready »', () => {
    const expiresAt = new Date(NOW.getTime() + 60_000).toISOString();
    expect(effectiveStatus(job({ status: 'ready', expiresAt }), NOW)).toBe('ready');
  });

  it('rend « expired » dès que l’échéance est passée, sans rien réécrire', () => {
    const expiresAt = new Date(NOW.getTime() - 1).toISOString();
    expect(effectiveStatus(job({ status: 'ready', expiresAt }), NOW)).toBe('expired');
  });

  it('traite l’échéance atteinte à la milliseconde près comme échue', () => {
    expect(effectiveStatus(job({ status: 'ready', expiresAt: NOW.toISOString() }), NOW)).toBe(
      'expired',
    );
  });

  it('laisse courir un export démarré il y a moins de la durée maximale', () => {
    const startedAt = new Date(NOW.getTime() - DUMP_MAX_RUNTIME_MS + 1_000).toISOString();
    expect(effectiveStatus(job({ status: 'running', startedAt }), NOW)).toBe('running');
  });

  it('enterre un export démarré depuis plus longtemps que la durée maximale', () => {
    const startedAt = new Date(NOW.getTime() - DUMP_MAX_RUNTIME_MS - 1_000).toISOString();
    expect(effectiveStatus(job({ status: 'running', startedAt }), NOW)).toBe('failed');
  });

  it('ne touche ni à « failed » ni à « expired », qui sont des états finaux', () => {
    expect(effectiveStatus(job({ status: 'failed' }), NOW)).toBe('failed');
    expect(effectiveStatus(job({ status: 'expired' }), NOW)).toBe('expired');
  });

  it('laisse « queued » un travail inscrit à l’instant', () => {
    const requestedAt = new Date(NOW.getTime() - 1_000).toISOString();
    expect(effectiveStatus(job({ status: 'queued', startedAt: null, requestedAt }), NOW)).toBe(
      'queued',
    );
  });

  it('enterre un « queued » plus vieux que la durée maximale', () => {
    const requestedAt = new Date(NOW.getTime() - DUMP_MAX_RUNTIME_MS - 1_000).toISOString();
    expect(effectiveStatus(job({ status: 'queued', startedAt: null, requestedAt }), NOW)).toBe(
      'failed',
    );
  });

  it('ÉCHOIT un export prêt dont l’échéance manque', () => {
    expect(effectiveStatus(job({ status: 'ready', expiresAt: null }), NOW)).toBe('expired');
  });

  it('ÉCHOIT un export prêt dont l’échéance est illisible', () => {
    expect(effectiveStatus(job({ status: 'ready', expiresAt: 'jamais' }), NOW)).toBe('expired');
  });

  it('laisse « ready » un export dont l’échéance est encore devant', () => {
    const expiresAt = new Date(NOW.getTime() + 60_000).toISOString();
    expect(effectiveStatus(job({ status: 'ready', expiresAt }), NOW)).toBe('ready');
  });

  it('enterre un « running » dont la date de démarrage est illisible', () => {
    expect(effectiveStatus(job({ status: 'running', startedAt: 'jamais' }), NOW)).toBe('failed');
  });

  it('enterre un « queued » dont la date de demande est illisible', () => {
    expect(
      effectiveStatus(job({ status: 'queued', startedAt: null, requestedAt: 'jamais' }), NOW),
    ).toBe('failed');
  });

  it('enterre un travail en cours daté au-delà de la tolérance dans le futur', () => {
    const startedAt = new Date(NOW.getTime() + DUMP_CLOCK_SKEW_TOLERANCE_MS + 1_000).toISOString();
    expect(effectiveStatus(job({ status: 'running', startedAt }), NOW)).toBe('failed');
  });

  it('laisse courir un travail que quelques secondes d’écart d’horloge mettent en avance', () => {
    const startedAt = new Date(NOW.getTime() + 2_000).toISOString();
    expect(effectiveStatus(job({ status: 'running', startedAt }), NOW)).toBe('running');
  });
});

describe('DUMP_CLOCK_SKEW_TOLERANCE_MS', () => {
  it('reste très en deçà de la borne d’exécution', () => {
    expect(DUMP_CLOCK_SKEW_TOLERANCE_MS).toBeGreaterThan(60_000);
    expect(DUMP_CLOCK_SKEW_TOLERANCE_MS).toBeLessThan(DUMP_MAX_RUNTIME_MS);
  });
});

describe('isInFlight', () => {
  it('ne considère en cours que « queued » et « running »', () => {
    expect(isInFlight('queued')).toBe(true);
    expect(isInFlight('running')).toBe(true);
    expect(isInFlight('ready')).toBe(false);
    expect(isInFlight('failed')).toBe(false);
    expect(isInFlight('expired')).toBe(false);
  });
});

describe('DUMP_TTL_MS', () => {
  it('vaut six heures, sous une journée', () => {
    expect(DUMP_TTL_MS).toBe(6 * 60 * 60 * 1_000);
    expect(DUMP_TTL_MS).toBeLessThan(24 * 60 * 60 * 1_000);
  });
});

describe('dumpFileName', () => {
  it('compose le nom depuis l’horodatage et l’identifiant du travail', () => {
    expect(dumpFileName('abc-123', new Date('2026-08-15T10:04:05.000Z'))).toBe(
      'cpi-base-20260815100405-abc-123.sql.gz',
    );
  });

  it('annonce une archive gzip', () => {
    expect(dumpFileName('x', NOW).endsWith('.sql.gz')).toBe(true);
  });
});

describe('pgEnvironmentFrom', () => {
  it('décompose une URL complète en variables libpq', () => {
    expect(pgEnvironmentFrom('postgresql://crm:secret@db.interne:5433/crm')).toEqual({
      PGHOST: 'db.interne',
      PGPORT: '5433',
      PGUSER: 'crm',
      PGPASSWORD: 'secret',
      PGDATABASE: 'crm',
    });
  });

  it('retombe sur 5432 quand le port est absent', () => {
    expect(pgEnvironmentFrom('postgresql://crm:secret@db/crm').PGPORT).toBe('5432');
  });

  it('décode un mot de passe percent-encodé', () => {
    expect(pgEnvironmentFrom('postgresql://crm:p%40ss%2Fw%23rd@db/crm').PGPASSWORD).toBe(
      'p@ss/w#rd',
    );
  });

  it('décode un nom de base percent-encodé', () => {
    expect(pgEnvironmentFrom('postgresql://crm:x@db/base%20de%20test').PGDATABASE).toBe(
      'base de test',
    );
  });

  it('ignore le paramètre schema de Prisma', () => {
    const env = pgEnvironmentFrom('postgresql://crm:x@db:5432/crm?schema=public');
    expect(env).toEqual({
      PGHOST: 'db',
      PGPORT: '5432',
      PGUSER: 'crm',
      PGPASSWORD: 'x',
      PGDATABASE: 'crm',
    });
  });

  it('reprend sslmode, qui est un vrai paramètre libpq', () => {
    expect(pgEnvironmentFrom('postgresql://crm:x@db/crm?sslmode=require').PGSSLMODE).toBe(
      'require',
    );
  });

  it('accepte aussi le schéma d’URL postgres://', () => {
    expect(pgEnvironmentFrom('postgres://crm:x@db/crm').PGDATABASE).toBe('crm');
  });

  it('refuse une URL qui n’est pas du PostgreSQL', () => {
    expect(() => pgEnvironmentFrom('mysql://crm:x@db/crm')).toThrow(InvalidDatabaseUrlError);
  });

  it('refuse une URL sans nom de base', () => {
    expect(() => pgEnvironmentFrom('postgresql://crm:x@db')).toThrow(InvalidDatabaseUrlError);
  });

  it('refuse une chaîne qui n’est pas une URL', () => {
    expect(() => pgEnvironmentFrom('pas une url')).toThrow(InvalidDatabaseUrlError);
  });
});
