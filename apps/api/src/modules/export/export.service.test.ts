import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import { Role, classifySegment } from '@crm/database';
import type { Prisma } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import type { AnalyticsService } from '../analytics/analytics.service.js';
import { ExportService } from './export.service.js';
import { ExportMode } from './dto.js';
import { PROSPECT_COLUMNS } from './columns.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};

interface Fixture {
  id: string;
  nom: string;
  sigle: string;
  shortName: string;
  phase2Status: 'PENDING' | 'METHOD_OBTAINED';
  method: 'PLATFORM' | null;
}

const FIXTURES: Fixture[] = [
  {
    id: 'p-01',
    nom: 'Un',
    sigle: 'CHUES',
    shortName: 'CBAO',
    phase2Status: 'METHOD_OBTAINED',
    method: 'PLATFORM',
  },
  {
    id: 'p-02',
    nom: 'Deux',
    sigle: 'CHUES',
    shortName: 'CBAO',
    phase2Status: 'PENDING',
    method: null,
  },
  {
    id: 'p-03',
    nom: 'Trois',
    sigle: 'CHUES',
    shortName: 'BHS',
    phase2Status: 'PENDING',
    method: null,
  },
  {
    id: 'p-04',
    nom: 'Quatre',
    sigle: 'SAES',
    shortName: 'CBAO',
    phase2Status: 'PENDING',
    method: null,
  },
  {
    id: 'p-05',
    nom: 'Cinq',
    sigle: 'SAES',
    shortName: 'BHS',
    phase2Status: 'PENDING',
    method: null,
  },
  {
    id: 'p-06',
    nom: 'Six',
    sigle: 'UDEN',
    shortName: 'BHS',
    phase2Status: 'PENDING',
    method: null,
  },
  {
    id: 'p-07',
    nom: 'Sept',
    sigle: 'UDEN',
    shortName: 'CBAO',
    phase2Status: 'PENDING',
    method: null,
  },
];

const DATE = new Date('2026-08-05T10:00:00.000Z');

function row(fixture: Fixture): Record<string, unknown> {
  return {
    id: fixture.id,
    nom: fixture.nom,
    prenom: 'Prénom',
    phoneE164: `+2217700000${fixture.id.slice(-2)}`,
    rev: 1,
    statut: 'NOUVEAU',
    banqueId: `b-${fixture.shortName}`,
    syndicatId: `s-${fixture.sigle}`,
    representantId: 'r-1',
    createdById: 'com-awa',
    phase2Status: fixture.phase2Status,
    enrollmentMethod: fixture.method,
    enrollmentCapturedAt: fixture.method ? DATE : null,
    enrollmentCapturedById: fixture.method ? 'com-omar' : null,
    clientCreatedAt: DATE,
    createdAt: DATE,
    updatedAt: DATE,
    deletedAt: null,
    banque: { name: `Banque ${fixture.shortName}`, shortName: fixture.shortName },
    syndicat: { sigle: fixture.sigle, name: `Syndicat ${fixture.sigle}` },
    // Partie de l'include partagé : une doublure qui l'omet ne ressemble à
    // aucune ligne que Prisma rend vraiment.
    journeys: [{ projet: 'CHUES', statut: 'NOUVEAU' }],
    canalProvenance: null,
    professionRef: null,
    createdBy: { fullName: 'Awa Sy' },
    enrollmentCapturedBy: fixture.method ? { fullName: 'Omar Ba' } : null,
    representant: {
      id: 'r-1',
      fullName: 'Moussa Diop',
      phoneE164: '+221770000001',
      clientCreatedAt: DATE,
      departement: { name: 'Dakar' },
      createdBy: { fullName: 'Awa Sy' },
    },
  };
}

type StringFilter = string | { not?: string; gt?: string };

function matches(where: Prisma.ProspectWhereInput, candidate: Record<string, unknown>): boolean {
  const clause = where as Record<string, unknown>;

  for (const [key, expected] of Object.entries(clause)) {
    if (!matchesClause(key, expected, candidate)) return false;
  }
  return true;
}

function matchesClause(
  key: string,
  expected: unknown,
  candidate: Record<string, unknown>,
): boolean {
  if (expected === undefined) return true;
  if (key === 'AND') {
    return (expected as Prisma.ProspectWhereInput[]).every((sub) => matches(sub, candidate));
  }
  if (key === 'syndicat' || key === 'banque') {
    const relation = candidate[key] as Record<string, string>;
    const field = key === 'syndicat' ? 'sigle' : 'shortName';
    return stringMatches((expected as Record<string, StringFilter>)[field], relation[field] ?? '');
  }
  if (key === 'deletedAt') return (candidate.deletedAt ?? null) === expected;
  return stringMatches(expected as StringFilter, candidate[key] as string);
}

function stringMatches(rule: StringFilter | undefined, value: string): boolean {
  if (rule === undefined) return true;
  if (typeof rule === 'string') return value === rule;
  if (rule.not !== undefined) return value !== rule.not;
  if (rule.gt !== undefined) return value > rule.gt;
  return true;
}

