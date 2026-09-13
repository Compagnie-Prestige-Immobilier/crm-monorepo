import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

/**
 * `/chues/representants` vu par l'ADMIN : l'export du registre. CHU-REP-07.
 *
 * Aucune donnée créée. Le fichier est écrit par le navigateur à partir d'un
 * `blob`, ce qu'aucun test unitaire ne peut observer : c'est tout l'objet du
 * scénario.
 */
test.use({ storageState: 'v1/.auth/admin.json' });

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function readMagic(path: string): Promise<number[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path, { start: 0, end: 3 })) {
    chunks.push(chunk as Buffer);
  }
  return Array.from(Buffer.concat(chunks));
}

test('CHU-REP-07 l’export du registre produit un vrai classeur', async ({ page }) => {
  await page.goto('/chues/representants');
  await expect(page.getByRole('heading', { level: 1, name: 'Représentants' })).toBeVisible();

  const exporter = page.getByRole('button', { name: 'Exporter' });
  await expect(exporter).toBeEnabled();

  const [download] = await Promise.all([page.waitForEvent('download'), exporter.click()]);

  // Le nom décide si le système propose Excel ou ouvre le fichier dans le
  // navigateur ; le suffixe de démonstration y apparaîtrait si la session avait
  // basculé d'espace.
  expect(download.suggestedFilename()).toMatch(/^cpi-representants-\d{4}-\d{2}-\d{2}\.xlsx$/u);

  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(1_000);
  // Un VRAI classeur, pas un 502 relayé tel quel et enregistré en `.xlsx` :
  // c'est la seule assertion que ce défaut ne passerait pas.
  expect(await readMagic(path)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});
