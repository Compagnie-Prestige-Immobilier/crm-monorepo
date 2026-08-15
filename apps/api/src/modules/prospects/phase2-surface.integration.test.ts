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
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

/**
 * Un seul filtre, quatre surfaces, sur un VRAI PostgreSQL.
 *
 * Les tests unitaires vérifient que chaque surface traduit correctement le
 * filtre ; ils ne peuvent pas vérifier que les traductions décrivent la même
 * population, parce que l'une produit un objet Prisma et l'autre du SQL brut.
 * Seule une base réelle peut répondre à la question qui compte : le total
 * affiché sur le tableau de bord, le nombre de lignes de la liste et le nombre
 * de lignes du fichier exporté sont-ils LE MÊME nombre ?
 *
 * Les fixtures sont rattachées à un commercial créé pour l'occasion. Le
 * cloisonnement en fait un univers clos : rien de ce qui existe déjà en base ne
 * peut entrer dans les compteurs, et le test reste juste sur une base peuplée.
 */

const RUN = uuidv7().slice(0, 8);
const DATABASE_URL = process.env.DATABASE_URL ?? readRootEnv();

function readRootEnv(): string {
  try {
    process.loadEnvFile(new URL('../../../../../.env', import.meta.url).pathname);
  } catch {
    /* Le contrôle d'existence ci-dessous produira un message plus utile. */
  }
  return process.env.DATABASE_URL ?? '';
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
const service = prisma as unknown as PrismaService;

const prospects = new ProspectsService(service, fakeDemoVisibility());
const analytics = new AnalyticsService(service, fakeDemoVisibility());
const exports = new ExportService(service, analytics, fakeDemoVisibility());

/** Le commercial propriétaire des fixtures : sa portée EST l'univers du test. */
let commercial: AuthenticatedUser;
let autreCommercial: AuthenticatedUser;
let campaignId: string;

/**
 * Population de contrôle : les quatre cases de la matrice, chacune peuplée
 * différemment, plus deux fiches d'un AUTRE commercial qui ne doivent jamais
 * apparaître nulle part.
 */
interface Attendu {
  id: string;
  nom: string;
  segment: BddSegment;
  sigle: string;
  shortName: string;
  obtenu: boolean;
}

const PLAN: readonly Omit<Attendu, 'id' | 'segment'>[] = [
  // BDD1, CHUES × CBAO
  { nom: 'B1Obtenu', sigle: 'CHUES', shortName: 'CBAO', obtenu: true },
  { nom: 'B1Obtenu2', sigle: 'CHUES', shortName: 'CBAO', obtenu: true },
  { nom: 'B1Attente', sigle: 'CHUES', shortName: 'CBAO', obtenu: false },
  // BDD2, CHUES × autre banque
  { nom: 'B2Obtenu', sigle: 'CHUES', shortName: 'BHS', obtenu: true },
  { nom: 'B2Attente', sigle: 'CHUES', shortName: 'BHS', obtenu: false },
  // BDD3, autre syndicat × CBAO
  { nom: 'B3Obtenu', sigle: 'SAES', shortName: 'CBAO', obtenu: true },
  { nom: 'B3Attente', sigle: 'SAES', shortName: 'CBAO', obtenu: false },
  { nom: 'B3Attente2', sigle: 'UDEN', shortName: 'CBAO', obtenu: false },
  // BDD4, autre syndicat × autre banque
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
              // L'auteur de la MÉTHODE est l'autre commercial : c'est ce qui
              // permet de vérifier qu'il n'est pas confondu avec l'auteur de
              // la saisie de phase 1.
              enrollmentCapturedById: other.id,
            }
          : {}),
      },
    });

    // Une tâche de campagne sur toutes les fiches, pour que le filtre
    // `campaignId` porte sur une population connue.
    await prisma.callTask.create({
      data: { campaignId: campaign.id, prospectId: id, assignedToId: owner.id, position: index },
    });

    // Deux tentatives sur les fiches abouties : la DERNIÈRE seule doit
    // apparaître, ce qui distingue un vrai « dernier » d'un « premier trouvé ».
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
      }),
    });
  }

  // Deux fiches d'un AUTRE commercial, dans deux segments différents : elles
  // ne doivent apparaître dans aucun compteur ni dans aucune feuille.
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
  // Nettoyage dans l'ordre des dépendances : les tentatives et les tâches
  // référencent les prospects, qui référencent le représentant et les users.
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

/**
 * Produit le classeur et le relit, c'est le FICHIER qui est jugé.
 *
 * La lecture est branchée AVANT l'écriture : le service pousse le XML au fil de
 * l'eau et le tampon d'un `PassThrough` est borné. Tout accumuler d'abord
 * ferait tenir le classeur entier en mémoire, ce que la génération en flux
 * existe précisément pour éviter.
 */
async function workbook(filter: ProspectFilterDto, mode: ExportMode): Promise<ExcelJS.Workbook> {
  const stream = new PassThrough();
  const book = new ExcelJS.Workbook();
  const reading = book.xlsx.read(stream);

  await exports.writeProspects(commercial, filter, stream, mode);
  return reading;
}

/** La feuille attendue, ou un échec explicite plutôt qu'un `undefined` propagé. */
function sheetOf(book: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = book.getWorksheet(name);
  if (!found) throw new Error(`Feuille « ${name} » absente du classeur.`);
  return found;
}

/** Texte d'une cellule : une `CellValue` peut être un objet que `String()` masquerait. */
function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Valeurs d'une colonne d'une feuille, en-tête exclu. */
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
    // Les quatre cases sont peuplées : un test où trois segments seraient vides
    // passerait sans rien prouver.
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
      // L'auteur de la saisie de phase 1 reste distinct.
      expect(item.ownedByCommercialId).toBe(commercial.id);
      // Deux tentatives existent ; c'est la plus récente qui doit sortir.
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

    // Le même identifiant passé comme AUTEUR DE SAISIE ne rend rien : le
    // cloisonnement borne la liste au commercial courant.
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
  /**
   * Le filtre est délibérément composite : segment, statut de phase 2 et
   * campagne à la fois. C'est la combinaison, pas chaque clause isolée, qui
   * révèle une clause écrasée par une autre.
   */
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
      // `Object.assign` plutôt qu'une diffusion : le filtre est une instance
      // de classe, et la diffuser en perdrait le prototype.
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

      // Et ce sont bien les MÊMES lignes, pas seulement le même nombre.
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
      // Rien d'un autre segment n'a fuité dans l'onglet.
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
    // La date d'obtention est une vraie cellule date, pas du texte.
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
    // Les statuts, eux, couvrent toute la population.
    expect(statuts.total).toBe(PLAN.length);
  });
});
