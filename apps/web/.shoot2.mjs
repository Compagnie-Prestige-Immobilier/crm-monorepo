import { chromium } from '@playwright/test';
const OUT = process.env.SHOT_DIR;
const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'fr-FR', timezoneId: 'Africa/Dakar', deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });

await page.goto(`${BASE}/connexion`);
await page.getByLabel(/identifiant|e-mail|email/i).first().fill('admin@cpi.sn');
await page.getByLabel(/mot de passe/i).first().fill('ChangeMoiEnProd2026');
await page.getByRole('button', { name: /connexion|se connecter/i }).click();
await page.waitForURL(/tableau-de-bord/);
await page.waitForLoadState('networkidle');

// Un identifiant de banque réel, pour une URL qui porte un filtre avancé.
const ref = await page.evaluate(async () => {
  const r = await fetch('/api/v1/referentiels?activeOnly=false');
  const j = await r.json();
  return { banque: j.banques?.[0], dep: j.departements?.[0] };
});
console.log('banque:', ref.banque?.shortName, ref.banque?.id);

async function setTheme(t) {
  await page.evaluate((x) => {
    localStorage.setItem('theme', x);
    document.documentElement.classList.toggle('dark', x === 'dark');
    document.documentElement.style.colorScheme = x;
  }, t);
  await page.waitForTimeout(300);
}
async function shot(n, full = false) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }); console.log('shot', n); }

for (const theme of ['light', 'dark']) {
  // ── Panneau REPLIÉ avec des filtres avancés actifs (puces de rappel) ──
  await page.evaluate(() => localStorage.setItem('cpi.filtres-avances', '0'));
  await page.goto(`${BASE}/tableau-de-bord?banqueId=${ref.banque.id}&statut=CONTACTE&segment=BDD1`);
  await setTheme(theme);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  // L'URL porte des filtres avancés : le panneau s'ouvre tout seul. On le referme
  // pour voir les puces.
  await page.getByRole('button', { name: /Filtres avancés/i }).click();
  await shot(`filtres-replies-${theme}`);

  // ── Panneau DÉPLIÉ ──
  await page.getByRole('button', { name: /Filtres avancés/i }).click();
  await shot(`filtres-deplies-${theme}`);
}

// ── Chiffres exacts ──
await setTheme('light');
await page.goto(`${BASE}/tableau-de-bord`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Chiffres exacts/i }).click();
await shot('chiffres-exacts-light');

// ── Recherche insensible aux accents dans un combo ──
await page.getByRole('button', { name: /Filtres avancés/i }).click();
await page.waitForTimeout(400);
const dep = page.getByRole('combobox', { name: /Département/i });
await dep.click();
await page.waitForTimeout(300);
await page.getByPlaceholder('Chercher…').fill('thies');
await page.waitForTimeout(400);
await shot('combo-accents-light');
const visible = await page.locator('[cmdk-item]').allTextContents();
console.log('résultats pour « thies » :', JSON.stringify(visible));
await page.keyboard.press('Escape');

await browser.close();
