import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ImportKind, ImportMode, VisiteImportChangeKind, type Prisma } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { audit, AuditAction } from '../../common/audit.js';
import { tryNormalizePhone } from '../../common/phone.js';
import { dakarDate, visiteInstant } from '../visites/visites.service.js';
import type {
  ChunkOutcome,
  ImportAdapter,
  ImportColumn,
  ImportRowError,
  ImportRunContext,
  ParsedRow,
  SheetLayout,
} from './import-adapter.js';
import { ImportAdapterFailure } from './import-adapter.js';
import { importCell, unresolvedImportValue } from './import-adapter.js';
import {
  VisiteImportError,
  allocateVisiteReferences,
  loadVisiteReferentiels,
  readSheetDate,
  readSheetTime,
  referentielMissReason,
  resolveReferentiel,
  type Entry,
  type VisiteReferentiels,
} from './visites-referentiels.js';
import {
  VISITES_REGISTRE_COLUMNS,
  VISITES_REGISTRE_HEADERS,
  VISITES_REGISTRE_LAYOUT,
} from './visites-registre.template.js';
import { SHEET_CELL } from './xlsx-rows.js';

/**
 * L'aller-retour Excel du registre : la directrice exporte, corrige dans le
 * classeur, redépose. `N° REGISTRE` porte l'identité — vide, la ligne est une
 * création ; renseigné et inconnu, elle est REFUSÉE, jamais repliée sur une
 * création.
 *
 * Chaque différence est écrite dans `VisiteImportChange`, jamais dans
 * `Visite` : la SIMULATION calcule et propose, l'APPLICATION relit le même
 * fichier et écrit ce qui reste coché. Voir `visites-registre.revue.service.ts`
 * pour l'écran de revue et `writeChunk` ci-dessous pour les deux passes.
 */

const VISITES_REGISTRE_MAX_ROWS = 20_000;
const VISITES_REGISTRE_MAX_DIFFERENCES = 5_000;

const H = VISITES_REGISTRE_HEADERS;

const DATE_FR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Une date retapée à la française se lit ; un mois > 12 ne se devine pas. */
function readRegistreDate(raw: string): string | null {
  const iso = readSheetDate(raw);
  if (iso !== null) return iso;

  const match = DATE_FR.exec(raw.trim());
  if (match === null) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year)}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Une heure retapée peut devenir une fraction de journée sous la plume
 * d'Excel : `0,604166…` pour 14:30. Essayée EN PREMIER, avant de déléguer au
 * lecteur du classeur historique.
 */
