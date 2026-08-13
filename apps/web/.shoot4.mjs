import { chromium } from '@playwright/test';
const OUT = process.env.SHOT_DIR;
const BASE = 'http://localhost:3000';
const THEME = process.env.THEME ?? 'light';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Africa/Dakar', deviceScaleFactor: 2 });
await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, THEME);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await page.goto(`${BASE}/connexion`);
await page.getByLabel(/identifiant|e-mail|email/i).first().fill('admin@cpi.sn');
await page.getByLabel(/mot de passe/i).first().fill('ChangeMoiEnProd2026');
await page.getByRole('button', { name: /connexion|se connecter/i }).click();
await page.waitForURL(/tableau-de-bord/);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /Réduire la navigation/i }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/v3-sidebar-reduite-${THEME}.png` });
console.log('shot reduite', THEME);

// Rechargement : la préférence tient, sans saut de largeur (cookie lu au serveur).
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1200);
const w = await page.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().width);
console.log('largeur après rechargement =', w, '(4.5rem = 72)');
await page.screenshot({ path: `${OUT}/v3-sidebar-reduite-rechargee-${THEME}.png` });

await page.getByRole('button', { name: /Déployer la navigation/i }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/v3-sidebar-deployee-${THEME}.png` });
console.log('shot deployee', THEME);
await browser.close();
