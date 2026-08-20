import { Injectable } from '@nestjs/common';
import { ImportKind, ImportMode } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { tryNormalizePhone } from '../../common/phone.js';
import { normalizeKey } from '../representants/representants-import.service.js';
import {
  formatVisiteReference,
  nextVisiteSequence,
  visiteReferencePrefix,
} from '../visites/reference.js';
import { visiteInstant } from '../visites/visites.service.js';
import type {
  ChunkOutcome,
  ImportAdapter,
  ImportColumn,
  ImportRowError,
  ImportRunContext,
  ParsedRow,
  SheetLayout,
} from './import-adapter.js';
import { SHEET_CELL } from './xlsx-rows.js';

/**
 * Reprise du classeur de visites tenu à l'accueil depuis des années.
 *
 * Ce n'est pas un modèle téléchargé puis rempli : c'est un classeur vivant, un
 * onglet de données par mois au milieu de trente autres d'agrégats, en-tête en
 * ligne 3, et un mois qui compte deux colonnes de plus que les autres. D'où
 * `layout`, qui fait retrouver les colonnes par leur en-tête, onglet par onglet.
 */

export const VISITES_MAX_ROWS = 20_000;

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
  NON_PREPARE: 'VISITE_IMPORT_NON_PREPARE',
} as const;

export const VISITE_IMPORT_HEADERS = {
  date: 'DATE VISITE',
  heure: 'HEURE VISITE',
  nom: 'PRENOM ET NOMS',
  telephone: 'TELEPHONES',
  entreprise: 'ENTREPRISE',
  direction: 'DIRECTION',
  destinataire: 'DESTINATAIRES',
  objet: 'OBJECT VISITE',
  commentaire: 'COMMENTAIRES / NOTES',
} as const;

const H = VISITE_IMPORT_HEADERS;

/**
 * La colonne « N° » du classeur n'est PAS reprise.
 *
 * Elle repart à 1 chaque mois, elle ne désigne donc rien hors de son onglet ; et
 * l'accueil pré-numérote cinq cents lignes par mois qu'il ne remplit jamais. En
 * la laissant hors du modèle, ces lignes se projettent vides et le moteur les
 * saute, au lieu de compter cinq mille refus « date absente ».
 */
export const VISITES_IMPORT_COLUMNS: readonly ImportColumn[] = [
  {
    header: H.date,
    width: 14,
    required: true,
    help: 'Date de la visite. Une vraie date Excel, pas du texte.',
    sample: '06/01/2026',
  },
  {
    header: H.heure,
    width: 12,
    required: false,
    help: 'Heure d’arrivée. 11H08, 11h45 et 12H sont lus. Vide si elle n’a pas été relevée.',
    sample: '11H08',
  },
  {
    header: H.nom,
    width: 32,
    required: true,
    help: 'Le visiteur, tel qu’il s’est présenté.',
    sample: 'MOUHAMED FALL',
  },
  {
    header: H.telephone,
    width: 18,
    required: false,
    help: 'Facultatif. Le numéro est gardé tel quel, et normalisé quand c’est possible.',
    sample: '78 454 44 66',
  },
  {
    header: H.entreprise,
    width: 20,
    required: true,
    help: 'Une entrée de la liste déroulante ENTREPRISES.',
    sample: 'CPI',
  },
  {
    header: H.direction,
    width: 26,
    required: false,
    help: 'Facultatif. Une entrée de la liste DIRECTIONS &/OU NIVEAU.',
    sample: 'COMMERCIALE',
  },
  {
    header: H.destinataire,
    width: 34,
    required: false,
    help: 'Facultatif. Une entrée de la liste DESTINATAIRES.',
    sample: 'MME. NDOYE (RESP. COMM.)',
  },
  {
    header: H.objet,
    width: 30,
    required: true,
    help: 'Une entrée de la liste OBJECT VISITE.',
    sample: 'SUIVI DE DOSSIER',
  },
  {
    header: H.commentaire,
    width: 48,
    required: false,
    help: 'Facultatif. Ce que l’accueil a noté.',
    sample: 'Reçu par MME NDOYE',
  },
];

