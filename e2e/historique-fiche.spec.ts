import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { effacerFiches, marque, semerProspect, type FicheSemee } from './donnees-chues';

const compte = compteDe('COMMERCIAL');

const telephones: string[] = [];

async function semer(): Promise<FicheSemee> {
  const suffixe = marque();
  let fiche: FicheSemee | null = null;
  await avecBase(async (client) => {
    fiche = await semerProspect(client, `Fall ${suffixe}`, `Historique ${suffixe}`, compte.id);
  });
  if (fiche === null) throw new Error('prospect non seme');
  telephones.push((fiche as FicheSemee).phoneE164);
  return fiche;
}

/** Le lien direct evite l'annuaire : la fiche appelee en sort. */
async function ouvrirFiche(page: Page, fiche: FicheSemee): Promise<void> {
  await page.goto(`/teleconseil/console?fiche=${fiche.id}`);
  await expect(
    page.getByRole('group', { name: 'Avez-vous eu la personne au téléphone ?' }),
  ).toBeVisible();
}

test.use({ storageState: compte.etat });

test.afterAll(async () => {
  await effacerFiches(telephones);
});

test.describe('parcours, historique de la fiche prospect', () => {
  test('le repli garde l’ecran, une fois deplie il rend le dernier appel', async ({ page }) => {
    const fiche = await semer();
    const commentaire = `Sonne dans le vide ${marque()}`;

    await ouvrirFiche(page, fiche);
    await page
      .getByRole('group', { name: 'Avez-vous eu la personne au téléphone ?' })
      .getByRole('button', { name: /Non, elle n’a pas répondu/u })
      .click();
    await page.getByRole('button', { name: /NRP/u }).click();
    await page.getByLabel(/^Commentaire/u).fill(commentaire);
    await page.getByRole('button', { name: 'Enregistrer l’appel' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Appel consigné pour ${fiche.nom}` }),
    ).toBeVisible();

    const lectures: string[] = [];
    page.on('request', (requete) => {
      if (requete.url().includes(`${fiche.id}/segment-history`)) lectures.push(requete.url());
    });

    await ouvrirFiche(page, fiche);
    const historique = page.getByRole('list', { name: 'Histoire' });
    await expect(historique).toBeHidden();
    expect(lectures, 'le repli ne lit rien').toHaveLength(0);

    await page.locator('summary').filter({ hasText: 'Historique de la fiche' }).click();
    await expect(historique.getByText('NRP')).toBeVisible();
    await expect(historique.getByText(commentaire)).toBeVisible();
    await expect(historique.getByText(compte.nom).first()).toBeVisible();
    expect(lectures.length, 'deplie, il lit les changements de statut').toBeGreaterThan(0);
  });
});
