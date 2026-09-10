import { expect, test } from '@playwright/test';

/**
 * Le debordement horizontal est la seule panne responsive qu'une machine sait
 * constater seule : la page est plus large que l'ecran, et le lecteur pousse le
 * contenu du doigt pour lire une colonne. Le reste (densite, lisibilite) se
 * juge a l'oeil.
 */
const ROUTES = [
  '/',
  '/accueil',
  '/accueil/import',
  '/accueil/listes',
  '/accueil/tableau-de-bord',
  '/admin',
  '/admin/champs-conversion',
  '/admin/commerciaux',
  '/admin/enrolement',
  '/admin/imports',
  '/admin/notifications',
  '/admin/parametres',
  '/admin/referentiels',
  '/admin/referentiels/issues-appel',
  '/admin/referentiels/statuts-qualification',
  '/chues',
  '/chues/appels-representants',
  '/chues/banque',
  '/chues/campagnes',
  '/chues/console',
  '/chues/demandes-clients',
  '/chues/dossiers',
  '/chues/dossiers/etapes',
  '/chues/dossiers/export',
  '/chues/dossiers/nouveau',
  '/chues/mes-contacts',
  '/chues/parametres-chues',
  '/chues/prospects',
  '/chues/prospects/nouveau',
  '/chues/rappels',
  '/chues/representants',
  '/chues/representants/import',
  '/chues/statistiques',
  '/chues/suggestions',
  '/chues/supervision',
  '/chues/tableau-de-bord',
  '/compte',
  '/espaces',
  '/grand-public',
  '/grand-public/banque',
  '/grand-public/campagnes',
  '/grand-public/console',
  '/grand-public/dossiers',
  '/grand-public/dossiers/export',
  '/grand-public/dossiers/nouveau',
  '/grand-public/mes-contacts',
  '/grand-public/nouveau',
  '/grand-public/rappels',
  '/grand-public/statistiques',
  '/grand-public/supervision',
  '/grand-public/tableau-de-bord',
  '/notifications',
];

for (const route of ROUTES) {
  test(`sans debordement horizontal: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Pas de `networkidle` : `LiveStream` tient un flux SSE ouvert en
    // permanence, le reseau n'est jamais au repos et l'attente expire.
    await page.locator('#contenu-principal').waitFor({ state: 'attached' });
    await page.waitForTimeout(700);

    const debordement = await page.evaluate(() => {
      const racine = document.documentElement;
      // Un tableau qui defile DANS son cadre est voulu : on ne remonte que ce
      // qui pousse la page entiere.
      const coupables = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => element.getBoundingClientRect().right > racine.clientWidth + 1)
        .slice(0, 5)
        .map(
          (element) =>
            `${element.tagName.toLowerCase()}.${element.className.toString().slice(0, 80)}`,
        );
      return { largeur: racine.scrollWidth, ecran: racine.clientWidth, coupables };
    });

    expect(
      debordement.largeur,
      `${route} deborde de ${String(debordement.largeur - debordement.ecran)} px. Coupables: ${debordement.coupables.join(' | ')}`,
    ).toBeLessThanOrEqual(debordement.ecran + 1);
  });
}
