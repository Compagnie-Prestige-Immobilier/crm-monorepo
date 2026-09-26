import { expect, test, type Page } from '@playwright/test';

import { avecBase, BASE_URL, compteDe, MOT_DE_PASSE } from './comptes';
import { effacerFiches, marque, semerProspect, type FicheSemee } from './donnees-chues';
import { apiDe, creerCompte, purger, type CompteCree } from './donnees-listes';

const compte = compteDe('ADMIN');
const BASE_DEMO = process.env.DATABASE_URL_DEMO;

async function remplir(page: Page, motDePasse: string): Promise<void> {
  await page.getByLabel('E-mail ou identifiant').fill(compte.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test.describe('parcours 1, connexion et session', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.30' } });

  test('refus, ouverture, rechargement, fermeture', async ({ page }) => {
    await page.goto('/connexion');

    await remplir(page, 'MauvaisMotDePasse');
    await expect(page.getByRole('alert')).toHaveText('Identifiants invalides.');
    await expect(page).toHaveURL(/\/connexion$/);

    await remplir(page, MOT_DE_PASSE);
    const menuCompte = page.getByRole('button', { name: `Compte de ${compte.nom}` });
    await expect(menuCompte).toBeVisible();

    await page.reload();
    await expect(menuCompte).toBeVisible();

    await menuCompte.click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/connexion(\?suite=.*)?$/);
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();

    await remplir(page, MOT_DE_PASSE);
    await expect(page.getByRole('button', { name: `Compte de ${compte.nom}` })).toBeVisible();
    await page.context().storageState({ path: compte.etat });
  });
});

test.describe('parcours 1, limiteur de connexion', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.31' } });

  test('la onzieme tentative est refusee', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(compte.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('MauvaisMotDePasse');

    // Le limiteur est un seau de jetons qui se remplit au fil de la minute : dix
    // tentatives par l'écran, machine chargée, dureraient assez pour en regagner.
    for (let tentative = 1; tentative <= 10; tentative += 1) {
      const refus = await page.request.post('/api/v1/auth/login', {
        data: { identifier: compte.email, password: 'MauvaisMotDePasse' },
        headers: { Origin: BASE_URL },
      });
      expect(refus.status(), `tentative ${String(tentative)}`).toBe(401);
    }

    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Trop de tentatives. Réessayez dans une minute.',
    );
  });
});

test.describe('parcours 1, seconde base', () => {
  test.skip(BASE_DEMO === undefined, 'DATABASE_URL_DEMO absent');
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.32' } });

  test('la base démo propose un profil sans identifiants et le signale', async ({ page }) => {
    await page.goto('/connexion');
    // Le raccourci n'est écouté qu'une fois le formulaire monté, après la lecture de la session.
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await page.keyboard.press('Control+Shift+N');
    await page.getByRole('combobox', { name: 'Base' }).click();
    await page.getByRole('option', { name: 'demo' }).click();
    await expect(page.getByLabel('E-mail ou identifiant')).toBeHidden();
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeHidden();
    await page.getByRole('combobox', { name: 'Profil démo' }).click();
    await page.getByRole('option', { name: 'Téléconseiller' }).click();
    await page.getByRole('button', { name: 'Se connecter' }).click();
    const menuCompte = page.getByRole('button', { name: 'Compte de Awa Fixture' });
    await expect(menuCompte).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('MODE DÉMO · BASE DEMO');

    await menuCompte.click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('combobox', { name: 'Base' })).toContainText('demo');
    await page.getByRole('combobox', { name: 'Base' }).click();
    await page.getByRole('option', { name: 'public' }).click();
    await expect(page.getByLabel('E-mail ou identifiant')).toBeVisible();
  });
});

