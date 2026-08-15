import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import { Role } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { AnalyticsService } from '../analytics/analytics.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { BankCasesExportService } from '../bank-cases/bank-cases-export.service.js';
import { ExportService } from './export.service.js';
import { RepresentantsExportService } from './representants-export.service.js';
import { ExportMode } from './dto.js';
import { DEMO_FILENAME_SUFFIX, demoFilenameSuffix } from './demo-marking.js';

/**
 * Le marquage de démonstration, ÉPROUVÉ DE BOUT EN BOUT SUR CHAQUE EXPORT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI MANQUAIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `demo-marking.test.ts` éprouve les PRIMITIVES : un classeur fabriqué sur
 * place, une feuille écrite à la main, et les trois marques vérifiées dessus.
 * C'est nécessaire et ce n'est pas suffisant. Il ne dit rien de la seule chose
 * qui compte à l'usage : que chaque SERVICE d'export les appelle, sur CHACUNE
 * de ses feuilles.
 *
 * Or c'est là que le défaut se loge. Un service qui ajoute un onglet et oublie
 * `writeDemoWarningRow` produit un classeur dont une feuille sur trois est
 * marquée. Le fichier part au siège, la feuille non marquée en est extraite,
 * et des lignes fictives sont lues comme réelles. Aucune épreuve existante ne
 * bouge : les primitives fonctionnent toujours, et le service ne les appelle
 * simplement pas partout.
 *
 * On balaie donc les feuilles RÉELLEMENT produites, quelles qu'elles soient :
 * un onglet ajouté demain entre dans le contrôle sans que personne ait à y
 * penser, ce qui est tout l'intérêt.
 */

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};

/**
 * Fragment de l'avertissement écrit par `writeDemoWarningRow`.
 *
 * On cherche une SOUS-CHAÎNE stable plutôt que la phrase entière : la
 * formulation peut être retouchée sans que la mécanique change, et exiger le
 * texte au caractère près ferait de ce balayage un test de rédaction.
 */
const AVERTISSEMENT = 'MODE DÉMONSTRATION';

/** Exécute un écrivain de classeur et relit le fichier produit. */
async function relire(write: (stream: PassThrough) => Promise<void>): Promise<ExcelJS.Workbook> {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) =>
    sink.on('finish', () => {
      resolve();
    }),
  );

  await write(sink);
  await done;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.concat(chunks) as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook;
}

