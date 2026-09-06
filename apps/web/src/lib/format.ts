import { format, parseISO } from 'date-fns';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export const DAKAR_UTC_OFFSET = '+00:00';

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
import { fr } from 'date-fns/locale';

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

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${decimalFormatter.format(value)} %`;
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd MMM yyyy', { locale: fr });
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "dd MMM yyyy 'à' HH:mm", { locale: fr });
}

export function formatShortDate(iso: string): string {
  return format(parseISO(iso), 'dd MMM', { locale: fr });
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
  parts.push(format(parseISO(call.deviceCallAt), 'HH:mm', { locale: fr }));
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

export function formatPhone(e164: string): string {
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