function makePrisma(fixtures = FIXTURES): { service: PrismaService; queries: () => number } {
  let rawCalls = 0;
  const prisma = {
    prospect: {
      findMany: ({ where }: { where: Prisma.ProspectWhereInput }): Promise<unknown[]> =>
        Promise.resolve(
          fixtures
            .map(row)
            .filter((candidate) => matches(where, candidate))
            .sort((left, right) => String(left.id).localeCompare(String(right.id))),
        ),
    },
    $queryRaw: (): Promise<unknown[]> => {
      rawCalls += 1;
      return Promise.resolve([
        {
          prospectId: 'p-01',
          outcome: 'METHOD_OBTAINED',
          comment: 'Accepte la plateforme',
          at: DATE,
        },
      ]);
    },
  };
  return { service: prisma as unknown as PrismaService, queries: () => rawCalls };
}

const stubAnalytics = (): AnalyticsService => {
  const empty = { items: [], total: 0 };
  return {
    totals: vi.fn().mockResolvedValue({
      prospects: 0,
      representants: 0,
      commerciauxActifs: 0,
      departementsCouverts: 0,
      nouveau: 0,
      contacte: 0,
      converti: 0,
      perdu: 0,
      prospects7Jours: 0,
      prospects30Jours: 0,
    }),
    byBanque: vi.fn().mockResolvedValue(empty),
    bySyndicat: vi.fn().mockResolvedValue(empty),
    byDepartement: vi.fn().mockResolvedValue(empty),
    bySegment: vi.fn().mockResolvedValue(empty),
    byPhase2Status: vi.fn().mockResolvedValue(empty),
    byEnrollmentMethod: vi.fn().mockResolvedValue(empty),
  } as unknown as AnalyticsService;
};

async function build(
  mode: ExportMode,
  filter: ProspectFilterDto = {},
  fixtures = FIXTURES,
): Promise<ExcelJS.Workbook> {
  const { service } = makePrisma(fixtures);
  return read(new ExportService(service, stubAnalytics(), fakeWorkspace()), filter, mode);
}

async function read(
  exports: ExportService,
  filter: ProspectFilterDto,
  mode?: ExportMode,
): Promise<ExcelJS.Workbook> {
  const stream = new PassThrough();
  const workbook = new ExcelJS.Workbook();
  const reading = workbook.xlsx.read(stream);

  await exports.writeProspects(admin, filter, stream, mode);
  return reading;
}

const sheetNames = (workbook: ExcelJS.Workbook): string[] =>
  workbook.worksheets.map((sheet) => sheet.name);

function sheetOf(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = workbook.getWorksheet(name);
  if (!found) throw new Error(`Feuille « ${name} » absente du classeur.`);
  return found;
}

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function column(sheet: ExcelJS.Worksheet, header: string): string[] {
  const index = PROSPECT_COLUMNS.findIndex((spec) => spec.header === header) + 1;
  const values: string[] = [];
  sheet.eachRow((row, number) => {
    if (number > 1) values.push(text(row.getCell(index).value));
  });
  return values;
}

describe('classeur consolidé', () => {
  it('contient EXACTEMENT cinq feuilles, nommées Consolidé et BDD1 à BDD4', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);
    expect(sheetNames(workbook)).toEqual(['Consolidé', 'BDD1', 'BDD2', 'BDD3', 'BDD4']);
  });

  it('chaque onglet BDD ne contient QUE son segment', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);

    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      const sheet = sheetOf(workbook, segment);
      const noms = column(sheet, 'Nom');
      const segments = column(sheet, 'Segment');

      expect(new Set(segments)).toEqual(new Set(noms.length ? [segment] : []));
      const attendus = FIXTURES.filter(
        (f) =>
          classifySegment({ syndicatSigle: f.sigle, banqueShortName: f.shortName }) === segment,
      ).map((f) => f.nom);
      expect(noms.toSorted()).toEqual(attendus.toSorted());
    }
  });

  it('l’onglet Consolidé contient tout, et exactement la somme des quatre segments', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);

    const consolide = column(sheetOf(workbook, 'Consolidé'), 'Nom');
    expect(consolide).toHaveLength(FIXTURES.length);

    const parSegment = (['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const).flatMap((segment) =>
      column(sheetOf(workbook, segment), 'Nom'),
    );
    expect(parSegment.toSorted()).toEqual(consolide.toSorted());
  });

  it('ignore un `segment` reçu en paramètre : c’est le classeur qui segmente', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED, { segment: 'BDD1' });
    expect(column(sheetOf(workbook, 'BDD4'), 'Nom')).not.toHaveLength(0);
    expect(column(sheetOf(workbook, 'Consolidé'), 'Nom')).toHaveLength(FIXTURES.length);
  });

  it('applique les autres filtres à TOUTES les feuilles', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED, { phase2Status: 'METHOD_OBTAINED' });
    expect(column(sheetOf(workbook, 'Consolidé'), 'Nom')).toEqual(['Un']);
    expect(column(sheetOf(workbook, 'BDD1'), 'Nom')).toEqual(['Un']);
    expect(column(sheetOf(workbook, 'BDD4'), 'Nom')).toEqual([]);
  });
});

