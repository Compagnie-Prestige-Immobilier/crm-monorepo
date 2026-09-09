const DAKAR_TIME_ZONE = 'Africa/Dakar';

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: DAKAR_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

type Field = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

export function dakarWallClock(date: Date): Record<Field, number> {
  const found = {} as Record<Field, number>;
  for (const part of PARTS.formatToParts(date)) {
    if (part.type !== 'literal') found[part.type as Field] = Number(part.value);
  }
  return found;
}

function dakarOffsetMs(instant: Date): number {
  const { year, month, day, hour, minute, second } = dakarWallClock(instant);
  const wallSeconds = Date.UTC(year, month - 1, day, hour, minute, second);
  const instantSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return wallSeconds - instantSeconds;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function fromDakarWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  return new Date(guess - dakarOffsetMs(new Date(guess)));
}

export function inclusiveDateFrom(iso: string): Date {
  const match = DATE_ONLY.exec(iso);
  if (!match) return new Date(iso);
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return fromDakarWallClock(year, month, day, 0, 0, 0, 0);
}

export function inclusiveDateTo(iso: string): Date {
  const match = DATE_ONLY.exec(iso);
  if (!match) return new Date(iso);
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return fromDakarWallClock(year, month, day, 23, 59, 59, 999);
}
