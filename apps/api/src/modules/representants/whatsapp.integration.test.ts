process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.PHONE_DEFAULT_REGION ??= 'SN';

import { PrismaClient, PrismaPg, Role, WhatsappStatus } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TAG = 'ITWA';

let departementId: string;
let commercialId: string;
let compteur = 0;

async function cleanup(): Promise<void> {
  await prisma.representant.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
}

const creer = async (data: Record<string, unknown>): Promise<{ id: string }> => {
  compteur += 1;
  return prisma.representant.create({
    data: {
      id: uuidv7(),
      fullName: `${TAG} Rep ${String(compteur)}`,
      phoneE164: `+2217712345${String(compteur).padStart(2, '0')}`,
      departementId,
      createdById: commercialId,
      clientCreatedAt: new Date('2026-01-02T09:00:00.000Z'),
      ...data,
    },
    select: { id: true },
  });
};

beforeAll(async () => {
  await cleanup();

  const departement = await prisma.departement.findFirstOrThrow({ select: { id: true } });
  departementId = departement.id;

  const commercial = await prisma.user.create({
    data: {
      id: uuidv7(),
      username: `${TAG.toLowerCase()}-com`,
      email: `${TAG.toLowerCase()}-com@cpi.sn`,
      fullName: `${TAG} Commercial`,
      passwordHash: 'x',
      role: Role.COMMERCIAL,
      departementId,
    },
    select: { id: true },
  });
  commercialId = commercial.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('le CHECK qui lie le numéro WhatsApp à son statut', () => {
  it('REFUSE un numéro porté par un statut qui l’interdit', async () => {
    for (const whatsappStatus of [
      WhatsappStatus.NON_DEMANDE,
      WhatsappStatus.MEME_NUMERO,
      WhatsappStatus.AUCUN,
    ]) {
      await expect(
        creer({ whatsappStatus, whatsappE164: '+221780000001' }),
        whatsappStatus,
      ).rejects.toThrow(/representants_whatsapp_number_matches_status/);
    }
  });

  it('REFUSE AUTRE_NUMERO sans numéro', async () => {
    await expect(creer({ whatsappStatus: WhatsappStatus.AUTRE_NUMERO })).rejects.toThrow(
      /representants_whatsapp_number_matches_status/,
    );
  });

  it('REFUSE aussi la bascule à froid qui laisserait le numéro derrière elle', async () => {
    const row = await creer({
      whatsappStatus: WhatsappStatus.AUTRE_NUMERO,
      whatsappE164: '+221780000002',
    });

    await expect(
      prisma.representant.update({
        where: { id: row.id },
        data: { whatsappStatus: WhatsappStatus.AUCUN },
      }),
    ).rejects.toThrow(/representants_whatsapp_number_matches_status/);
  });

  it('ACCEPTE MEME_NUMERO sans jamais recopier le téléphone', async () => {
    const row = await creer({ whatsappStatus: WhatsappStatus.MEME_NUMERO });

    await expect(
      prisma.representant.findUniqueOrThrow({
        where: { id: row.id },
        select: { whatsappStatus: true, whatsappE164: true },
      }),
    ).resolves.toEqual({ whatsappStatus: WhatsappStatus.MEME_NUMERO, whatsappE164: null });
  });

  it('ACCEPTE AUTRE_NUMERO avec son numéro, et la profession en texte libre', async () => {
    const row = await creer({
      whatsappStatus: WhatsappStatus.AUTRE_NUMERO,
      whatsappE164: '+221780000003',
      profession: 'Directeur d’école',
    });

    await expect(
      prisma.representant.findUniqueOrThrow({
        where: { id: row.id },
        select: { whatsappE164: true, profession: true },
      }),
    ).resolves.toEqual({ whatsappE164: '+221780000003', profession: 'Directeur d’école' });
  });

  it('les fiches déjà en base restent NON_DEMANDE : la migration n’invente aucune réponse', async () => {
    const row = await creer({});

    await expect(
      prisma.representant.findUniqueOrThrow({
        where: { id: row.id },
        select: { whatsappStatus: true, whatsappE164: true, profession: true },
      }),
    ).resolves.toEqual({
      whatsappStatus: WhatsappStatus.NON_DEMANDE,
      whatsappE164: null,
      profession: null,
    });
  });
});
