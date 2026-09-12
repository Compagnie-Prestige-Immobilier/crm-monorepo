import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { adminApi, ensureWorkspaceFixtures } from './fixtures';

/**
 * ET3-1 à ET3-6 (E2E.md) : `/chues/console`, étape 3, convertir un
 * prospect. L'écran ouvre sur la recherche, la fiche choisie reçoit l'appel,
 * puis on revient à la liste ; `?fiche=<id>` ouvre directement la fiche.
 *
 * `serial` : les fiches sont créées une fois, et chaque parcours change leur
 * état (rappel promis, adhésion, clôture) pour le suivant.
 *
 * Plage +221 78 100 91xx : hors du jeu de démonstration et des fixtures.
 */

test.use({ storageState: 'v1/.auth/commercial.json' });
test.describe.configure({ mode: 'serial' });

const FICHES = {
  ouverte: { phone: '+221781009101', saisie: '781009101', prenom: 'Ouverte' },
  rappel: { phone: '+221781009102', saisie: '781009102', prenom: 'Rappel' },
  adhesion: { phone: '+221781009103', saisie: '781009103', prenom: 'Adhesion' },
  close: { phone: '+221781009104', saisie: '781009104', prenom: 'Close' },
} as const;
const NOM = 'EtapeTrois';

const ids: Record<keyof typeof FICHES, string> = {
  ouverte: '',
  rappel: '',
  adhesion: '',
  close: '',
};
let trancheLabel = '';
let syndicatSigle = '';

async function ok<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(response.ok(), `${response.url()} : ${String(response.status())}`).toBe(true);
  return (await response.json()) as T;
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const { representantId } = await ensureWorkspaceFixtures();

  const api = await adminApi();
  try {
    const banques = await ok<{ id: string; isActive: boolean }[]>(
      await api.get('/api/v1/referentiels/banques', { params: { activeOnly: 'true' } }),
    );
    const tranches = await ok<{ id: string; label: string; isActive: boolean }[]>(
      await api.get('/api/v1/referentiels/tranches-revenu', { params: { activeOnly: 'true' } }),
    );
    const syndicats = await ok<{ id: string; sigle: string; isActive: boolean }[]>(
      await api.get('/api/v1/referentiels/syndicats', { params: { activeOnly: 'true' } }),
    );
    const banqueId = banques[0]?.id;
    trancheLabel = tranches[0]?.label ?? '';
    syndicatSigle = syndicats[0]?.sigle ?? '';
    expect(banqueId, 'Aucune banque active dans le référentiel').toBeTruthy();
    expect(trancheLabel, 'Aucune tranche de revenu active dans le référentiel').not.toBe('');
    expect(syndicatSigle, 'Aucun syndicat actif dans le référentiel').not.toBe('');

    for (const [cle, fiche] of Object.entries(FICHES) as [
      keyof typeof FICHES,
      (typeof FICHES)[keyof typeof FICHES],
    ][]) {
      const found = await ok<{ items: { id: string; phoneE164: string }[] }>(
        await api.get('/api/v1/prospects', { params: { search: fiche.phone, pageSize: '50' } }),
      );
      for (const row of found.items.filter((item) => item.phoneE164 === fiche.phone)) {
        await api.delete(`/api/v1/prospects/${row.id}`);
      }
      const created = await ok<{ id: string }>(
        await api.post('/api/v1/prospects', {
          data: { nom: NOM, prenom: fiche.prenom, phone: fiche.phone, banqueId, representantId },
        }),
      );
      ids[cle] = created.id;
    }
  } finally {
    await api.dispose();
  }
});

const champ = (page: Page) => page.getByLabel('Quel prospect avez-vous appelé ?');
const fiche = (page: Page) => page.getByRole('region', { name: 'Fiche courante' });

async function ouvrirParRecherche(page: Page, cle: keyof typeof FICHES): Promise<void> {
  await page.goto('/chues/console');
  await champ(page).fill(FICHES[cle].saisie);
  await page.getByRole('button', { name: new RegExp(`${NOM} ${FICHES[cle].prenom}`) }).click();
  await expect(fiche(page).getByRole('heading', { level: 2 })).toHaveText(
    `${NOM} ${FICHES[cle].prenom}`,
  );
}

