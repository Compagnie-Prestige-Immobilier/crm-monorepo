import { expect, test } from '@playwright/test';
import { compteDe } from './comptes';

test.describe('assistant Kairos, pile PostgreSQL', () => {
  test.skip(
    process.env.KAIROS_E2E_PARITE !== '1',
    'Nécessite le serveur Kairos de parcours avec PostgreSQL.',
  );
  test.use({ storageState: compteDe('ADMIN').etat });
  test('réponse progressive, historique personnel, options et tâches', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.goto('/teleconseil/tableau-de-bord');
    await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
    const fenetre = page.getByRole('dialog', { name: 'Assistant' });
    await fenetre.getByRole('button', { name: "Combien d'appels hier ?" }).click();
    await expect(fenetre.getByRole('button', { name: 'Exporter', exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(fenetre.getByRole('button', { name: 'Nouvelle', exact: true })).toBeEnabled();
    await fenetre.getByRole('button', { name: 'Nouvelle', exact: true }).click();
    await expect(fenetre.getByRole('button', { name: 'Exporter', exact: true })).toHaveCount(0);
    await fenetre.getByRole('button', { name: 'Historique', exact: true }).click();
    await fenetre
      .getByRole('region', { name: 'Historique des conversations' })
      .getByRole('button', { name: "Combien d'appels hier ?", exact: true })
      .first()
      .click();
    await expect(fenetre.getByRole('button', { name: 'Exporter', exact: true })).toBeVisible();
    await fenetre.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(fenetre.getByText('Désactivé dans le CRM')).toBeVisible();
    await expect(fenetre.getByRole('button', { name: 'Transférer au support' })).toBeVisible();
    await fenetre.getByRole('button', { name: 'Règles et tâches' }).click();
    await fenetre.getByRole('textbox', { name: 'Nom', exact: true }).fill('Résumé de parcours');
    await fenetre
      .getByRole('textbox', { name: 'Texte à résumer' })
      .fill('Préparer le suivi des appels de la journée.');
    await fenetre.getByRole('button', { name: 'Créer la tâche' }).click();
    await expect(fenetre.getByText('Résumé de parcours', { exact: true })).toBeVisible();
    await fenetre.getByRole('button', { name: 'Exécutions', exact: true }).click();
    await expect(fenetre.getByText('Aucune exécution.')).toBeVisible();
    await fenetre.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await fenetre.getByRole('button', { name: 'Confirmer la suppression' }).click();
    await expect(fenetre.getByText('Résumé de parcours', { exact: true })).toHaveCount(0);
    await fenetre.getByRole('button', { name: 'Fermer les options' }).click();
    await fenetre.getByRole('button', { name: 'Options', exact: true }).click();
    await fenetre.getByRole('button', { name: 'Transférer au support' }).click();
    await expect(fenetre.getByRole('button', { name: 'Envoyer au support' })).toBeDisabled();
    await fenetre.getByRole('checkbox').check();
    await fenetre.getByRole('button', { name: 'Envoyer au support' }).click();
    await expect(fenetre.getByText('Ticket n° 81 créé.', { exact: false })).toBeVisible();
    await fenetre.getByRole('button', { name: 'Fermer les options' }).click();
    await fenetre.getByRole('button', { name: 'Historique', exact: true }).click();
    await fenetre
      .getByRole('button', { name: /Supprimer Combien d'appels hier/ })
      .first()
      .click();
    await fenetre
      .getByRole('button', { name: /Supprimer Combien d'appels hier/ })
      .first()
      .click();
    await expect(fenetre.getByRole('button', { name: 'Exporter', exact: true })).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test('une réponse survit au rechargement puis Stop annule le même tour', async ({ page }) => {
    const question = "Combien d'appels hier ? réponse lente";
    await page.goto('/teleconseil/tableau-de-bord');
    await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
    const fenetre = page.getByRole('dialog', { name: 'Assistant' });
    const depart = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/kairos/conversation'),
    );
    await fenetre.getByRole('textbox', { name: 'Votre question' }).fill(question);
    await fenetre.getByRole('button', { name: 'Envoyer', exact: true }).click();
    const demande = await depart;
    await expect(fenetre.getByRole('button', { name: 'Exporter', exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
    await fenetre.getByRole('button', { name: 'Historique', exact: true }).click();
    await fenetre
      .getByRole('region', { name: 'Historique des conversations' })
      .getByRole('button', { name: question, exact: true })
      .first()
      .click();
    await expect(fenetre.getByRole('button', { name: 'Exporter', exact: true })).toBeVisible();
    const reprise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/kairos/conversation'),
    );
    await fenetre.getByRole('button', { name: 'Reprendre la réponse' }).click();
    expect((await reprise).headers()['x-kairos-request-id']).toBe(
      demande.headers()['x-kairos-request-id'],
    );
    const annulation = page.waitForResponse((r) => r.url().endsWith('/conversation/annuler'));
    await fenetre.getByRole('button', { name: 'Arrêter la réponse' }).click();
    const reponse = await annulation;
    expect(reponse.status()).toBe(200);
    expect(reponse.request().postDataJSON().requestId).toBe(
      demande.headers()['x-kairos-request-id'],
    );
    await expect(fenetre.getByRole('button', { name: 'Nouvelle', exact: true })).toBeEnabled();
    await fenetre.getByRole('button', { name: 'Nouvelle', exact: true }).click();
    await expect(fenetre.getByRole('textbox', { name: 'Votre question' })).toBeEnabled();
  });
});
