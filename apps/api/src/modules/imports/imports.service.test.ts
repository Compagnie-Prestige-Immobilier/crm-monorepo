import { ConflictException, NotFoundException } from '@nestjs/common';
import { ImportMode, ImportStatus } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { fakeJob, FakeImportPrisma } from './fake-import-prisma.js';
import type { ImportFileStore, StoredImportFile } from './import-file.store.js';
import type { ImportRunnerService } from './import-runner.service.js';
import { ImportsService } from './imports.service.js';

class FakeFileStore implements ImportFileStore {
  removed: string[] = [];
  failOnRemove = false;

  save(): Promise<StoredImportFile> {
    return Promise.reject(new Error('non utilisé dans ces cas'));
  }

  remove(storagePath: string): Promise<void> {
    this.removed.push(storagePath);
    if (this.failOnRemove) return Promise.reject(new Error('volume indisponible'));
    return Promise.resolve();
  }
}

const idleRunner = {
  run: () => Promise.resolve({ result: 'busy' as const }),
} as unknown as ImportRunnerService;

const NOW = new Date('2026-08-16T10:00:00.000Z');

describe('service d’import', () => {
  let prisma: FakeImportPrisma;
  let files: FakeFileStore;
  let service: ImportsService;

  beforeEach(() => {
    prisma = new FakeImportPrisma();
    files = new FakeFileStore();
    service = new ImportsService(prisma as unknown as PrismaService, idleRunner, files);
  });

  describe('application d’une simulation', () => {
    it('remet le MÊME travail en file, compteurs et rapport remis à plat', async () => {
      prisma.jobs.push(
        fakeJob({
          status: ImportStatus.succeeded,
          mode: ImportMode.DRY_RUN,
          processedRows: 40,
          createdRows: 38,
          skippedRows: 2,
          errorRows: 5,
          claimToken: 'jeton-de-la-simulation',
          claimedAt: NOW,
          report: { errors: [] },
        }),
      );

      const dto = await service.apply('job-1', NOW);

      expect(dto.mode).toBe(ImportMode.APPLY);
      expect(dto.status).toBe(ImportStatus.queued);
      expect(dto.processedRows).toBe(0);
      expect(dto.createdRows).toBe(0);
      expect(dto.errorRows).toBe(0);
      expect(prisma.jobs[0]?.claimToken).toBeNull();
      expect(prisma.jobs).toHaveLength(1);
    });

    it('refuse d’appliquer deux fois', async () => {
      prisma.jobs.push(fakeJob({ status: ImportStatus.succeeded, mode: ImportMode.APPLY }));

      await expect(service.apply('job-1', NOW)).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuse d’appliquer une simulation qui court encore', async () => {
      prisma.jobs.push(fakeJob({ status: ImportStatus.running, mode: ImportMode.DRY_RUN }));

      await expect(service.apply('job-1', NOW)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.jobs[0]?.status).toBe(ImportStatus.running);
    });

    it('refuse d’appliquer une simulation échue : son classeur n’existe plus', async () => {
      const job = fakeJob({ status: ImportStatus.succeeded, mode: ImportMode.DRY_RUN });
      job.expiresAt = new Date(NOW.getTime() - 1_000);
      prisma.jobs.push(job);

      await expect(service.apply('job-1', NOW)).rejects.toBeInstanceOf(ConflictException);
    });

    it('dit « introuvable » plutôt que « conflit » quand le travail n’existe pas', async () => {
      await expect(service.apply('absent', NOW)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pagination', () => {
    it('ne perd ni ne répète une ligne quand deux travaux partagent leur date', async () => {
      const meme = new Date('2026-08-16T09:00:00.000Z');
      prisma.jobs.push(
        fakeJob({ id: 'job-a', createdAt: meme }),
        fakeJob({ id: 'job-b', createdAt: meme }),
      );

      const premiere = await service.list({ page: 1, pageSize: 1 });
      const seconde = await service.list({ page: 2, pageSize: 1 });

      const vus = [...premiere.items, ...seconde.items].map((item) => item.id);
      expect(new Set(vus).size).toBe(2);
      expect(vus).toEqual(['job-b', 'job-a']);
    });
  });

  describe('reprise d’une application échouée', () => {
    const failedApply = () =>
      fakeJob({
        status: ImportStatus.failed,
        mode: ImportMode.APPLY,
        processedRows: 30_000,
        createdRows: 29_998,
        skippedRows: 2,
        errorRows: 4,
        failureCode: 'IMPORT_FAILED',
        claimToken: 'jeton-du-mort',
        claimedAt: NOW,
      });

    it('remet le travail en file EN GARDANT la position déjà écrite', async () => {
      prisma.jobs.push(failedApply());

      const dto = await service.apply('job-1', NOW);

      expect(dto.status).toBe(ImportStatus.queued);
      expect(dto.processedRows).toBe(30_000);
      expect(dto.createdRows).toBe(29_998);
      expect(dto.failureCode).toBeNull();
      expect(prisma.jobs[0]?.claimToken).toBeNull();
    });

    it('ne reprend pas un travail dont le classeur a expiré', async () => {
      const job = failedApply();
      job.expiresAt = new Date(NOW.getTime() - 1_000);
      prisma.jobs.push(job);

      await expect(service.apply('job-1', NOW)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.jobs[0]?.status).toBe(ImportStatus.failed);
    });

    it('ne reprend pas une simulation échouée : elle n’a rien écrit, on la redépose', async () => {
      prisma.jobs.push(
        fakeJob({ status: ImportStatus.failed, mode: ImportMode.DRY_RUN, processedRows: 12 }),
      );

      await expect(service.apply('job-1', NOW)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('échéance', () => {
    it('détruit le classeur, clôt le travail et RELÂCHE le jeton', async () => {
      const job = fakeJob({ status: ImportStatus.running, claimToken: 'jeton-en-cours' });
      job.expiresAt = new Date(NOW.getTime() - 1_000);
      prisma.jobs.push(job);

      const closed = await service.expireDue(NOW);

      expect(closed).toBe(1);
      expect(files.removed).toEqual(['/tmp/imports/job-1.xlsx']);
      expect(prisma.jobs[0]?.status).toBe(ImportStatus.expired);
      expect(prisma.jobs[0]?.claimToken).toBeNull();
    });

    it('marque la ligne AVANT de détruire le classeur', async () => {
      const job = fakeJob({ status: ImportStatus.running });
      job.expiresAt = new Date(NOW.getTime() - 1_000);
      prisma.jobs.push(job);
      files.failOnRemove = true;

      await expect(service.expireDue(NOW)).rejects.toThrow('volume indisponible');

      expect(prisma.jobs[0]?.status).toBe(ImportStatus.expired);
    });

    it('ne touche pas à un travail encore valide', async () => {
      prisma.jobs.push(fakeJob({ status: ImportStatus.succeeded }));

      expect(await service.expireDue(NOW)).toBe(0);
      expect(files.removed).toEqual([]);
    });

    it('n’expire pas deux fois le même travail', async () => {
      const job = fakeJob({ status: ImportStatus.expired });
      job.expiresAt = new Date(NOW.getTime() - 1_000);
      prisma.jobs.push(job);

      expect(await service.expireDue(NOW)).toBe(0);
    });
  });
});
