import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, lire, marque } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const NOM = `essai-${marque()}`;
const BASE_SQL = `cpi_demo_${NOM.replaceAll('-', '_')}`;
const EXISTE = `SELECT datname FROM pg_database WHERE datname = $1`;

interface BaseLue {
  datname: string;
}

// Le parcours détruit une base Postgres : le nettoyage vise le nom tiré, jamais
// un préfixe, pour qu'un test interrompu n'emporte pas la base d'un autre.
test.afterAll(async () => {
  await ecrire(`DELETE FROM bases_demonstration WHERE nom = $1`, [NOM]);
});

test.describe('Bases de démonstration', () => {
  test.use({ storageState: administrateur.etat });

  test('une base se crée, se sert, et sa suppression la détruit vraiment', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await page.goto('/admin/bases');
    await expect(page.getByRole('heading', { name: 'Bases de démonstration' })).toBeVisible();

    await page.getByLabel('Nom').fill(NOM);
    await page.getByRole('button', { name: 'Créer la base' }).click();
    await expect(page.getByText(/Base créée/u)).toBeVisible({ timeout: 150_000 });
    await expect(page.getByText(NOM, { exact: true })).toBeVisible();

    expect(await lire<BaseLue>(EXISTE, [BASE_SQL])).toHaveLength(1);

    // La raison d'être de tout ceci : la base est proposée à la connexion.
    const bases = await (await request.get('/api/v1/auth/bases')).json();
    expect(bases.bases).toContain(NOM);

    const ligne = page.getByRole('listitem').filter({ hasText: NOM });
    await ligne.getByRole('button', { name: 'Supprimer' }).click();
    // La confirmation n'est pas décorative : la base part sans retour possible.
    await expect(page.getByText(/sans retour possible/u)).toBeVisible();
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await expect(page.getByText('Base supprimée.')).toBeVisible({ timeout: 60_000 });

    expect(await lire<BaseLue>(EXISTE, [BASE_SQL])).toHaveLength(0);
  });
});
