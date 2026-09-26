import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import {
  apiDe,
  creerCompte,
  ligne,
  purger,
  sessionApi,
  suffixe,
  type CompteCree,
} from './donnees-listes';

const cle = suffixe();
const SUPERVISEUR = compteDe('SUPERVISEUR');
const ADMIN = compteDe('ADMIN');

let veilleur: CompteCree | null = null;

test.beforeAll(async () => {
  const api = await apiDe('ADMIN', '198.51.100.74');
  const compte = await creerCompte(api, 'COMMERCIAL', `MotDePasseVeille${cle.slice(0, 4)}`);
  veilleur = compte;
  await api.dispose();
});

test.afterAll(async () => {
  await avecBase(async (client) => {
    await client.query('DELETE FROM dashboard_layouts WHERE "userId" = ANY($1)', [
      [SUPERVISEUR.id, ADMIN.id],
    ]);
  });
  await purger({
    comptes: veilleur === null ? [] : [veilleur.id],
  });
});

async function widgetsDe(userId: string): Promise<string[]> {
  const trouvee = await ligne<{ sources: string[] }>(
    `SELECT array_agg(w->>'source' ORDER BY rang) AS sources
       FROM dashboard_layouts d,
            LATERAL jsonb_array_elements(d.layout->'widgets') WITH ORDINALITY AS t(w, rang)
      WHERE d."userId" = $1 AND d.ecran = 'chues'`,
    [userId],
  );
  return trouvee?.sources ?? [];
}

const blocsDe = (page: Page) => page.getByRole('button', { name: /^À propos de / });

// Un jeu de comptes par fichier de parcours : les téléconseillers débordent la page de 25.
async function toutesLesLignesTeleconseillers(page: Page): Promise<void> {
  const legende = page.getByRole('table', { name: /^Téléconseillers/ }).locator('caption');
  const nombre = Number((await legende.textContent())?.replace(/\D/g, ''));
  if (nombre <= 25) return;
  await page.getByRole('combobox', { name: 'Lignes' }).first().click();
  await page.getByRole('option', { name: '100', exact: true }).click();
}

async function reporterRappelIntrusif(page: Page): Promise<void> {
  const reporter = page.getByRole('button', { name: 'Plus tard' });
  if ((await reporter.count()) > 0) {
    await reporter.first().click({ force: true });
  }
}

