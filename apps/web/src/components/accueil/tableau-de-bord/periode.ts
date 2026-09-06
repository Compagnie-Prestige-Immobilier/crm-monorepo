import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';

export type PeriodePreset =
  | 'aujourdhui'
  | 'hier'
  | 'avant-hier'
  | 'cette-semaine'
  | 'ce-mois'
  | 'mois-dernier'
  | 'trois-mois'
  | 'douze-mois'
  | 'cette-annee'
  | 'annee-derniere';

export type Comparaison = 'aucune' | 'precedente' | 'annee-precedente';

export interface Plage {
  du: string;
  au: string;
}

export const PLAGE_MAX_JOURS = 400;

export const PILLS: readonly { preset: PeriodePreset; label: string }[] = [
  { preset: 'aujourdhui', label: 'Aujourd’hui' },
  { preset: 'hier', label: 'Hier' },
  { preset: 'avant-hier', label: 'Avant-hier' },
  { preset: 'cette-semaine', label: 'Cette semaine' },
  { preset: 'ce-mois', label: 'Ce mois-ci' },
  { preset: 'mois-dernier', label: 'Mois dernier' },
  { preset: 'trois-mois', label: '3 derniers mois' },
  { preset: 'douze-mois', label: '12 derniers mois' },
  { preset: 'cette-annee', label: 'Cette année' },
  { preset: 'annee-derniere', label: 'Année dernière' },
];

const iso = (date: Date): string => format(date, 'yyyy-MM-dd');
const dateUtc = (jour: string): Date => new Date(`${jour}T00:00:00Z`);

export function plageDuPreset(preset: PeriodePreset, reference: Date): Plage {
  switch (preset) {
    case 'aujourdhui': {
      const jour = iso(reference);
      return { du: jour, au: jour };
    }
    case 'hier': {
      const jour = iso(subDays(reference, 1));
      return { du: jour, au: jour };
    }
    case 'avant-hier': {
      const jour = iso(subDays(reference, 2));
      return { du: jour, au: jour };
    }
    case 'cette-semaine':
      return {
        du: iso(startOfWeek(reference, { weekStartsOn: 1 })),
        au: iso(endOfWeek(reference, { weekStartsOn: 1 })),
      };
    case 'ce-mois':
      return { du: iso(startOfMonth(reference)), au: iso(endOfMonth(reference)) };
    case 'mois-dernier': {
      const mois = subMonths(reference, 1);
      return { du: iso(startOfMonth(mois)), au: iso(endOfMonth(mois)) };
    }
    case 'trois-mois':
      return { du: iso(startOfMonth(subMonths(reference, 2))), au: iso(endOfMonth(reference)) };
    case 'douze-mois':
      return { du: iso(startOfMonth(subMonths(reference, 11))), au: iso(endOfMonth(reference)) };
    case 'cette-annee':
      return { du: iso(startOfYear(reference)), au: iso(endOfYear(reference)) };
    case 'annee-derniere': {
      const annee = subYears(reference, 1);
      return { du: iso(startOfYear(annee)), au: iso(endOfYear(annee)) };
    }
  }
}

export function joursDansPlage(plage: Plage): number {
  return differenceInCalendarDays(dateUtc(plage.au), dateUtc(plage.du)) + 1;
}

export function plageTropLarge(plage: Plage): boolean {
  return joursDansPlage(plage) > PLAGE_MAX_JOURS;
}

export function plagePrecedente(plage: Plage): Plage {
  const jours = joursDansPlage(plage);
  const debut = dateUtc(plage.du);
  return { du: iso(subDays(debut, jours)), au: iso(subDays(debut, 1)) };
}

export function plageAnneePrecedente(plage: Plage): Plage {
  return { du: iso(subYears(dateUtc(plage.du), 1)), au: iso(subYears(dateUtc(plage.au), 1)) };
}

export function plageComparaison(plage: Plage, comparaison: Comparaison): Plage | null {
  if (comparaison === 'precedente') return plagePrecedente(plage);
  if (comparaison === 'annee-precedente') return plageAnneePrecedente(plage);
  return null;
}

export function libellePreset(preset: PeriodePreset): string {
  return PILLS.find((pill) => pill.preset === preset)?.label ?? preset;
}
