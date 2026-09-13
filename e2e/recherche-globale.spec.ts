import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, marque } from './donnees-admin';

const teleconseiller = compteDe('COMMERCIAL');
const accueil = compteDe('ACCUEIL');
const cle = marque();
const NOM = `Cherchable${cle}`;

// La fiche appartient au téléconseiller qui la cherche : la liste est cloisonnée
// par propriétaire, une fiche d'autrui ne lui reviendrait pas.
test.beforeAll(async () => {
  await ecrire(
    `INSERT INTO prospects (id, nom, prenom, "phoneE164", "createdById",
                            "clientCreatedAt", "updatedAt", projet)
     VALUES (gen_random_uuid()::text, $1, 'Binta', $2, $3, now(), now(), 'CHUES')`,
    [NOM, `+22177${cle.replace(/\D/gu, '0').padEnd(7, '0').slice(0, 7)}`, teleconseiller.id],
  );
});

test.afterAll(async () => {
  await ecrire(`DELETE FROM "prospects" WHERE nom = $1`, [NOM]);
});

test.describe('recherche depuis la barre du haut', () => {
  // Le champ n'apparaît qu'au-delà de 1 536 px : sous cette largeur la barre du
  // haut n'a plus la place, et le titre de l'écran passe avant.
  test.describe('téléconseiller', () => {
    test.use({ storageState: teleconseiller.etat, viewport: { width: 1600, height: 900 } });

    test('le champ emmène à la liste, le terme dans l’URL', async ({ page }) => {
      await page.goto('/chues/console');
      const champ = page.getByRole('searchbox', { name: 'Chercher un prospect' });
      await champ.fill(NOM);
      await champ.press('Enter');

      await expect(page).toHaveURL(new RegExp(`/chues/prospects\\?search=${NOM}`, 'u'));
      // Le terme n'est pas seulement dans l'URL : la liste l'a repris, donc la
      // recherche est réellement en cours et non juste annoncée.
      await expect(page.getByPlaceholder('Nom, téléphone, représentant…')).toHaveValue(NOM);
    });
  });

  test.describe('accueil', () => {
    test.use({ storageState: accueil.etat });

    test('un rôle sans prospects ne voit pas le champ', async ({ page }) => {
      await page.goto('/accueil');
      await expect(page.getByRole('searchbox', { name: 'Chercher un prospect' })).toBeHidden();
    });
  });
});
