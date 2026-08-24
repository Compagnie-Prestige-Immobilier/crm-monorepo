import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import {
  ImportMode,
  VISITE_DESTINATAIRES,
  VISITE_DIRECTIONS,
  VISITE_ENTREPRISES,
  VISITE_OBJETS,
} from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ImportRunContext } from '../imports/import-adapter.js';
import { VisiteImportError } from '../imports/visites-referentiels.js';
import {
  VisitesRegistreAdapter,
  type VisiteRegistreRow,
} from '../imports/visites-registre.adapter.js';
import {
  VISITES_REGISTRE_COLUMNS,
  VISITES_REGISTRE_HEADERS,
  VISITES_REGISTRE_LAYOUT,
  VISITES_REGISTRE_SHEET,
} from '../imports/visites-registre.template.js';
import {
  projectSheets,
  type RowLike,
  type SheetLike,
  type SheetRow,
} from '../imports/xlsx-rows.js';
import type { VisitesService } from '../visites/visites.service.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';
import { VisitesExportService } from './visites-export.service.js';

const H = VISITES_REGISTRE_HEADERS;

const idOf = (prefix: string, code: string): string => `${prefix}:${code}`;

const REFERENTIEL_LABEL = new Map<string, string>([
  ...VISITE_ENTREPRISES.map((r) => [idOf('ent', r.code), r.label] as const),
  ...VISITE_DIRECTIONS.map((r) => [idOf('dir', r.code), r.label] as const),
  ...VISITE_DESTINATAIRES.map((r) => [idOf('des', r.code), r.label] as const),
  ...VISITE_OBJETS.map((r) => [idOf('obj', r.code), r.label] as const),
]);

const CPI = { id: idOf('ent', 'CPI'), code: 'CPI', label: 'CPI' };
const SUIVI = {
  id: idOf('obj', 'SUIVI_DOSSIER'),
  code: 'SUIVI_DOSSIER',
  label: 'SUIVI DE DOSSIER',
};
const COMMERCIALE = { id: idOf('dir', 'COMMERCIALE'), code: 'COMMERCIALE', label: 'COMMERCIALE' };
const NDOYE = { id: idOf('des', 'NDOYE'), code: 'NDOYE', label: 'MME. NDOYE (RESP. COMM.)' };

interface FakeVisite {
  id: string;
  reference: string;
  visitedAt: Date;
  timeKnown: boolean;
  visitorName: string;
  phone: string | null;
  phoneE164: string | null;
  entrepriseId: string;
  objetId: string;
  directionId: string | null;
  destinataireId: string | null;
  comment: string | null;
  createdAt: Date;
}

/** Trois visites contrastées, comme l'aller-retour neutre l'exige. */
const VISITE_SANS_HEURE: FakeVisite = {
  id: 'v-1',
  reference: 'V-2026-000001',
  visitedAt: new Date('2026-01-06T00:00:00.000Z'),
  timeKnown: false,
  visitorName: 'MOUHAMED FALL',
  phone: '77 123 45 67',
  phoneE164: '+221771234567',
  entrepriseId: CPI.id,
  objetId: SUIVI.id,
  directionId: COMMERCIALE.id,
  destinataireId: NDOYE.id,
  comment: null,
  createdAt: new Date('2026-01-06T09:00:00.000Z'),
};

const VISITE_SANS_DIRECTION: FakeVisite = {
  id: 'v-2',
  reference: 'V-2026-000002',
  visitedAt: new Date('2026-01-07T09:00:00.000Z'),
  timeKnown: true,
  visitorName: 'AWA SY',
  phone: null,
  phoneE164: null,
  entrepriseId: CPI.id,
  objetId: SUIVI.id,
  directionId: null,
  destinataireId: null,
  comment: null,
  createdAt: new Date('2026-01-07T09:05:00.000Z'),
};

