import type { components } from '@/api/schema';

type Activite = components['schemas']['ActiviteDesTeleconseillers'];
type LigneActivite = components['schemas']['LigneDActivite'];

const COMPTEURS = [
  'repCalls',
  'repConfirmedCalls',
  'repDetectedCalls',
  'repUnloggedCalls',
  'repReached',
  'repCallback',
  'repUnreachable',
  'repCallbacksHonored',
  'repCallbacksLate',
  'repCallbacksUpcoming',
  'repQuestioned',
  'repQualified',
  'repFiches',
  'repFichesJointes',
  'repFichesNonJointes',
  'repFichesAcceptees',
  'repFichesARappeler',
  'repFichesEligibles',
  'representantsContacted',
  'fiches',
  'fichesJointes',
  'calls',
  'confirmedCalls',
  'detectedCalls',
  'unloggedCalls',
  'methodObtained',
  'unreachable',
  'wrongNumber',
  'refused',
  'callback',
  'callbacksHonored',
  'callbacksLate',
  'callbacksUpcoming',
  'prospectsCreated',
] as const;

type CleCompteur = (typeof COMPTEURS)[number];

type CleTaux =
  | 'repContactRate'
  | 'repQualificationRate'
  | 'repReachabilityRate'
  | 'repAcceptanceRate'
  | 'ficheReachRate'
  | 'reachRate'
  | 'confirmRate'
  | 'repConfirmRate'
  | 'avgCallSeconds'
  | 'repAvgCallSeconds';

export type CleActivite = CleCompteur | CleTaux;

/**
 * `callSeconds` ne vient pas de l'API : c'est le numérateur reconstitué de la
 * durée moyenne. Sans lui, agréger plusieurs lignes moyennerait des moyennes.
 */
export type Compteurs = Record<CleCompteur, number> &
  Record<CleTaux, number | null> & { callSeconds: number; repCallSeconds: number };

export type Ligne = Compteurs & {
  id: string;
  name: string;
  isActive: boolean;
  hasActivity: boolean;
};

export type Totaux = Compteurs & { people: number };
export type TotauxParTranche = Compteurs & { bucket: string };

function taux(part: number, tout: number): number | null {
  return tout === 0 ? null : Math.round((part / tout) * 1000) / 10;
}

function moyenne(total: number, nombre: number): number | null {
  return nombre === 0 ? null : Math.round(total / nombre);
}

function compteursVides(): Compteurs {
  const zeros = Object.fromEntries(COMPTEURS.map((cle) => [cle, 0])) as Record<CleCompteur, number>;
  return {
    ...zeros,
    repContactRate: null,
    repQualificationRate: null,
    repReachabilityRate: null,
    repAcceptanceRate: null,
    ficheReachRate: null,
    reachRate: null,
    confirmRate: null,
    repConfirmRate: null,
    avgCallSeconds: null,
    repAvgCallSeconds: null,
    callSeconds: 0,
    repCallSeconds: 0,
  };
}

function cumuler(dans: Compteurs, ligne: LigneDActiviteBrute): void {
  for (const cle of COMPTEURS) dans[cle] += ligne[cle];
  dans.callSeconds += (ligne.avgCallSeconds ?? 0) * ligne.confirmedCalls;
  dans.repCallSeconds += (ligne.repAvgCallSeconds ?? 0) * ligne.repConfirmedCalls;
}

type LigneDActiviteBrute = LigneActivite;

function calculerTaux<T extends Compteurs>(c: T): T {
  c.reachRate = taux(c.calls - c.unreachable, c.calls);
  c.repContactRate = taux(c.repReached, c.repCalls);
  c.repQualificationRate = taux(c.repQualified, c.repQuestioned);
  c.repReachabilityRate = taux(c.repFichesJointes, c.repFiches);
  c.repAcceptanceRate = taux(c.repFichesAcceptees, c.repFichesEligibles);
  c.ficheReachRate = taux(c.fichesJointes, c.fiches);
  c.confirmRate = taux(c.confirmedCalls, c.calls);
  c.repConfirmRate = taux(c.repConfirmedCalls, c.repCalls);
  c.avgCallSeconds = moyenne(c.callSeconds, c.confirmedCalls);
  c.repAvgCallSeconds = moyenne(c.repCallSeconds, c.repConfirmedCalls);
  return c;
}

/**
 * `items` n'a de ligne que là où il s'est passé quelque chose : le croisement
 * avec `teleconseillers` fait apparaître les comptes à zéro acte.
 */
export function lignesActivite(data: Activite): Ligne[] {
  const lignes = new Map<string, Ligne>();
  const ligne = (id: string, name: string, isActive: boolean): Ligne => {
    const trouvee = lignes.get(id) ?? {
      ...compteursVides(),
      id,
      name,
      isActive,
      hasActivity: false,
    };
    lignes.set(id, trouvee);
    return trouvee;
  };

  for (const personne of data.teleconseillers ?? []) {
    ligne(personne.id, personne.fullName, personne.isActive);
  }
  for (const brute of data.items ?? []) {
    const trouvee = ligne(brute.teleconseillerId, brute.teleconseillerName, true);
    cumuler(trouvee, brute);
    trouvee.hasActivity = true;
  }

  return [...lignes.values()].map(calculerTaux);
}

export function totauxActivite(lignes: readonly Ligne[]): Totaux {
  const totaux: Totaux = { ...compteursVides(), people: lignes.length };
  for (const ligne of lignes) {
    for (const cle of COMPTEURS) totaux[cle] += ligne[cle];
    totaux.callSeconds += ligne.callSeconds;
    totaux.repCallSeconds += ligne.repCallSeconds;
  }
  return calculerTaux(totaux);
}

export function moyennesActivite(totaux: Totaux): Compteurs {
  const diviseur = totaux.people === 0 ? 1 : totaux.people;
  const moyennes = { ...totaux };
  for (const cle of COMPTEURS) moyennes[cle] = Math.round((totaux[cle] / diviseur) * 10) / 10;
  return moyennes;
}

export function totauxParTranche(brutes: readonly LigneActivite[]): TotauxParTranche[] {
  const tranches = new Map<string, TotauxParTranche>();
  for (const brute of brutes) {
    const tranche = tranches.get(brute.bucket) ?? { ...compteursVides(), bucket: brute.bucket };
    cumuler(tranche, brute);
    tranches.set(tranche.bucket, tranche);
  }
  return [...tranches.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).map(calculerTaux);
}

export type CleTri = 'name' | CleActivite;
export type SensTri = 'asc' | 'desc';

export function trierLignes(lignes: readonly Ligne[], cle: CleTri, sens: SensTri): Ligne[] {
  const signe = sens === 'asc' ? 1 : -1;
  return [...lignes].sort((a, b) => {
    if (cle === 'name') return signe * a.name.localeCompare(b.name, 'fr');
    const gauche = a[cle];
    const droite = b[cle];
    if (gauche === null || droite === null) {
      if (gauche === droite) return a.name.localeCompare(b.name, 'fr');
      return gauche === null ? 1 : -1;
    }
    if (gauche === droite) return a.name.localeCompare(b.name, 'fr');
    return signe * (gauche - droite);
  });
}
