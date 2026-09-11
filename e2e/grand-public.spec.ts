import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { apiDe, creerCompte, ligne, mesurerDebordement, purger, suffixe } from './donnees-listes';

const cle = suffixe();
const numeroSenegalais = (): string =>
  `77${String(1_000_000 + Math.floor(Math.random() * 8_999_999))}`;
const NUMERO_SAISIE = numeroSenegalais();
const NUMERO_PUBLIC = numeroSenegalais();
const NUMERO_APPELE = numeroSenegalais();

let partageur = '';
const comptes: string[] = [];

test.beforeAll(async () => {
  const api = await apiDe('ADMIN', '198.51.100.76');
  const compte = await creerCompte(api, 'COMMERCIAL', `MotDePassePartage${cle.slice(0, 4)}`);
  partageur = compte.id;
  comptes.push(compte.id);
  await api.dispose();
});

test.afterAll(async () => {
  await avecBase(async (client) => {
    await client.query('DELETE FROM prospects WHERE "phoneE164" = ANY($1)', [
      [`+221${NUMERO_SAISIE}`, `+221${NUMERO_PUBLIC}`, `+221${NUMERO_APPELE}`],
    ]);
  });
  await purger({ comptes });
});

/** Le panneau affiche `+221 77 123 45 67` là où l'API garde `+221771234567`. */
function numeroAffiche(numero: string): string {
  const [, tete, milieu, gauche, droite] = /^(\d{2})(\d{3})(\d{2})(\d{2})$/u.exec(numero) ?? [];
  return `+221 ${String(tete)} ${String(milieu)} ${String(gauche)} ${String(droite)}`;
}

const champ = (page: Page, libelle: string) =>
  page.getByRole('textbox', { name: libelle, exact: true });

async function saisirProspect(page: Page, prenom: string, numero: string): Promise<void> {
  await page.goto('/grand-public/nouveau');
  await champ(page, 'Prénom Obligatoire').fill(prenom);
  await champ(page, 'Nom Obligatoire').fill(`GP ${cle}`);
  await champ(page, 'Téléphone Obligatoire').fill(numero);
  await page.getByRole('button', { name: 'Enregistrer et ouvrir la fiche' }).click();
}

async function parcoursEnBase(numero: string): Promise<{
  id: string;
  projet: string;
  consent: string;
  origin: string | null;
  createdById: string;
} | null> {
  return ligne(
    `SELECT p.id, j.projet, j.consent, p.origin, p."createdById"
       FROM prospects p JOIN prospect_journeys j ON j."prospectId" = p.id
      WHERE p."phoneE164" = $1`,
    [`+221${numero}`],
  );
}

