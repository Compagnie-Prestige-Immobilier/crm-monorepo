import { chromium } from '@playwright/test';
const b = await chromium.launch();
const c = await b.newContext({ viewport:{width:1440,height:1000}, locale:'fr-FR' });
const p = await c.newPage();
await p.goto('http://localhost:3000/connexion');
await p.getByLabel(/identifiant|e-mail|email/i).first().fill('admin@cpi.sn');
await p.getByLabel(/mot de passe/i).first().fill('ChangeMoiEnProd2026');
await p.getByRole('button', { name: /connexion|se connecter/i }).click();
await p.waitForURL(/tableau-de-bord/); await p.waitForLoadState('networkidle');
await c.addCookies([{ name:'cpi_sidebar', value:'1', domain:'localhost', path:'/' }]);
// HTML SERVEUR brut, hors React
const html = await p.evaluate(async () => (await fetch('/tableau-de-bord', { headers:{ 'accept':'text/html' } })).text());
const m = html.match(/<aside[^>]*>/);
console.log('aside servi par le serveur :', m ? m[0] : 'introuvable');
await p.reload(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
console.log('classe aside après rechargement :', await p.evaluate(() => document.querySelector('aside')?.className));
await b.close();
