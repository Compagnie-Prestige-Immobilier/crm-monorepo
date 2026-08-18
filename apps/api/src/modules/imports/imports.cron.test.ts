import { ImportStatus } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { fakeJob, FakeImportPrisma } from './fake-import-prisma.js';
import type { ImportRunOutcome, ImportRunnerService } from './import-runner.service.js';
import { ImportsCron } from './imports.cron.js';
import { IMPORT_LEASE_MS } from './imports.job.js';
import type { ImportsService } from './imports.service.js';

const NOW = new Date('2026-08-16T10:00:00.000Z');

class RecordingRunner {
  readonly ran: string[] = [];

  run(jobId: string): Promise<ImportRunOutcome> {
    this.ran.push(jobId);
    return Promise.resolve({ result: 'succeeded', created: 0, processed: 0 });
  }
}

const idleExpiry = { expireDue: () => Promise.resolve(0) } as unknown as ImportsService;

describe('balayage des imports', () => {
  let prisma: FakeImportPrisma;
  let runner: RecordingRunner;
  let cron: ImportsCron;

  beforeEach(() => {
    prisma = new FakeImportPrisma();
    runner = new RecordingRunner();
    cron = new ImportsCron(
      prisma as unknown as PrismaService,
      runner as unknown as ImportRunnerService,
      idleExpiry,
    );
  });

  it('démarre un travail qui attend', async () => {
    prisma.jobs.push(fakeJob({ id: 'neuf', status: ImportStatus.queued, claimedAt: null }));

    await cron.sweep(NOW);

    expect(runner.ran).toEqual(['neuf']);
  });

  it('ranime un travail EN COURS dont le bail a expiré', async () => {
    prisma.jobs.push(
      fakeJob({
        id: 'mort',
        status: ImportStatus.running,
        claimToken: 'jeton-du-mort',
        claimedAt: new Date(NOW.getTime() - IMPORT_LEASE_MS - 60_000),
      }),
    );

    await cron.sweep(NOW);

    expect(runner.ran).toEqual(['mort']);
  });

  it('ranime aussi un QUEUED déjà revendiqué dont le bail a expiré', async () => {
    prisma.jobs.push(
      fakeJob({
        id: 'queued-mort',
        status: ImportStatus.queued,
        claimToken: 'jeton-du-mort',
        claimedAt: new Date(NOW.getTime() - IMPORT_LEASE_MS - 1_000),
      }),
    );

    await cron.sweep(NOW);

    expect(runner.ran).toEqual(['queued-mort']);
  });

  it('ne touche pas à un travail dont le bail court encore', async () => {
    prisma.jobs.push(
      fakeJob({
        id: 'vivant',
        status: ImportStatus.running,
        claimToken: 'jeton-vivant',
        claimedAt: new Date(NOW.getTime() - 60_000),
      }),
    );

    await cron.sweep(NOW);

    expect(runner.ran).toEqual([]);
  });

  it('ignore les travaux terminés, quelle que soit leur ancienneté', async () => {
    for (const status of [ImportStatus.succeeded, ImportStatus.failed, ImportStatus.expired]) {
      prisma.jobs.push(
        fakeJob({ id: `fini-${status}`, status, claimedAt: new Date(NOW.getTime() - 86_400_000) }),
      );
    }

    await cron.sweep(NOW);

    expect(runner.ran).toEqual([]);
  });

  it('ne ranime pas un travail échu : son classeur n’existe plus', async () => {
    const echu = fakeJob({ id: 'echu', status: ImportStatus.queued });
    echu.expiresAt = new Date(NOW.getTime() - 1_000);
    prisma.jobs.push(echu);

    await cron.sweep(NOW);

    expect(runner.ran).toEqual([]);
  });

  it('sert le plus ancien d’abord, et pas plus de trois par passage', async () => {
    for (let index = 0; index < 5; index += 1) {
      const job = fakeJob({ id: `job-${String(index)}`, status: ImportStatus.queued });
      job.createdAt = new Date(NOW.getTime() - (index % 2 === 0 ? 10 - index : index) * 60_000);
      prisma.jobs.push(job);
    }

    await cron.sweep(NOW);

    expect(runner.ran).toEqual(['job-0', 'job-2', 'job-4']);
  });
});
