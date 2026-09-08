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
export const RELATION_LABELS = ['Non qualifié', 'Contacté', 'Accepté', 'Refusé'] as const;

export const WHATSAPP_LABELS = ['Non demandé', 'Même numéro', 'Autre numéro', 'Aucun'] as const;

function tableDe<T extends string>(entrees: readonly (readonly [string, T])[]): Map<string, T> {
  const table = new Map<string, T>();
  for (const [libelle, valeur] of entrees) table.set(normalizeKey(libelle), valeur);
  // Le nom de l'énumération est TOUJOURS accepté : un fichier réexporté depuis
  // la base porte `AMBASSADEUR` et non « Ambassadeur ».
  for (const [, valeur] of entrees) table.set(normalizeKey(valeur), valeur);
  return table;
}

const RELATIONS = tableDe<RepresentantRelation>([
  ['Non qualifié', RepresentantRelation.INCONNU],
  ['Contacté', RepresentantRelation.CONTACTE],
  ['Accepté', RepresentantRelation.AMBASSADEUR],
  ['Refusé', RepresentantRelation.REFUS],
]);

const WHATSAPP = tableDe<WhatsappStatus>([
  ['Non demandé', WhatsappStatus.NON_DEMANDE],
  ['Même numéro', WhatsappStatus.MEME_NUMERO],
  ['Autre numéro', WhatsappStatus.AUTRE_NUMERO],
  ['Aucun', WhatsappStatus.AUCUN],
]);

