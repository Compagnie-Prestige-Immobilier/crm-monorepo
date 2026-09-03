import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { WorkShiftsService } from './work-shifts.service.js';

function serviceWith(value?: string) {
  const upsert = vi.fn().mockResolvedValue({ updatedAt: new Date('2026-09-03T12:00:00Z') });
  const prisma = {
    appSetting: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          value === undefined ? null : { value, updatedAt: new Date('2026-09-03T10:00:00Z') },
        ),
      upsert,
    },
  };
  return { service: new WorkShiftsService(prisma as unknown as PrismaService), upsert };
}

describe('créneaux de supervision', () => {
  it('utilise 09h-14h et 15h-18h sans réglage', async () => {
    const { service } = serviceWith();
    expect((await service.get()).shifts).toEqual([
      { key: 'morning', label: 'Matin', start: '09:00', end: '14:00' },
      { key: 'afternoon', label: 'Après-midi', start: '15:00', end: '18:00' },
    ]);
  });

  it('refuse les créneaux qui se chevauchent', async () => {
    const { service, upsert } = serviceWith();
    await expect(
      service.update('usr-1', {
        morningStart: '09:00',
        morningEnd: '15:30',
        afternoonStart: '15:00',
        afternoonEnd: '18:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('remplace un réglage corrompu par les horaires par défaut', async () => {
    const { service } = serviceWith(
      JSON.stringify({
        shifts: [
          { key: 'morning', label: 'Matin', start: '99:00', end: '14:00' },
          { key: 'afternoon', label: 'Après-midi', start: '15:00', end: '18:00' },
        ],
      }),
    );
    expect((await service.get()).shifts[0]?.start).toBe('09:00');
  });
});