test.describe('parcours 1, cache vidé au changement de compte', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.33' } });

  const compteA = compteDe('COMMERCIAL');
  const telephones: string[] = [];
  let compteB: CompteCree | null = null;

  test.beforeAll(async () => {
    const api = await apiDe('ADMIN', '198.51.100.34');
    compteB = await creerCompte(api, 'COMMERCIAL', 'MotDePasseB12E2E');
    await api.dispose();
  });

  test.afterAll(async () => {
    await effacerFiches(telephones);
    await purger({ comptes: compteB === null ? [] : [compteB.id] });
  });

  async function connecter(page: Page, identifiant: string, motDePasse: string): Promise<void> {
    await page.getByLabel('E-mail ou identifiant').fill(identifiant);
    await page.getByLabel('Mot de passe', { exact: true }).fill(motDePasse);
    await page.getByRole('button', { name: 'Se connecter' }).click();
  }

  /** Même formatage que la table des rappels : la ligne se retrouve par le numéro affiché. */
  function ligneDuRappel(page: Page, telephoneE164: string) {
    const lisible = telephoneE164.replace(
      /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/u,
      '+221 $1 $2 $3 $4',
    );
    return page.getByRole('row').filter({ hasText: lisible });
  }

  test('le rappel de A n’apparaît pas pour B connecté ensuite dans le même onglet', async ({
    page,
  }) => {
    if (compteB === null) throw new Error('compte B non créé');

    await page.goto('/connexion');
    await connecter(page, compteA.email, MOT_DE_PASSE);
    await expect(page.getByRole('button', { name: `Compte de ${compteA.nom}` })).toBeVisible();

    const suffixe = marque();
    let fiche: FicheSemee | null = null;
    await avecBase(async (client) => {
      fiche = await semerProspect(client, `Partage ${suffixe}`, `Poste ${suffixe}`, compteA.id);
    });
    if (fiche === null) throw new Error('prospect non semé');
    const ficheDeA = fiche as FicheSemee;
    telephones.push(ficheDeA.phoneE164);

    // Toute la suite navigue par des liens de la coque : un `page.goto` rechargerait
    // le panneau et viderait le cache par construction, masquant le défaut du B12.
    await page.getByRole('link', { name: 'Fiche prospect' }).click();
    await page.getByLabel('Quel prospect avez-vous appelé ?').fill(ficheDeA.nom);
    await page.getByRole('button', { name: ficheDeA.nom }).click();
    await page
      .getByRole('group', { name: 'Avez-vous eu la personne au téléphone ?' })
      .getByRole('button', { name: /Oui, elle a répondu/u })
      .click();
    await page.getByRole('button', { name: /^Continuer/u }).click();
    await page
      .getByRole('group', { name: 'Qu’a dit la personne ?' })
      .getByRole('button', { name: /À rappeler/u })
      .click();
    await page
      .getByRole('group', { name: 'Échéance du rappel' })
      .getByRole('button', { name: /Dans 1 h/u })
      .click();
    await expect(page.getByRole('status').filter({ hasText: /Rappel le/u })).toBeVisible();
    await page.getByRole('button', { name: /Enregistrer l’appel/u }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Appel consigné pour ${ficheDeA.nom}` }),
    ).toBeVisible();

    // « Dans 1 h » tombe dans l’onglet Aujourd’hui : on avance l’échéance pour la
    // retrouver dans l’onglet En retard, celui que l’écran ouvre par défaut.
    await avecBase(async (client) => {
      await client.query(
        `UPDATE scheduled_callbacks SET "scheduledAt" = now() - interval '1 day'
           WHERE "prospectId" = $1`,
        [ficheDeA.id],
      );
    });

    await page.getByRole('link', { name: 'Rappels promis' }).click();
    await expect(ligneDuRappel(page, ficheDeA.phoneE164)).toBeVisible();

    await page.getByRole('button', { name: `Compte de ${compteA.nom}` }).click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    // Le réseau est ralenti après la connexion de B : une éventuelle donnée de A
    // rendue depuis le cache, avant la vraie réponse, a le temps de se montrer.
    await page.route('**/api/v1/phase2/callbacks**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await connecter(page, compteB.identifiant, compteB.motDePasse);
    await expect(page.getByRole('button', { name: `Compte de ${compteB.nom}` })).toBeVisible();

    const reponse = page.waitForResponse('**/api/v1/phase2/callbacks**');
    await page.getByRole('link', { name: 'Rappels promis' }).click();
    await expect(page.getByRole('tab', { name: /En retard/u })).toBeVisible();
    expect(await ligneDuRappel(page, ficheDeA.phoneE164).count()).toBe(0);
    await reponse;
    await expect(ligneDuRappel(page, ficheDeA.phoneE164)).toHaveCount(0);
  });
});
