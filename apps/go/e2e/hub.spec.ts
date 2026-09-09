import { expect, test, type Page } from '@playwright/test';

import { compteDe, ROLES, type RoleCompte } from './comptes';
import { apiDe, creerCompte, ligne, purger } from './donnees-listes';

/** `COQUES` de `web/src/lib/nav.ts`, réécrit ici : c'est le contrat à tenir. */
const ESPACES: readonly { titre: string; roles: readonly RoleCompte[] }[] = [
  { titre: 'Accueil', roles: ['ADMIN', 'DIRECTION', 'ACCUEIL'] },
  {
    titre: 'Projet CHUES',
    roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'BANQUE_FINANCE'],
  },
  {
    titre: 'Projet Grand Public',
    roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'BANQUE_FINANCE'],
  },
  { titre: 'Admin', roles: ['ADMIN'] },
];

const BARRE_SUPERVISEUR: readonly { libelle: string; adresse: string }[] = [
  { libelle: 'Tableau de bord', adresse: '/chues/statistiques' },
  { libelle: 'Qualifier un représentant', adresse: '/chues/appels-representants' },
  { libelle: 'Ajouter un prospect', adresse: '/chues/prospects/nouveau' },
  { libelle: 'Convertir un prospect', adresse: '/chues/console' },
  { libelle: 'Rappels promis', adresse: '/chues/rappels' },
];

async function ouvrirHub(page: Page): Promise<void> {
  await page.goto('/espaces');
  await expect(page.getByRole('heading', { name: 'Vos espaces', level: 1 })).toBeVisible();
}

test.describe('parcours 2, le hub distribue les espaces selon le rôle', () => {
  test('chaque rôle lit ses quatre tuiles, ouvertes ou fermées', async ({ browser }) => {
    for (const role of ROLES) {
      const contexte = await browser.newContext({ storageState: compteDe(role).etat });
      const page = await contexte.newPage();
      await ouvrirHub(page);

      for (const espace of ESPACES) {
        const autorise = espace.roles.includes(role);
        const tuile = page.getByRole('link', { name: new RegExp(`^${espace.titre}`) });
        await expect(tuile, `${role} et la tuile ${espace.titre}`).toHaveCount(autorise ? 1 : 0);
        if (!autorise) {
          const refus = page
            .locator('div', { hasText: espace.titre })
            .getByText('Non accessible à votre rôle');
          await expect(refus.first(), `${role} n’est pas averti pour ${espace.titre}`).toBeVisible();
        }
      }
      await contexte.close();
    }
  });

  test('une adresse interdite rend « Accès refusé » sans quitter le panneau', async ({
    browser,
  }) => {
    const contexte = await browser.newContext({ storageState: compteDe('ACCUEIL').etat });
    const page = await contexte.newPage();

    for (const adresse of ['/chues/prospects', '/admin/commerciaux']) {
      await page.goto(adresse);
      await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
      await expect(page.getByText('Rôle en cours :')).toBeVisible();
      await expect(page, `${adresse} a redirigé au lieu de refuser`).toHaveURL(
        new RegExp(`${adresse}$`),
      );
    }
    await contexte.close();
  });
});

test.describe('parcours 2, la barre latérale du projet CHUES', () => {
  test.use({ storageState: compteDe('SUPERVISEUR').etat });

  test('mène à chaque écran, et « Tous les espaces » ramène au choix', async ({ page }) => {
    await page.goto('/chues/statistiques');
    const barre = page.getByRole('navigation', { name: 'Navigation principale' });

    for (const entree of BARRE_SUPERVISEUR) {
      await barre.getByRole('link', { name: entree.libelle, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${entree.adresse}$`));
      await expect(page.getByRole('heading', { name: entree.libelle, level: 1 })).toBeVisible();
    }

    await page.getByRole('link', { name: 'Tous les espaces' }).first().click();
    await expect(page.getByRole('heading', { name: 'Vos espaces', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Revenir' })).toBeVisible();
  });
});

test.describe('parcours 2, le mot de passe et les sessions', () => {
  const ANCIEN = 'MotDePasseJetable1';
  const NOUVEAU = 'MotDePasseJetable2';
  let compteId = '';

  test.afterAll(async () => {
    if (compteId !== '') await purger({ comptes: [compteId] });
  });

  test('le changement révoque les autres sessions du même compte', async ({ browser }) => {
    const administration = await apiDe('ADMIN', '198.51.100.70');
    const jetable = await creerCompte(administration, 'COMMERCIAL', ANCIEN);
    compteId = jetable.id;
    await administration.dispose();

    const ouvrir = async (adresse: string, motDePasse: string): Promise<Page> => {
      const contexte = await browser.newContext({
        extraHTTPHeaders: { 'X-Forwarded-For': adresse },
      });
      const page = await contexte.newPage();
      await page.goto('/connexion');
      await page.getByLabel('E-mail ou identifiant').fill(jetable.email);
      await page.getByLabel('Mot de passe').fill(motDePasse);
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await expect(page.getByRole('button', { name: `Compte de ${jetable.nom}` })).toBeVisible();
      return page;
    };

    const bureau = await ouvrir('198.51.100.71', ANCIEN);
    const telephone = await ouvrir('198.51.100.72', ANCIEN);

    await bureau.getByRole('button', { name: `Compte de ${jetable.nom}` }).click();
    await bureau.getByRole('menuitem', { name: 'Mot de passe' }).click();
    await expect(bureau).toHaveURL(/\/compte$/);
    await bureau.getByLabel('Mot de passe actuel').fill(ANCIEN);
    await bureau.getByLabel('Nouveau mot de passe').fill(NOUVEAU);
    await bureau.getByLabel('Confirmation').fill(NOUVEAU);
    await bureau.getByRole('button', { name: 'Changer le mot de passe' }).click();
    await expect(bureau.getByText('Mot de passe changé.')).toBeVisible();

    const sessions = await ligne<{ vivantes: string; total: string }>(
      `SELECT count(*) FILTER (WHERE "revokedAt" IS NULL) AS vivantes, count(*) AS total
         FROM refresh_tokens WHERE "userId" = $1`,
      [jetable.id],
    );
    expect(sessions, 'aucune session en base pour le compte jetable').not.toBeNull();
    expect(Number(sessions?.total), 'les deux connexions doivent être tracées').toBe(2);
    expect(Number(sessions?.vivantes), 'une seule session survit au changement').toBe(1);

    await telephone.goto('/espaces');
    await expect(telephone).toHaveURL(/\/connexion(\?next=.*)?$/);

    await bureau.goto('/espaces');
    await expect(bureau.getByRole('heading', { name: 'Vos espaces', level: 1 })).toBeVisible();

    await bureau.context().close();
    await telephone.context().close();
  });
});

test.describe('parcours 2 en 390 px, le tiroir de navigation', () => {
  test.use({
    storageState: compteDe('SUPERVISEUR').etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('s’ouvre, mène à un écran et se referme', async ({ page }) => {
    await page.goto('/chues/statistiques');
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
      'la barre latérale ne doit pas tenir l’écran d’un téléphone',
    ).toBeHidden();

    await page.getByRole('button', { name: 'Ouvrir la navigation' }).click();
    const tiroir = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(tiroir).toBeVisible();

    await tiroir.getByRole('link', { name: 'Rappels promis', exact: true }).click();
    await expect(tiroir).toBeHidden();
    await expect(page).toHaveURL(/\/chues\/rappels$/);
    await expect(page.getByRole('heading', { name: 'Rappels promis', level: 1 })).toBeVisible();
  });
});
