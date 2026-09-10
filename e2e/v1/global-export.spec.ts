import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';

test.use({ storageState: 'v1/.auth/superviseur.json' });

test('un superviseur télécharge le suivi global avec tableaux et graphiques', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/chues/prospects?search=aucune-fiche-export-global');
  const button = page.getByRole('button', { name: 'Export Excel global', exact: true });
  await expect(button).toBeVisible();
  const downloading = page.waitForEvent('download');
  await button.click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/^cpi-global-\d{4}-\d{2}-\d{2}.*\.xlsx$/u);
  const path = testInfo.outputPath('cpi-global.xlsx');
  await download.saveAs(path);
  const book = new ExcelJS.Workbook();
  const bytes = await readFile(path);
  await book.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  expect(book.worksheets).toHaveLength(12);
  const dashboard = book.getWorksheet('Tableau de bord');
  if (!dashboard) throw new Error('Tableau de bord absent');
  expect(dashboard.getImages()).toHaveLength(4);
  const prospects = book.getWorksheet('Prospects');
  if (!prospects) throw new Error('Prospects absents');
  expect(prospects.rowCount).toBeGreaterThan(1);
  expect(prospects.getTables()).toHaveLength(1);
  expect(prospects.getCell('A1').font).toMatchObject({ name: 'Arial', size: 14 });
  expect(prospects.views[0]).toMatchObject({ state: 'frozen' });
  const totals: number[] = [];
  dashboard.eachRow((row) => {
    if (row.getCell(1).text === 'Totaux' && row.getCell(2).text === 'Prospects')
      totals.push(Number(row.getCell(3).value));
  });
  expect(totals).toEqual([prospects.rowCount - 1]);
  await expect(button).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('export-global.png') });

  for (const role of ['commercial', 'banque']) {
    const context = await browser.newContext({ storageState: `v1/.auth/${role}.json` });
    try {
      expect((await context.request.get('/api/export/global')).status()).toBe(403);
      expect((await context.request.get('/api/v1/export/global.xlsx')).status()).toBe(403);
    } finally {
      await context.close();
    }
  }
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    expect((await anonymous.request.get('/api/export/global')).status()).toBe(401);
    expect((await anonymous.request.get('/api/v1/export/global.xlsx')).status()).toBe(401);
  } finally {
    await anonymous.close();
  }
});
