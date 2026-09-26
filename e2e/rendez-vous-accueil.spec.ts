import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, lire } from './donnees-admin';
import { apiDe, creerProspect, purger, suffixe } from './donnees-listes';

/** Ce qu'un ADMIN coche dans « Utilisateurs et rôles » pour ouvrir l'écran au comptoir. */
const OUVERTURE = ['rendez_vous.voir', 'rendez_vous.suivre', 'rendez_vous.exporter'];

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
    await ecrire('DELETE FROM "visites" WHERE "visitorName" = $1', [`Awa ${nom}`]);
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
    // Le comptoir ouvre sur la journée : le rendez-vous de demain n'y est pas.
    await expect(page.getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await expect(ligne).toHaveCount(0);
    await page.getByRole('button', { name: 'Toutes les dates' }).click();
    await expect(ligne).toHaveCount(1);
    await expect(ligne.getByRole('link', { name: /^\+221 77 / })).toBeVisible();

    // Les types trient la file : un RV CPI ne s'affiche pas sous RV site.
    await page.getByRole('tab', { name: 'RV site', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: nom })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Tous', exact: true }).click();
    await expect(ligne).toHaveCount(1);

    // La venue se confirme depuis la liste : ouvrir chaque fiche ferait perdre la file.
    await ligne.getByRole('button', { name: /^Confirmer la venue/ }).click();
    await expect(ligne.getByText('Venu', { exact: true }).first()).toBeVisible();

    // Venu, il passe au registre sans ressaisir son nom ni son numéro.
    await ligne.getByRole('button', { name: 'Enregistrer la visite' }).click();
    const fenetre = page.getByRole('dialog', { name: 'Enregistrer une visite' });
    await expect(fenetre.getByLabel('PRENOM ET NOMS')).toHaveValue(`Awa ${nom}`);
    await expect(fenetre.getByLabel('TELEPHONES')).toHaveValue(/^\+221 77 /);
    const [choix = { entreprise: '', objet: '' }] = await lire<{
      entreprise: string;
      objet: string;
    }>(
      `SELECT (SELECT "label" FROM "visite_entreprises" WHERE "isActive" ORDER BY "sortOrder" LIMIT 1) AS entreprise,
              (SELECT "label" FROM "visite_objets" WHERE "isActive" ORDER BY "sortOrder" LIMIT 1) AS objet`,
    );
    await fenetre.getByRole('combobox', { name: /ENTREPRISE/u }).click();
    await page.getByRole('option', { name: choix.entreprise, exact: true }).click();
    await fenetre.getByRole('combobox', { name: /OBJET VISITE/u }).click();
    await page.getByRole('option', { name: choix.objet, exact: true }).click();
    await fenetre.getByRole('button', { name: 'Enregistrer la visite' }).click();
    await expect(fenetre).toHaveCount(0);
    const visites = await lire<{ phoneE164: string }>(
      'SELECT "phoneE164" FROM "visites" WHERE "visitorName" = $1',
      [`Awa ${nom}`],
    );
    expect(visites, 'visite enregistrée au registre').toHaveLength(1);

    // Le filtre des venues sépare ce qui est confirmé de ce qui attend.
    await page.getByRole('combobox', { name: 'Venue' }).click();
    await page.getByRole('option', { name: 'Pas venus', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: nom })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Venue' }).click();
    await page.getByRole('option', { name: 'Venus', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: nom })).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Venue' }).click();
    await page.getByRole('option', { name: 'Toutes les venues', exact: true }).click();

    // Le classeur emporte les filtres posés.
    const lien = page.getByRole('link', { name: 'Exporter' });
    await expect(lien).toHaveAttribute('href', /export\/rendez-vous\.xlsx/u);

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