function readRegistreTime(raw: string): string | null {
  const trimmed = raw.trim();
  const fraction = Number(trimmed);
  if (Number.isFinite(fraction) && fraction >= 0 && fraction < 1 && /[.,]/.test(trimmed)) {
    const totalMinutes = Math.round(fraction * 1_440);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${pad2(hour)}:${pad2(minute)}`;
  }
  return readSheetTime(trimmed);
}

export interface VisiteRegistreRow {
  readonly rowNumber: number;
  readonly sheet: string;
  readonly reference: string | null;
  readonly date: string;
  readonly time: string | null;
  readonly visitorName: string;
  readonly phone: string | null;
  readonly phoneE164: string | null;
  readonly entreprise: Entry;
  readonly objet: Entry;
  readonly direction: Entry | null;
  readonly destinataire: Entry | null;
  readonly comment: string | null;
}

export interface VisiteRegistreRun {
  readonly refs: VisiteReferentiels;
}

/** Les colonnes comparées, dans l'ordre du classeur : avant/après s'y lisent colonne par colonne. */
type FieldKey =
  | 'date'
  | 'heure'
  | 'nom'
  | 'telephone'
  | 'entreprise'
  | 'direction'
  | 'destinataire'
  | 'objet'
  | 'commentaire';

const FIELD_LABELS: Record<FieldKey, string> = {
  date: H.date,
  heure: H.heure,
  nom: H.nom,
  telephone: H.telephone,
  entreprise: H.entreprise,
  direction: H.direction,
  destinataire: H.destinataire,
  objet: H.objet,
  commentaire: H.commentaire,
};

type Fields = Record<FieldKey, string>;

function fieldsOfRow(row: VisiteRegistreRow): Fields {
  return {
    date: row.date,
    heure: row.time ?? '',
    nom: row.visitorName,
    telephone: row.phone ?? '',
    entreprise: row.entreprise.label,
    direction: row.direction?.label ?? '',
    destinataire: row.destinataire?.label ?? '',
    objet: row.objet.label,
    commentaire: row.comment ?? '',
  };
}

const VISITE_INCLUDE = {
  entreprise: { select: { id: true, label: true } },
  direction: { select: { id: true, label: true } },
  destinataire: { select: { id: true, label: true } },
  objet: { select: { id: true, label: true } },
} as const;

type VisiteRow = Prisma.VisiteGetPayload<{ include: typeof VISITE_INCLUDE }>;

function fieldsOfVisite(visite: VisiteRow): Fields {
  return {
    date: dakarDate(visite.visitedAt),
    heure: visite.timeKnown ? timeOf(visite.visitedAt) : '',
    nom: visite.visitorName,
    telephone: visite.phone ?? '',
    entreprise: visite.entreprise.label,
    direction: visite.direction?.label ?? '',
    destinataire: visite.destinataire?.label ?? '',
    objet: visite.objet.label,
    commentaire: visite.comment ?? '',
  };
}

/** Reformatée en heure MURALE de Dakar : `visitedAt` est un instant UTC réel. */
function timeOf(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dakar',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

function fieldsEqual(a: Fields, b: Fields): boolean {
  return (Object.keys(FIELD_LABELS) as FieldKey[]).every((key) => a[key] === b[key]);
}

function diffOf(
  before: Fields,
  after: Fields,
): { field: string; label: string; before: string; after: string }[] {
  const diffs: { field: string; label: string; before: string; after: string }[] = [];
  for (const key of Object.keys(FIELD_LABELS) as FieldKey[]) {
    if (before[key] !== after[key]) {
      diffs.push({ field: key, label: FIELD_LABELS[key], before: before[key], after: after[key] });
    }
  }
  return diffs;
}

function hashOf(fields: Fields): string {
  const canonical = (Object.keys(FIELD_LABELS) as FieldKey[])
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

const changeKey = (sheet: string, rowNumber: number): string => `${sheet} ${String(rowNumber)}`;

function labelOf(row: { date: string; time: string | null; visitorName: string }): string {
  const [year, month, day] = row.date.split('-');
  const jour = `${day ?? ''}/${month ?? ''}`;
  return row.time === null
    ? `${row.visitorName}, ${jour}/${year ?? ''}`
    : `${row.visitorName}, ${jour} ${row.time}`;
}

@Injectable()
export class VisitesRegistreAdapter implements ImportAdapter<VisiteRegistreRow, VisiteRegistreRun> {
  readonly kind = ImportKind.VISITES_REGISTRE;
  readonly maxRows = VISITES_REGISTRE_MAX_ROWS;
  readonly templateColumns: readonly ImportColumn[] = VISITES_REGISTRE_COLUMNS;
  readonly layout: SheetLayout = VISITES_REGISTRE_LAYOUT;

  async prepare(ctx: ImportRunContext): Promise<VisiteRegistreRun> {
    return { refs: await loadVisiteReferentiels(ctx.tx) };
  }

  parseRow(
    cells: Record<string, string>,
    rowNumber: number,
    run: VisiteRegistreRun,
  ): ParsedRow<VisiteRegistreRow> {
    const refs = run.refs;
    const sheet = importCell(cells, SHEET_CELL);
    const refuse = (
      column: string,
      code: string,
      detail: string,
    ): ParsedRow<VisiteRegistreRow> => ({
      ok: false,
      error: { rowNumber, column, code, message: detail },
    });

    const reference = importCell(cells, H.numero);

    const rawDate = importCell(cells, H.date);
    if (rawDate === '') {
      return refuse(H.date, VisiteImportError.DATE_ABSENTE, 'la date de la visite manque.');
    }
    const date = readRegistreDate(rawDate);
    if (date === null) {
      return refuse(
        H.date,
        VisiteImportError.DATE_ILLISIBLE,
        `« ${rawDate} » n’est pas une date. Écrivez jj/mm/aaaa, ou laissez une vraie date Excel.`,
      );
    }

    const rawTime = importCell(cells, H.heure);
    const time = rawTime === '' ? null : readRegistreTime(rawTime);
    if (unresolvedImportValue(rawTime, time)) {
      return refuse(
        H.heure,
        VisiteImportError.HEURE_ILLISIBLE,
        `« ${rawTime} » ne se lit pas comme une heure. Écrivez 14:30, ou laissez vide.`,
      );
    }

    const visitorName = importCell(cells, H.nom);
    if (visitorName.length < 2) {
      return refuse(H.nom, VisiteImportError.NOM_ABSENT, 'le nom du visiteur manque.');
    }

    const entreprise = resolveReferentiel(refs.entreprises, cells[H.entreprise]);
    if (entreprise === null) {
      return refuse(
        H.entreprise,
        ...referentielMissReason(refs, importCell(cells, H.entreprise), 'entreprise'),
      );
    }

    const rawDirection = importCell(cells, H.direction);
    const direction =
      rawDirection === '' ? null : resolveReferentiel(refs.directions, rawDirection);
    if (unresolvedImportValue(rawDirection, direction)) {
      return refuse(H.direction, ...referentielMissReason(refs, rawDirection, 'direction'));
    }

    const rawDestinataire = importCell(cells, H.destinataire);
    const destinataire =
      rawDestinataire === '' ? null : resolveReferentiel(refs.destinataires, rawDestinataire);
    if (unresolvedImportValue(rawDestinataire, destinataire)) {
      return refuse(
        H.destinataire,
        ...referentielMissReason(refs, rawDestinataire, 'destinataire'),
      );
    }

    const objet = resolveReferentiel(refs.objets, cells[H.objet]);
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
        reference: reference === '' ? null : reference,
        date,
        time,
        visitorName: visitorName.slice(0, 160),
        phone: phone === '' ? null : phone.slice(0, 40),
        phoneE164: tryNormalizePhone(phone) ?? null,
        entreprise,
        objet,
        direction,
        destinataire,
        comment: comment === '' ? null : comment.slice(0, 2_000),
      },
    };
  }

  async writeChunk(
    rows: readonly VisiteRegistreRow[],
    ctx: ImportRunContext,
  ): Promise<ChunkOutcome> {
    if (rows.length === 0) return { created: 0, updated: 0, skipped: 0, errors: [] };

    return ctx.mode === ImportMode.DRY_RUN ? this.simulate(rows, ctx) : this.apply(rows, ctx);
  }

  /**
   * Calcule les différences et les PERSISTE : ce n'est pas une vraie
   * simulation, la revue doit survivre à la requête HTTP qui l'a demandée.
   */
  private async simulate(
    rows: readonly VisiteRegistreRow[],
    ctx: ImportRunContext,
  ): Promise<ChunkOutcome> {
    const errors: ImportRowError[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const withReference = rows.filter((row) => row.reference !== null);
    const existing =
      withReference.length === 0
        ? []
        : await ctx.tx.visite.findMany({
            where: { reference: { in: withReference.map((row) => row.reference as string) } },
            include: VISITE_INCLUDE,
          });
    const byReference = new Map(existing.map((visite) => [visite.reference, visite]));

    for (const row of rows) {
      if (row.reference === null) {
        created += 1;
        await ctx.tx.visiteImportChange.upsert({
          where: {
            importJobId_sheet_rowNumber: {
              importJobId: ctx.jobId,
              sheet: row.sheet,
              rowNumber: row.rowNumber,
            },
          },
          update: {
            kind: VisiteImportChangeKind.CREATE,
            reference: null,
            visiteId: null,
            label: labelOf(row),
            fields: diffOf(blankFields(), fieldsOfRow(row)),
            rowHash: null,
          },
          create: {
            id: uuidv7(),
            importJobId: ctx.jobId,
            sheet: row.sheet,
            rowNumber: row.rowNumber,
            kind: VisiteImportChangeKind.CREATE,
            reference: null,
            visiteId: null,
            label: labelOf(row),
            fields: diffOf(blankFields(), fieldsOfRow(row)),
            rowHash: null,
          },
        });
        continue;
      }

      const visite = byReference.get(row.reference);
      if (visite === undefined) {
        errors.push({
          rowNumber: row.rowNumber,
          column: H.numero,
          code: VisiteImportError.REGISTRE_NUMERO_INCONNU,
          message: `« ${row.reference} » ne figure pas au registre. Vérifiez le numéro, ou laissez la colonne vide pour créer une visite.`,
        });
        continue;
      }

      const before = fieldsOfVisite(visite);
      const after = fieldsOfRow(row);
      if (fieldsEqual(before, after)) {
        skipped += 1;
        continue;
      }

      updated += 1;
      await ctx.tx.visiteImportChange.upsert({
        where: {
          importJobId_sheet_rowNumber: {
            importJobId: ctx.jobId,
            sheet: row.sheet,
            rowNumber: row.rowNumber,
          },
        },
        update: {
          kind: VisiteImportChangeKind.UPDATE,
          reference: row.reference,
          visiteId: visite.id,
          label: labelOf(row),
          fields: diffOf(before, after),
          rowHash: hashOf(before),
        },
        create: {
          id: uuidv7(),
          importJobId: ctx.jobId,
          sheet: row.sheet,
          rowNumber: row.rowNumber,
          kind: VisiteImportChangeKind.UPDATE,
          reference: row.reference,
          visiteId: visite.id,
          label: labelOf(row),
          fields: diffOf(before, after),
          rowHash: hashOf(before),
        },
      });
    }

    const total = await ctx.tx.visiteImportChange.count({ where: { importJobId: ctx.jobId } });
    if (total > VISITES_REGISTRE_MAX_DIFFERENCES) {
      throw new ImportAdapterFailure(
        VisiteImportError.REGISTRE_TROP_DE_DIFFERENCES,
        `${total.toLocaleString('fr-FR')} différences détectées. Ce n’est plus une revue. ` +
          'Réexportez une période plus courte.',
      );
    }

    return { created, updated, skipped, errors };
  }

  /** Relit le MÊME fichier et écrit ce qui reste coché, en vérifiant le verrou optimiste. */
  private async apply(
    rows: readonly VisiteRegistreRow[],
    ctx: ImportRunContext,
  ): Promise<ChunkOutcome> {
    const errors: ImportRowError[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const changes = await ctx.tx.visiteImportChange.findMany({
      where: {
        importJobId: ctx.jobId,
        OR: rows.map((row) => ({ sheet: row.sheet, rowNumber: row.rowNumber })),
      },
    });
    const byKey = new Map(
      changes.map((change) => [changeKey(change.sheet, change.rowNumber), change]),
    );

    const toUpdate = rows.filter((row) => {
      const change = byKey.get(changeKey(row.sheet, row.rowNumber));
      return (
        change !== undefined && change.selected && change.kind === VisiteImportChangeKind.UPDATE
      );
    });
    const visiteIds = toUpdate
      .map((row) => byKey.get(changeKey(row.sheet, row.rowNumber))?.visiteId)
      .filter((id): id is string => id !== null && id !== undefined);
    const currentVisites =
      visiteIds.length === 0
        ? []
        : await ctx.tx.visite.findMany({
            where: { id: { in: visiteIds } },
            include: VISITE_INCLUDE,
          });
    const visiteById = new Map(currentVisites.map((visite) => [visite.id, visite]));

    const toCreate: VisiteRegistreRow[] = [];

    for (const row of rows) {
      const change = byKey.get(changeKey(row.sheet, row.rowNumber));
      if (change === undefined || !change.selected) {
        skipped += 1;
        continue;
      }

      if (change.kind === VisiteImportChangeKind.CREATE) {
        toCreate.push(row);
        continue;
      }

      const visite = change.visiteId === null ? undefined : visiteById.get(change.visiteId);
      if (visite === undefined) {
        errors.push({
          rowNumber: row.rowNumber,
          column: H.numero,
          code: VisiteImportError.REGISTRE_NUMERO_INCONNU,
          message: `« ${row.reference ?? ''} » ne figure plus au registre.`,
        });
        continue;
      }

      const currentFields = fieldsOfVisite(visite);
      if (hashOf(currentFields) !== change.rowHash) {
        errors.push({
          rowNumber: row.rowNumber,
          column: H.numero,
          code: VisiteImportError.REGISTRE_MODIFIEE_DEPUIS,
          message: `${change.label} a été corrigée à l’accueil depuis votre revue. Sa ligne n’a pas été écrite. Réexportez pour la revoir.`,
        });
        continue;
      }

      const after = fieldsOfRow(row);
      const before: Record<string, string> = {};
      const afterChanged: Record<string, string> = {};
      for (const diff of diffOf(currentFields, after)) {
        before[diff.label] = diff.before;
        afterChanged[diff.label] = diff.after;
      }

      await ctx.tx.visite.update({
        where: { id: visite.id },
        data: {
          visitedAt: visiteInstant(row.date, row.time ?? undefined),
          timeKnown: row.time !== null,
          visitorName: row.visitorName,
          phone: row.phone,
          phoneE164: row.phoneE164,
          entrepriseId: row.entreprise.id,
          objetId: row.objet.id,
          directionId: row.direction?.id ?? null,
          destinataireId: row.destinataire?.id ?? null,
          comment: row.comment,
        },
      });

      // `updatedAt` avance : c'est aussi le curseur de synchronisation mobile, une
      // application de plusieurs centaines de corrections remet ces visites en
      // tête du flux des téléphones. Voulu, mais bon à savoir.
      await audit(
        ctx.tx,
        { id: ctx.requestedById },
        {
          action: AuditAction.VISITE_REGISTRE_CORRECTION,
          entity: 'visite',
          entityId: visite.id,
          before,
          after: afterChanged,
        },
      );

      updated += 1;
    }

    const creation = await this.createSelected(toCreate, ctx);
    created += creation.created;
    skipped += creation.skipped;
    if (creation.error !== undefined) errors.push(creation.error);

    return { created, updated, skipped, errors };
  }

  private async createSelected(
    rows: readonly VisiteRegistreRow[],
    ctx: ImportRunContext,
  ): Promise<{ created: number; skipped: number; error?: ImportRowError }> {
    if (rows.length === 0) return { created: 0, skipped: 0 };
    const references = await allocateVisiteReferences(rows, (row) => row.date, ctx.tx);
    const written = await ctx.tx.visite.createMany({
      data: rows.map((row) => ({
        id: uuidv7(),
        reference: references.get(row) ?? '',
        visitedAt: visiteInstant(row.date, row.time ?? undefined),
        timeKnown: row.time !== null,
        visitorName: row.visitorName,
        phone: row.phone,
        phoneE164: row.phoneE164,
        entrepriseId: row.entreprise.id,
        objetId: row.objet.id,
        directionId: row.direction?.id ?? null,
        destinataireId: row.destinataire?.id ?? null,
        comment: row.comment,
        createdById: ctx.requestedById,
      })),
      skipDuplicates: true,
    });
    const skipped = rows.length - written.count;
    if (skipped === 0) return { created: written.count, skipped: 0 };
    return {
      created: written.count,
      skipped,
      error: {
        rowNumber: rows[0]?.rowNumber ?? 0,
        code: VisiteImportError.REFERENCE_EPUISEE,
        message: `${String(skipped)} ligne(s) n’ont pas été écrites : leur référence a été prise par une saisie faite à l’accueil pendant l’import.`,
      },
    };
  }
}

function blankFields(): Fields {
  return {
    date: '',
    heure: '',
    nom: '',
    telephone: '',
    entreprise: '',
    direction: '',
    destinataire: '',
    objet: '',
    commentaire: '',
  };
}
