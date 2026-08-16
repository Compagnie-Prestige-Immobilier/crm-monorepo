import { expect, test as setup } from '@playwright/test';

/**
 * Se connecte UNE fois et range les cookies de session sur disque.
 *
 * Ce n'est pas seulement une optimisation. L'API applique deux limiteurs de
 * débit : 10 connexions par minute et par IP, 300 requêtes par minute, et le
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

  /**
   * La suite part TOUJOURS mode démonstration ÉTEINT.
   *
   * Le mode démonstration met la plateforme en lecture seule et suffixe le nom
   * des classeurs exportés par « DEMONSTRATION ». Laissé allumé par une
   * exécution précédente — interrompue, ou dont le parcours de désactivation
   * n'a pas été atteint — il fait échouer tout ce qui écrit, et les échecs
   * tombent sur des écrans qui n'y sont pour rien. Une suite ne doit pas
   * dépendre de la façon dont la précédente s'est terminée.
   *
   * `purge` et non `disable` : la désactivation masque les lignes, la purge les
   * retire. Sans effet si le mode est déjà éteint.
   *
   * Ici et pas dans `global-setup.ts` : la purge demande une session
   * administrateur, et c'est ce parcours qui vient de la poser. La faire en
   * amont obligerait à dépenser une connexion de plus sur un point d'entrée
   * limité à dix par minute.
   */
  const purge = await page.request.post('/api/v1/admin/demo/purge', { timeout: 150_000 });
  expect(
    purge.ok(),
    `La purge du mode démonstration a répondu ${String(purge.status())} : la suite ne ` +
      'peut pas partir d’un état connu.',
  ).toBe(true);
});
