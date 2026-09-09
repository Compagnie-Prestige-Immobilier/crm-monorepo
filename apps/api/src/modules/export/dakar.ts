// Une cellule date Excel ne transporte aucun fuseau et exceljs y serialise l'instant UTC :
// sans reecriture sur l'heure murale de Dakar, un serveur hors fuseau decale tout le classeur.

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

function wallClock(date: Date): Record<Field, number> {
  const found = {} as Record<Field, number>;
  for (const part of PARTS.formatToParts(date)) {
    if (part.type !== 'literal') found[part.type as Field] = Number(part.value);
  }
  return found;
}

/** Rend un vrai `Date` : une chaine formatee ferait perdre le tri et le filtre d'Excel. */
export function toDakarCell(date: Date): Date {
  const { year, month, day, hour, minute, second } = wallClock(date);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

export function formatDakarDate(date: Date): string {
  const { year, month, day } = wallClock(date);
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
