import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Projet } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { CLE_PARAMETRES, ParametresService } from './parametres.service.js';

const env = {
  PLATEFORME_CHUES_URL: 'https://chues.env/api',
  PLATEFORME_CHUES_TOKEN: 'jeton-env-chues',
  PLATEFORME_GRAND_PUBLIC_URL: 'https://gp.env/api',
  PLATEFORME_GRAND_PUBLIC_TOKEN: 'jeton-env-gp',
};

vi.mock('../../env.js', () => ({ readEnv: () => env }));

class FakePrisma {
  readonly lignes = new Map<string, { key: string; value: string; updatedAt: Date }>();

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }) =>
      Promise.resolve(this.lignes.get(where.key) ?? null),
    upsert: ({ where, create, update }: { where: { key: string }; create: { value: string }; update: { value: string } }) => {
      const existant = this.lignes.get(where.key);
      const value = existant ? update.value : create.value;
      this.lignes.set(where.key, { key: where.key, value, updatedAt: new Date() });
      return Promise.resolve(this.lignes.get(where.key));
    },
  };
}

let prisma: FakePrisma;
let service: ParametresService;

beforeEach(() => {
  prisma = new FakePrisma();
  service = new ParametresService(prisma as unknown as PrismaService);
});

const stocke = (valeurs: Record<string, string>): void => {
  prisma.lignes.set(CLE_PARAMETRES, {
    key: CLE_PARAMETRES,
    value: JSON.stringify(valeurs),
    updatedAt: new Date('2026-09-06T10:00:00.000Z'),
  });
};

describe('paramètres CHUES', () => {
  it('n’expose JAMAIS un jeton, seulement le fait qu’il soit posé', async () => {
    stocke({ chuesApiUrl: 'https://chues.base/api', chuesApiToken: 'secret-a-ne-pas-fuiter' });

    const lu = await service.chues();

    expect(lu.chuesApiTokenPose).toBe(true);
    expect(JSON.stringify(lu)).not.toContain('secret-a-ne-pas-fuiter');
  });

  it('garde le jeton en place quand la mise à jour ne le porte pas', async () => {
    stocke({ chuesApiUrl: 'https://chues.base/api', chuesApiToken: 'jeton-en-place' });

    await service.maj('admin-1', { chuesApiUrl: 'https://chues.base/v2' });

    const config = await service.configPlateforme(Projet.CHUES);
    expect(config).toEqual({ url: 'https://chues.base/v2', token: 'jeton-en-place' });
  });

  it('efface une valeur quand la chaîne est vide, et la laisse quand elle est absente', async () => {
    stocke({ email: 'enrolement@chues.sn', whatsappE164: '+221771234567' });

    await service.maj('admin-1', { email: '' });

    expect(await service.publics()).toMatchObject({
      email: null,
      whatsappE164: '+221771234567',
    });
  });
});

describe('configuration du connecteur', () => {
  it('retombe sur l’environnement tant que rien n’est saisi', async () => {
    expect(await service.configPlateforme(Projet.CHUES)).toEqual({
      url: 'https://chues.env/api',
      token: 'jeton-env-chues',
    });
    expect((await service.chues()).heriteDeLEnvironnement).toBe(true);
  });

  /** Sans cette règle, saisir l'écran resterait sans effet là où les variables existent. */
  it('la base PRIME sur l’environnement dès qu’une URL y est posée', async () => {
    stocke({ chuesApiUrl: 'https://chues.base/api', chuesApiToken: 'jeton-base' });

    expect(await service.configPlateforme(Projet.CHUES)).toEqual({
      url: 'https://chues.base/api',
      token: 'jeton-base',
    });
    expect((await service.chues()).heriteDeLEnvironnement).toBe(false);
  });

  it('chaque plateforme retombe séparément : l’une en base, l’autre dans l’environnement', async () => {
    stocke({ chuesApiUrl: 'https://chues.base/api', chuesApiToken: 'jeton-base' });

    expect(await service.configPlateforme(Projet.GRAND_PUBLIC)).toEqual({
      url: 'https://gp.env/api',
      token: 'jeton-env-gp',
    });
  });

  /** Une ligne éditée à la main ne doit pas empêcher le connecteur de répondre. */
  it('une valeur illisible vaut des réglages vides, jamais une exception', async () => {
    prisma.lignes.set(CLE_PARAMETRES, {
      key: CLE_PARAMETRES,
      value: 'pas du JSON',
      updatedAt: new Date(),
    });

    expect(await service.publics()).toEqual({
      plateformeUrl: null,
      email: null,
      whatsappE164: null,
    });
  });
});
