import { chromium } from '@playwright/test';
const OUT = process.env.SHOT_DIR;
const BASE = 'http://localhost:3000';
const THEME = process.env.THEME ?? 'light';
const OPEN = process.env.PANEL_OPEN === '1' ? '1' : '0';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1150 }, locale: 'fr-FR', timezoneId: 'Africa/Dakar', deviceScaleFactor: 2 });
// Les préférences sont posées AVANT tout script de page : next-themes les lit
// à son montage, il n'y a donc aucune fenêtre où le thème clair s'appliquerait.
await ctx.addInitScript(([theme, open]) => {
  try {
    localStorage.setItem('theme', theme);
    localStorage.setItem('cpi.filtres-avances', open);
  } catch {}
}, [THEME, OPEN]);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });

await page.goto(`${BASE}/connexion`);
await page.getByLabel(/identifiant|e-mail|email/i).first().fill('admin@cpi.sn');
await page.getByLabel(/mot de passe/i).first().fill('ChangeMoiEnProd2026');
await page.getByRole('button', { name: /connexion|se connecter/i }).click();
await page.waitForURL(/tableau-de-bord/);
await page.waitForLoadState('networkidle');

const ref = await page.evaluate(async () => {
  const j = await (await fetch('/api/v1/referentiels?activeOnly=false')).json();
  return { banque: j.banques?.[0]?.id };
});

async function shot(n, full = false) {
  await page.waitForTimeout(700);
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
  console.log('shot', n, '| dark =', dark);
}

// 1. Tableau de bord nominal
await page.goto(`${BASE}/tableau-de-bord`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await shot(`v2-dashboard-${THEME}`);
await shot(`v2-dashboard-${THEME}-full`, true);

// 2. Chiffres exacts
await page.getByRole('button', { name: /Chiffres exacts/i }).click();
await shot(`v2-exacts-${THEME}`);
await page.getByRole('button', { name: /Chiffres exacts/i }).click();

// 3. Filtres avancés actifs, panneau REPLIÉ
await page.goto(`${BASE}/tableau-de-bord?banqueId=${ref.banque}&statut=CONTACTE&segment=BDD1&search=diop`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1200);
const toggle = page.getByRole('button', { name: /Filtres avancés/i });
if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
await shot(`v2-filtres-replies-${THEME}`);

// 4. Panneau DÉPLIÉ
await toggle.click();
await shot(`v2-filtres-deplies-${THEME}`);

// 5. Recherche insensible aux accents dans un combo
const dep = page.getByRole('combobox', { name: /Département/i });
await dep.scrollIntoViewIfNeeded();
await dep.click();
await page.waitForTimeout(400);
await page.getByPlaceholder('Chercher…').fill('thies');
await page.waitForTimeout(400);
await shot(`v2-combo-accents-${THEME}`);
console.log('« thies » ->', JSON.stringify(await page.locator('[cmdk-item]').allTextContents()));
await page.keyboard.press('Escape');

await browser.close();
