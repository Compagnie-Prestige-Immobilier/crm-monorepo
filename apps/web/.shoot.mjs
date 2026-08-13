import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.SHOT_DIR;
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'fr-FR',
  timezoneId: 'Africa/Dakar',
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded' });
await page.getByLabel(/identifiant|e-mail|email/i).first().fill('admin@cpi.sn');
await page.getByLabel(/mot de passe/i).first().fill('ChangeMoiEnProd2026');
await page.getByRole('button', { name: /connexion|se connecter/i }).click();
await page.waitForURL(/tableau-de-bord|banque|dossiers/, { timeout: 30000 });
await page.waitForLoadState('networkidle');
console.log('logged in ->', page.url());

async function shot(name, opts = {}) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.full ?? false });
  console.log('shot', name);
}

async function setTheme(theme) {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(400);
}

for (const theme of ['light', 'dark']) {
  await page.goto(`${BASE}/tableau-de-bord`, { waitUntil: 'domcontentloaded' });
  await setTheme(theme);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(`dashboard-${theme}`);
  await shot(`dashboard-${theme}-full`, { full: true });
}
await browser.close();
