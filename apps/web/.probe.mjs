import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/connexion');
await page.getByLabel(/identifiant|e-mail|email/i).first().fill('admin@cpi.sn');
await page.getByLabel(/mot de passe/i).first().fill('ChangeMoiEnProd2026');
await page.getByRole('button', { name: /connexion|se connecter/i }).click();
await page.waitForURL(/tableau-de-bord/);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const el = document.querySelector('.text-display');
  const cs = el ? getComputedStyle(el) : null;
  return {
    found: !!el,
    cls: el?.className,
    fontSize: cs?.fontSize,
    fontWeight: cs?.fontWeight,
    text: el?.textContent,
    varDisplay: getComputedStyle(document.documentElement).getPropertyValue('--text-display'),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