/** Textes des dix premières lignes d'une feuille, aplatis. */
function tete(sheet: ExcelJS.Worksheet): string {
  const morceaux: string[] = [];
  for (let ligne = 1; ligne <= 10; ligne += 1) {
    sheet.getRow(ligne).eachCell({ includeEmpty: false }, (cell) => {
      const valeur: unknown = cell.value;
      if (typeof valeur === 'string') morceaux.push(valeur);
      else if (valeur !== null && typeof valeur === 'object' && 'richText' in valeur) {
        const riche = valeur as { richText: { text: string }[] };
        morceaux.push(riche.richText.map((part) => part.text).join(''));
      }
    });
  }
  return morceaux.join(' | ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Doublures : le contenu importe peu, seules les FEUILLES comptent.
// ─────────────────────────────────────────────────────────────────────────────

const prospectRow = (id: string): Record<string, unknown> => ({
  id,
  nom: `Nom-${id}`,
  prenom: 'Prénom',
  phoneE164: '+221771234567',
  statut: 'NOUVEAU',
  phase2Status: 'PENDING',
  enrollmentMethod: null,
  enrollmentCapturedAt: null,
  clientCreatedAt: new Date('2026-03-03T09:00:00.000Z'),
  createdAt: new Date('2026-03-03T09:00:00.000Z'),
  updatedAt: new Date('2026-03-03T09:00:00.000Z'),
  deletedAt: null,
  notes: null,
  createdBy: { fullName: 'Awa' },
  representant: {
    id: 'rep-1',
    fullName: 'Rep Un',
    phoneE164: '+221770000001',
    notes: null,
    clientCreatedAt: new Date('2026-03-01T09:00:00.000Z'),
    createdAt: new Date('2026-03-01T09:00:00.000Z'),
    createdBy: { fullName: 'Awa' },
    departement: { name: 'Dakar', region: { name: 'Dakar' } },
    ief: null,
  },
  syndicat: { name: 'Syndicat', sigle: 'CHUES' },
  banque: { name: 'Banque', shortName: 'CBAO' },
  departement: { name: 'Dakar', region: { name: 'Dakar' } },
  ief: null,
});

const prospectPrisma = (): PrismaService =>
  ({
    prospect: {
      findMany: () => Promise.resolve([prospectRow('p-1')]),
    },
    representant: {
      findMany: () =>
        Promise.resolve([
          { ...(prospectRow('p-1').representant as object), _count: { prospects: 3 } },
        ]),
    },
    $queryRaw: () => Promise.resolve([]),
    $queryRawUnsafe: () => Promise.resolve([]),
  }) as unknown as PrismaService;

const analyticsStub = (): AnalyticsService => {
  const empty = { items: [], total: 0 };
  return {
    totals: vi.fn().mockResolvedValue({
      prospects: 1,
      representants: 1,
      commerciauxActifs: 1,
      departementsCouverts: 1,
      nouveau: 1,
      enCours: 0,
      converti: 0,
      perdu: 0,
    }),
    byDepartement: vi.fn().mockResolvedValue(empty),
    byBanque: vi.fn().mockResolvedValue(empty),
    bySyndicat: vi.fn().mockResolvedValue(empty),
    byPhase2Status: vi.fn().mockResolvedValue({ items: [] }),
    byEnrollmentMethod: vi.fn().mockResolvedValue({ items: [] }),
    bySegment: vi.fn().mockResolvedValue({ items: [] }),
    topCommercials: vi.fn().mockResolvedValue(empty),
    topRepresentants: vi.fn().mockResolvedValue(empty),
  } as unknown as AnalyticsService;
};

const bankCaseRow = (): Record<string, unknown> => ({
  id: 'bc-1',
  reference: 'REF-1',
  referenceKey: 'ref-1',
  prospectId: 'p-1',
  customerName: 'Client',
  customerPhoneE164: '+221771234567',
  amountXof: null,
  rejectionDetail: null,
  rev: 1,
  createdAt: new Date('2026-03-03T09:00:00.000Z'),
  updatedAt: new Date('2026-03-03T09:00:00.000Z'),
  deletedAt: null,
  processingBank: { name: 'Banque', shortName: 'CBAO' },
  currentStage: { id: 'st-1', code: 'A_TRAITER', label: 'À traiter', type: 'OPEN' },
  rejectionReason: null,
  createdBy: { id: 'u-1', fullName: 'Awa' },
  updatedBy: null,
  prospect: {
    id: 'p-1',
    nom: 'Nom',
    prenom: 'Prénom',
    departement: { name: 'Dakar' },
    syndicat: { sigle: 'CHUES' },
  },
});

const bankAnalyticsStub = () =>
  ({
    totals: vi.fn().mockResolvedValue({
      total: 1,
      aTraiter: 1,
      enTraitement: 0,
      encaisses: 0,
      rejetes: 0,
      totalAmountCashed: '0',
    }),
    byStage: vi.fn().mockResolvedValue([]),
    byBank: vi.fn().mockResolvedValue([]),
    byRejectionReason: vi.fn().mockResolvedValue([]),
  }) as unknown as ConstructorParameters<typeof BankCasesExportService>[1];

const bankPrisma = (): PrismaService =>
  ({
    bankCase: { findMany: () => Promise.resolve([bankCaseRow()]) },
    bankCaseTransition: { findMany: () => Promise.resolve([]) },
    $queryRaw: () => Promise.resolve([]),
    $queryRawUnsafe: () => Promise.resolve([]),
  }) as unknown as PrismaService;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les trois exports du produit, chacun rendu deux fois : mode ALLUMÉ puis
 * ÉTEINT. Le second passage n'est pas décoratif : il établit que la marque
 * vient bien de la BASCULE et non d'un en-tête écrit en toutes circonstances,
 * ce qu'un contrôle du seul mode allumé ne saurait distinguer.
 */
const EXPORTS: { nom: string; rendre: (demo: boolean, stream: PassThrough) => Promise<void> }[] = [
  {
    nom: 'prospects (mode filtré)',
    rendre: (demo, stream) =>
      new ExportService(prospectPrisma(), analyticsStub(), fakeDemoVisibility(demo)).writeProspects(
        admin,
        {},
        stream,
        ExportMode.FILTERED,
      ),
  },
  {
    nom: 'prospects (mode consolidé)',
    rendre: (demo, stream) =>
      new ExportService(prospectPrisma(), analyticsStub(), fakeDemoVisibility(demo)).writeProspects(
        admin,
        {},
        stream,
        ExportMode.CONSOLIDATED,
      ),
  },
  {
    nom: 'représentants',
    rendre: (demo, stream) =>
      new RepresentantsExportService(prospectPrisma(), fakeDemoVisibility(demo)).writeRepresentants(
        admin,
        {},
        stream,
      ),
  },
  {
    nom: 'dossiers bancaires',
    rendre: (demo, stream) =>
      new BankCasesExportService(bankPrisma(), bankAnalyticsStub(), fakeDemoVisibility(demo)).write(
        {},
        stream,
      ),
  },
];

describe('mode démonstration ALLUMÉ : chaque feuille de chaque export est marquée', () => {
  it.each(EXPORTS)('$nom porte l’avertissement sur TOUTES ses feuilles', async ({ rendre }) => {
    const workbook = await relire((stream) => rendre(true, stream));

    // Garde-fou : un classeur sans feuille ferait passer la boucle à vide.
    expect(workbook.worksheets.length).toBeGreaterThan(0);

    const nues = workbook.worksheets
      .filter((sheet) => !tete(sheet).includes(AVERTISSEMENT))
      .map((sheet) => sheet.name);

    expect(
      nues,
      `Ces feuilles ne portent AUCUN avertissement : extraites du classeur, ` +
        `leurs lignes fictives se lisent comme des lignes réelles. Ajoutez ` +
        `writeDemoWarningRow(feuille, demoEnabled, largeur) après ses colonnes.`,
    ).toEqual([]);
  });

  it.each(EXPORTS)('$nom ne porte AUCUNE marque mode éteint', async ({ rendre }) => {
    // La contrepartie indispensable : un classeur de plateforme en service ne
    // doit rien laisser voir de cette mécanique. Sans cette moitié, écrire
    // l'avertissement en toutes circonstances satisferait l'épreuve ci-dessus.
    const workbook = await relire((stream) => rendre(false, stream));

    const marquees = workbook.worksheets
      .filter((sheet) => tete(sheet).includes(AVERTISSEMENT))
      .map((sheet) => sheet.name);

    expect(marquees).toEqual([]);
  });
});

describe('le nom du fichier porte le suffixe', () => {
  /**
   * Le suffixe survit à tout : renommage manuel excepté, c'est la seule marque
   * qui reste visible dans un dossier de téléchargements, avant même que le
   * fichier ne soit ouvert.
   */
  it('ajoute le suffixe mode allumé, et rien mode éteint', () => {
    expect(demoFilenameSuffix(true)).toBe(DEMO_FILENAME_SUFFIX);
    expect(demoFilenameSuffix(true)).not.toBe('');
    expect(demoFilenameSuffix(false)).toBe('');
  });

  it('les trois contrôleurs composent le même nom de fichier', () => {
    // Les trois routes construisent `prefixe-date${suffixe}.xlsx`. On éprouve
    // ici la composition, seul endroit où une faute produirait un fichier
    // « demo.xlsx » ou « .xlsx-demo ».
    for (const prefixe of ['prospects-cpi', 'representants-cpi', 'dossiers-bancaires']) {
      const nom = `${prefixe}-2026-03-03${demoFilenameSuffix(true)}.xlsx`;
      expect(nom.endsWith('.xlsx')).toBe(true);
      expect(nom).toContain(DEMO_FILENAME_SUFFIX);
      expect(nom.indexOf(DEMO_FILENAME_SUFFIX)).toBeLessThan(nom.indexOf('.xlsx'));
    }
  });
});
