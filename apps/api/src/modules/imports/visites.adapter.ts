import { Injectable } from '@nestjs/common';
import { ImportKind, ImportMode } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { tryNormalizePhone } from '../../common/phone.js';
import { normalizeKey } from '../representants/representants-import.service.js';
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
import { importCell, unresolvedImportValue } from './import-adapter.js';
import {
  VisiteImportError,
  allocateVisiteReferences,
  loadVisiteReferentiels,
  readSheetDate,
  readSheetTime,
  referentielMissReason,
  resolveReferentiel,
  type VisiteReferentiels,
} from './visites-referentiels.js';
import { SHEET_CELL } from './xlsx-rows.js';

export { VisiteImportError, readSheetDate, readSheetTime };

/**
 * Reprise du classeur de visites tenu à l'accueil depuis des années.
 *
 * Ce n'est pas un modèle téléchargé puis rempli : c'est un classeur vivant, un
 * onglet de données par mois au milieu de trente autres d'agrégats, en-tête en
 * ligne 3, et un mois qui compte deux colonnes de plus que les autres. D'où
 * `layout`, qui fait retrouver les colonnes par leur en-tête, onglet par onglet.
 */

export const VISITES_MAX_ROWS = 20_000;

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

/** Référentiels chargés et visites déjà vues, LE TEMPS D'UNE EXÉCUTION. */
export interface VisiteImportRun {
  readonly seen: Map<string, VisiteImportRow>;
  readonly refs: VisiteReferentiels;
}

/**
 * La liste déroulante du classeur porte ce libellé TRONQUÉ depuis l'origine :
 * douze lignes le portent. Ce n'est pas une valeur inconnue à deviner, c'est
 * l'orthographe d'accueil de `ACHAT_PRODUITS`, appariée sur la chaîne exacte.
 */
const LIBELLES_DU_CLASSEUR: ReadonlyMap<string, string> = new Map([
  [normalizeKey('ACHAT PRODUITS SANTARGILE ET/OU MAK'), 'ACHAT_PRODUITS'],
]);

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
export class VisitesImportAdapter implements ImportAdapter<VisiteImportRow, VisiteImportRun> {
  readonly kind = ImportKind.VISITES;
  readonly maxRows = VISITES_MAX_ROWS;
  readonly templateColumns: readonly ImportColumn[] = VISITES_IMPORT_COLUMNS;
  readonly layout = VISITES_SHEET_LAYOUT;

  async prepare(ctx: ImportRunContext): Promise<VisiteImportRun> {
    return { seen: new Map(), refs: await loadVisiteReferentiels(ctx.tx) };
  }

  parseRow(
    cells: Record<string, string>,
    rowNumber: number,
    run: VisiteImportRun,
  ): ParsedRow<VisiteImportRow> {
    const refs = run.refs;
    const sheet = importCell(cells, SHEET_CELL);
    const refuse = (column: string, code: string, detail: string): ParsedRow<VisiteImportRow> => ({
      ok: false,
      error: {
        rowNumber,
        column,
        code,
        message: sheet === '' ? detail : `Onglet « ${sheet} » : ${detail}`,
      },
    });

    const rawDate = importCell(cells, H.date);
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

    const rawTime = importCell(cells, H.heure);
    const time = rawTime === '' ? null : readSheetTime(rawTime);
    if (unresolvedImportValue(rawTime, time)) {
      return refuse(
        H.heure,
        VisiteImportError.HEURE_ILLISIBLE,
        `« ${rawTime} » ne se lit pas comme une heure. Écrivez 11H08, ou laissez vide.`,
      );
    }

    const visitorName = importCell(cells, H.nom);
    if (visitorName.length < 2) {
      return refuse(H.nom, VisiteImportError.NOM_ABSENT, 'le nom du visiteur manque.');
    }

    const entreprise = resolveReferentiel(
      refs.entreprises,
      cells[H.entreprise],
      LIBELLES_DU_CLASSEUR,
    );
    if (entreprise === null) {
      return refuse(
        H.entreprise,
        ...referentielMissReason(refs, importCell(cells, H.entreprise), 'entreprise'),
      );
    }

    const rawDirection = importCell(cells, H.direction);
    const direction =
      rawDirection === ''
        ? null
        : resolveReferentiel(refs.directions, rawDirection, LIBELLES_DU_CLASSEUR);
    if (unresolvedImportValue(rawDirection, direction)) {
      return refuse(H.direction, ...referentielMissReason(refs, rawDirection, 'direction'));
    }

    const rawDestinataire = importCell(cells, H.destinataire);
    const destinataire =
      rawDestinataire === ''
        ? null
        : resolveReferentiel(refs.destinataires, rawDestinataire, LIBELLES_DU_CLASSEUR);
    if (unresolvedImportValue(rawDestinataire, destinataire)) {
      return refuse(
        H.destinataire,
        ...referentielMissReason(refs, rawDestinataire, 'destinataire'),
      );
    }

    const objet = resolveReferentiel(refs.objets, cells[H.objet], LIBELLES_DU_CLASSEUR);
    if (objet === null) {
      return refuse(H.objet, ...referentielMissReason(refs, importCell(cells, H.objet), 'objet'));
    }

    const phone = importCell(cells, H.telephone);
    const comment = importCell(cells, H.commentaire);

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

  async writeChunk(
    rows: readonly VisiteImportRow[],
    ctx: ImportRunContext,
    run: VisiteImportRun,
  ): Promise<ChunkOutcome> {
    if (rows.length === 0) return { created: 0, skipped: 0, errors: [] };

    const errors: ImportRowError[] = [];
    let skipped = 0;

    const unique: VisiteImportRow[] = [];
    for (const row of rows) {
      const key = visiteDedupKey(row);
      const previous = run.seen.get(key);
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
      run.seen.set(key, row);
      unique.push(row);
    }

    const known = new Set<string>();
    const existing = await ctx.tx.visite.findMany({
      where: {
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

    const references = await allocateVisiteReferences(retained, (row) => row.date, ctx.tx);
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
}
