import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateWorkShiftsDto, WorkShiftsDto } from './supervision.dto.js';

export interface WorkShift {
  readonly key: 'morning' | 'afternoon';
  readonly label: string;
  readonly start: string;
  readonly end: string;
}

const SETTING_KEY = 'supervision.creneaux';
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_SHIFTS: readonly WorkShift[] = [
  { key: 'morning', label: 'Matin', start: '09:00', end: '14:00' },
  { key: 'afternoon', label: 'Après-midi', start: '15:00', end: '18:00' },
];

const minutes = (value: string): number => {
  const [hours = 0, mins = 0] = value.split(':').map(Number);
  return hours * 60 + mins;
};

function validated(shifts: readonly WorkShift[]): WorkShift[] {
  const [morning, afternoon] = shifts;
  if (
    morning === undefined ||
    afternoon === undefined ||
    minutes(morning.start) >= minutes(morning.end) ||
    minutes(afternoon.start) >= minutes(afternoon.end) ||
    minutes(morning.end) > minutes(afternoon.start)
  ) {
    throw new BadRequestException({
      code: 'INVALID_WORK_SHIFTS',
      message: 'Les créneaux doivent être ordonnés, sans chevauchement.',
    });
  }
  return [morning, afternoon];
}

function parse(value: string | undefined): WorkShift[] {
  if (value === undefined) return [...DEFAULT_SHIFTS];
  try {
    const raw = JSON.parse(value) as Partial<WorkShiftsDto>;
    if (!Array.isArray(raw.shifts) || raw.shifts.length !== 2) return [...DEFAULT_SHIFTS];
    const shifts = raw.shifts;
    if (
      shifts[0]?.key !== 'morning' ||
      shifts[1]?.key !== 'afternoon' ||
      !shifts.every(
        (shift) =>
          typeof shift.label === 'string' &&
          TIME_PATTERN.test(shift.start) &&
          TIME_PATTERN.test(shift.end),
      )
    ) {
      return [...DEFAULT_SHIFTS];
    }
    return validated(shifts as WorkShift[]);
  } catch {
    return [...DEFAULT_SHIFTS];
  }
}

@Injectable()
export class WorkShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<WorkShiftsDto> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    return { shifts: parse(setting?.value), updatedAt: setting?.updatedAt.toISOString() ?? null };
  }

  async update(actorId: string, body: UpdateWorkShiftsDto): Promise<WorkShiftsDto> {
    const shifts = validated([
      { key: 'morning', label: 'Matin', start: body.morningStart, end: body.morningEnd },
      {
        key: 'afternoon',
        label: 'Après-midi',
        start: body.afternoonStart,
        end: body.afternoonEnd,
      },
    ]);
    const row = await this.prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: JSON.stringify({ shifts }), updatedById: actorId },
      update: { value: JSON.stringify({ shifts }), updatedById: actorId },
    });
    return { shifts, updatedAt: row.updatedAt.toISOString() };
  }
}
