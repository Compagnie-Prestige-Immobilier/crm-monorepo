import { normalizeKey } from '../representants/representants-import.service.js';
import {
  formatVisiteReference,
  nextVisiteSequence,
  visiteReferencePrefix,
} from '../visites/reference.js';
import type { PrismaTransactionClient } from './import-adapter.js';

/**
 * Résolution des quatre listes du registre des visites, et lecture des dates
 * et heures du classeur : partagées par les DEUX adaptateurs qui les lisent,
 * la reprise du classeur historique et l'aller-retour Excel. Un référentiel
 * désactivé cesse d'être proposé aux deux.
 */

export const VisiteImportError = {
  DATE_ABSENTE: 'VISITE_IMPORT_DATE_ABSENTE',
  DATE_ILLISIBLE: 'VISITE_IMPORT_DATE_ILLISIBLE',
  HEURE_ILLISIBLE: 'VISITE_IMPORT_HEURE_ILLISIBLE',
  NOM_ABSENT: 'VISITE_IMPORT_NOM_ABSENT',
  ENTREPRISE_INCONNUE: 'VISITE_IMPORT_ENTREPRISE_INCONNUE',
  OBJET_INCONNU: 'VISITE_IMPORT_OBJET_INCONNU',
  DIRECTION_INCONNUE: 'VISITE_IMPORT_DIRECTION_INCONNUE',
  DESTINATAIRE_INCONNU: 'VISITE_IMPORT_DESTINATAIRE_INCONNU',
  COLONNES_DECALEES: 'VISITE_IMPORT_COLONNES_DECALEES',
  DOUBLON_DANS_LE_FICHIER: 'VISITE_IMPORT_DOUBLON_DANS_LE_FICHIER',
  DEJA_AU_REGISTRE: 'VISITE_IMPORT_DEJA_AU_REGISTRE',
  REFERENCE_EPUISEE: 'VISITE_IMPORT_REFERENCE_EPUISEE',
  REGISTRE_NUMERO_INCONNU: 'VISITE_IMPORT_REGISTRE_NUMERO_INCONNU',
  REGISTRE_TROP_DE_DIFFERENCES: 'VISITE_IMPORT_REGISTRE_TROP_DE_DIFFERENCES',
  REGISTRE_MODIFIEE_DEPUIS: 'VISITE_IMPORT_REGISTRE_MODIFIEE_DEPUIS',
} as const;

export interface Entry {
  readonly id: string;
  readonly label: string;
}

export interface VisiteReferentiels {
  readonly entreprises: ReadonlyMap<string, Entry>;
  readonly directions: ReadonlyMap<string, Entry>;
  readonly destinataires: ReadonlyMap<string, Entry>;
  readonly objets: ReadonlyMap<string, Entry>;
  /** Où une valeur se trouve VRAIMENT, pour nommer un décalage de colonnes. */
  readonly owners: ReadonlyMap<string, string>;
}

function indexRow(
  map: Map<string, Entry>,
  owners: Map<string, string>,
  owner: string,
  row: { id: string; code: string; label: string },
): void {
  const entry = { id: row.id, label: row.label };
  for (const key of [normalizeKey(row.label), normalizeKey(row.code)]) {
    if (key === '') continue;
    map.set(key, entry);
    if (!owners.has(key)) owners.set(key, owner);
  }
}

export async function loadVisiteReferentiels(
  tx: PrismaTransactionClient,
): Promise<VisiteReferentiels> {
  const select = { id: true, code: true, label: true } as const;
  const where = { isActive: true } as const;

  const [entreprises, directions, destinataires, objets] = await Promise.all([
    tx.visiteEntreprise.findMany({ where, select }),
    tx.visiteDirection.findMany({ where, select }),
    tx.visiteDestinataire.findMany({ where, select }),
    tx.visiteObjet.findMany({ where, select }),
  ]);

  const owners = new Map<string, string>();
  const index = (
    rows: readonly { id: string; code: string; label: string }[],
    owner: string,
  ): ReadonlyMap<string, Entry> => {
    const map = new Map<string, Entry>();
    for (const row of rows) indexRow(map, owners, owner, row);
    return map;
  };

  return {
    entreprises: index(entreprises, 'entreprises'),
    directions: index(directions, 'directions'),
    destinataires: index(destinataires, 'destinataires'),
    objets: index(objets, 'objets de visite'),
    owners,
  };
}

function resolveAlias(
  index: ReadonlyMap<string, Entry>,
  aliases: ReadonlyMap<string, string> | undefined,
  key: string,
): Entry | null {
  if (aliases === undefined) return null;
  const code = aliases.get(key);
  if (code === undefined) return null;
  return index.get(normalizeKey(code)) ?? null;
}

export function resolveReferentiel(
  index: ReadonlyMap<string, Entry>,
  raw: string | undefined,
  aliases?: ReadonlyMap<string, string>,
): Entry | null {
  const key = normalizeKey((raw ?? '').trim());
  if (key === '') return null;
  return index.get(key) ?? resolveAlias(index, aliases, key);
}

