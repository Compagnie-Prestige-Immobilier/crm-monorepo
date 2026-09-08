import { PrismaClient, PrismaPg, Projet, Role } from '@crm/database';
import ExcelJS from 'exceljs';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { WorkspaceContext } from '../../workspaces/workspace.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { GlobalExportService } from './global-export.service.js';

try {
  process.loadEnvFile(new URL('../../../../../.env', import.meta.url).pathname);
} catch {}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});
const marker = uuidv7();
const users = [uuidv7(), uuidv7()] as const;
const reps = [uuidv7(), uuidv7(), uuidv7()] as const;
const contacts = Array.from({ length: 501 }, () => uuidv7());
const removed = uuidv7();
const lot = uuidv7();
const call = uuidv7();
const repCall = uuidv7();
const region = uuidv7();
const dept = uuidv7();
const timestamp = new Date('2026-08-10T09:30:00Z');
const text = '=HYPERLINK("https://example.invalid","Texte")';

beforeAll(async () => {
  await prisma.user.createMany({
    data: users.map((id, index) => ({
      id,
      email: `${id}@export.test`,
      username: id,
      fullName: `Export ${marker} ${String(index)}`,
      passwordHash: 'non-utilisable',
      role: Role.COMMERCIAL,
    })),
  });
  await prisma.region.create({ data: { id: region, name: marker, code: marker } });
  await prisma.departement.create({
    data: { id: dept, regionId: region, name: marker, code: marker },
  });
  await prisma.representant.createMany({
    data: reps.map((id, index) => ({
      id,
      fullName: `${marker} ${String(index)}`,
      phoneE164: `+${String(BigInt(`0x${id.replaceAll('-', '').slice(-12)}`))}`,
      departementId: dept,
      createdById: users[index % 2]!,
      clientCreatedAt: timestamp,
      notes: text,
      ...(index === 2 ? { deletedAt: timestamp } : {}),
    })),
  });
  await prisma.prospect.createMany({
    data: [...contacts, removed].map((id, index) => ({
      id,
      nom: marker,
      prenom: String(index),
      phoneE164: `+${String(BigInt(`0x${id.replaceAll('-', '').slice(-12)}`))}`,
      createdById: users[index % 2]!,
      clientCreatedAt: timestamp,
      projet: Projet.GRAND_PUBLIC,
      representantId: index === 0 ? reps[0] : null,
      ...(id === removed ? { deletedAt: timestamp } : {}),
    })),
  });
  const journey = await prisma.prospectJourney.create({
    data: { prospectId: contacts[0]!, projet: Projet.CHUES, statut: 'CONVERTI' },
  });
  await prisma.prospectJourney.create({
    data: { prospectId: contacts[0]!, projet: Projet.GRAND_PUBLIC },
  });
  await prisma.prospectConversion.create({
    data: { journeyId: journey.id, amountXof: 500_000, confirmedById: users[0]! },
  });
  await prisma.callAttempt.create({
    data: {
      id: call,
      prospectId: contacts[0]!,
      performedById: users[1]!,
      clientCreatedAt: timestamp,
      outcome: 'CALLBACK',
      comment: text,
    },
  });
  await prisma.scheduledCallback.create({
    data: {
      prospectId: contacts[0]!,
      assignedToId: users[1]!,
      sourceAttemptId: call,
      scheduledAt: timestamp,
    },
  });
  await prisma.repCallAttempt.create({
    data: {
      id: repCall,
      representantId: reps[0]!,
      performedById: users[0]!,
      clientCreatedAt: timestamp,
      outcome: 'REACHED',
    },
  });
  await prisma.representantComment.create({
    data: {
      id: uuidv7(),
      representantId: reps[0]!,
      authorId: users[0]!,
      body: text,
      clientCreatedAt: timestamp,
    },
  });
  await prisma.representantRelationChange.create({
    data: {
      representantId: reps[0]!,
      fromStatus: 'INCONNU',
      toStatus: 'CONTACTE',
      changedById: users[0]!,
      source: 'WEB',
    },
  });
  await prisma.representantSuggestion.create({
    data: {
      sourceRepresentantId: reps[0]!,
      sourceAttemptId: repCall,
      suggestedById: users[0]!,
      suggestedPhoneE164: '+221770001234',
      clientCreatedAt: timestamp,
    },
  });
  await prisma.lotExport.create({
    data: {
      id: lot,
      name: marker,
      cible: 'PROSPECTS',
      projet: Projet.GRAND_PUBLIC,
      createdById: users[0]!,
      itemCount: 1,
      filters: {
        distribution: {
          teleconseillerIds: users,
          fichesParJour: 50,
          jours: 1,
          objectifs: { [users[1]!]: 7 },
        },
      },
      items: { create: { position: 0, prospectId: contacts[0]!, assigneeId: users[1] } },
    },
  });
  await prisma.lotExportReaffectation.create({
    data: {
      lotId: lot,
      toAssigneeId: users[1]!,
      performedById: users[0]!,
      fiches: 1,
      positions: [0],
    },
  });
}, 60_000);

