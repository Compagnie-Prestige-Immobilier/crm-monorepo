import { expect, test, type Page } from '@playwright/test';

import { avecBase, BASE_URL, compteDe, MOT_DE_PASSE } from './comptes';

const compte = compteDe('ADMIN');
const BASE_DEMO = process.env.DATABASE_URL_DEMO;
const COMPTE_DEMO = {
  id: '0199aaaa-0000-7000-8000-0000000000de',
  email: 'demo.seule@cpi.sn',
  identifiant: 'demo.seule',
  nom: 'Compte Démo Seule',
};
const CONDENSAT =
  '$argon2id$v=19$m=19456,t=2,p=1$dI4UOWpqGWphWJ1FU7RSBQ$cOhcigHgQbTGlFfucnddHW60b3KBemABT290kltRnyc';

async function remplir(page: Page, motDePasse: string): Promise<void> {
  await page.getByLabel('E-mail ou identifiant').fill(compte.email);
  await page.getByLabel('Mot de passe').fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test.describe('parcours 1, connexion et session', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.30' } });

  test('refus, ouverture, rechargement, fermeture', async ({ page }) => {
    await page.goto('/connexion');

    await remplir(page, 'MauvaisMotDePasse');
    await expect(page.getByRole('alert')).toHaveText('Identifiants invalides.');
    await expect(page).toHaveURL(/\/connexion$/);

    await remplir(page, MOT_DE_PASSE);
    const menuCompte = page.getByRole('button', { name: `Compte de ${compte.nom}` });
    await expect(menuCompte).toBeVisible();

    await page.reload();
    await expect(menuCompte).toBeVisible();

    await menuCompte.click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/connexion(\?suite=.*)?$/);
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();
  });
});

test.describe('parcours 1, limiteur de connexion', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.31' } });

  test('la onzieme tentative est refusee', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(compte.email);
    await page.getByLabel('Mot de passe').fill('MauvaisMotDePasse');

    // Le limiteur est un seau de jetons qui se remplit au fil de la minute : dix
    // tentatives par l'écran, machine chargée, dureraient assez pour en regagner.
    for (let tentative = 1; tentative <= 10; tentative += 1) {
      const refus = await page.request.post('/api/v1/auth/login', {
        data: { identifier: compte.email, password: 'MauvaisMotDePasse' },
        headers: { Origin: BASE_URL },
      });
      expect(refus.status(), `tentative ${String(tentative)}`).toBe(401);
    }

    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Trop de tentatives. Réessayez dans une minute.',
    );
  });
});

test.describe('parcours 1, seconde base', () => {
  test.skip(BASE_DEMO === undefined, 'DATABASE_URL_DEMO absent');
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.32' } });

  test.beforeAll(async () => {
    await avecBase(async (client) => {
      await client.query(
        `INSERT INTO users (id, email, username, "passwordHash", "fullName", role, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'ADMIN'::"Role", now())
         ON CONFLICT (id) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "isActive" = true`,
        [COMPTE_DEMO.id, COMPTE_DEMO.email, COMPTE_DEMO.identifiant, CONDENSAT, COMPTE_DEMO.nom],
      );
    }, BASE_DEMO);
  });

  test('un compte qui n’existe que dans la base démo s’y connecte, et nulle part ailleurs', async ({
    page,
  }) => {
    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(COMPTE_DEMO.email);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toHaveText('Identifiants invalides.');

    await page.keyboard.press('Control+Shift+D');
    await page.getByRole('combobox', { name: 'Base' }).click();
    await page.getByRole('option', { name: 'demo' }).click();
    await page.getByRole('button', { name: 'Se connecter' }).click();
    const menuCompte = page.getByRole('button', { name: `Compte de ${COMPTE_DEMO.nom}` });
    await expect(menuCompte).toBeVisible();
    await expect(menuCompte.getByText('demo')).toBeVisible();

    await menuCompte.click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('combobox', { name: 'Base' })).toContainText('demo');
    await page.getByRole('combobox', { name: 'Base' }).click();
    await page.getByRole('option', { name: 'public' }).click();
    await page.getByLabel('E-mail ou identifiant').fill(COMPTE_DEMO.email);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toHaveText('Identifiants invalides.');
  });
});