export type VisiteReferentielKindAttendu = 'entreprise' | 'direction' | 'destinataire' | 'objet';

const PHONE_LIKE = /^\+?\d[\d\s.-]{5,}$/;

const CODES = {
  entreprise: VisiteImportError.ENTREPRISE_INCONNUE,
  direction: VisiteImportError.DIRECTION_INCONNUE,
  destinataire: VisiteImportError.DESTINATAIRE_INCONNU,
  objet: VisiteImportError.OBJET_INCONNU,
} as const;

const LISTES = {
  entreprise: 'ENTREPRISES',
  direction: 'DIRECTIONS &/OU NIVEAU',
  destinataire: 'DESTINATAIRES',
  objet: 'OBJECT VISITE',
} as const;

/**
 * Ce que la cellule contient VRAIMENT, quand elle ne contient pas ce qu'on
 * attend. Les deux classeurs portent des téléphones et des destinataires sous
 * la mauvaise colonne : dire « inconnu » ferait chercher une entrée à
 * ajouter, alors que la ligne est décalée d'un cran.
 */
export function referentielMissReason(
  refs: VisiteReferentiels,
  raw: string,
  attendu: VisiteReferentielKindAttendu,
): [string, string] {
  if (raw === '') {
    return [CODES[attendu], `la colonne ${LISTES[attendu]} est vide, elle est obligatoire.`];
  }

  if (PHONE_LIKE.test(raw)) {
    return [
      VisiteImportError.COLONNES_DECALEES,
      `« ${raw} » est un numéro de téléphone, pas ${attendu === 'objet' ? 'un objet de visite' : `une ${attendu}`}. Les colonnes de cette ligne sont décalées.`,
    ];
  }

  const owner = refs.owners.get(normalizeKey(raw));
  if (owner !== undefined) {
    return [
      VisiteImportError.COLONNES_DECALEES,
      `« ${raw} » appartient à la liste des ${owner}, pas à ${LISTES[attendu]}. Les colonnes de cette ligne sont décalées.`,
    ];
  }

  return [
    CODES[attendu],
    `« ${raw} » ne figure pas dans la liste ${LISTES[attendu]}. Corrigez la cellule, ou ajoutez l’entrée à la liste avant de relancer.`,
  ];
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const FIRST_UNAMBIGUOUS_SERIAL = 61;
const LAST_SERIAL = 2_958_465;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const HOUR_MINUTE = /^(\d{1,2})\s*[h:]\s*(\d{2})\s*h?$/i;
const HOUR_ALONE = /^(\d{1,2})\s*h?$/i;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Le classeur porte des dates numériques : styles ignorés, le flux rend le rang brut. */
export function readSheetDate(raw: string): string | null {
  if (ISO_DATE.test(raw)) return raw.slice(0, 10);

  const serial = Number(raw);
  if (!Number.isInteger(serial) || serial < FIRST_UNAMBIGUOUS_SERIAL || serial > LAST_SERIAL) {
    return null;
  }
  return new Date(EXCEL_EPOCH_UTC + serial * 86_400_000).toISOString().slice(0, 10);
}

function fromHourMinute(raw: string): string | null {
  const match = HOUR_MINUTE.exec(raw);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour >= 24 || minute >= 60) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
}

function fromHourAlone(raw: string): string | null {
  const match = HOUR_ALONE.exec(raw);
  if (match === null) return null;
  const hour = Number(match[1]);
  return hour < 24 ? `${pad2(hour)}:00` : null;
}

/** `11H08`, `11h45`, `12H`, `15` et `14H15H` se lisent. `17H5` ne se devine pas. */
export function readSheetTime(raw: string): string | null {
  return fromHourMinute(raw) ?? fromHourAlone(raw);
}

/**
 * Le rang du registre court par ANNÉE. Partagé par les deux adaptateurs, qui
 * peuvent tous deux créer des visites dans la même transaction de tranche.
 */
export async function allocateVisiteReferences<T>(
  rows: readonly T[],
  dateOf: (row: T) => string,
  tx: PrismaTransactionClient,
): Promise<Map<T, string>> {
  const years = [...new Set(rows.map((row) => Number(dateOf(row).slice(0, 4))))];
  const next = new Map<number, number>();

  for (const year of years) {
    const last = await tx.visite.findFirst({
      where: { reference: { startsWith: visiteReferencePrefix(year) } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });
    next.set(year, nextVisiteSequence(last?.reference, year));
  }

  const references = new Map<T, string>();
  for (const row of rows) {
    const year = Number(dateOf(row).slice(0, 4));
    const sequence = next.get(year) ?? 1;
    next.set(year, sequence + 1);
    references.set(row, formatVisiteReference(year, sequence));
  }
  return references;
}