export const VISITES_SHEET_LAYOUT: SheetLayout = {
  sheetPattern: /BDD VISITES/i,
  headerRow: 3,
};

export interface VisiteImportRow {
  readonly rowNumber: number;
  readonly sheet: string;
  readonly date: string;
  readonly time: string | null;
  readonly visitorName: string;
  readonly phone: string | null;
  readonly phoneE164: string | null;
  readonly entrepriseId: string;
  readonly objetId: string;
  readonly directionId: string | null;
  readonly destinataireId: string | null;
  readonly comment: string | null;
}

interface Entry {
  readonly id: string;
  readonly label: string;
}

interface Referentiels {
  readonly entreprises: ReadonlyMap<string, Entry>;
  readonly directions: ReadonlyMap<string, Entry>;
  readonly destinataires: ReadonlyMap<string, Entry>;
  readonly objets: ReadonlyMap<string, Entry>;
  /** Où une valeur se trouve VRAIMENT, pour nommer un décalage de colonnes. */
  readonly owners: ReadonlyMap<string, string>;
}

interface RunState {
  readonly seen: Map<string, VisiteImportRow>;
}

/**
 * La liste déroulante du classeur porte ce libellé TRONQUÉ depuis l'origine :
 * douze lignes le portent. Ce n'est pas une valeur inconnue à deviner, c'est
 * l'orthographe d'accueil de `ACHAT_PRODUITS`, appariée sur la chaîne exacte.
 */
const LIBELLES_DU_CLASSEUR: ReadonlyMap<string, string> = new Map([
  [normalizeKey('ACHAT PRODUITS SANTARGILE ET/OU MAK'), 'ACHAT_PRODUITS'],
]);

const MAX_TRACKED_RUNS = 8;

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const FIRST_UNAMBIGUOUS_SERIAL = 61;
const LAST_SERIAL = 2_958_465;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const HOUR_MINUTE = /^(\d{1,2})\s*[h:]\s*(\d{2})\s*h?$/i;
const HOUR_ALONE = /^(\d{1,2})\s*h?$/i;
const PHONE_LIKE = /^\+?\d[\d\s.-]{5,}$/;

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

/** `11H08`, `11h45`, `12H`, `15` et `14H15H` se lisent. `17H5` ne se devine pas. */
export function readSheetTime(raw: string): string | null {
  const both = HOUR_MINUTE.exec(raw);
  if (both !== null) {
    const hour = Number(both[1]);
    const minute = Number(both[2]);
    return hour < 24 && minute < 60 ? `${pad2(hour)}:${pad2(minute)}` : null;
  }

  const alone = HOUR_ALONE.exec(raw);
  if (alone === null) return null;

  const hour = Number(alone[1]);
  return hour < 24 ? `${pad2(hour)}:00` : null;
}

export const visiteDedupKey = (row: {
  date: string;
  time: string | null;
  visitorName: string;
  entrepriseId: string;
}): string => [row.date, row.time ?? '', normalizeKey(row.visitorName), row.entrepriseId].join('|');

const dedupKeyOf = (row: {
  visitedAt: Date;
  timeKnown: boolean;
  visitorName: string;
  entrepriseId: string;
}): string => {
  const iso = row.visitedAt.toISOString();
  return [
    iso.slice(0, 10),
    row.timeKnown ? iso.slice(11, 16) : '',
    normalizeKey(row.visitorName),
    row.entrepriseId,
  ].join('|');
};

@Injectable()
export class VisitesImportAdapter implements ImportAdapter<VisiteImportRow> {
  readonly kind = ImportKind.VISITES;
  readonly maxRows = VISITES_MAX_ROWS;
  readonly templateColumns: readonly ImportColumn[] = VISITES_IMPORT_COLUMNS;
  readonly layout = VISITES_SHEET_LAYOUT;

