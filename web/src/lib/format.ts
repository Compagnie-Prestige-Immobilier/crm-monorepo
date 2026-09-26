import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

const DAKAR_UTC_OFFSET = '+00:00';

export function dakarLocalToIso(local: string): string | null {
  const trimmed = local.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/u.test(trimmed)) return null;
  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const parsed = new Date(`${withSeconds}${DAKAR_UTC_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function formatDakarDateTime(local: string): string | null {
  const iso = dakarLocalToIso(local);
  if (iso === null) return null;

  const at = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(at.getUTCDate())}/${pad(at.getUTCMonth() + 1)}/${String(at.getUTCFullYear())} à ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} (heure de Dakar)`;
}

import { RETIRED_SUFFIX } from '@/lib/types';

const numberFormatter = new Intl.NumberFormat('fr-SN');
const decimalFormatter = new Intl.NumberFormat('fr-SN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatDecimal(value: number): string {
  return decimalFormatter.format(value);
}

export function formatRate(value: number): string {
  return `${Number.isInteger(value) ? formatNumber(value) : formatDecimal(value)} %`;
}

export function formatRateOrNone(value: number | null): string {
  return value === null ? 'Sans objet' : formatRate(value);
}

const DAKAR = 'Africa/Dakar';
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: DAKAR,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: DAKAR,
  day: '2-digit',
  month: 'short',
});
const clockFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: DAKAR,
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  const at = new Date(iso);
  return `${dateFormatter.format(at)} à ${clockFormatter.format(at)}`;
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

/** `jour` : minuit du poste au jour calendaire de Dakar (UTC+0 toute l'année), pour date-fns. */
export function reperesDakar(iso: string): { jour: Date; heure: string } {
  const at = new Date(iso);
  return {
    jour: new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
    heure: String(at.getUTCHours()).padStart(2, '0'),
  };
}

const DEVICE_CALL_LABELS: Record<string, string> = {
  sortant: 'Sortant',
  entrant: 'Entrant',
  manque: 'Manqué',
  rejete: 'Rejeté',
  bloque: 'Bloqué',
  messagerie: 'Messagerie',
  externe: 'Externe',
  inconnu: 'Inconnu',
};

function formatCallDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const reste = seconds % 60;
  if (minutes === 0) return `${formatNumber(reste)} s`;
  return `${formatNumber(minutes)} min ${String(reste).padStart(2, '0')}`;
}

/** Une ligne du journal d'appels : nature, durée, heure. */
export function formatDetectedCall(call: {
  deviceCallType?: string | null;
  deviceCallDurationSeconds?: number | null;
  deviceCallAt: string;
}): string {
  const duree = call.deviceCallDurationSeconds ?? null;
  const parts = [DEVICE_CALL_LABELS[call.deviceCallType ?? ''] ?? 'Inconnu'];
  if (duree !== null) parts.push(formatCallDuration(duree));
  parts.push(clockFormatter.format(new Date(call.deviceCallAt)));
  return parts.join(' · ');
}

/**
 * Ce que le journal d'appels du téléphone Android dit d'une tentative. Sans
 * `deviceCallAt`, l'appel n'est que déclaré : aucune trace ne l'atteste.
 */
export function formatDeviceCall(attempt: {
  deviceCallType?: string | null;
  deviceCallDurationSeconds?: number | null;
  deviceCallAt?: string | null;
}): string {
  const at = attempt.deviceCallAt ?? null;
  if (at === null) return 'Téléphone : non confirmé';
  return `Téléphone : ${formatDetectedCall({ ...attempt, deviceCallAt: at })}`;
}

/** Un lead venu d’un réseau social n’a parfois que son nom : le libellé dit laquelle des absences c’est. */
export const SANS_NUMERO = 'Sans numéro';

export function formatPhone(e164: string | null | undefined): string {
  if (e164 === null || e164 === undefined || e164 === '') return SANS_NUMERO;
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function withRetired(label: string, isActive: boolean): string {
  return isActive ? label : `${label} ${RETIRED_SUFFIX}`;
}
