const nombres = new Intl.NumberFormat('fr-SN');
const decimaux = new Intl.NumberFormat('fr-SN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const jourCourt = new Intl.DateTimeFormat('fr-SN', { day: '2-digit', month: 'short' });
const jourLong = new Intl.DateTimeFormat('fr-SN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const heure = new Intl.DateTimeFormat('fr-SN', { hour: '2-digit', minute: '2-digit' });

export function formatNumber(value: number): string {
  return nombres.format(value);
}

export function formatDecimal(value: number): string {
  return decimaux.format(value);
}

export function formatRate(value: number): string {
  return `${Number.isInteger(value) ? formatNumber(value) : formatDecimal(value)} %`;
}

export function formatRateOrNone(value: number | null): string {
  return value === null ? 'Sans objet' : formatRate(value);
}

export function formatDate(iso: string): string {
  return jourLong.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  const at = new Date(iso);
  return `${jourLong.format(at)} à ${heure.format(at)}`;
}

/** Un temps de traitement : sous la minute, les secondes suffisent. */
export function formatDuree(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = Math.round(secondes % 60);
  if (minutes === 0) return `${String(reste)} s`;
  return `${String(minutes)} min ${String(reste).padStart(2, '0')}`;
}

export function formatShortDate(iso: string): string {
  return jourCourt.format(new Date(iso));
}

/**
 * Un E.164 sénégalais se lit par groupes de deux après l'indicatif ; tout autre
 * pays reste tel quel plutôt que d'être mal découpé.
 */
export function formatPhone(e164: string): string {
  const senegal = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/u.exec(e164);
  if (senegal === null) return e164;
  return `+221 ${senegal[1] ?? ''} ${senegal[2] ?? ''} ${senegal[3] ?? ''} ${senegal[4] ?? ''}`;
}

/** Une somme en FCFA : le serveur rend une suite de chiffres, jamais un flottant. */
export function formatXof(digits: string): string {
  const propre = digits.trim().replace(/^0+(?=\d)/u, '');
  if (!/^\d{1,18}$/u.test(propre)) return `${digits} FCFA`;
  return `${formatNumber(Number(propre))} FCFA`;
}