const VISITE_COMMENTAIRE_APOSTROPHES: FakeVisite = {
  id: 'v-3',
  reference: 'V-2026-000003',
  visitedAt: new Date('2026-01-08T14:30:00.000Z'),
  timeKnown: true,
  visitorName: "M. O'CONNOR",
  phone: 'XX-INCONNU-99',
  phoneE164: null,
  entrepriseId: CPI.id,
  objetId: SUIVI.id,
  directionId: COMMERCIALE.id,
  destinataireId: null,
  comment: "Client d'accueil, très pressé. Reçu par « l'assistante »",
  createdAt: new Date('2026-01-08T15:00:00.000Z'),
};

const VISITES = [VISITE_SANS_HEURE, VISITE_SANS_DIRECTION, VISITE_COMMENTAIRE_APOSTROPHES];

function toPayload(visite: FakeVisite) {
  return {
    ...visite,
    entreprise: { label: REFERENTIEL_LABEL.get(visite.entrepriseId) ?? '' },
    objet: { label: REFERENTIEL_LABEL.get(visite.objetId) ?? '' },
    direction: visite.directionId
      ? { label: REFERENTIEL_LABEL.get(visite.directionId) ?? '' }
      : null,
    destinataire: visite.destinataireId
      ? { label: REFERENTIEL_LABEL.get(visite.destinataireId) ?? '' }
      : null,
  };
}

function exportPrisma(visites: readonly FakeVisite[]): PrismaService {
  return {
    visite: { findMany: () => Promise.resolve(visites.map(toPayload)) },
  } as unknown as PrismaService;
}

const visitesServiceStub = (): VisitesService =>
  ({ buildWhere: () => ({}) }) as unknown as VisitesService;

async function exporterEtLire(
  visites: readonly FakeVisite[],
  demo: boolean,
): Promise<ExcelJS.Workbook> {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) =>
    sink.on('finish', () => {
      resolve();
    }),
  );

  await new VisitesExportService(
    exportPrisma(visites),
    visitesServiceStub(),
    fakeWorkspace(demo),
  ).writeVisites({}, sink);
  await done;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.concat(chunks) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook;
}

/** Une worksheet BUFFERÉE, adaptée en `SheetLike` : `projectSheets` est le vrai chemin de lecture. */
function sheetsOf(workbook: ExcelJS.Workbook): AsyncIterable<SheetLike> {
  return {
    [Symbol.asyncIterator]() {
      const worksheets = workbook.worksheets;
      let index = 0;
      return {
        next(): Promise<IteratorResult<SheetLike>> {
          if (index >= worksheets.length) return Promise.resolve({ done: true, value: undefined });
          const sheet = worksheets[index];
          index += 1;
          if (!sheet) return Promise.resolve({ done: true, value: undefined });
          return Promise.resolve({ done: false, value: rowsOf(sheet) });
        },
      };
    },
  };
}

function rowsOf(sheet: ExcelJS.Worksheet): SheetLike {
  return {
    name: sheet.name,
    [Symbol.asyncIterator]() {
      let number = 1;
      const last = sheet.rowCount;
      return {
        next(): Promise<IteratorResult<RowLike>> {
          if (number > last) return Promise.resolve({ done: true, value: undefined });
          const row = sheet.getRow(number);
          number += 1;
          const like: RowLike = {
            number: row.number,
            cellCount: row.cellCount,
            getCell: (index: number) => row.getCell(index),
          };
          return Promise.resolve({ done: false, value: like });
        },
      };
    },
  };
}

async function projectAll(workbook: ExcelJS.Workbook): Promise<SheetRow[]> {
  const rows: SheetRow[] = [];
  for await (const row of projectSheets(
    sheetsOf(workbook),
    VISITES_REGISTRE_COLUMNS,
    VISITES_REGISTRE_LAYOUT,
  )) {
    rows.push(row);
  }
  return rows;
}

function fakeTx(visites: readonly FakeVisite[]) {
  const changes: Record<string, unknown>[] = [];
  return {
    changes,
    tx: {
      visite: {
        findMany: (args: { where: { reference: { in: string[] } } }) => {
          const wanted = new Set(args.where.reference.in);
          return Promise.resolve(visites.filter((v) => wanted.has(v.reference)).map(toPayload));
        },
      },
      visiteImportChange: {
        upsert: (args: { create: Record<string, unknown> }) => {
          changes.push(args.create);
          return Promise.resolve(args.create);
        },
        count: () => Promise.resolve(changes.length),
      },
    } as unknown as ImportRunContext['tx'],
  };
}

