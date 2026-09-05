process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-32-characters';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import {
  LotExportCible,
  PrismaClient,
  PrismaPg,
  RappelOrigine,
  RepCallOutcome,
  Role,
  StatutQualificationEffect,
  SuggestionStatus,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import { LotExportFicheEtat, type CreateLotExportDto } from './dto.js';
import { LotsExportService } from './lots-export.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const service = new LotsExportService(prisma as unknown as PrismaService, new WorkspaceContext());

const TAG = 'ITLE';

let departementId: string;
let admin: AuthenticatedUser;
let alice: string;
let bruno: string;
let carine: string;
let superviseur: string;
let statutReessayable: string;
let statutDefinitif: string;

interface ErreurMetier {
  code?: string;
}
const codeDe = (error: unknown): string | undefined =>
  ((error as { response?: ErreurMetier }).response ?? {}).code;

async function refus(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

async function compte(nom: string, role: Role): Promise<string> {
  const row = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}.${nom}@cpi.sn`,
      username: `${TAG.toLowerCase()}_${nom}`,
      fullName: `${TAG} ${nom}`,
      passwordHash: 'x'.repeat(20),
      role,
    },
  });
  return row.id;
}

async function fiches(nombre: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < nombre; index += 1) {
    const row = await prisma.representant.create({
      data: {
        id: uuidv7(),
        fullName: `${TAG} Fiche ${String(index).padStart(2, '0')}`,
        phoneE164: `+2217790${String(index).padStart(5, '0')}`,
        departementId,
        createdById: admin.id,
        clientCreatedAt: new Date(),
      },
      select: { id: true },
    });
    ids.push(row.id);
  }
  return ids;
}

async function appeler(representantId: string, performedById: string): Promise<void> {
  await prisma.repCallAttempt.create({
    data: {
      id: uuidv7(),
      representantId,
      performedById,
      outcome: RepCallOutcome.REACHED,
      clientCreatedAt: new Date(),
    },
  });
}

function campagne(
  nom: string,
  teleconseillerIds: readonly string[],
  fichesParJour: number,
  cible: LotExportCible = LotExportCible.REPRESENTANTS,
): CreateLotExportDto {
  return {
    name: `${TAG} ${nom}`,
    cible,
    representants: { departementId },
    distribution: { teleconseillerIds: [...teleconseillerIds], fichesParJour, jours: 1 },
  };
}

/** L'assignation courante, position par position. */
async function assignations(lotId: string): Promise<(string | null)[]> {
  const rows = await prisma.lotExportItem.findMany({
    where: { lotId },
    orderBy: { position: 'asc' },
    select: { assigneeId: true },
  });
  return rows.map((row) => row.assigneeId);
}

async function cleanupData(): Promise<void> {
  await prisma.lotExport.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.representantSuggestion.deleteMany({
    where: { sourceRepresentant: { departementId } },
  });
  await prisma.repCallAttempt.deleteMany({ where: { representant: { departementId } } });
  await prisma.representant.deleteMany({ where: { departementId } });
}

beforeAll(async () => {
  const region = await prisma.region.findFirstOrThrow();
  const departement = await prisma.departement.upsert({
    where: { code: `${TAG}-DEPT` },
    update: {},
    create: { code: `${TAG}-DEPT`, name: `${TAG} Département`, regionId: region.id },
    select: { id: true },
  });
  departementId = departement.id;

  await cleanupData();
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });

  const adminId = await compte('pilote', Role.ADMIN);
  admin = {
    id: adminId,
    email: `${TAG.toLowerCase()}.pilote@cpi.sn`,
    username: `${TAG.toLowerCase()}_pilote`,
    fullName: `${TAG} pilote`,
    role: Role.ADMIN,
  };
  alice = await compte('alice', Role.COMMERCIAL);
  bruno = await compte('bruno', Role.COMMERCIAL);
  carine = await compte('carine', Role.COMMERCIAL);
  superviseur = await compte('sup', Role.SUPERVISEUR);

  await prisma.statutQualification.deleteMany({ where: { code: { startsWith: TAG } } });
  const reessayable = await prisma.statutQualification.create({
    data: {
      code: `${TAG}_OCCUPE`,
      label: `${TAG} Occupé`,
      effect: StatutQualificationEffect.UNREACHABLE,
      retryAfterMinutes: 30,
    },
    select: { id: true },
  });
  const definitif = await prisma.statutQualification.create({
    data: {
      code: `${TAG}_DEFINITIF`,
      label: `${TAG} Injoignable définitif`,
      effect: StatutQualificationEffect.UNREACHABLE,
      retryAfterMinutes: null,
    },
    select: { id: true },
  });
  statutReessayable = reessayable.id;
  statutDefinitif = definitif.id;
});

afterAll(async () => {
  await cleanupData();
  await prisma.statutQualification.deleteMany({ where: { code: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
  await prisma.departement.deleteMany({ where: { code: `${TAG}-DEPT` } });
  await prisma.$disconnect();
});

beforeEach(cleanupData);

describe('EB-16 réaffectation', () => {
  it('laisse la fiche déjà appelée à son téléconseiller, et déplace les autres', async () => {
    const cibles = await fiches(4);
    const lot = await service.create(admin, campagne('réaffectation', [alice, bruno], 2));
    // Tourniquet : alice tient 0 et 2, bruno 1 et 3.
    await appeler(cibles[0] as string, alice);

    const refuse = await refus(() =>
      service.reaffecter(admin, lot.id, { positions: [0], versTeleconseillerId: carine }),
    );
    expect(codeDe(refuse)).toBe('LOT_EXPORT_REAFFECTATION_VIDE');

    await service.reaffecter(admin, lot.id, { positions: [0, 2], versTeleconseillerId: carine });

    expect(await assignations(lot.id)).toEqual([alice, bruno, carine, bruno]);
  });

  it('trace le mouvement et fait entrer le destinataire dans l’équipe', async () => {
    await fiches(4);
    const lot = await service.create(admin, campagne('trace', [alice, bruno], 2));

    const detail = await service.reaffecter(admin, lot.id, {
      positions: [0, 1],
      versTeleconseillerId: carine,
    });

    expect(detail.reaffectations).toHaveLength(2);
    expect(
      detail.reaffectations
        .map((ligne) => ({ de: ligne.fromName, vers: ligne.toName, fiches: ligne.fiches }))
        .sort((gauche, droite) => (gauche.de ?? '').localeCompare(droite.de ?? '')),
    ).toEqual([
      { de: `${TAG} alice`, vers: `${TAG} carine`, fiches: 1 },
      { de: `${TAG} bruno`, vers: `${TAG} carine`, fiches: 1 },
    ]);
    expect(detail.reaffectations[0]?.performedByName).toBe(admin.fullName);
    expect(detail.repartition.map((ligne) => ligne.teleconseillerId)).toEqual([
      alice,
      bruno,
      carine,
    ]);
  });
});

describe('EB-16 retrait', () => {
  it('redistribue les fiches non traitées selon les objectifs en vigueur', async () => {
    const cibles = await fiches(12);
    const lot = await service.create(admin, campagne('retrait', [alice, bruno, carine], 4));
    // Alice tient 0, 3, 6 et 9 ; le premier est appelé et ne bougera pas.
    await appeler(cibles[0] as string, alice);
    // Sans cet objectif, le tourniquet rendrait la position 9 à bruno.
    await service.update(lot.id, { objectifs: [{ teleconseillerId: bruno, fichesParJour: 1 }] });

    const detail = await service.retirer(admin, lot.id, { teleconseillerId: alice });

    const apres = await assignations(lot.id);
    expect(apres[0]).toBe(alice);
    expect([apres[3], apres[6], apres[9]]).toEqual([bruno, carine, carine]);
    expect(detail.repartition.map((ligne) => ligne.teleconseillerId)).toEqual([bruno, carine]);
    expect(
      detail.reaffectations.map((ligne) => ({ de: ligne.fromName, fiches: ligne.fiches })),
    ).toEqual(
      expect.arrayContaining([
        { de: `${TAG} alice`, fiches: 1 },
        { de: `${TAG} alice`, fiches: 2 },
      ]),
    );
  });

  it('refuse de vider l’équipe', async () => {
    await fiches(2);
    const lot = await service.create(admin, campagne('dernier', [alice], 2));

    const refuse = await refus(() => service.retirer(admin, lot.id, { teleconseillerId: alice }));

    expect(codeDe(refuse)).toBe('LOT_EXPORT_EQUIPE_VIDE');
    expect(await assignations(lot.id)).toEqual([alice, alice]);
  });
});

describe('EB-14 et EB-17 réglages', () => {
  it('garde les critères de tirage et ne redistribue rien', async () => {
    await fiches(4);
    const lot = await service.create(admin, campagne('réglages', [alice, bruno], 2));
    const avant = await assignations(lot.id);

    const apres = await service.update(lot.id, {
      name: `${TAG} renommée`,
      objectifs: [{ teleconseillerId: alice, fichesParJour: 7 }],
    });

    expect(apres.name).toBe(`${TAG} renommée`);
    expect(apres.scopeLabel).toBe('Tous les représentants');
    const { filters } = await prisma.lotExport.findUniqueOrThrow({
      where: { id: lot.id },
      select: { filters: true },
    });
    expect(filters).toEqual({
      departementId,
      distribution: {
        teleconseillerIds: [alice, bruno],
        fichesParJour: 2,
        jours: 1,
        objectifs: { [alice]: 7 },
      },
    });
    expect(await assignations(lot.id)).toEqual(avant);
  });

  it('l’objectif explicite prime sur la pondération du rôle', async () => {
    await fiches(1);

    const parRole = await service.preview(campagne('aperçu', [alice, superviseur], 50));
    const regle = campagne('aperçu', [alice, superviseur], 50);
    regle.distribution.objectifs = [{ teleconseillerId: superviseur, fichesParJour: 50 }];
    const parObjectif = await service.preview(regle);

    expect(parRole.places).toBe(60);
    expect(parObjectif.places).toBe(100);
  });
});

describe('EB-18 état des fiches', () => {
  it('« à rappeler » prime sur « traitée »', async () => {
    const cibles = await fiches(2);
    const lot = await service.create(admin, campagne('états', [alice], 2));
    await appeler(cibles[0] as string, alice);
    await appeler(cibles[1] as string, alice);
    await prisma.representant.update({
      where: { id: cibles[0] as string },
      data: { nextCallbackAt: new Date(), nextCallbackOrigine: RappelOrigine.PROMIS },
    });

    const rappels = await service.fiches(lot.id, { etat: LotExportFicheEtat.A_RAPPELER });
    const traitees = await service.fiches(lot.id, { etat: LotExportFicheEtat.TRAITEE });

    expect(rappels.items.map((item) => item.position)).toEqual([0]);
    expect(traitees.items.map((item) => item.position)).toEqual([1]);
  });
});

describe('EB-19 nouvelles cibles', () => {
  it('les injoignables excluent un statut sans délai de reprise', async () => {
    const [reessayable, definitif, sansStatut] = await fiches(3);
    await prisma.representant.updateMany({
      where: { id: { in: [reessayable as string, definitif as string, sansStatut as string] } },
      data: { lastCallOutcome: RepCallOutcome.UNREACHABLE },
    });
    await prisma.representant.update({
      where: { id: reessayable as string },
      data: { statutQualificationId: statutReessayable },
    });
    await prisma.representant.update({
      where: { id: definitif as string },
      data: { statutQualificationId: statutDefinitif },
    });

    const lot = await service.create(
      admin,
      campagne('injoignables', [alice], 50, LotExportCible.REPRESENTANTS_INJOIGNABLES),
    );

    const items = await prisma.lotExportItem.findMany({
      where: { lotId: lot.id },
      select: { representantId: true },
    });
    expect(items.map((item) => item.representantId)).toEqual([reessayable]);
  });

  it('deux recommandations du même numéro ne donnent qu’une fiche, un numéro connu aucune', async () => {
    const [source, connu] = await fiches(2);
    const numeroConnu = await prisma.representant.findUniqueOrThrow({
      where: { id: connu as string },
      select: { phoneE164: true },
    });
    const nouveau = '+221779900001';
    for (const [index, numero] of [nouveau, nouveau, numeroConnu.phoneE164].entries()) {
      const attemptId = uuidv7();
      await prisma.repCallAttempt.create({
        data: {
          id: attemptId,
          representantId: source as string,
          performedById: alice,
          outcome: RepCallOutcome.PROSPECTS_PROMISED,
          clientCreatedAt: new Date(),
        },
      });
      await prisma.representantSuggestion.create({
        data: {
          sourceRepresentantId: source as string,
          suggestedName: `${TAG} Recommandé ${String(index)}`,
          suggestedPhoneE164: numero,
          suggestedById: alice,
          sourceAttemptId: attemptId,
          status: SuggestionStatus.A_APPELER,
          clientCreatedAt: new Date(),
        },
      });
    }

    const lot = await service.create(
      admin,
      campagne('recommandés', [alice], 50, LotExportCible.CONTACTS_RECOMMANDES),
    );

    expect(lot.itemCount).toBe(1);
    const items = await prisma.lotExportItem.findMany({
      where: { lotId: lot.id },
      select: { representant: { select: { id: true, phoneE164: true } } },
    });
    expect(items.map((item) => item.representant?.phoneE164)).toEqual([nouveau]);

    const resolues = await prisma.representantSuggestion.findMany({
      where: { sourceRepresentantId: source as string, resolvedRepresentantId: { not: null } },
      select: { resolvedRepresentantId: true },
    });
    expect(resolues.map((piste) => piste.resolvedRepresentantId)).toEqual([
      items[0]?.representant?.id,
    ]);
  });
});
