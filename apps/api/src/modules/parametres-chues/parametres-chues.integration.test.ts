process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';

import { PrismaClient, PrismaPg, Role } from '@crm/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { PARAMETRES_USINE, CLES, cleStockee } from './parametres.js';
import { ParametresChuesService } from './parametres-chues.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const service = new ParametresChuesService(prisma as unknown as PrismaService);

const TAG = 'ITPC';
let admin: AuthenticatedUser;
let superviseur: AuthenticatedUser;

async function compte(nom: string, role: Role): Promise<AuthenticatedUser> {
  const row = await prisma.user.create({
    data: {
      email: `${TAG.toLowerCase()}.${nom}@cpi.sn`,
      username: `${TAG.toLowerCase()}_${nom}`,
      fullName: `${TAG} ${nom}`,
      passwordHash: 'x'.repeat(20),
      role,
    },
  });
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.fullName,
    role,
  };
}

const stockees = { key: { in: CLES.map(cleStockee) } };

async function vider(): Promise<void> {
  await prisma.appSettingChange.deleteMany({ where: stockees });
  await prisma.appSetting.deleteMany({ where: stockees });
}

async function refus(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

beforeAll(async () => {
  await vider();
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
  admin = await compte('pilote', Role.ADMIN);
  superviseur = await compte('sup', Role.SUPERVISEUR);
});

beforeEach(vider);

afterAll(async () => {
  await vider();
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG.toLowerCase() } } });
  await prisma.$disconnect();
});

describe('EB-29 lecture', () => {
  it('rend l’usine tant que rien n’a été réglé', async () => {
    await expect(service.lire()).resolves.toEqual(PARAMETRES_USINE);
  });

  it('rend la valeur réglée, listes comprises', async () => {
    await service.ecrire(admin, {
      plateformeChuesUrl: 'https://chues.cpi.sn',
      destinatairesBpe: ['bpe@cpi.sn', 'pilotage@cpi.sn'],
    });

    const lus = await service.lire();
    expect(lus.plateformeChuesUrl).toBe('https://chues.cpi.sn');
    expect(lus.destinatairesBpe).toEqual(['bpe@cpi.sn', 'pilotage@cpi.sn']);
    expect(lus.emailChues).toBe(PARAMETRES_USINE.emailChues);
  });
});

describe('EB-29 droits', () => {
  it('le superviseur écrit les deux textes', async () => {
    const apres = await service.ecrire(superviseur, { messageWhatsapp: 'Bonjour {prenom}.' });

    expect(apres.messageWhatsapp).toBe('Bonjour {prenom}.');
  });

  it('le superviseur ne touche ni aux liens ni aux destinataires', async () => {
    await refus(() => service.ecrire(superviseur, { plateformeChuesUrl: 'https://ailleurs.sn' }));
    await refus(() => service.ecrire(superviseur, { destinatairesBpe: ['moi@cpi.sn'] }));

    expect((await service.lire()).plateformeChuesUrl).toBe('');
  });

  // Un corps qui mêle un texte permis et un lien interdit ne doit rien écrire
  // du tout : la moitié appliquée serait pire qu'un refus franc.
  it('un corps qui mêle permis et interdit n’écrit rien', async () => {
    await refus(() =>
      service.ecrire(superviseur, {
        messageWhatsapp: 'passera-t-il ?',
        plateformeChuesUrl: 'https://ailleurs.sn',
      }),
    );

    expect((await service.lire()).messageWhatsapp).toBe(PARAMETRES_USINE.messageWhatsapp);
  });
});

describe('EB-29 trace', () => {
  it('garde l’ancienne et la nouvelle valeur, et qui a changé', async () => {
    await service.ecrire(admin, { emailChues: 'chues@cpi.sn' });
    await service.ecrire(admin, { emailChues: 'adhesion@cpi.sn' });

    const { items } = await service.journal(10);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      cle: 'emailChues',
      ancienne: 'chues@cpi.sn',
      nouvelle: 'adhesion@cpi.sn',
      parNom: `${TAG} pilote`,
    });
    // Nul, et non chaîne vide : le réglage n'existait pas, il n'était pas vide.
    expect(items[1]?.ancienne).toBeNull();
  });

  it('n’inscrit rien quand la valeur ne change pas', async () => {
    await service.ecrire(admin, { emailChues: 'chues@cpi.sn' });
    await service.ecrire(admin, { emailChues: 'chues@cpi.sn' });

    expect((await service.journal(10)).items).toHaveLength(1);
  });
});
