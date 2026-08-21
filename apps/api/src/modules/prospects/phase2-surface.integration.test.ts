import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import { PrismaClient, PrismaPg, Role, classifySegment } from '@crm/database';
import type { BddSegment } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { ExportService } from '../export/export.service.js';
import { ExportMode } from '../export/dto.js';
import { PROSPECT_COLUMNS } from '../export/columns.js';
import { ProspectsService } from './prospects.service.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';

const RUN = uuidv7().slice(0, 8);
const DATABASE_URL = process.env.DATABASE_URL ?? readRootEnv();

function readRootEnv(): string {
  try {
    process.loadEnvFile(new URL('../../../../../.env', import.meta.url).pathname);
  } catch {}
  return process.env.DATABASE_URL ?? '';
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
const service = prisma as unknown as PrismaService;

const prospects = new ProspectsService(service);
const analytics = new AnalyticsService(service);
const exports = new ExportService(service, analytics, fakeWorkspace());

let commercial: AuthenticatedUser;
let autreCommercial: AuthenticatedUser;
let campaignId: string;

interface Attendu {
  id: string;
  nom: string;
  segment: BddSegment;
  sigle: string;
  shortName: string;
  obtenu: boolean;
}

const PLAN: readonly Omit<Attendu, 'id' | 'segment'>[] = [
  { nom: 'B1Obtenu', sigle: 'CHUES', shortName: 'CBAO', obtenu: true },
  { nom: 'B1Obtenu2', sigle: 'CHUES', shortName: 'CBAO', obtenu: true },
  { nom: 'B1Attente', sigle: 'CHUES', shortName: 'CBAO', obtenu: false },
  { nom: 'B2Obtenu', sigle: 'CHUES', shortName: 'BHS', obtenu: true },
  { nom: 'B2Attente', sigle: 'CHUES', shortName: 'BHS', obtenu: false },
  { nom: 'B3Obtenu', sigle: 'SAES', shortName: 'CBAO', obtenu: true },
  { nom: 'B3Attente', sigle: 'SAES', shortName: 'CBAO', obtenu: false },
  { nom: 'B3Attente2', sigle: 'UDEN', shortName: 'CBAO', obtenu: false },
  { nom: 'B4Obtenu', sigle: 'SAES', shortName: 'BHS', obtenu: true },
  { nom: 'B4Attente', sigle: 'UDEN', shortName: 'Ecobank', obtenu: false },
];

let attendus: Attendu[] = [];

const bySegment = (segment: BddSegment): Attendu[] =>
  attendus.filter((row) => row.segment === segment);

beforeAll(async () => {
  expect(DATABASE_URL, 'DATABASE_URL doit être défini pour la suite d’intégration').not.toBe('');

  const departement = await prisma.departement.findFirstOrThrow({ select: { id: true } });

  const [owner, other] = await Promise.all([
    prisma.user.create({
      data: {
        email: `phase2-${RUN}@cpi.test`,
        username: `phase2-${RUN}`,
        passwordHash: 'x',
        fullName: 'Awa Sy',
        role: Role.COMMERCIAL,
        departementId: departement.id,
      },
    }),
    prisma.user.create({
      data: {
        email: `phase2-other-${RUN}@cpi.test`,
        username: `phase2-other-${RUN}`,
        passwordHash: 'x',
        fullName: 'Omar Ba',
        role: Role.COMMERCIAL,
        departementId: departement.id,
      },
    }),
  ]);

  commercial = {
    id: owner.id,
    email: owner.email,
    username: owner.username,
    fullName: owner.fullName,
    role: Role.COMMERCIAL,
  };
  autreCommercial = {
    id: other.id,
    email: other.email,
    username: other.username,
    fullName: other.fullName,
    role: Role.COMMERCIAL,
  };

  const representant = await prisma.representant.create({
    data: {
      id: uuidv7(),
      fullName: `Moussa Diop ${RUN}`,
      phoneE164: `+2217700${RUN.slice(0, 5)}`,
      departementId: departement.id,
      createdById: owner.id,
      clientCreatedAt: new Date('2026-08-01T09:00:00.000Z'),
    },
  });

  const banques = new Map(
    (await prisma.banque.findMany({ select: { id: true, shortName: true } })).map((row) => [
      row.shortName,
      row.id,
    ]),
  );
  const syndicats = new Map(
    (await prisma.syndicat.findMany({ select: { id: true, sigle: true } })).map((row) => [
      row.sigle,
      row.id,
    ]),
  );

  const campaign = await prisma.callCampaign.create({
    data: { name: `Campagne ${RUN}`, scope: 'ALL', seed: RUN, createdById: owner.id },
  });
  campaignId = campaign.id;

  attendus = [];
  let index = 0;
  for (const entry of PLAN) {
    index += 1;
    const id = uuidv7();
    const banqueId = banques.get(entry.shortName);
    const syndicatId = syndicats.get(entry.sigle);
    expect(banqueId, `banque ${entry.shortName} absente du référentiel`).toBeTruthy();
    expect(syndicatId, `syndicat ${entry.sigle} absent du référentiel`).toBeTruthy();

    await prisma.prospect.create({
      data: {
        id,
        nom: entry.nom,
        prenom: `P${String(index)}`,
        phoneE164: `+22177${RUN.slice(0, 3)}${String(1000 + index)}`,
        banqueId: banqueId ?? '',
        syndicatId: syndicatId ?? '',
        representantId: representant.id,
        createdById: owner.id,
        clientCreatedAt: new Date('2026-08-02T09:00:00.000Z'),
        ...(entry.obtenu
          ? {
              phase2Status: 'METHOD_OBTAINED' as const,
              enrollmentMethod: 'PLATFORM' as const,
              enrollmentCapturedAt: new Date('2026-08-03T11:30:00.000Z'),
              enrollmentCapturedById: other.id,
            }
          : {}),
      },
    });

    await prisma.callTask.create({
      data: { campaignId: campaign.id, prospectId: id, assignedToId: owner.id, position: index },
    });

    if (entry.obtenu) {
      await prisma.callAttempt.create({
        data: {
          id: uuidv7(),
          prospectId: id,
          performedById: other.id,
          outcome: 'UNREACHABLE',
          comment: 'Ne répond pas',
          clientCreatedAt: new Date('2026-08-03T09:00:00.000Z'),
          createdAt: new Date('2026-08-03T09:00:00.000Z'),
        },
      });
      await prisma.callAttempt.create({
        data: {
          id: uuidv7(),
          prospectId: id,
          performedById: other.id,
          outcome: 'METHOD_OBTAINED',
          method: 'PLATFORM',
          comment: `Accepte la plateforme (${entry.nom})`,
          clientCreatedAt: new Date('2026-08-03T11:30:00.000Z'),
          createdAt: new Date('2026-08-03T11:30:00.000Z'),
        },
      });
    }

    attendus.push({
      id,
      nom: entry.nom,
      sigle: entry.sigle,
      shortName: entry.shortName,
      obtenu: entry.obtenu,
      segment: classifySegment({
        syndicatSigle: entry.sigle,
        banqueShortName: entry.shortName,
      }) as BddSegment,
    });
  }

  for (const [suffix, sigle, shortName] of [
    ['X1', 'CHUES', 'CBAO'],
    ['X2', 'SAES', 'BHS'],
  ] as const) {
    await prisma.prospect.create({
      data: {
        id: uuidv7(),
        nom: `Intrus${suffix}`,
        prenom: 'Z',
        phoneE164: `+22178${RUN.slice(0, 3)}${suffix === 'X1' ? '9001' : '9002'}`,
        banqueId: banques.get(shortName) ?? '',
        syndicatId: syndicats.get(sigle) ?? '',
        representantId: representant.id,
        createdById: other.id,
        clientCreatedAt: new Date('2026-08-02T09:00:00.000Z'),
      },
    });
  }
});

afterAll(async () => {
  const ids = (
    await prisma.prospect.findMany({
      where: { createdById: { in: [commercial.id, autreCommercial.id] } },
      select: { id: true },
    })
  ).map((row) => row.id);

  await prisma.callAttempt.deleteMany({ where: { prospectId: { in: ids } } });
  await prisma.callTask.deleteMany({ where: { prospectId: { in: ids } } });
  await prisma.prospect.deleteMany({ where: { id: { in: ids } } });
  await prisma.callCampaign.deleteMany({ where: { id: campaignId } });
  await prisma.representant.deleteMany({
    where: { createdById: { in: [commercial.id, autreCommercial.id] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [commercial.id, autreCommercial.id] } } });
  await prisma.$disconnect();
});

async function workbook(filter: ProspectFilterDto, mode: ExportMode): Promise<ExcelJS.Workbook> {
  const stream = new PassThrough();
  const book = new ExcelJS.Workbook();
  const reading = book.xlsx.read(stream);

  await exports.writeProspects(commercial, filter, stream, mode);
  return reading;
}

function sheetOf(book: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = book.getWorksheet(name);
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

describe('la matrice BDD1–BDD4 sur données réelles', () => {
  it('classe chaque fiche du même côté que le référentiel CBAO / CHUES', async () => {
    const page = await prospects.list(commercial, { pageSize: 200 });

    expect(page.meta.total).toBe(PLAN.length);
    for (const attendu of attendus) {
      const item = page.items.find((row) => row.id === attendu.id);
      expect(item?.segment, attendu.nom).toBe(attendu.segment);
    }
    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      expect(bySegment(segment).length, segment).toBeGreaterThan(0);
    }
  });

  it('le filtre par segment ne rend que le segment demandé', async () => {
    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      const page = await prospects.list(commercial, { segment, pageSize: 200 });
      expect(page.items.map((row) => row.nom).toSorted()).toEqual(
        bySegment(segment)
          .map((row) => row.nom)
          .toSorted(),
      );
      expect(page.items.every((row) => row.segment === segment)).toBe(true);
    }
  });

  it('les quatre segments partitionnent la base : ni recouvrement ni trou', async () => {
    const total = await prospects.list(commercial, { pageSize: 200 });
    const parSegment = await Promise.all(
      (['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const).map((segment) =>
        prospects.list(commercial, { segment, pageSize: 200 }),
      ),
    );

    const reunis = parSegment.flatMap((page) => page.items.map((row) => row.id));
    expect(new Set(reunis).size).toBe(reunis.length); // aucun recouvrement
    expect(reunis.toSorted()).toEqual(total.items.map((row) => row.id).toSorted());
  });

  it('le cloisonnement tient : les fiches d’un collègue n’entrent nulle part', async () => {
    const page = await prospects.list(commercial, { pageSize: 200 });
    expect(page.items.some((row) => row.nom.startsWith('Intrus'))).toBe(false);

    const stats = await analytics.bySegment(commercial, {});
    expect(stats.total).toBe(PLAN.length);
  });
});

describe('la phase 2 remonte jusqu’à la liste', () => {
  it('rend la méthode, son auteur, et la DERNIÈRE tentative, pas la première', async () => {
    const page = await prospects.list(commercial, {
      phase2Status: 'METHOD_OBTAINED',
      pageSize: 200,
    });

    const obtenus = attendus.filter((row) => row.obtenu);
    expect(page.meta.total).toBe(obtenus.length);

    for (const item of page.items) {
      expect(item.enrollmentMethod).toBe('PLATFORM');
      expect(item.enrollmentCapturedByName).toBe('Omar Ba');
      expect(item.enrollmentCapturedById).toBe(autreCommercial.id);
      expect(item.ownedByCommercialId).toBe(commercial.id);
      expect(item.lastOutcome).toBe('METHOD_OBTAINED');
      expect(item.lastComment).toBe(`Accepte la plateforme (${item.nom})`);
    }
  });

  it('distingue l’auteur de la méthode du commercial de saisie', async () => {
    const parAuteur = await prospects.list(commercial, {
      enrollmentCapturedById: autreCommercial.id,
      pageSize: 200,
    });
    expect(parAuteur.meta.total).toBe(attendus.filter((row) => row.obtenu).length);

    const parSaisie = await prospects.list(commercial, {
      commercialId: autreCommercial.id,
      pageSize: 200,
    });
    expect(parSaisie.meta.total).toBe(0);
  });

  it('le filtre par campagne passe par les tâches', async () => {
    const page = await prospects.list(commercial, { campaignId, pageSize: 200 });
    expect(page.meta.total).toBe(PLAN.length);

    const inconnue = await prospects.list(commercial, {
      campaignId: '00000000-0000-7000-8000-000000000000',
      pageSize: 200,
    });
    expect(inconnue.meta.total).toBe(0);
  });
});

describe('un filtre unique, des comptes identiques sur les trois surfaces', () => {
  const FILTRES: readonly ProspectFilterDto[] = [
    {},
    { segment: 'BDD1' },
    { segment: 'BDD3' },
    { phase2Status: 'METHOD_OBTAINED' },
    { enrollmentMethod: 'PLATFORM' },
    { segment: 'BDD1', phase2Status: 'METHOD_OBTAINED' },
    { segment: 'BDD4', phase2Status: 'PENDING' },
  ];

  it.each(FILTRES.map((filter) => [JSON.stringify(filter), filter] as const))(
    'liste, agrégats et export filtré comptent pareil pour %s',
    async (_titre, filtre) => {
      const filter: ProspectFilterDto = Object.assign({}, filtre, { campaignId });

      const page = await prospects.list(commercial, Object.assign({}, filter, { pageSize: 200 }));
      const totaux = await analytics.totals(commercial, filter);
      const segments = await analytics.bySegment(commercial, filter);
      const statuts = await analytics.byPhase2Status(commercial, filter);
      const book = await workbook(filter, ExportMode.FILTERED);
      const feuille = sheetOf(book, 'Prospects');

      const attendu = page.meta.total;

      expect(totaux.prospects, 'analytics.totals').toBe(attendu);
      expect(segments.total, 'analytics.bySegment').toBe(attendu);
      expect(statuts.total, 'analytics.byPhase2Status').toBe(attendu);
      expect(column(feuille, 'Nom'), 'export filtré').toHaveLength(attendu);

      expect(column(feuille, 'Nom').toSorted()).toEqual(
        page.items.map((row) => row.nom).toSorted(),
      );
    },
  );

  it('le classeur consolidé répartit exactement ce que comptent les agrégats', async () => {
    const filter: ProspectFilterDto = { campaignId };
    const book = await workbook(filter, ExportMode.CONSOLIDATED);
    const segments = await analytics.bySegment(commercial, filter);

    expect(book.worksheets.map((sheet) => sheet.name)).toEqual([
      'Consolidé',
      'BDD1',
      'BDD2',
      'BDD3',
      'BDD4',
    ]);

    for (const item of segments.items) {
      const feuille = sheetOf(book, item.segment);
      const noms = column(feuille, 'Nom');
      expect(noms, item.segment).toHaveLength(item.prospects);
      expect(new Set(column(feuille, 'Segment'))).toEqual(
        new Set(noms.length ? [item.segment] : []),
      );
      expect(noms.toSorted()).toEqual(
        bySegment(item.segment)
          .map((row) => row.nom)
          .toSorted(),
      );
    }

    const consolide = column(sheetOf(book, 'Consolidé'), 'Nom');
    expect(consolide).toHaveLength(segments.total);
    expect(consolide.toSorted()).toEqual(
      (['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const)
        .flatMap((segment) => column(sheetOf(book, segment), 'Nom'))
        .toSorted(),
    );
  });

  it('les colonnes de phase 2 du classeur portent ce que dit la liste', async () => {
    const book = await workbook({ phase2Status: 'METHOD_OBTAINED' }, ExportMode.CONSOLIDATED);
    const feuille = sheetOf(book, 'BDD1');

    expect(column(feuille, 'Statut phase 2').every((value) => value === 'Méthode obtenue')).toBe(
      true,
    );
    expect(column(feuille, 'Méthode d’enrôlement').every((value) => value === 'Plateforme')).toBe(
      true,
    );
    expect(column(feuille, 'Méthode obtenue par').every((value) => value === 'Omar Ba')).toBe(true);
    expect(column(feuille, 'Dernier résultat').every((value) => value === 'Méthode obtenue')).toBe(
      true,
    );
    expect(
      column(feuille, 'Dernier commentaire').every((value) => value.startsWith('Accepte')),
    ).toBe(true);
    expect(column(feuille, 'Commercial').every((value) => value === 'Awa Sy')).toBe(true);
    expect(
      feuille
        .getRow(2)
        .getCell(PROSPECT_COLUMNS.findIndex((spec) => spec.header === 'Date d’obtention') + 1)
        .value,
    ).toBeInstanceOf(Date);
  });

  it('la répartition par méthode ne compte que les porteurs d’une méthode', async () => {
    const methodes = await analytics.byEnrollmentMethod(commercial, {});
    const statuts = await analytics.byPhase2Status(commercial, {});

    const obtenus = attendus.filter((row) => row.obtenu).length;
    expect(methodes.total).toBe(obtenus);
    expect(methodes.items.find((item) => item.method === 'PLATFORM')?.prospects).toBe(obtenus);
    expect(statuts.items.find((item) => item.status === 'METHOD_OBTAINED')?.prospects).toBe(
      obtenus,
    );
    expect(statuts.total).toBe(PLAN.length);
  });
});
