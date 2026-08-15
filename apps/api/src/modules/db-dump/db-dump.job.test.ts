import { describe, expect, it } from 'vitest';

import {
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

  /**
   * LE test de l'échéance. Sans lui, un fichier contenant la base entière
   * resterait servi indéfiniment sur la seule foi de l'état enregistré : rien
   * dans la ligne ne change au passage de l'échéance, c'est l'horloge qui
   * bouge.
   */
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

  /**
   * Un `running` que plus rien ne fera avancer BLOQUERAIT toute nouvelle
   * demande, puisqu'une seule est autorisée à la fois. C'est le scénario du
   * redéploiement en plein export : sans cette borne, le bouton reste muet
   * jusqu'à ce que quelqu'un édite la base à la main.
   */
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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LE TEST QUI REMPLACE UNE ASSERTION FAUSSE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Ce fichier ÉPINGLAIT le contraire : « ne touche pas à queued », dans la
   * même phrase que `failed` et `expired`, comme si les trois étaient des états
   * finaux. `queued` n'en est pas un, c'est le plus fugace de tous, et le
   * laisser passer à travers la borne rendait la panne DÉFINITIVE.
   *
   * Un conteneur qui meurt entre l'écriture de `queued` et celle de `running`
   * laissait une ligne que rien ne faisait vieillir. `isInFlight('queued')`
   * étant vrai, toute demande ultérieure rendait ce fantôme au lieu de démarrer
   * un export, pour toujours, sans aucune route pour réarmer. Le test précédent
   * faisait passer ce trou pour une décision.
   */
  it('enterre un « queued » plus vieux que la durée maximale', () => {
    const requestedAt = new Date(NOW.getTime() - DUMP_MAX_RUNTIME_MS - 1_000).toISOString();
    expect(effectiveStatus(job({ status: 'queued', startedAt: null, requestedAt }), NOW)).toBe(
      'failed',
    );
  });

  /**
   * Un `ready` sans échéance ne doit pas être réputé éternel par accident,
   * mais il ne doit pas non plus disparaître : le service en écrit toujours
   * une, et l'absence signale une ligne d'une version antérieure.
   */
  it('laisse « ready » un export sans échéance enregistrée', () => {
    expect(effectiveStatus(job({ status: 'ready', expiresAt: null }), NOW)).toBe('ready');
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
  /**
   * Le chiffre est un arbitrage, documenté dans `db-dump.job.ts` : assez long
   * pour couvrir une demi-journée de bureau, assez court pour ne jamais
   * traverser la nuit, où passent les instantanés de volume.
   */
  it('vaut six heures, sous une journée', () => {
    expect(DUMP_TTL_MS).toBe(6 * 60 * 60 * 1_000);
    expect(DUMP_TTL_MS).toBeLessThan(24 * 60 * 60 * 1_000);
  });
});

describe('dumpFileName', () => {
  /**
   * Le nom ne prend RIEN de la requête. La route de téléchargement ne porte
   * aucun paramètre, et ce nom-là est la seule chose qui touche au système de
   * fichiers.
   */
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

  /**
   * Un mot de passe contenant `@`, `/` ou `#` est OBLIGATOIREMENT
   * percent-encodé dans une URI. Le transmettre encodé à libpq fait échouer
   * l'authentification avec un message qui ne dit jamais pourquoi.
   */
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

  /**
   * `?schema=public` est une convention PRISMA. La traduire en `--schema` ou
   * en variable libpq restreindrait l'export à UN schéma, alors que la demande
   * porte sur la base entière : l'utilisateur croirait tenir une copie
   * complète et n'en aurait qu'une partie.
   */
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

  /** `sslmode`, lui, EST un paramètre libpq : une base gérée le réclame. */
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
