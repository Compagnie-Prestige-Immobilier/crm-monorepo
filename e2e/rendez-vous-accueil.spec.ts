import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { apiDe } from './donnees-listes';

/** Ce qu'un ADMIN coche dans « Utilisateurs et rôles » pour ouvrir l'écran au comptoir. */
const OUVERTURE = ['rendez_vous.suivre', 'prospects.lire'];

async function permissionsDuRoleAccueil(): Promise<string[]> {
  const api = await apiDe('ADMIN', '198.51.100.91');
  const corps = await (await api.get('/api/v1/roles')).json();
  const role = corps.roles.find((item: { id: string }) => item.id === 'ACCUEIL');
  await api.dispose();
  return role.permissions;
}

async function poserPermissions(permissions: string[]): Promise<void> {
  const api = await apiDe('ADMIN', '198.51.100.91');
  const reponse = await api.put('/api/v1/roles/ACCUEIL/permissions', { data: { permissions } });
  expect(reponse.status(), 'permissions du rôle Accueil').toBe(200);
  await api.dispose();
}

// Le drapeau `BETA_SUIVI_RENDEZ_VOUS` est posé par le serveur d'essai ; sans lui
// la permission n'existe pour personne, et l'écran avec elle.
test.describe('rendez-vous au comptoir', () => {
  test.use({ storageState: compteDe('ACCUEIL').etat });

  let permissionsAvant: string[] = [];

  test.beforeAll(async () => {
    permissionsAvant = await permissionsDuRoleAccueil();
    await poserPermissions([...new Set([...permissionsAvant, ...OUVERTURE])]);
  });

  test.afterAll(async () => {
    await poserPermissions(permissionsAvant);
  });

  test('l’onglet trie les rendez-vous par type, et se referme avec la permission', async ({
    page,
  }) => {
    await page.goto('/accueil');
    const onglet = page.getByRole('link', { name: 'Rendez-vous' });
    await expect(onglet).toBeVisible();

    await onglet.click();
    await expect(page).toHaveURL(/phase2Status=APPOINTMENT/);
    // Un rendez-vous téléphonique n'amène personne au comptoir : l'écran l'écarte.
    await expect(page).toHaveURL(/sansMotif=RDV_TELEPHONIQUE/);

    await page.getByRole('tab', { name: 'RV site', exact: true }).click();
    await expect(page).toHaveURL(/motif=RV_SITE/);
    await page.getByRole('tab', { name: 'Tous', exact: true }).click();
    await expect(page).not.toHaveURL(/motif=RV_SITE/);

    await poserPermissions(permissionsAvant.filter((p) => !OUVERTURE.includes(p)));
    await page.reload();
    await expect(page.getByRole('tab', { name: 'RV CPI', exact: true })).toHaveCount(0);
    await expect(onglet).toHaveCount(0);
  });
});
