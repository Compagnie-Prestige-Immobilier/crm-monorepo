import { format, parseISO } from 'date-fns';
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

/** Initiales pour les avatars — deux lettres maximum, jamais d'emoji (§8). */
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
 * référence. Sans marque visible, l'administrateur croirait la donnée perdue —
 * ou pire, croirait la banque encore proposée à la saisie mobile.
 */
export function withRetired(label: string, isActive: boolean): string {
  return isActive ? label : `${label} ${RETIRED_SUFFIX}`;
}
