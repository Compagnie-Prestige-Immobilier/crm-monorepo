import { RepCallOutcome, RepresentantRelation, WhatsappStatus } from '@crm/database';

/**
 * Clé de rapprochement d'un libellé de référentiel.
 *
 * Accents retirés, casse effacée, ponctuation et espaces compactés. Un fichier
 * rempli à la main écrit « SAINT-LOUIS », « Saint Louis » et « saint  louis »
 * pour le même département : les trois doivent tomber sur la même clé, sans
 * quoi l'import rejette des lignes parfaitement correctes et l'utilisateur en
 * conclut que l'outil ne marche pas.
 */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Libellés proposés en liste déroulante, dans l'ordre du parcours. */
export const RELATION_LABELS = ['Inconnu', 'Contacté', 'Ambassadeur', 'Refus'] as const;

export const WHATSAPP_LABELS = [
  'Non demandé',
  'Même numéro',
  'Autre numéro',
  'Aucun',
] as const;

function tableDe<T extends string>(entrees: readonly (readonly [string, T])[]): Map<string, T> {
  const table = new Map<string, T>();
  for (const [libelle, valeur] of entrees) table.set(normalizeKey(libelle), valeur);
  // Le nom de l'énumération est TOUJOURS accepté : un fichier réexporté depuis
  // la base porte `AMBASSADEUR` et non « Ambassadeur ».
  for (const [, valeur] of entrees) table.set(normalizeKey(valeur), valeur);
  return table;
}

const RELATIONS = tableDe<RepresentantRelation>([
  ['Inconnu', RepresentantRelation.INCONNU],
  ['À appeler', RepresentantRelation.INCONNU],
  ['Contacté', RepresentantRelation.CONTACTE],
  ['Ambassadeur', RepresentantRelation.AMBASSADEUR],
  ['Refus', RepresentantRelation.REFUS],
  ['Refusé', RepresentantRelation.REFUS],
]);

const WHATSAPP = tableDe<WhatsappStatus>([
  ['Non demandé', WhatsappStatus.NON_DEMANDE],
  ['Même numéro', WhatsappStatus.MEME_NUMERO],
  ['Autre numéro', WhatsappStatus.AUTRE_NUMERO],
  ['Aucun', WhatsappStatus.AUCUN],
]);

/** Le statut, ou `null` si le libellé n'est pas reconnu. Vide rend le défaut. */
export function parseRelation(raw: string): RepresentantRelation | null {
  if (raw.trim() === '') return RepresentantRelation.INCONNU;
  return RELATIONS.get(normalizeKey(raw)) ?? null;
}

/**
 * Le statut WhatsApp, ou `null` si le libellé n'est pas reconnu.
 *
 * « Autre numéro » est REFUSÉ à l'import : le schéma impose alors un
 * `whatsappE164`, que le modèle de fichier ne porte pas. Accepter le libellé
 * écrirait une ligne qui viole sa propre contrainte CHECK.
 */
export function parseWhatsapp(raw: string): WhatsappStatus | null {
  if (raw.trim() === '') return WhatsappStatus.NON_DEMANDE;
  const valeur = WHATSAPP.get(normalizeKey(raw)) ?? null;
  return valeur === WhatsappStatus.AUTRE_NUMERO ? null : valeur;
}

export const OUTCOME_LABELS = ['Joint', 'Injoignable', 'Refus', 'Faux numéro', 'Autre'] as const;

const OUTCOMES = tableDe<RepCallOutcome>([
  ['Joint', RepCallOutcome.REACHED],
  ['Injoignable', RepCallOutcome.UNREACHABLE],
  ['Refus', RepCallOutcome.REFUSED],
  ['Faux numéro', RepCallOutcome.WRONG_NUMBER],
  ['Autre', RepCallOutcome.OTHER],
]);

/**
 * L'issue d'un appel passé, ou `null` si le libellé n'est pas reconnu.
 *
 * `CALLBACK` et `PROSPECTS_PROMISED` sont volontairement absents : le premier
 * exige un `callbackAt`, le second un nombre de fiches promises, et le modèle
 * de fichier ne porte ni l'un ni l'autre. Les accepter écrirait des lignes qui
 * violent leur propre contrainte.
 */
export function parseOutcome(raw: string): RepCallOutcome | null {
  if (raw.trim() === '') return RepCallOutcome.REACHED;
  return OUTCOMES.get(normalizeKey(raw)) ?? null;
}

/** Les champs de qualification et l'appel déjà passé, une fois validés. */
export interface Complements {
  readonly relationStatus: RepresentantRelation;
  readonly whatsappStatus: WhatsappStatus;
  readonly ownerId: string | null;
  readonly appel: { readonly date: Date; readonly outcome: RepCallOutcome } | null;
}

