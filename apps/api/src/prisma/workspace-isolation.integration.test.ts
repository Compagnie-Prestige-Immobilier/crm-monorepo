import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClients } from './prisma.service.js';

function loadRootEnv(): void {
  try {
    process.loadEnvFile(new URL('../../../../.env', import.meta.url).pathname);
  } catch {}
}

const KEY = `test.isolation.${uuidv7().slice(0, 8)}`;
let clients: PrismaClients;

beforeAll(() => {
  loadRootEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL doit être défini pour la suite d’intégration.');
  }
  clients = new PrismaClients();
});

afterAll(async () => {
  await clients.get('demo').appSetting.deleteMany({ where: { key: KEY } });
  await clients.get('public').appSetting.deleteMany({ where: { key: KEY } });
  await clients.onModuleDestroy();
});

// Le seed de démo et toute saisie faite « en démo » atterrissaient dans
// `public` : Prisma ignorait le `?schema=` de l'URL.
describe('isolement des espaces', () => {
  it('une écriture en démo est invisible depuis public, et réciproquement', async () => {
    await clients.get('demo').appSetting.create({ data: { key: KEY, value: 'demo' } });

    expect(await clients.get('public').appSetting.findUnique({ where: { key: KEY } })).toBeNull();
    expect((await clients.get('demo').appSetting.findUnique({ where: { key: KEY } }))?.value).toBe(
      'demo',
    );

    await clients.get('public').appSetting.create({ data: { key: KEY, value: 'public' } });
    expect(
      (await clients.get('public').appSetting.findUnique({ where: { key: KEY } }))?.value,
    ).toBe('public');
    expect((await clients.get('demo').appSetting.findUnique({ where: { key: KEY } }))?.value).toBe(
      'demo',
    );
  });

  it('le SQL brut sans préfixe suit aussi le schéma du client', async () => {
    const rows = await clients.get('demo').$queryRaw<{ value: string }[]>`
      SELECT value FROM app_settings WHERE key = ${KEY}
    `;
    expect(rows.map((row) => row.value)).toEqual(['demo']);
  });
});
