import { apiFetch, asArray, asNumber, asRecord, asString } from '@/lib/api/raw';
import { toFilterQuery } from '@/lib/api/query-params';
import type { ProspectFilters } from '@/lib/types';

/**
 * `GET /analytics/funnel` : l'entonnoir complet et les montants encaissés.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi le montant est une CHAÎNE, de bout en bout.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * XOF est stocké en `Decimal(18,0)`. `Number.MAX_SAFE_INTEGER` s'arrête à
 * quinze chiffres et demi : au-delà, `Number(montant)` perd des unités sans
 * lever la moindre erreur, et le total affiché diverge de celui du classeur
 * Excel sans que rien ne le signale. Le validateur ci-dessous REFUSE donc un
 * nombre JSON là où l'API promet une chaîne : mieux vaut un écran d'erreur
 * nommé qu'un montant faux affiché à la direction.
 *
 * Le chemin passe par `lib/api/raw` parce que la route est absente du client
 * engendré (`pnpm codegen` n'a pas été rejoué). La forme est donc déclarée et
 * validée ici, explicitement.
 *
 * TODO(codegen) : après régénération, cet appel redevient
 * `client.GET('/api/v1/analytics/funnel', …)` et le validateur disparaît. La
 * signature de `fetchFunnel` ne bouge pas, donc aucun écran ne bouge.
 */

/** Une marche de la chaîne, du prospect saisi au dossier encaissé. */
export interface FunnelStage {
  /** Libellé prêt à afficher, tel que l'API le nomme. */
  label: string;
  count: number;
  /**
   * Part de l'étape PRÉCÉDENTE, en pourcentage. Vaut 100 pour la première.
   *
   * C'est le seul taux qui montre OÙ la chaîne se casse. Le taux global noie
   * la marche défaillante dans la moyenne : 43 % puis 6 % se lisent tous les
   * deux « 2,7 % du total » si l'on ne regarde que lui.
   */
  tauxEtapePrecedente: number;
  /** Part du sommet de l'entonnoir, en pourcentage. */
  tauxGlobal: number;
}

/** Les montants. Chaque champ monétaire est une CHAÎNE, jamais un nombre. */
export interface FunnelFinance {
  montantEncaisse: string;
  montantEncaisse30Jours: string;
  encaissementMoyen: string;
  montantEnCours: string;
  dossiers: number;
  dossiersOuverts: number;
  dossiersEncaisses: number;
  dossiersRejetes: number;
  tauxRejet: number;
  /** `null` tant qu'aucun dossier n'est clos : « 0 jour » serait un mensonge. */
  delaiMoyenJours: number | null;
}

export interface Funnel {
  etapes: FunnelStage[];
  finance: FunnelFinance;
}

/**
 * Montant XOF : une CHAÎNE, et rien d'autre.
 *
 * Un nombre est refusé au lieu d'être converti. La conversion serait
 * silencieuse et le montant affiché deviendrait faux à partir du seizième
 * chiffre : exactement le genre de dérive qu'on ne remarque qu'en comparant
 * avec la comptabilité, des semaines plus tard.
 */
function asMoney(value: unknown, where: string): string {
  if (typeof value === 'number') {
    throw new Error(`${where} est un nombre JSON, or un montant XOF doit rester une chaîne`);
  }
  return asString(value, where);
}

/** `null` accepté et conservé : l'absence de délai est une information. */
function asNullableNumber(value: unknown, where: string): number | null {
  if (value === null || value === undefined) return null;
  return asNumber(value, where);
}

function parseStage(value: unknown, index: number): FunnelStage {
  const where = `etapes[${String(index)}]`;
  const stage = asRecord(value, where);
  return {
    label: asString(stage.label, `${where}.label`),
    count: asNumber(stage.count, `${where}.count`),
    tauxEtapePrecedente: asNumber(stage.tauxEtapePrecedente, `${where}.tauxEtapePrecedente`),
    tauxGlobal: asNumber(stage.tauxGlobal, `${where}.tauxGlobal`),
  };
}

export function parseFunnel(value: unknown): Funnel {
  const payload = asRecord(value, 'la réponse');
  const finance = asRecord(payload.finance, 'finance');

  return {
    etapes: asArray(payload.etapes, 'etapes').map(parseStage),
    finance: {
      montantEncaisse: asMoney(finance.montantEncaisse, 'finance.montantEncaisse'),
      montantEncaisse30Jours: asMoney(
        finance.montantEncaisse30Jours,
        'finance.montantEncaisse30Jours',
      ),
      encaissementMoyen: asMoney(finance.encaissementMoyen, 'finance.encaissementMoyen'),
      montantEnCours: asMoney(finance.montantEnCours, 'finance.montantEnCours'),
      dossiers: asNumber(finance.dossiers, 'finance.dossiers'),
      dossiersOuverts: asNumber(finance.dossiersOuverts, 'finance.dossiersOuverts'),
      dossiersEncaisses: asNumber(finance.dossiersEncaisses, 'finance.dossiersEncaisses'),
      dossiersRejetes: asNumber(finance.dossiersRejetes, 'finance.dossiersRejetes'),
      tauxRejet: asNumber(finance.tauxRejet, 'finance.tauxRejet'),
      delaiMoyenJours: asNullableNumber(finance.delaiMoyenJours, 'finance.delaiMoyenJours'),
    },
  };
}

/**
 * L'entonnoir prend EXACTEMENT le même filtre que le reste du tableau de bord :
 * les montants décrivent la population des chiffres affichés au-dessus.
 */
export function fetchFunnel(filters: ProspectFilters): Promise<Funnel> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toFilterQuery(filters))) {
    params.set(key, String(value));
  }
  const query = params.toString();
  return apiFetch(`/analytics/funnel${query === '' ? '' : `?${query}`}`, parseFunnel);
}

/**
 * Indice de la marche où la chaîne se casse, ou `null`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * On désigne le MINIMUM observé, on n'applique aucun seuil.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Décréter qu'un passage sous 20 % est « mauvais » serait inventer une norme
 * métier que personne n'a fixée, et la peindre en rouge sur un écran de
 * direction lui donnerait force de vérité. Le minimum, lui, est un fait : sur
 * l'exemple 100 / 43,2 / 6,3 / 100, c'est l'ouverture de dossier qui casse,
 * quelle que soit l'opinion qu'on a de 6,3 %.
 *
 * La première marche est exclue : elle vaut toujours 100 % par construction.
 * Un minimum à 100 n'est pas une rupture, et une ÉGALITÉ ne désigne aucune
 * marche en particulier : dans les deux cas on ne montre rien plutôt que de
 * pointer arbitrairement.
 */
export function breakingStageIndex(stages: readonly FunnelStage[]): number | null {
  if (stages.length < 2) return null;
  if ((stages[0]?.count ?? 0) === 0) return null;

  let index = -1;
  let lowest = Number.POSITIVE_INFINITY;
  let tied = false;

  for (let i = 1; i < stages.length; i += 1) {
    const rate = stages[i]?.tauxEtapePrecedente ?? 0;
    if (rate < lowest) {
      lowest = rate;
      index = i;
      tied = false;
    } else if (rate === lowest) {
      tied = true;
    }
  }

  if (index === -1 || tied || lowest >= 100) return null;
  return index;
}