function referentielsRun(): ImportRunContext {
  const list = (
    seeds: readonly { code: string; label: string }[],
    prefix: string,
  ): { findMany: () => Promise<{ id: string; code: string; label: string }[]> } => ({
    findMany: () =>
      Promise.resolve(
        seeds.map((seed) => ({ id: idOf(prefix, seed.code), code: seed.code, label: seed.label })),
      ),
  });

  return {
    jobId: 'job-1',
    mode: ImportMode.DRY_RUN,
    requestedById: 'admin-1',
    tx: {
      visiteEntreprise: list(VISITE_ENTREPRISES, 'ent'),
      visiteDirection: list(VISITE_DIRECTIONS, 'dir'),
      visiteDestinataire: list(VISITE_DESTINATAIRES, 'des'),
      visiteObjet: list(VISITE_OBJETS, 'obj'),
    } as unknown as ImportRunContext['tx'],
  };
}

describe('l’aller-retour neutre : export puis relecture ne signale rien', () => {
  it('zéro création, zéro correction, zéro erreur, zéro ligne de différentiel', async () => {
    const adapter = new VisitesRegistreAdapter();
    const run = await adapter.prepare(referentielsRun());

    const workbook = await exporterEtLire(VISITES, false);
    const projected = await projectAll(workbook);
    expect(projected).toHaveLength(3);

    const rows: VisiteRegistreRow[] = projected.map((raw) => {
      const parsed = adapter.parseRow(raw.cells, raw.rowNumber, run);
      if (!parsed.ok)
        throw new Error(`ligne refusée à tort : ${parsed.error.code} ${parsed.error.message}`);
      return parsed.row;
    });

    const { tx, changes } = fakeTx(VISITES);
    const ctx: ImportRunContext = {
      jobId: 'job-1',
      mode: ImportMode.DRY_RUN,
      requestedById: 'admin-1',
      tx,
    };
    const outcome = await adapter.writeChunk(rows, ctx);

    expect(outcome.created).toBe(0);
    expect(outcome.updated ?? 0).toBe(0);
    expect(outcome.errors).toEqual([]);
    expect(outcome.skipped).toBe(3);
    expect(changes).toHaveLength(0);
  });

  it('accepte l’alias OBJECT VISITE', async () => {
    const workbook = await exporterEtLire(VISITES, false);
    const sheet = workbook.getWorksheet(VISITES_REGISTRE_SHEET);
    if (!sheet) throw new Error('feuille absente');
    const objetColumn = VISITES_REGISTRE_COLUMNS.findIndex((c) => c.header === H.objet) + 1;
    sheet.getRow(1).getCell(objetColumn).value = 'OBJECT VISITE';

    const projected = await projectAll(workbook);
    expect(projected).toHaveLength(3);
    expect(projected[0]?.cells[H.objet]).toBe('SUIVI DE DOSSIER');
  });

  it('déplacer une colonne et en intercaler une inconnue ne change rien', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(VISITES_REGISTRE_SHEET);
    sheet.addRow([H.nom, 'COLONNE INCONNUE', H.date, H.entreprise, H.objet]);
    sheet.addRow([]);
    sheet.addRow([
      'MOUHAMED FALL',
      'peu importe',
      new Date(Date.UTC(2026, 0, 6)),
      'CPI',
      'SUIVI DE DOSSIER',
    ]);

    const projected = await projectAll(workbook);
    expect(projected).toHaveLength(1);
    expect(projected[0]?.cells[H.nom]).toBe('MOUHAMED FALL');
    expect(projected[0]?.cells[H.entreprise]).toBe('CPI');
  });

  it('la ligne 2 n’est jamais lue, dans les deux modes', async () => {
    for (const demo of [true, false]) {
      const workbook = await exporterEtLire(VISITES, demo);
      const projected = await projectAll(workbook);
      expect(projected).toHaveLength(3);
      expect(projected[0]?.rowNumber).toBe(3);
      expect(projected[0]?.cells[H.nom]).toBe('MOUHAMED FALL');
    }
  });
});