test('ET3-1 · l’écran ouvre sur la recherche, focalisée, avec les dernières fiches', async ({
  page,
}) => {
  await page.goto('/chues/console');

  await expect(champ(page)).toBeFocused();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
  await expect(
    page.getByText('Vos fiches et celles que vos campagnes vous ont confiées.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: new RegExp(`${NOM} ${FICHES.ouverte.prenom}`) }),
  ).toBeVisible();
  const annuaire = page
    .getByRole('table')
    .filter({ has: page.getByRole('button', { name: new RegExp(NOM) }) });
  expect(await annuaire.getByRole('row').count()).toBeLessThanOrEqual(21);
});

test('ET3-2 · ?fiche=<id> ouvre directement la fiche visée', async ({ page }) => {
  await page.goto(`/chues/console?fiche=${ids.ouverte}`);

  await expect(fiche(page).getByRole('heading', { level: 2 })).toHaveText(
    `${NOM} ${FICHES.ouverte.prenom}`,
  );
  await expect(page.getByRole('alert').filter({ hasText: 'n’a pas pu être chargée' })).toHaveCount(
    0,
  );
  await expect(fiche(page).getByText('Jamais appelée.')).toBeVisible();

  await page.getByRole('button', { name: 'Revenir à la liste' }).click();
  await expect(champ(page)).toBeVisible();
});

test('ET3-3 · les touches ouvrent l’échéance, les renseignements, et consignent l’issue', async ({
  page,
}) => {
  await ouvrirParRecherche(page, 'ouverte');

  await page.keyboard.press('2');
  await expect(fiche(page).getByText('Quand rappeler')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fiche(page).getByText('Quand rappeler')).toHaveCount(0);

  await page.keyboard.press('1');
  await expect(fiche(page).getByText('Phase 3 · Conversion')).toBeVisible();
  await expect(fiche(page).getByRole('combobox', { name: /Revenu mensuel/ })).toBeVisible();
  await expect(fiche(page).getByRole('group', { name: 'Situation' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(fiche(page).getByText('Phase 3 · Conversion')).toHaveCount(0);

  // ET3-4 : après enregistrement, retour à la liste. Personne n'est ouvert à sa place.
  await page.keyboard.press('3');
  await expect(page.getByRole('status')).toHaveText(
    `Appel enregistré pour ${NOM} ${FICHES.ouverte.prenom}.`,
  );
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
  await expect(champ(page)).toBeVisible();

  const relue = await ok<{ lastOutcome: string; phase2Status: string }>(
    await page.request.get(`/api/v1/prospects/${ids.ouverte}`),
  );
  expect(relue.lastOutcome).toBe('UNREACHABLE');
  expect(relue.phase2Status).toBe('PENDING');
});

test('ET3-2b · un rappel promis revient ouvrir la fiche depuis les rappels', async ({ page }) => {
  await page.goto(`/chues/console?fiche=${ids.rappel}`);
  await expect(fiche(page).getByRole('heading', { level: 2 })).toHaveText(
    `${NOM} ${FICHES.rappel.prenom}`,
  );

  await page.keyboard.press('2');
  await expect(fiche(page).getByText('Quand rappeler')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.getByRole('status')).toHaveText(
    `Appel enregistré pour ${NOM} ${FICHES.rappel.prenom}.`,
  );

  await page.goto('/chues/rappels');
  await page.getByRole('tab', { name: 'Cette semaine' }).click();
  const ligne = page.getByRole('row').filter({ hasText: '78 100 91 02' });
  await expect(ligne).toHaveCount(1);
  await ligne.getByRole('link', { name: 'Consigner l’appel' }).click();

  await expect(page).toHaveURL(new RegExp(`/chues/console\\?fiche=${ids.rappel}`));
  await expect(fiche(page).getByRole('heading', { level: 2 })).toHaveText(
    `${NOM} ${FICHES.rappel.prenom}`,
  );
});

test('ET3-7 · l’adhésion exige le dossier complet, et le serveur l’enregistre', async ({
  page,
}) => {
  await page.goto(`/chues/console?fiche=${ids.adhesion}`);
  await expect(fiche(page).getByRole('heading', { level: 2 })).toHaveText(
    `${NOM} ${FICHES.adhesion.prenom}`,
  );

  await page.keyboard.press('1');
  await expect(fiche(page).getByText('Phase 3 · Conversion')).toBeVisible();
  // Un enseignant CHUES n'a ni situation ni mode de paiement à déclarer.
  await expect(fiche(page).getByRole('group', { name: 'Situation' })).toHaveCount(0);
  await expect(fiche(page).getByRole('combobox', { name: /^Paiement/ })).toHaveCount(0);

  // Dossier incomplet : rien ne part, et chaque manque est nommé sous son champ.
  await page.getByRole('button', { name: /Enregistrer l’adhésion/ }).click();
  await expect(page.getByText('La profession est obligatoire.')).toBeVisible();
  await expect(page.getByText('Dites s’il est fonctionnaire.')).toBeVisible();
  await expect(page.getByText('Choisissez la méthode d’enrôlement.')).toBeVisible();

  await page.getByLabel(/^E-mail/).fill('adhesion@example.sn');
  await page.getByLabel(/^Profession/).fill('Professeur de lettres');
  await page.getByLabel(/Durée dans l’établissement/).fill('48');
  await page
    .getByRole('group', { name: 'Fonctionnaire' })
    .getByRole('radio', { name: 'Oui' })
    .check();
  await page.getByRole('combobox', { name: /Syndicat/ }).click();
  await page.getByRole('option', { name: syndicatSigle }).click();
  await page
    .getByRole('group', { name: 'Engagement en cours à la banque' })
    .getByRole('radio', { name: 'Non' })
    .check();
  await page.getByRole('combobox', { name: /Revenu mensuel/ }).click();
  await page.getByRole('option', { name: trancheLabel }).click();
  await page.getByRole('combobox', { name: /Durée du système de paiement/ }).click();
  await page.getByRole('option', { name: '2 ans (24 mois)' }).click();
  await page.getByRole('radio', { name: 'Plateforme' }).check();

  await page.getByRole('button', { name: /Enregistrer l’adhésion/ }).click();
  await expect(page.getByRole('status')).toHaveText(
    `Appel enregistré pour ${NOM} ${FICHES.adhesion.prenom}.`,
  );

  const relue = await ok<{
    phase2Status: string;
    enrollmentMethod: string | null;
    profession: string | null;
    syndicatSigle: string | null;
    type: string | null;
    incomeBandLabel: string | null;
    paymentMode: string | null;
    dureeSystemeMois: number | null;
  }>(await page.request.get(`/api/v1/prospects/${ids.adhesion}`));
  expect(relue).toMatchObject({
    phase2Status: 'METHOD_OBTAINED',
    enrollmentMethod: 'PLATFORM',
    profession: 'Professeur de lettres',
    syndicatSigle,
    type: null,
    incomeBandLabel: trancheLabel,
    paymentMode: null,
    dureeSystemeMois: 24,
  });
});

test('ET3-5 · la carte clavier ne mentionne plus ↑ ↓ ni Espace', async ({ page }) => {
  await page.goto(`/chues/console?fiche=${ids.ouverte}`);
  await expect(fiche(page).getByRole('heading', { level: 2 })).toBeVisible();

  await page.getByText('Carte clavier').click();
  await expect(page.getByText('Copier le numéro')).toBeVisible();
  await expect(page.getByText('↑ ↓')).toHaveCount(0);
  await expect(page.getByText('Espace', { exact: true })).toHaveCount(0);
});

test('ET3-6 · une fiche déjà close refuse un nouvel appel en le disant', async ({ page }) => {
  await page.goto(`/chues/console?fiche=${ids.close}`);
  await expect(fiche(page).getByRole('heading', { level: 2 })).toHaveText(
    `${NOM} ${FICHES.close.prenom}`,
  );
  // Le refus se consigne depuis le dossier : la personne était joignable.
  await page.keyboard.press('1');
  await page.getByRole('button', { name: 'Il refuse' }).click();
  await expect(page.getByRole('status')).toHaveText(
    `Appel enregistré pour ${NOM} ${FICHES.close.prenom}.`,
  );

  await page.goto(`/chues/console?fiche=${ids.close}`);
  await expect(fiche(page).getByRole('status')).toContainText('Fiche déjà close (refus)');
  await expect(fiche(page).getByRole('button', { name: /Injoignable/ })).toHaveCount(0);

  await page.keyboard.press('3');
  await expect(page.getByRole('status')).toContainText('Fiche déjà close');
});
