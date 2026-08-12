import { expect, test as setup } from '@playwright/test';

/**
 * Se connecte UNE fois et range les cookies de session sur disque.
 *
 * Ce n'est pas seulement une optimisation. L'API applique deux limiteurs de
 * débit — 10 connexions par minute et par IP, 300 requêtes par minute — et le
 * panel émet une dizaine d'appels par écran. Une suite qui se reconnecte à
 * chaque test épuise le quota, l'API répond 429, et les tests échouent pour une
 * raison qui n'a rien à voir avec ce qu'ils vérifient.
 *
 * Le parcours de connexion lui-même reste testé en propre dans
 * `prospects.spec.ts` : c'est sa RÉPÉTITION qu'on supprime, pas sa couverture.
 */

const IDENTIFIER = process.env.E2E_ADMIN_IDENTIFIER ?? 'admin@cpi.sn';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMoiEnProd2026';

export const STORAGE_STATE = 'e2e/.auth/admin.json';

setup('authentifier l’administrateur', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill(IDENTIFIER);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await page.waitForURL('**/tableau-de-bord');
  // On attend un élément RENDU PAR LE SERVEUR avec la session : si le layout
  // avait renvoyé vers /connexion, l'état sauvegardé serait inutilisable et
  // tous les tests suivants échoueraient sans raison lisible.
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
