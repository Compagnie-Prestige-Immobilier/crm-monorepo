import { format, parseISO } from 'date-fns';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * L'heure métier est celle de DAKAR, jamais celle du navigateur.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `Africa/Dakar` est à UTC+00:00 toute l'année : le Sénégal n'observe pas
 * l'heure d'été. Le décalage est donc une CONSTANTE, et c'est ce qui rend la
 * conversion ci-dessous sûre à écrire à la main plutôt que par une bibliothèque
 * de fuseaux.
 *
 * L'entrée `<input type="datetime-local">` rend une chaîne SANS fuseau
 * (`2026-08-20T09:00`). Passée à `new Date()`, elle est interprétée dans le
 * fuseau du POSTE. Un administrateur en déplacement à Paris (UTC+2 l'été) qui
 * programme un envoi « à 9 h » l'envoyait donc à 7 h, heure de Dakar : deux
 * heures avant l'ouverture des bureaux, à quatre cents personnes, et rien à
 * l'écran ne le disait. On rend le décalage EXPLICITE.
 */
export const DAKAR_UTC_OFFSET = '+00:00';

/**
 * `2026-08-20T09:00` (saisi à Dakar) → `2026-08-20T09:00:00.000Z`.
 *
 * Rend `null` si la chaîne n'a pas la forme attendue : l'appelant décide alors
 * quoi faire, plutôt que de recevoir une `Invalid Date` qui traversera le
 * réseau.
 */
export function dakarLocalToIso(local: string): string | null {
  const trimmed = local.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/u.test(trimmed)) return null;
  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const parsed = new Date(`${withSeconds}${DAKAR_UTC_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Récapitulatif d'un envoi programmé, DANS le fuseau métier et en le disant.
 *
 * Le fuseau est écrit en toutes lettres, pas déduit : c'est la seule ligne que
 * lit l'administrateur avant d'engager un envoi à quatre cents personnes, et
 * « 09:00 » sans mention de fuseau ne veut rien dire pour quelqu'un qui n'est
 * pas à Dakar ce jour-là. Les lecteurs `getUTC*` donnent l'heure de Dakar
 * exactement, `Africa/Dakar` étant à UTC+00:00 toute l'année.
 */
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

/**
 * Un TAUX, sans signe : `43.2` → « 43,2 % », `100` → « 100 % ».
 *
 * Distinct de `formatPercent`, qui préfixe un `+` : une variation se signe, une
 * part ne se signe pas. « +43,2 % de l'étape précédente » se lirait comme une
 * hausse là où le chiffre décrit une proportion.
 *
 * La décimale tombe sur un entier : « 100,0 % » ajoute un chiffre qui ne porte
 * aucune information et rallonge une colonne déjà serrée.
 */
export function formatRate(value: number): string {
  return `${Number.isInteger(value) ? formatNumber(value) : formatDecimal(value)} %`;
}

/**
 * Le même taux, quand le dénominateur peut être VIDE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `null` ne se replie pas sur `0 %`, et c'est tout l'intérêt.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'API rend `null` là où aucune observation n'existe, précisément pour que le
 * panel ne confonde pas deux situations opposées : « 0 % de numéros
 * inexploitables », qui est un excellent résultat, et « aucun appel passé », qui
 * n'en est pas un. Un `?? 0` les rendrait indistinguables dans la colonne, et
 * la colonne est justement ce sur quoi on décide.
 *
 * « Sans objet » plutôt qu'un tiret : un tiret dans une colonne de chiffres se
 * lit comme un zéro mal aligné, ou comme un défaut d'affichage.
 */
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

/**
 * Présentation d'un E.164 sénégalais : `+221771234567` → `+221 77 123 45 67`.
 * Le stockage reste strictement E.164 ; ce découpage est cosmétique et ne sert
 * jamais de clé.
 */
export function formatPhone(e164: string): string {
  const match = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  if (match === null) return e164;
  return `+221 ${match[1] ?? ''} ${match[2] ?? ''} ${match[3] ?? ''} ${match[4] ?? ''}`;
}

/** Initiales pour les avatars : deux lettres maximum, jamais d'emoji (§8). */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Libellé d'une valeur de référentiel désactivée.
 *
 * Désactiver une banque ne supprime AUCUN prospect : les fiches gardent leur
 * référence. Sans marque visible, l'administrateur croirait la donnée perdue -
 * ou pire, croirait la banque encore proposée à la saisie mobile.
 */
export function withRetired(label: string, isActive: boolean): string {
  return isActive ? label : `${label} ${RETIRED_SUFFIX}`;
}
