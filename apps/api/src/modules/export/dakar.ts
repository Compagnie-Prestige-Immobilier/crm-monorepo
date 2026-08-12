/**
 * Horodatages du classeur, exprimés à l'heure de Dakar.
 *
 * Une cellule date d'Excel est un NOMBRE de jours depuis 1900 : le format ne
 * transporte aucun fuseau. Le tableur affiche donc littéralement ce qu'on y a
 * écrit, et exceljs convertit un `Date` JavaScript en sérialisant son instant
 * UTC. Écrire l'objet brut revient donc à publier des heures UTC — un appel
 * passé à 23 h 30 à Dakar apparaîtrait daté du lendemain dès que le fuseau du
 * serveur s'en écarterait.
 *
 * On réécrit donc chaque date sur son heure MURALE à Dakar avant de la
 * confier au classeur. Le décalage est aujourd'hui nul, ce qui rend la
 * transformation invisible ; elle reste néanmoins nécessaire, parce que rien
 * dans le code n'impose que le serveur tourne à l'heure de Dakar — un
 * conteneur déployé ailleurs, ou une base configurée sur un autre fuseau,
 * produirait sans elle un fichier décalé sans le moindre avertissement.
 */

export const DAKAR_TIME_ZONE = 'Africa/Dakar';

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

/**
 * Date à écrire dans une cellule Excel.
 *
 * Le résultat reste un vrai `Date`, donc une vraie cellule date : Excel sait la
 * trier, la filtrer et la soustraire. Une chaîne formatée perdrait tout cela,
 * et l'équipe commerciale trie précisément sur ces colonnes.
 */
export function toDakarCell(date: Date): Date {
  const { year, month, day, hour, minute, second } = wallClock(date);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

/** Même heure murale, en texte — pour les noms de fichiers et les libellés. */
export function formatDakarDate(date: Date): string {
  const { year, month, day } = wallClock(date);
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