  private referentiels: Referentiels | null = null;
  private readonly runs = new Map<string, RunState>();

  async prepare(ctx: ImportRunContext): Promise<void> {
    const select = { id: true, code: true, label: true } as const;
    const where = { isActive: true } as const;

    const [entreprises, directions, destinataires, objets] = await Promise.all([
      ctx.tx.visiteEntreprise.findMany({ where, select }),
      ctx.tx.visiteDirection.findMany({ where, select }),
      ctx.tx.visiteDestinataire.findMany({ where, select }),
      ctx.tx.visiteObjet.findMany({ where, select }),
    ]);

    const owners = new Map<string, string>();
    const index = (
      rows: readonly { id: string; code: string; label: string }[],
      owner: string,
    ): ReadonlyMap<string, Entry> => {
      const map = new Map<string, Entry>();
      for (const row of rows) {
        const entry = { id: row.id, label: row.label };
        for (const key of [normalizeKey(row.label), normalizeKey(row.code)]) {
          if (key === '') continue;
          map.set(key, entry);
          if (!owners.has(key)) owners.set(key, owner);
        }
      }
      return map;
    };

    this.referentiels = {
      entreprises: index(entreprises, 'entreprises'),
      directions: index(directions, 'directions'),
      destinataires: index(destinataires, 'destinataires'),
      objets: index(objets, 'objets de visite'),
      owners,
    };

    this.runs.set(ctx.jobId, { seen: new Map() });
    while (this.runs.size > MAX_TRACKED_RUNS) {
      const oldest = this.runs.keys().next();
      if (oldest.done === true) break;
      this.runs.delete(oldest.value);
    }
  }

  parseRow(cells: Record<string, string>, rowNumber: number): ParsedRow<VisiteImportRow> {
    const refs = this.referentiels;
    if (refs === null) {
      throw new Error(`${VisiteImportError.NON_PREPARE}: parseRow appelée avant prepare.`);
    }

    const sheet = cells[SHEET_CELL] ?? '';
    const refuse = (column: string, code: string, detail: string): ParsedRow<VisiteImportRow> => ({
      ok: false,
      error: {
        rowNumber,
        column,
        code,
        message: sheet === '' ? detail : `Onglet « ${sheet} » : ${detail}`,
      },
    });

    const rawDate = (cells[H.date] ?? '').trim();
    if (rawDate === '') {
      return refuse(H.date, VisiteImportError.DATE_ABSENTE, 'la date de la visite manque.');
    }

    const date = readSheetDate(rawDate);
    if (date === null) {
      return refuse(
        H.date,
        VisiteImportError.DATE_ILLISIBLE,
        `« ${rawDate} » n’est pas une date. Saisissez une vraie date Excel.`,
      );
    }

    const rawTime = (cells[H.heure] ?? '').trim();
    const time = rawTime === '' ? null : readSheetTime(rawTime);
    if (rawTime !== '' && time === null) {
      return refuse(
        H.heure,
        VisiteImportError.HEURE_ILLISIBLE,
        `« ${rawTime} » ne se lit pas comme une heure. Écrivez 11H08, ou laissez vide.`,
      );
    }

    const visitorName = (cells[H.nom] ?? '').trim();
    if (visitorName.length < 2) {
      return refuse(H.nom, VisiteImportError.NOM_ABSENT, 'le nom du visiteur manque.');
    }

    const entreprise = this.resolve(refs.entreprises, cells[H.entreprise]);
    if (entreprise === null) {
      return refuse(
        H.entreprise,
        ...this.missReason(refs, (cells[H.entreprise] ?? '').trim(), 'entreprise'),
      );
    }

    const rawDirection = (cells[H.direction] ?? '').trim();
    const direction = rawDirection === '' ? null : this.resolve(refs.directions, rawDirection);
    if (rawDirection !== '' && direction === null) {
      return refuse(H.direction, ...this.missReason(refs, rawDirection, 'direction'));
    }

    const rawDestinataire = (cells[H.destinataire] ?? '').trim();
    const destinataire =
      rawDestinataire === '' ? null : this.resolve(refs.destinataires, rawDestinataire);
    if (rawDestinataire !== '' && destinataire === null) {
      return refuse(H.destinataire, ...this.missReason(refs, rawDestinataire, 'destinataire'));
    }

    const objet = this.resolve(refs.objets, cells[H.objet]);
    if (objet === null) {
      return refuse(H.objet, ...this.missReason(refs, (cells[H.objet] ?? '').trim(), 'objet'));
    }

    const phone = (cells[H.telephone] ?? '').trim();
    const comment = (cells[H.commentaire] ?? '').trim();

    return {
      ok: true,
      row: {
        rowNumber,
        sheet,
        date,
        time,
        visitorName: visitorName.slice(0, 160),
        phone: phone === '' ? null : phone.slice(0, 40),
        phoneE164: tryNormalizePhone(phone) ?? null,
        entrepriseId: entreprise.id,
        objetId: objet.id,
        directionId: direction?.id ?? null,
        destinataireId: destinataire?.id ?? null,
        comment: comment === '' ? null : comment.slice(0, 2_000),
      },
    };
  }

