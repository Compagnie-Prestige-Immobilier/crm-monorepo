import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { apiDe, creerCompte, ligne, purger, suffixe, type CompteCree } from './donnees-listes';

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
    await constructeur.getByRole('button', { name: 'Oui, c’est ça' }).click();

    await constructeur
      .getByRole('group', { name: 'Formes possibles' })
      .getByRole('button')
      .first()
      .click();
    await expect(constructeur.getByText('C’est celui-ci ?')).toBeVisible();
    await constructeur.getByRole('button', { name: 'Oui, l’ajouter' }).click();
    await expect(
      constructeur.getByText(`« ${titre} » est sur le tableau de bord.`, { exact: false }),
    ).toBeVisible();
    await expect(
      constructeur.getByRole('list', { name: 'Ajoutés pendant cette session' }),
    ).toContainText(titre);
    await constructeur.getByRole('button', { name: 'Un autre indicateur' }).click();
    await expect(constructeur.getByLabel('Votre demande')).toBeFocused();

    await constructeur.getByLabel('Votre demande').fill('ventes par site');
    await constructeur.getByLabel('Votre demande').press('Enter');
    await constructeur.getByRole('button', { name: 'Oui, c’est ça' }).click();
    const formes = constructeur.getByRole('group', { name: 'Formes possibles' });
    await expect(formes.getByRole('button').first()).toBeVisible();
    await expect(constructeur.getByText('Rien sur la période')).toHaveCount(0);
    const question = constructeur.getByText(/^Comment afficher « (.+?) » \?/u);
    const ventes = /« (.+?) »/u.exec((await question.textContent()) ?? '')?.[1] ?? '';
    await formes.getByRole('button').first().click();
    await expect(constructeur.getByText('C’est celui-ci ?')).toBeVisible();
    await expect(constructeur.getByText('Rien sur la période')).toHaveCount(0);
    await constructeur.getByRole('button', { name: 'Oui, l’ajouter' }).click();
    await expect(constructeur.getByText(`« ${ventes} » est sur le tableau de bord.`)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.reload();
    const marques = async () => {
      const reponse = await page.request.get('/api/v1/tableaux-de-bord/pilotage/disposition');
      const { widgets } = (await reponse.json()) as { widgets: { marque?: string }[] };
      return widgets.map((widget) => widget.marque ?? '');
    };
    const avant = await marques();
    await page.getByRole('button', { name: `Modifier ${ventes}` }).click();
    const edition = page.getByRole('dialog', { name: 'Modifier un indicateur' });
    await edition
      .getByRole('group', { name: 'Formes possibles' })
      .getByRole('button')
      .nth(1)
      .click();
    await edition.getByRole('button', { name: 'Oui, l’ajouter' }).click();
    await expect(
      page.getByRole('dialog').getByText(`« ${ventes} » est sur le tableau de bord.`),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(marques).not.toEqual(avant);
    expect(await marques()).toHaveLength(avant.length);
    await page.getByRole('button', { name: `Retirer ${ventes}` }).click();

    const retirer = page.getByRole('button', { name: `Retirer ${titre}` });
    await expect(retirer).toBeVisible();
    await retirer.click();
    await expect(page.getByText(`« ${titre} » retiré du tableau de bord.`)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'À propos de Ventes du mois' })).toBeVisible();
    await expect(retirer).toHaveCount(0);
  });
});
