import { expect, test } from '@playwright/test';

import { BASE_URL, compteDe, MOT_DE_PASSE } from './comptes';
import { ecrire, lire, marque, sessionDe } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const cle = marque();
const ROLE = `Chef d’équipe ${cle}`;
const COMPTE = {
  nom: `Chef ${cle}`,
  identifiant: `chef.${cle}`,
  email: `chef.${cle}@cpi.sn`,
  motDePasse: MOT_DE_PASSE,
};

test.afterAll(async () => {
  await ecrire(`DELETE FROM "users" WHERE "email" = $1`, [COMPTE.email]);
  await ecrire(`DELETE FROM "roles" WHERE "libelle" = $1`, [ROLE]);
});

test.describe('parcours utilisateurs et rôles', () => {
  test.use({ storageState: administrateur.etat });

  test('un rôle personnalisé retire une permission à son compte, la donnée suit sa base', async ({
    page,
    browser,
  }) => {
    await page.goto('/admin/commerciaux');
    await page.getByRole('tab', { name: 'Rôles' }).click();
    await page.getByRole('button', { name: 'Nouveau rôle' }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByLabel('Nom du rôle').fill(ROLE);
    await dialogue.getByRole('button', { name: 'Créer le rôle' }).click();
    await expect(page.getByText(`Rôle ${ROLE} créé.`)).toBeVisible();

    const gerer = page.getByRole('checkbox', {
      name: `Créer et modifier les campagnes pour ${ROLE}`,
    });
    await expect(gerer).toBeChecked();
    await gerer.uncheck();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText(`Permissions de ${ROLE} enregistrées.`)).toBeVisible();

    const [role] = await lire<{ id: string }>(`SELECT "id" FROM "roles" WHERE "libelle" = $1`, [
      ROLE,
    ]);
    expect(role).toBeDefined();
    await page.getByRole('button', { name: `Actions pour ${ROLE}` }).click();
    await page.getByRole('menuitem', { name: 'Supprimer le rôle' }).click();
    await page.getByRole('button', { name: 'Supprimer le rôle' }).click();
    await expect(page.getByText(`Rôle ${ROLE} supprimé.`)).toBeVisible();

    // Recréé tel quel pour y passer un compte : le rôle utilisé ne se supprime plus.
    await page.getByRole('button', { name: 'Nouveau rôle' }).click();
    await page.getByRole('dialog').getByLabel('Nom du rôle').fill(ROLE);
    await page.getByRole('dialog').getByRole('button', { name: 'Créer le rôle' }).click();
    await page
      .getByRole('checkbox', { name: `Créer et modifier les campagnes pour ${ROLE}` })
      .uncheck();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText(`Permissions de ${ROLE} enregistrées.`)).toBeVisible();

    await page.getByRole('tab', { name: 'Utilisateurs' }).click();
    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    const formulaire = page.getByRole('dialog');
    await formulaire.getByLabel('Nom complet').fill(COMPTE.nom);
    await formulaire.getByLabel('Adresse e-mail').fill(COMPTE.email);
    await formulaire.getByLabel('Identifiant').fill(COMPTE.identifiant);
    await formulaire.getByLabel('Rôle').click();
    await page.getByRole('option', { name: ROLE }).click();
    await formulaire.getByLabel('Mot de passe').fill(COMPTE.motDePasse);
    await formulaire.getByRole('button', { name: 'Créer le compte' }).click();
    await expect(page.getByText(`Compte de ${COMPTE.nom} créé.`)).toBeVisible();

    await page.getByPlaceholder('Nom, e-mail, identifiant…').fill(COMPTE.nom);
    const ligne = page.getByRole('row').filter({ hasText: COMPTE.nom });
    await expect(ligne.getByText(ROLE)).toBeVisible();
    await expect(ligne.getByText('base : Supervision')).toBeVisible();

    await page.getByRole('tab', { name: 'Rôles' }).click();
    await page.getByRole('button', { name: new RegExp(ROLE) }).click();
    await page.getByRole('button', { name: `Actions pour ${ROLE}` }).click();
    await expect(
      page.getByRole('menuitem', { name: /Retirez d’abord les 1 comptes/ }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');

    const { contexte, vue } = await sessionDe(browser, '198.51.99.21', COMPTE);
    try {
      const refus = await vue.request.post(`${BASE_URL}/api/v1/lots-export`, {
        headers: { Origin: BASE_URL },
        data: {},
      });
      expect(refus.status()).toBe(403);
      const lecture = await vue.request.get(`${BASE_URL}/api/v1/lots-export`);
      expect(lecture.status()).toBe(200);
      const [compte] = await lire<{ role: string }>(
        `SELECT "role"::text AS role FROM "users" WHERE "email" = $1`,
        [COMPTE.email],
      );
      expect(compte?.role).toBe('SUPERVISEUR');
    } finally {
      await contexte.close();
    }
  });
});

const BARRES = [
  {
    role: 'ADMIN',
    arrivee: /\/admin\/pilotage$/u,
    groupes: ['Au quotidien', 'Réglages'],
    liens: [
      'Tableau de pilotage',
      'Comptes et rôles',
      'Importer un classeur',
      'Journal des actions',
      'Envois et tâches',
      'Listes de référence',
      'Courriels et messages',
      'Notifications',
      'Champs de la conversion',
      'Plateformes d’enrôlement',
    ],
    espaces: true,
  },
  {
    role: 'DIRECTION',
    arrivee: /\/teleconseil\/tableau-de-bord$/u,
    groupes: ['Piloter', 'Appeler'],
    liens: [
      'Tableau de pilotage',
      'Tableau de bord',
      'Campagnes d’appels',
      'Intéressés, hésitants et RDV',
      'Ventes',
      'Banque & Finance',
      'Fiche représentant',
      'Fiche prospect',
      'Rappels promis',
    ],
    espaces: true,
  },
  {
    role: 'SUPERVISEUR',
    arrivee: /\/teleconseil\/tableau-de-bord$/u,
    groupes: ['Piloter', 'Appeler'],
    liens: [
      'Tableau de bord',
      'Campagnes d’appels',
      'Intéressés, hésitants et RDV',
      'Fiche représentant',
      'Fiche prospect',
      'Rappels promis',
    ],
    espaces: true,
  },
  {
    role: 'COMMERCIAL',
    arrivee: /\/teleconseil$/u,
    groupes: [],
    liens: ['Mon travail', 'Fiche représentant', 'Fiche prospect', 'Rappels promis'],
    espaces: false,
  },
] as const;

for (const barre of BARRES) {
  test.describe(`parcours navigation, la barre de ${barre.role}`, () => {
    test.use({ storageState: compteDe(barre.role).etat });

    test('arrivée, groupes, un seul « Plus » et accès aux espaces', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(barre.arrivee);

      const menu = page.getByRole('navigation', { name: 'Navigation principale' });
      await expect(menu.getByRole('link')).toHaveText([...barre.liens]);
      await expect(menu.getByRole('heading', { level: 2 })).toHaveText([...barre.groupes]);
      await expect(menu.getByText('Plus', { exact: true })).toHaveCount(1);

      const espaces = page.getByRole('link', { name: 'Espaces', exact: true });
      await expect(espaces).toHaveCount(barre.espaces ? 1 : 0);
      if (barre.espaces) return;
      await page.goto('/espaces');
      await expect(page).toHaveURL(barre.arrivee);
    });
  });
}