  async writeChunk(rows: readonly VisiteImportRow[], ctx: ImportRunContext): Promise<ChunkOutcome> {
    if (rows.length === 0) return { created: 0, skipped: 0, errors: [] };

    const state = this.runs.get(ctx.jobId) ?? { seen: new Map<string, VisiteImportRow>() };
    this.runs.set(ctx.jobId, state);

    const errors: ImportRowError[] = [];
    let skipped = 0;

    const unique: VisiteImportRow[] = [];
    for (const row of rows) {
      const key = visiteDedupKey(row);
      const previous = state.seen.get(key);
      if (previous !== undefined) {
        skipped += 1;
        errors.push({
          rowNumber: row.rowNumber,
          column: H.nom,
          code: VisiteImportError.DOUBLON_DANS_LE_FICHIER,
          message: `Même visiteur, même entreprise, même instant qu’à la ligne ${String(previous.rowNumber)} de l’onglet « ${previous.sheet} ».`,
        });
        continue;
      }
      state.seen.set(key, row);
      unique.push(row);
    }

    // Le registre de démonstration est un jeu d'affichage : une visite fictive
    // ne doit pas faire passer une vraie visite pour déjà enregistrée.
    const known = new Set<string>();
    const existing = await ctx.tx.visite.findMany({
      where: {
        isDemo: false,
        visitedAt: { in: unique.map((row) => visiteInstant(row.date, row.time ?? undefined)) },
        entrepriseId: { in: unique.map((row) => row.entrepriseId) },
      },
      select: { visitedAt: true, timeKnown: true, visitorName: true, entrepriseId: true },
    });
    for (const row of existing) known.add(dedupKeyOf(row));

    const retained: VisiteImportRow[] = [];
    for (const row of unique) {
      if (known.has(visiteDedupKey(row))) {
        skipped += 1;
        errors.push({
          rowNumber: row.rowNumber,
          column: H.nom,
          code: VisiteImportError.DEJA_AU_REGISTRE,
          message: 'Cette visite figure déjà au registre.',
        });
        continue;
      }
      retained.push(row);
    }

    if (ctx.mode === ImportMode.DRY_RUN) {
      return { created: retained.length, skipped, errors };
    }
    if (retained.length === 0) return { created: 0, skipped, errors };

    const references = await this.allocateReferences(retained, ctx);
    const written = await ctx.tx.visite.createMany({
      data: retained.map((row) => ({
        id: uuidv7(),
        reference: references.get(row) ?? '',
        visitedAt: visiteInstant(row.date, row.time ?? undefined),
        timeKnown: row.time !== null,
        visitorName: row.visitorName,
        phone: row.phone,
        phoneE164: row.phoneE164,
        entrepriseId: row.entrepriseId,
        objetId: row.objetId,
        directionId: row.directionId,
        destinataireId: row.destinataireId,
        comment: row.comment,
        createdById: ctx.requestedById,
        // La reprise d'un historique réel n'emprunte pas l'interrupteur de
        // démonstration : les lignes disparaîtraient à son extinction.
        isDemo: false,
      })),
      skipDuplicates: true,
    });

    if (written.count < retained.length) {
      const perdues = retained.length - written.count;
      skipped += perdues;
      errors.push({
        rowNumber: retained[0]?.rowNumber ?? 0,
        code: VisiteImportError.REFERENCE_EPUISEE,
        message: `${String(perdues)} ligne(s) n’ont pas été écrites : leur référence a été prise par une saisie faite à l’accueil pendant l’import.`,
      });
    }

    return { created: written.count, skipped, errors };
  }