/** Le refus d'une ligne, DÉSIGNÉ PAR LE RANG de la colonne fautive. */
export interface ComplementRefus {
  readonly rang: number;
  readonly code: string;
  readonly message: string;
  readonly value: string;
}

/**
 * Valide les cinq colonnes de qualification, POUR LES DEUX CHEMINS D'IMPORT.
 *
 * L'import synchrone et le moteur d'arrière-plan appliquent les mêmes règles ;
 * les écrire deux fois les ferait diverger au premier correctif, et l'écart se
 * verrait comme un import qui accepte ce que l'autre refuse.
 */
export function parseComplements(
  cells: Record<'relation' | 'whatsapp' | 'charge' | 'dateAppel' | 'issue', string>,
  comptes: ReadonlyMap<string, { readonly id: string }>,
): Complements | ComplementRefus {
  const relationStatus = parseRelation(cells.relation);
  if (!relationStatus) {
    return {
      rang: 6,
      code: 'RELATION_UNKNOWN',
      message: 'Statut de relation inconnu. Inconnu, Contacté, Ambassadeur ou Refus.',
      value: cells.relation,
    };
  }

  const whatsappStatus = parseWhatsapp(cells.whatsapp);
  if (!whatsappStatus) {
    return {
      rang: 7,
      code: 'WHATSAPP_UNKNOWN',
      message:
        'Statut WhatsApp inconnu. Non demandé, Même numéro ou Aucun. « Autre numéro » ne s’importe pas : le second numéro n’a pas de colonne.',
      value: cells.whatsapp,
    };
  }

  const owner = cells.charge === '' ? undefined : comptes.get(normalizeKey(cells.charge));
  if (cells.charge !== '' && owner === undefined) {
    return {
      rang: 8,
      code: 'OWNER_UNKNOWN',
      message: 'Chargé de compte introuvable. Identifiant, e-mail ou nom complet d’un compte actif.',
      value: cells.charge,
    };
  }

  // L'issue ne vaut RIEN sans sa date : elle décrit un appel, et un appel sans
  // date ne peut pas être écrit — `clientCreatedAt` est obligatoire, et
  // l'inventer daterait l'appel du jour de l'import.
  const date = parseDateAppel(cells.dateAppel);
  if (cells.dateAppel !== '' && date === null) {
    return {
      rang: 9,
      code: 'CALL_DATE_INVALID',
      message: 'Date du dernier appel illisible ou dans le futur. Format JJ/MM/AAAA.',
      value: cells.dateAppel,
    };
  }
  if (cells.issue !== '' && date === null) {
    return {
      rang: 9,
      code: 'CALL_DATE_MISSING',
      message: 'Une issue d’appel sans date d’appel ne s’enregistre pas. Renseignez la date.',
      value: cells.issue,
    };
  }

  const outcome = parseOutcome(cells.issue);
  if (!outcome) {
    return {
      rang: 10,
      code: 'CALL_OUTCOME_UNKNOWN',
      message: 'Issue d’appel inconnue. Joint, Injoignable, Refus, Faux numéro ou Autre.',
      value: cells.issue,
    };
  }

  return {
    relationStatus,
    whatsappStatus,
    ownerId: owner?.id ?? null,
    appel: date === null ? null : { date, outcome },
  };
}

const JOUR_MOIS_AN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const AN_MOIS_JOUR = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * La date d'un appel passé, à minuit. `null` si elle est illisible ou à venir.
 *
 * Minuit UTC et non local : Dakar est à UTC+0 toute l'année, les deux
 * coïncident, et une conversion de fuseau ferait glisser la date d'un jour sur
 * une machine de développement européenne.
 */
export function parseDateAppel(raw: string, maintenant = new Date()): Date | null {
  const texte = raw.trim();
  if (texte === '') return null;

  const jma = JOUR_MOIS_AN.exec(texte);
  const amj = AN_MOIS_JOUR.exec(texte);
  if (!jma && !amj) return null;
  const [annee, mois, jour] = jma
    ? [Number(jma[3]), Number(jma[2]), Number(jma[1])]
    : [Number(amj?.[1]), Number(amj?.[2]), Number(amj?.[3])];

  const date = new Date(Date.UTC(annee, mois - 1, jour));
  // Le contrôle de recomposition attrape le 31 février, que `Date.UTC` accepte
  // en le reportant au 3 mars sans rien dire.
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1) return null;
  if (date.getUTCDate() !== jour) return null;
  if (date.getTime() > maintenant.getTime()) return null;
  return date;
}
