import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { apiDe, creerProspect, purger, suffixe } from './donnees-listes';

/** Ce qu'un ADMIN coche dans « Utilisateurs et rôles » pour ouvrir l'écran au comptoir. */
const OUVERTURE = ['rendez_vous.voir', 'rendez_vous.suivre'];

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
  let convoque = '';
  const nom = `Convoque ${suffixe()}`;

  test.beforeAll(async () => {
    permissionsAvant = await permissionsDuRoleAccueil();
    await poserPermissions([...new Set([...permissionsAvant, ...OUVERTURE])]);

    // Un téléconseiller pose le rendez-vous, comme dans la console.
    const api = await apiDe('COMMERCIAL', '198.51.100.92');
    convoque = await creerProspect(api, {
      nom,
      prenom: 'Awa',
      phone: `+22177${String(4_100_000 + Math.floor(Math.random() * 800_000))}`,
      projet: 'GRAND_PUBLIC',
    });
    const demain = new Date(Date.now() + 86_400_000).toISOString();
    const appel = await api.post('/api/v1/phase2/call-attempts', {
      data: {
        id: randomUUID(),
        prospectId: convoque,
        reasonCode: 'RV_CPI',
        callbackAt: demain,
        clientCreatedAt: new Date().toISOString(),
      },
    });
    expect(appel.status(), 'rendez-vous consigné').toBe(200);
    await api.dispose();
  });

  test.afterAll(async () => {
    await poserPermissions(permissionsAvant);
    await purger({ prospects: [convoque] });
  });

  test('l’onglet trie les rendez-vous par type, et se referme avec la permission', async ({
    page,
  }) => {
    await page.goto('/accueil');
    const onglet = page.getByRole('link', { name: 'Rendez-vous' });
    await expect(onglet).toBeVisible();

    await onglet.click();
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await expect(ligne).toHaveCount(1);

    // Les types trient la file : un RV CPI ne s'affiche pas sous RV site.
    await page.getByRole('tab', { name: 'RV site', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: nom })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Tous', exact: true }).click();
    await expect(ligne).toHaveCount(1);

    // La venue se confirme depuis la liste : ouvrir chaque fiche ferait perdre la file.
    await ligne.getByRole('button', { name: /^Confirmer la venue/ }).click();
    await expect(ligne.getByText('Venu', { exact: true }).first()).toBeVisible();

    // La recherche porte sur le nom comme sur le numéro.
    const recherche = page.getByLabel('Rechercher un rendez-vous');
    await recherche.fill(nom);
    await expect(page.getByRole('row').filter({ hasText: nom })).toHaveCount(1);
    await recherche.fill('Personne qui n’existe pas');
    await expect(page.getByText('Aucun rendez-vous ici', { exact: false })).toBeVisible();
    await recherche.fill('');

    await poserPermissions(permissionsAvant.filter((p) => !OUVERTURE.includes(p)));
    await page.reload();
    await expect(page.getByRole('tab', { name: 'RV CPI', exact: true })).toHaveCount(0);
    await expect(onglet).toHaveCount(0);
  });
});