  /** Le rang du registre court par ANNÉE, et le classeur en couvre deux. */
  private async allocateReferences(
    rows: readonly VisiteImportRow[],
    ctx: ImportRunContext,
  ): Promise<Map<VisiteImportRow, string>> {
    const years = [...new Set(rows.map((row) => Number(row.date.slice(0, 4))))];
    const next = new Map<number, number>();

    for (const year of years) {
      // LECTURE GLOBALE : l'unicité de la référence est portée par un index
      // global, lignes de démonstration comprises. Cloisonner ici rendrait un
      // rang déjà pris. Même motif que `VisitesService.nextSequence`.
      const last = await ctx.tx.visite.findFirst({
        where: { reference: { startsWith: visiteReferencePrefix(year) } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
      });
      next.set(year, nextVisiteSequence(last?.reference, year));
    }

    const references = new Map<VisiteImportRow, string>();
    for (const row of rows) {
      const year = Number(row.date.slice(0, 4));
      const sequence = next.get(year) ?? 1;
      next.set(year, sequence + 1);
      references.set(row, formatVisiteReference(year, sequence));
    }
    return references;
  }

  private resolve(index: ReadonlyMap<string, Entry>, raw: string | undefined): Entry | null {
    const key = normalizeKey((raw ?? '').trim());
    if (key === '') return null;

    const direct = index.get(key);
    if (direct !== undefined) return direct;

    const code = LIBELLES_DU_CLASSEUR.get(key);
    return code === undefined ? null : (index.get(normalizeKey(code)) ?? null);
  }

  /**
   * Ce que la cellule contient VRAIMENT, quand elle ne contient pas ce qu'on
   * attend. Le classeur porte des téléphones sous ENTREPRISE et des
   * destinataires sous OBJECT VISITE : dire « inconnu » ferait chercher une
   * entrée à ajouter, alors que la ligne est décalée d'un cran.
   */
  private missReason(
    refs: Referentiels,
    raw: string,
    attendu: 'entreprise' | 'direction' | 'destinataire' | 'objet',
  ): [string, string] {
    const codes = {
      entreprise: VisiteImportError.ENTREPRISE_INCONNUE,
      direction: VisiteImportError.DIRECTION_INCONNUE,
      destinataire: VisiteImportError.DESTINATAIRE_INCONNU,
      objet: VisiteImportError.OBJET_INCONNU,
    } as const;
    const listes = {
      entreprise: 'ENTREPRISES',
      direction: 'DIRECTIONS &/OU NIVEAU',
      destinataire: 'DESTINATAIRES',
      objet: 'OBJECT VISITE',
    } as const;

    if (raw === '') {
      return [codes[attendu], `la colonne ${listes[attendu]} est vide, elle est obligatoire.`];
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
        `« ${raw} » appartient à la liste des ${owner}, pas à ${listes[attendu]}. Les colonnes de cette ligne sont décalées.`,
      ];
    }

    return [
      codes[attendu],
      `« ${raw} » ne figure pas dans la liste ${listes[attendu]}. Corrigez la cellule, ou ajoutez l’entrée à la liste avant de relancer.`,
    ];
  }
}