afterAll(async () => {
  await prisma.lotExport.deleteMany({ where: { id: lot } });
  await prisma.prospect.deleteMany({ where: { id: { in: [...contacts, removed] } } });
  await prisma.representant.deleteMany({ where: { id: { in: [...reps] } } });
  await prisma.departement.deleteMany({ where: { id: dept } });
  await prisma.region.deleteMany({ where: { id: region } });
  await prisma.user.deleteMany({ where: { id: { in: [...users] } } });
  await prisma.$disconnect();
});

function rows(book: ExcelJS.Workbook, name: string): Map<string, ExcelJS.CellValue>[] {
  const sheet = book.getWorksheet(name);
  if (!sheet) throw new Error(`Onglet absent : ${name}`);
  const headers = Array.from(
    { length: sheet.columnCount },
    (_, i) => sheet.getRow(1).getCell(i + 1).text,
  );
  const result: Map<string, ExcelJS.CellValue>[] = [];
  sheet.eachRow((row, index) => {
    if (index > 1)
      result.push(new Map(headers.map((header, i) => [header, row.getCell(i + 1).value])));
  });
  return result;
}

it('exporte toutes les équipes, les fiches isolées et leur historique dans un vrai classeur', async () => {
  const started = performance.now();
  const book = await new GlobalExportService(
    prisma as PrismaService,
    new WorkspaceContext(),
  ).build();
  const buffer = await book.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  const exported = rows(loaded, 'Prospects').filter((row) => row.get('Nom') === marker);
  expect(exported).toHaveLength(501);
  expect(new Set(exported.map((row) => row.get('Identifiant'))).size).toBe(501);
  expect(new Set(exported.map((row) => row.get('Identifiant téléconseiller')))).toEqual(
    new Set(users),
  );
  expect(exported.some((row) => row.get('Identifiant') === removed)).toBe(false);
  const representatives = rows(loaded, 'Représentants').filter((row) =>
    reps.some((id) => id === row.get('Identifiant')),
  );
  expect(representatives).toHaveLength(2);
  expect(representatives.find((row) => row.get('Identifiant') === reps[1])!.get('Prospects')).toBe(
    0,
  );
  expect(representatives[0]!.get('Notes')).toBe(text);
  expect(exported[0]!.get('Date de saisie')).toEqual(timestamp);
  expect(typeof exported[0]!.get('Téléphone')).toBe('string');
  expect(
    rows(loaded, 'Parcours').filter((row) => row.get('Identifiant prospect') === contacts[0]),
  ).toHaveLength(2);
  expect(
    rows(loaded, 'Conversions')
      .find((row) => row.get('Identifiant prospect') === contacts[0])
      ?.get('Montant XOF'),
  ).toBe(500_000);
  expect(
    rows(loaded, 'Appels').filter((row) =>
      [call, repCall].some((id) => id === row.get('Identifiant')),
    ),
  ).toHaveLength(2);
  expect(
    rows(loaded, 'Appels')
      .find((row) => row.get('Identifiant') === call)
      ?.get('Commentaire'),
  ).toBe(text);
  expect(
    rows(loaded, 'Relances')
      .find((row) => row.get('Appel source') === call)
      ?.get('État'),
  ).toBe('En attente');
  expect(
    rows(loaded, 'Affectations')
      .find((row) => row.get('Identifiant campagne') === lot)
      ?.get('Objectif quotidien'),
  ).toBe(7);
  expect(
    rows(loaded, 'Historique').filter((row) =>
      [reps[0], lot].some((id) => id === row.get('Identifiant fiche ou campagne')),
    ),
  ).toHaveLength(2);
  expect(
    rows(loaded, 'Suggestions')
      .find((row) => row.get('Appel source') === repCall)
      ?.get('État'),
  ).toBe('À appeler');
  expect(loaded.worksheets).toHaveLength(12);
  for (const sheet of loaded.worksheets) {
    expect(sheet.getCell('A1').font).toMatchObject({ name: 'Arial', size: 14 });
    if (sheet.name === 'Tableau de bord') continue;
    expect(sheet.getTables()).toHaveLength(1);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 1 });
    sheet.getRow(1).eachCell((value) => expect(value.text).not.toMatch(/commercial|—/iu));
  }
  const count = await prisma.prospect.count({ where: { deletedAt: null } });
  const dashboard = loaded.getWorksheet('Tableau de bord')!;
  const totals: number[] = [];
  dashboard.eachRow((row) => {
    if (row.getCell(1).text === 'Totaux' && row.getCell(2).text === 'Prospects')
      totals.push(Number(row.getCell(3).value));
  });
  expect(totals).toEqual([count]);
  console.info({
    durationMs: Math.round(performance.now() - started),
    bytes: buffer.byteLength,
    prospects: count,
    rssMiB: Math.round(process.memoryUsage().rss / 1_048_576),
  });
}, 120_000);