test.describe('parcours 11, la saisie et le suivi Grand Public', () => {
  test.use({ storageState: compteDe('COMMERCIAL').etat });

  test('une fiche saisie ouvre son parcours, puis son refus s’écrit et se relit', async ({
    page,
  }) => {
    await saisirProspect(page, 'Fatou', NUMERO_SAISIE);

    await expect(page.getByRole('heading', { name: `Fatou GP ${cle}`, level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/grand-public\/[0-9a-f-]{36}$/);

    const enBase = await parcoursEnBase(NUMERO_SAISIE);
    expect(enBase?.projet, 'la fiche doit ouvrir le parcours Grand Public').toBe('GRAND_PUBLIC');
    expect(enBase?.consent, 'le consentement par défaut est perdu').toBe('INTERESSE');

    const doublons = await ligne<{ n: string }>(
      'SELECT count(*) AS n FROM prospect_journeys WHERE "prospectId" = $1',
      [String(enBase?.id)],
    );
    expect(Number(doublons?.n), 'une seule fiche, un seul parcours').toBe(1);

    await page.getByRole('button', { name: 'Refusé', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirmer la conversion' })).toHaveCount(0);

    const apres = await parcoursEnBase(NUMERO_SAISIE);
    expect(apres?.consent, 'le refus n’a pas été écrit').toBe('REFUSE');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Confirmer la conversion' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Intéressé', exact: true })).toBeVisible();
  });

  test('la console consigne un rappel promis, visible dans les rappels', async ({ page }) => {
    await saisirProspect(page, 'Modou', NUMERO_APPELE);
    const fiche = await parcoursEnBase(NUMERO_APPELE);

    await page.goto('/grand-public/console');
    await page.getByRole('searchbox').fill(NUMERO_APPELE);
    await page
      .getByRole('button', { name: new RegExp(`GP ${cle} Modou`) })
      .first()
      .click();
    await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();

    await page.getByRole('button', { name: '2 Injoignable' }).click();
    await page.getByRole('button', { name: '1 À rappeler' }).click();
    await page.getByRole('button', { name: /^3 Demain 9 h/ }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Appel enregistré pour' }),
    ).toBeVisible();

    await expect
      .poll(
        async () =>
          Number(
            (
              await ligne<{ n: string }>(
                `SELECT count(*) AS n FROM scheduled_callbacks
                  WHERE "prospectId" = $1 AND "status" = 'PENDING'`,
                [String(fiche?.id)],
              )
            )?.n,
          ),
        { message: 'le rappel promis n’est pas en base' },
      )
      .toBe(1);

    const appels = await ligne<{ n: string }>(
      'SELECT count(*) AS n FROM call_attempts WHERE "prospectId" = $1',
      [String(fiche?.id)],
    );
    expect(Number(appels?.n), 'l’appel n’a pas été consigné').toBe(1);

    // `scope=week` couvre le jour même et les six suivants : « demain 9 h » y
    // tombe quel que soit le jour de l'exécution.
    await page.goto('/grand-public/rappels');
    await page.getByRole('tab', { name: 'Cette semaine' }).click();
    const rangee = page.getByRole('row').filter({ hasText: numeroAffiche(NUMERO_APPELE) });
    await expect(rangee).toHaveCount(1);
    await expect(rangee).toContainText('demain à 09:00');
    // Le numéro seul ne dit pas qui rappeler : la ligne doit porter le nom.
    await expect(rangee).toContainText(`GP ${cle}`);
  });
});

test.describe('parcours 11, le formulaire public', () => {
  test('le lien partagé s’ouvre sans session, et un envoi non vérifié n’écrit rien', async ({
    browser,
  }) => {
    const contexte = await browser.newContext({
      extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.77' },
    });
    const page = await contexte.newPage();

    await page.goto(`/demande/${partageur}`);
    await expect(page.getByRole('heading', { name: 'Demande de rappel', level: 1 })).toBeVisible();
    await expect(page.getByText('Étape 1 sur 2')).toBeVisible();

    await champ(page, 'Nom Obligatoire').fill(`PUBLIC ${cle}`);
    await champ(page, 'Prénom Obligatoire').fill('Aissatou');
    await champ(page, 'Téléphone Obligatoire').fill(NUMERO_PUBLIC);
    await page.getByRole('button', { name: 'Suivant' }).click();

    await expect(page.getByText('Étape 2 sur 2')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Syndicat Obligatoire' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Banque Obligatoire' })).toBeVisible();

    // Sans `TURNSTILE_SECRET_KEY`, `formulaire_public.go` refuse l'écriture. Le
    // visiteur le lit avant de remplir, et la première étape n'a rien créé.
    await expect(page.getByRole('alert').first()).toContainText('vérification anti-robot');
    const enBase = await parcoursEnBase(NUMERO_PUBLIC);
    expect(enBase, 'la première étape a déjà écrit une fiche').toBeNull();

    await contexte.close();
  });
});

test.describe('parcours 11 en 390 px, la saisie tient dans un téléphone', () => {
  test.use({
    storageState: compteDe('COMMERCIAL').etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('le formulaire de saisie s’ouvre sans débordement horizontal', async ({ page }) => {
    await page.goto('/grand-public/nouveau');
    await expect(
      page.getByRole('heading', { name: 'Nouveau prospect Grand Public', level: 1 }),
    ).toBeVisible();

    const mesure = await mesurerDebordement(page);
    expect(
      mesure.largeur,
      `la saisie déborde de ${String(mesure.largeur - mesure.ecran)} px. Coupables : ${mesure.coupables.join(' | ')}`,
    ).toBeLessThanOrEqual(mesure.ecran + 1);
  });
});