describe('la revue nomme précisément ce qui change', () => {
  async function simulerUneLigne(row: FakeVisite, autre: FakeVisite): Promise<VisiteRegistreRow> {
    const adapter = new VisitesRegistreAdapter();
    const run = await adapter.prepare(referentielsRun());
    const workbook = await exporterEtLire([row], false);
    const [projected] = await projectAll(workbook);
    if (!projected) throw new Error('rien à projeter');
    const parsed = adapter.parseRow(projected.cells, projected.rowNumber, run);
    if (!parsed.ok) throw new Error(`refusée : ${parsed.error.code}`);
    void autre;
    return parsed.row;
  }

  it('une cellule modifiée donne exactement une différence nommant la bonne colonne', async () => {
    const adapter = new VisitesRegistreAdapter();
    const parsedRow = await simulerUneLigne(VISITE_SANS_HEURE, VISITE_SANS_HEURE);

    const modifiee: FakeVisite = { ...VISITE_SANS_HEURE, comment: 'Autre chose' };
    const { tx, changes } = fakeTx([modifiee]);
    const ctx: ImportRunContext = {
      jobId: 'job-1',
      mode: ImportMode.DRY_RUN,
      requestedById: 'admin-1',
      tx,
    };
    const outcome = await adapter.writeChunk([parsedRow], ctx);

    expect(outcome.updated).toBe(1);
    expect(changes).toHaveLength(1);
    const fields = changes[0]?.fields as { label: string }[];
    expect(fields).toHaveLength(1);
    expect(fields[0]?.label).toBe(H.commentaire);
  });

  it('une ligne sans numéro donne une création', async () => {
    const adapter = new VisitesRegistreAdapter();
    const run = await adapter.prepare(referentielsRun());
    const parsed = adapter.parseRow(
      {
        [H.numero]: '',
        [H.date]: '06/01/2026',
        [H.heure]: '',
        [H.nom]: 'NOUVEAU VISITEUR',
        [H.telephone]: '',
        [H.entreprise]: 'CPI',
        [H.direction]: '',
        [H.destinataire]: '',
        [H.objet]: 'SUIVI DE DOSSIER',
        [H.commentaire]: '',
      },
      3,
      run,
    );
    if (!parsed.ok) throw new Error('refusée à tort');

    const { tx, changes } = fakeTx([]);
    const ctx: ImportRunContext = {
      jobId: 'job-1',
      mode: ImportMode.DRY_RUN,
      requestedById: 'admin-1',
      tx,
    };
    const outcome = await adapter.writeChunk([parsed.row], ctx);

    expect(outcome.created).toBe(1);
    expect(changes).toHaveLength(1);
  });

  it('un numéro inconnu donne un refus et aucune création', async () => {
    const adapter = new VisitesRegistreAdapter();
    const run = await adapter.prepare(referentielsRun());
    const parsed = adapter.parseRow(
      {
        [H.numero]: 'V-2026-999999',
        [H.date]: '06/01/2026',
        [H.heure]: '',
        [H.nom]: 'INCONNU',
        [H.telephone]: '',
        [H.entreprise]: 'CPI',
        [H.direction]: '',
        [H.destinataire]: '',
        [H.objet]: 'SUIVI DE DOSSIER',
        [H.commentaire]: '',
      },
      3,
      run,
    );
    if (!parsed.ok) throw new Error('refusée à tort');

    const { tx, changes } = fakeTx([]);
    const ctx: ImportRunContext = {
      jobId: 'job-1',
      mode: ImportMode.DRY_RUN,
      requestedById: 'admin-1',
      tx,
    };
    const outcome = await adapter.writeChunk([parsed.row], ctx);

    expect(outcome.created).toBe(0);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]?.code).toBe(VisiteImportError.REGISTRE_NUMERO_INCONNU);
    expect(changes).toHaveLength(0);
  });
});