/** Le statut, ou `null` si le libellé n'est pas reconnu. Vide rend le défaut. */
function parseRelation(raw: string): RepresentantRelation | null {
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
function parseWhatsapp(raw: string): WhatsappStatus | null {
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
function parseOutcome(raw: string): RepCallOutcome | null {
  if (raw.trim() === '') return RepCallOutcome.REACHED;
  return OUTCOMES.get(normalizeKey(raw)) ?? null;
}

/** Les champs de qualification et l'appel déjà passé, une fois validés. */
export interface Complements {
  readonly relationStatus: RepresentantRelation;
  readonly whatsappStatus: WhatsappStatus;
  readonly ownerId: string | null;
  readonly appel: {
    readonly date: Date;
    readonly outcome: RepCallOutcome;
    /** Ce qui a été dit pendant CET appel. La base l'exige sur `OTHER`. */
    readonly comment: string | null;
  } | null;
}

/** Le refus d'une ligne, DÉSIGNÉ PAR LE RANG de la colonne fautive. */
export interface ComplementRefus {
  readonly rang: number;
  readonly code: string;
  readonly message: string;
  readonly value: string;
}

type ComplementCells = Record<
  'notes' | 'relation' | 'whatsapp' | 'charge' | 'dateAppel' | 'issue',
  string
>;

function parseRelationStep(raw: string): RepresentantRelation | ComplementRefus {
  const relationStatus = parseRelation(raw);
  if (relationStatus) return relationStatus;
  return {
    rang: 6,
    code: 'RELATION_UNKNOWN',
    message: 'Statut de relation inconnu. Inconnu, Contacté, Ambassadeur ou Refus.',
    value: raw,
  };
}

function parseWhatsappStep(raw: string): WhatsappStatus | ComplementRefus {
  const whatsappStatus = parseWhatsapp(raw);
  if (whatsappStatus) return whatsappStatus;
  return {
    rang: 7,
    code: 'WHATSAPP_UNKNOWN',
    message:
      'Statut WhatsApp inconnu. Non demandé, Même numéro ou Aucun. « Autre numéro » ne s’importe pas : le second numéro n’a pas de colonne.',
    value: raw,
  };
}

function parseOwnerStep(
  raw: string,
  comptes: ReadonlyMap<string, { readonly id: string }>,
): string | null | ComplementRefus {
  if (raw === '') return null;
  const owner = comptes.get(normalizeKey(raw));
  if (owner) return owner.id;
  return {
    rang: 8,
    code: 'OWNER_UNKNOWN',
    message: 'Chargé de compte introuvable. Identifiant, e-mail ou nom complet d’un compte actif.',
    value: raw,
  };
}

/**
 * L'issue ne vaut RIEN sans sa date : elle décrit un appel, et un appel sans
 * date ne peut pas être écrit — `clientCreatedAt` est obligatoire, et
 * l'inventer daterait l'appel du jour de l'import.
 */
function parseCallDateStep(cells: Pick<ComplementCells, 'dateAppel' | 'issue'>): Date | null | ComplementRefus {
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
  return date;
}

/**
 * La MÊME règle qu'en base : `rep_call_attempts_other_requires_comment`.
 * « Autre » sans un mot d'explication est un fourre-tout dont personne ne
 * tire rien six mois plus tard — et la contrainte ferait échouer la tranche
 * entière au lieu de cette seule ligne.
 */
function parseOutcomeStep(
  issue: string,
  notes: string,
): { readonly outcome: RepCallOutcome; readonly comment: string | null } | ComplementRefus {
  const outcome = parseOutcome(issue);
  if (!outcome) {
    return {
      rang: 10,
      code: 'CALL_OUTCOME_UNKNOWN',
      message: 'Issue d’appel inconnue. Joint, Injoignable, Refus, Faux numéro ou Autre.',
      value: issue,
    };
  }

  const comment = notes.trim() === '' ? null : notes.trim().slice(0, 2_000);
  if (outcome === RepCallOutcome.OTHER && comment === null) {
    return {
      rang: 10,
      code: 'CALL_COMMENT_REQUIRED',
      message: 'L’issue « Autre » exige une note : sans elle, l’appel n’apprend rien.',
      value: issue,
    };
  }

  return { outcome, comment };
}

function parseAppelStep(cells: ComplementCells): Complements['appel'] | ComplementRefus {
  const date = parseCallDateStep(cells);
  if (date === null) return null;
  if (!(date instanceof Date)) return date;

  const parsedOutcome = parseOutcomeStep(cells.issue, cells.notes);
  if (!('outcome' in parsedOutcome)) return parsedOutcome;

  return { date, outcome: parsedOutcome.outcome, comment: parsedOutcome.comment };
}

function resolveOwnerAndAppel(
  cells: ComplementCells,
  comptes: ReadonlyMap<string, { readonly id: string }>,
): { readonly ownerId: string | null; readonly appel: Complements['appel'] } | ComplementRefus {
  const ownerId = parseOwnerStep(cells.charge, comptes);
  if (ownerId !== null && typeof ownerId !== 'string') return ownerId;

  const appel = parseAppelStep(cells);
  if (appel !== null && !('date' in appel)) return appel;

  return { ownerId, appel };
}

/**
 * Valide les cinq colonnes de qualification, POUR LES DEUX CHEMINS D'IMPORT.
 *
 * L'import synchrone et le moteur d'arrière-plan appliquent les mêmes règles ;
 * les écrire deux fois les ferait diverger au premier correctif, et l'écart se
 * verrait comme un import qui accepte ce que l'autre refuse.
 */
export function parseComplements(
  cells: ComplementCells,
  comptes: ReadonlyMap<string, { readonly id: string }>,
): Complements | ComplementRefus {
  const relationStatus = parseRelationStep(cells.relation);
  if (typeof relationStatus !== 'string') return relationStatus;

  const whatsappStatus = parseWhatsappStep(cells.whatsapp);
  if (typeof whatsappStatus !== 'string') return whatsappStatus;

  const resolved = resolveOwnerAndAppel(cells, comptes);
  if ('code' in resolved) return resolved;

  return {
    relationStatus,
    whatsappStatus,
    ownerId: resolved.ownerId,
    appel: resolved.appel,
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
function extractDateParts(texte: string): readonly [number, number, number] | null {
  const jma = JOUR_MOIS_AN.exec(texte);
  if (jma) return [Number(jma[3]), Number(jma[2]), Number(jma[1])];
  const amj = AN_MOIS_JOUR.exec(texte);
  if (amj) return [Number(amj[1]), Number(amj[2]), Number(amj[3])];
  return null;
}

/**
 * Attrape le 31 février, que `Date.UTC` accepte en le reportant au 3 mars
 * sans rien dire.
 */
function estMemeDateCalendaire(date: Date, annee: number, mois: number, jour: number): boolean {
  return (
    date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour
  );
}

function parseDateAppel(raw: string, maintenant = new Date()): Date | null {
  const texte = raw.trim();
  if (texte === '') return null;

  const parts = extractDateParts(texte);
  if (!parts) return null;
  const [annee, mois, jour] = parts;

  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (!estMemeDateCalendaire(date, annee, mois, jour)) return null;
  if (date.getTime() > maintenant.getTime()) return null;
  return date;
}