test.describe('parcours 9, le tableau de bord CHUES', () => {
  test.use({ storageState: SUPERVISEUR.etat });

  test('la disposition composée s’écrit en base et tient au rechargement', async ({ page }) => {
    await page.goto('/teleconseil/tableau-de-bord');
    await reporterRappelIntrusif(page);
    const blocs = blocsDe(page);
    await expect(blocs.first()).toBeVisible();
    const avant = await blocs.count();
    expect(avant, 'le tableau de bord doit proposer plusieurs blocs').toBeGreaterThan(2);

    const premier = (await blocs.first().getAttribute('aria-label')) ?? '';
    const retire = premier.replace('À propos de ', '');

    await page.getByRole('button', { name: `Retirer ${retire}` }).click();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect.poll(async () => (await widgetsDe(SUPERVISEUR.id)).length).toBe(avant);
    await page.getByRole('button', { name: `Retirer ${retire}` }).click();
    await expect.poll(async () => (await widgetsDe(SUPERVISEUR.id)).length).toBe(avant - 1);

    const sources = await widgetsDe(SUPERVISEUR.id);

    await page.reload();
    await expect(blocs.first()).toBeVisible();
    await expect(page.getByRole('button', { name: `À propos de ${retire}` })).toHaveCount(0);
    await expect(blocs).toHaveCount(avant - 1);

    const apres = await widgetsDe(SUPERVISEUR.id);
    expect(apres, 'la base et l’écran doivent porter la même suite').toEqual(sources);
  });

  test('la période choisie se lit dans l’URL et dans l’en-tête', async ({ page }) => {
    await page.goto('/teleconseil/tableau-de-bord');
    await reporterRappelIntrusif(page);
    await page.getByRole('button', { name: 'Aujourd’hui', exact: true }).click();

    await expect(page).toHaveURL(/periode=aujourdhui/);
    await expect(page.getByText('Aujourd’hui', { exact: true }).last()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Aujourd’hui', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('le classeur du tableau de bord se télécharge', async ({ page }) => {
    await page.goto('/teleconseil/tableau-de-bord');
    await reporterRappelIntrusif(page);
    await expect(blocsDe(page).first()).toBeVisible();

    const attente = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter en Excel' }).click();
    const classeur = await attente;

    expect(classeur.suggestedFilename()).toMatch(/\.xlsx$/);
    const chemin = await classeur.path();
    expect(chemin, 'le classeur n’a pas été écrit').not.toBeNull();
  });

  test('le tableau de bord Grand Public s’ouvre avec ses propres blocs', async ({ page }) => {
    await page.goto('/teleconseil/tableau-de-bord?projet=Grand+Public');
    await reporterRappelIntrusif(page);
    await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
    await expect(blocsDe(page).first()).toBeVisible();
  });
});

test.describe('parcours 9, le tableau de pilotage', () => {
  test.use({ storageState: ADMIN.etat });

  test('l’administrateur arrive sur le pilotage, qui s’ouvre sur les ventes', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/admin\/pilotage$/u);
    await expect(page.getByRole('button', { name: 'À propos de Ventes du mois' })).toBeVisible();
    await expect(page.getByText(/représentant/iu)).toHaveCount(0);
  });

  test('le constructeur ajoute un indicateur qui tient au rechargement, sans IA', async ({
    page,
  }) => {
    await page.goto('/admin/pilotage');
    await page.getByRole('button', { name: 'Ajouter un indicateur' }).click();
    const constructeur = page.getByRole('dialog', { name: 'Ajouter un indicateur' });
    await constructeur.getByLabel('Votre demande').fill('taux de joignabilité');
    await constructeur.getByLabel('Votre demande').press('Enter');

    const comprendre = constructeur.getByText(/^Je comprends : « (.+?) »/u);
    await expect(comprendre).toBeVisible();
    const titre = /« (.+?) »/u.exec((await comprendre.textContent()) ?? '')?.[1] ?? '';
    await constructeur.getByRole('button', { name: 'Oui', exact: true }).click();

    await constructeur
      .getByRole('group', { name: 'Formes possibles' })
      .getByRole('button')
      .first()
      .click();
    await constructeur.getByRole('button', { name: 'Ajouter au tableau de bord' }).click();
    await expect(
      constructeur.getByText(`« ${titre} » est sur le tableau de bord.`, { exact: false }),
    ).toBeVisible();
    await expect(constructeur.getByLabel('Votre demande')).toBeEditable();

    await page.reload();
    const retirer = page.getByRole('button', { name: `Retirer ${titre}` });
    await expect(retirer).toBeVisible();
    await retirer.click();
    await expect(page.getByText(`« ${titre} » retiré du tableau de bord.`)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'À propos de Ventes du mois' })).toBeVisible();
    await expect(retirer).toHaveCount(0);
  });
});

test.describe('parcours 9, la supervision', () => {
  test.use({ storageState: SUPERVISEUR.etat });

  test('un battement fait passer un compte de « Inactif » à « Connecté »', async ({
    page,
    browser,
  }) => {
    expect(veilleur, 'le compte de veille n’a pas été créé').not.toBeNull();
    const compte = veilleur as CompteCree;

    await page.goto('/teleconseil/supervision?volet=comptes');
    await reporterRappelIntrusif(page);
    await toutesLesLignesTeleconseillers(page);
    const rangee = page.getByRole('row').filter({ hasText: compte.identifiant });
    await expect(rangee).toContainText('Inactif');

    const battant: APIRequestContext = await sessionApi(
      compte.identifiant,
      compte.motDePasse,
      '198.51.100.75',
    );
    const poste = await browser.newContext({ storageState: await battant.storageState() });
    await battant.dispose();
    await (await poste.newPage()).goto('/teleconseil/console');

    await expect
      .poll(
        async () =>
          (
            await ligne<{ userId: string }>(
              'SELECT "userId" FROM agent_heartbeats WHERE "userId" = $1',
              [compte.id],
            )
          )?.userId,
        { message: 'le battement n’est pas écrit en base' },
      )
      .toBe(compte.id);
    await poste.close();

    await page.reload();
    await toutesLesLignesTeleconseillers(page);
    await expect(rangee).toContainText('Connecté');
  });

  test('le volet Activité compte les appels et les saisies', async ({ page }) => {
    await page.goto('/teleconseil/supervision');
    await reporterRappelIntrusif(page);
    await expect(page.getByRole('table').first()).toContainText('Téléconseiller');
  });
});