describe('colonnes', () => {
  it('porte les colonnes historiques ET celles de la phase 2', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);
    const header = sheetOf(workbook, 'Consolidé').getRow(1);
    const headers = PROSPECT_COLUMNS.map((_spec, index) => text(header.getCell(index + 1).value));

    expect(headers).toEqual([
      'Nom',
      'Prénom',
      'Téléphone',
      'Projets',
      'Statut',
      'Banque',
      'Syndicat',
      'Représentant',
      'Tél. représentant',
      'Département',
      'Commercial',
      'Date de saisie',
      'Secteur',
      'Profession',
      'Canal de provenance',
      'Durée du système (mois)',
      'Employeur',
      'Type de contrat',
      'Ancienneté (mois)',
      'Lieu d’activité',
      'Mode d’épargne',
      'Pays de résidence',
      'Ville de résidence',
      'WhatsApp',
      'Relais au Sénégal',
      'Tél. relais',
      'Segment',
      'Méthode d’enrôlement',
      'Statut phase 3 (conversion)',
      'Dernier résultat',
      'Dernier commentaire',
      'Dernier appel',
      'Méthode obtenue par',
      'Date d’obtention',
    ]);
  });

  it('remplit les colonnes de phase 2 de la ligne concernée', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);
    const sheet = sheetOf(workbook, 'BDD1');
    const ligne = sheet.getRow(2);
    const cell = (header: string): string =>
      text(ligne.getCell(PROSPECT_COLUMNS.findIndex((s) => s.header === header) + 1).value);

    expect(cell('Nom')).toBe('Un');
    expect(cell('Segment')).toBe('BDD1');
    expect(cell('Statut phase 3 (conversion)')).toBe('Méthode obtenue');
    expect(cell('Méthode d’enrôlement')).toBe('Plateforme en ligne');
    expect(cell('Méthode obtenue par')).toBe('Omar Ba');
    expect(cell('Dernier résultat')).toBe('Méthode obtenue');
    expect(cell('Dernier commentaire')).toBe('Accepte la plateforme');
    expect(cell('Commercial')).toBe('Awa Sy');
  });

  it('laisse vides les colonnes de phase 2 d’un prospect en attente', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);
    const ligne = sheetOf(workbook, 'BDD2').getRow(2);
    const cell = (header: string): string =>
      text(ligne.getCell(PROSPECT_COLUMNS.findIndex((s) => s.header === header) + 1).value);

    expect(cell('Statut phase 3 (conversion)')).toBe('En attente');
    expect(cell('Méthode d’enrôlement')).toBe('');
    expect(cell('Méthode obtenue par')).toBe('');
    expect(cell('Dernier résultat')).toBe('');
  });

  it('écrit les dates en cellules date, pas en texte', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);
    const index = PROSPECT_COLUMNS.findIndex((s) => s.header === 'Date de saisie') + 1;
    expect(sheetOf(workbook, 'BDD1').getRow(2).getCell(index).value).toBeInstanceOf(Date);
  });
});

describe('mise en forme', () => {
  it('fige l’en-tête, pose l’autofiltre et le bordeaux CPI sur chaque feuille', async () => {
    const workbook = await build(ExportMode.CONSOLIDATED);

    for (const sheet of workbook.worksheets) {
      expect(sheet.views[0]?.state).toBe('frozen');
      expect(sheet.autoFilter).toBeTruthy();

      const header = sheet.getRow(1);
      expect(header.font.bold).toBe(true);
      expect(header.font.color?.argb).toBe('FFFFFFFF');
      expect(header.fill).toMatchObject({ fgColor: { argb: 'FF630210' } });
      expect(sheet.getColumn(1).width).toBeGreaterThan(0);
    }
  });
});

describe('vue filtrée', () => {
  it('conserve les feuilles historiques Prospects, Représentants et Synthèse', async () => {
    const workbook = await build(ExportMode.FILTERED);
    expect(sheetNames(workbook)).toEqual(['Prospects', 'Représentants', 'Synthèse']);
  });

  it('est le mode par défaut', async () => {
    const { service } = makePrisma();
    const workbook = await read(new ExportService(service, stubAnalytics(), fakeWorkspace()), {});
    expect(sheetNames(workbook)).toEqual(['Prospects', 'Représentants', 'Synthèse']);
  });

  it('n’exporte QUE les lignes du filtre reçu', async () => {
    const workbook = await build(ExportMode.FILTERED, { segment: 'BDD3' });
    const noms = column(sheetOf(workbook, 'Prospects'), 'Nom');
    expect(noms.toSorted()).toEqual(['Quatre', 'Sept']);
  });
});

describe('coût des requêtes', () => {
  it('lit les dernières tentatives par PAGE, jamais par ligne', async () => {
    const { service, queries } = makePrisma();
    const exports = new ExportService(service, stubAnalytics(), fakeWorkspace());
    const stream = new PassThrough();
    stream.resume();

    await exports.writeProspects(admin, {}, stream, ExportMode.CONSOLIDATED);

    expect(queries()).toBe(5);
  });
});
