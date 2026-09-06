import { expect, request, test, type Page } from '@playwright/test';

/**
 * Composition de l'écran « Chiffres » du projet CHUES, en session SUPERVISEUR.
 *
 * Une seule donnée est touchée : la DISPOSITION du compte
 * `fixture.superviseur@cpi.sn` sur l'écran `chues`. Elle est remise à zéro au
 * début du fichier et dans un `afterAll` inconditionnel, par
 * `DELETE /api/v1/tableaux-de-bord/chues/disposition`.
 *
 * Les scénarios se suivent sur cette même donnée : `serial` est obligatoire.
 * Conséquence assumée : le premier rouge arrête la suite du fichier.
 *
 * Dépendance connue : `GET /api/v1/supervision/activite` répond 500 (virgule de
 * trop dans `supervision.service.ts`), donc la GRILLE ne se rend pas. Tout ce
 * qui vise une carte est ATTENDU ROUGE ; la barre d'édition et le tiroir, eux,
 * vivent au-dessus de l'état d'erreur.
 */

test.use({ storageState: 'e2e/.auth/superviseur.json' });
test.describe.configure({ mode: 'serial' });

const DISPOSITION = '/api/v1/tableaux-de-bord/chues/disposition';

const CARTES_USINE = [
  'Taux de contact',
  'Taux de joignabilité des représentants',
  'Taux d’acceptation',
  'Taux de qualification',
  'Répartition des statuts de qualification',
  'Par téléconseiller',
  'Fiches ouvertes',
] as const;

/** Les sources du catalogue CHUES d'un superviseur qui ne sont pas d'usine. */
const SOURCES_EN_RESERVE = [
  'Taux de rappel',
  'Joints et non joints',
  'Statuts par famille',
  'Joignabilité par créneau',
  'Taux d’exploitation',
  'Exploitation par campagne',
  'Représentants par département',
  'Représentants par IEF',
  'Représentants jamais appelés',
  'Représentants injoignables',
  'Taux de joignabilité des prospects',
  'Méthodes obtenues',
  'Durée moyenne sur la fiche',
  'Durée moyenne de communication',
  'Appels par jour',
  'Méthodes d’adhésion',
  'Délais médians',
] as const;

async function effacerLaDisposition(): Promise<void> {
  const api = await request.newContext({
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    storageState: 'e2e/.auth/superviseur.json',
  });
  try {
    await api.delete(DISPOSITION);
  } finally {
    await api.dispose();
  }
}

/** Le seul repère unique d'une carte : la région du graphique (`ChartCard`). */
function carte(page: Page, titre: string) {
  return page.getByRole('group', { name: `${titre} graphique` });
}

/**
 * Attend la RÉPONSE de disposition, pas un délai : sans elle, le bouton
 * « Composer l’écran » est bien rendu mais son geste ne fait rien, faute de
 * disposition à recopier dans le brouillon.
 */
async function avecDisposition(page: Page, geste: () => Promise<unknown>): Promise<void> {
  const attendue = page.waitForResponse(
    (reponse) =>
      reponse.url().includes(DISPOSITION) &&
      reponse.request().method() === 'GET' &&
      reponse.status() === 200,
  );
  await geste();
  await attendue;
  // La réponse reçue n'est pas encore rendue : c'est la première carte qui
  // prouve que le brouillon a de quoi se recopier.
  await expect(
    page
      .getByRole('group', { name: / graphique$/u })
      .or(page.getByText('Cet écran est vide'))
      .first(),
  ).toBeVisible();
}

async function ouvrirComposition(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Composer l’écran' }).click();
  await expect(page.getByText('Mode organisation')).toBeVisible();
}

/** Une proposition du tiroir : sa carte, reconnue par son titre. */
function proposition(page: Page, titre: string) {
  return page
    .getByRole('dialog')
    .locator('article', { has: page.getByRole('heading', { name: titre, exact: true }) });
}

/** Ajouter passe par l'exemple : le tiroir montre la forme avant de la poser. */
async function ajouterDepuisLeTiroir(page: Page, titre: string): Promise<void> {
  const carte = proposition(page, titre);
  await carte.getByRole('button', { name: 'Voir cet exemple' }).click();
  await carte.getByRole('button', { name: 'Ajouter cette forme' }).click();
  await expect(carte).toHaveCount(0);
}

async function enregistrer(page: Page): Promise<void> {
  const enregistre = page.waitForResponse(
    (reponse) => reponse.url().includes(DISPOSITION) && reponse.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await enregistre;
}

/** L'ordre des cartes, lu sur les boutons « Retirer … » du mode composition. */
async function ordreDesCartes(page: Page): Promise<string[]> {
  await expect(page.getByRole('button', { name: /^Retirer / }).first()).toBeVisible();
  const boutons = await page.getByRole('button', { name: /^Retirer / }).all();
  const titres: string[] = [];
  for (const bouton of boutons) {
    titres.push(((await bouton.getAttribute('aria-label')) ?? '').replace(/^Retirer /, ''));
  }
  return titres;
}

test.beforeAll(async () => {
  await effacerLaDisposition();
});

test.afterAll(async () => {
  await effacerLaDisposition();
});

test('CHU-DSP-01 · « Composer l’écran » ouvre le mode et le nomme', async ({ page }) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  await expect(page.getByRole('button', { name: 'Ajouter un graphique' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toHaveCount(0);

  // Fixer la disposition de toute l'entreprise reste réservé à l'ADMIN.
  await expect(page.getByRole('button', { name: 'Proposer par défaut' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitter' }).click();
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
});

test('CHU-DSP-03 · retirer une carte, enregistrer, recharger : elle reste absente', async ({
  page,
}) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  await page.getByRole('button', { name: 'Retirer Fiches ouvertes' }).click();
  await enregistrer(page);

  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
  await expect(carte(page, 'Fiches ouvertes')).toHaveCount(0);

  await avecDisposition(page, () => page.reload());
  await expect(carte(page, 'Fiches ouvertes')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revenir à l’écran par défaut' })).toBeVisible();
});

test('CHU-DSP-04 · ajouter une carte depuis le tiroir', async ({ page }) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  await page.getByRole('button', { name: 'Ajouter un graphique' }).click();

  const tiroir = page.getByRole('dialog');
  await expect(tiroir.getByText('Ajouter un graphique')).toBeVisible();
  await expect(tiroir).toContainText(
    'Choisissez une question simple. Nous vous proposons l’affichage le plus facile à lire.',
  );
  await expect(proposition(page, 'Prospects saisis')).toBeVisible();
  // Une source déjà posée n'est pas proposée : sinon l'enregistrement crée un
  // doublon que le serveur déduplique en silence.
  await expect(proposition(page, 'Taux de contact')).toHaveCount(0);

  await ajouterDepuisLeTiroir(page, 'Prospects saisis');
  await tiroir.getByRole('button', { name: 'Fermer' }).click();
  await expect(tiroir).toHaveCount(0);
  await expect(carte(page, 'Prospects saisis')).toBeVisible();

  await enregistrer(page);
});

test('CHU-DSP-05 · le tiroir dit quand tout est placé', async ({ page }) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  await page.getByRole('button', { name: 'Ajouter un graphique' }).click();
  const tiroir = page.getByRole('dialog');

  // CHU-DSP-03 a retiré « Fiches ouvertes », CHU-DSP-04 a posé « Prospects saisis ».
  for (const source of [...SOURCES_EN_RESERVE, 'Fiches ouvertes']) {
    await ajouterDepuisLeTiroir(page, source);
  }

  await expect(tiroir).toContainText('Toutes les questions sont déjà affichées.');
  await expect(proposition(page, 'Méthodes d’adhésion')).toHaveCount(0);

  // On quitte SANS enregistrer : ce scénario ne laisse aucune trace en base.
  await tiroir.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Quitter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
});

test('CHU-DSP-06 · l’ordre se change au clavier, sans glisser-déposer, et il est sauvegardé', async ({
  page,
}) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  const avant = await ordreDesCartes(page);
  expect(avant[0], 'la grille d’usine commence par le taux de contact').toBe('Taux de contact');

  await page.getByRole('button', { name: 'Descendre Taux de contact' }).click();

  const apres = await ordreDesCartes(page);
  expect(apres[0]).not.toBe('Taux de contact');

  await expect(page.getByRole('button', { name: `Monter ${apres[0] ?? ''}` })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: `Descendre ${apres[apres.length - 1] ?? ''}` }),
  ).toBeDisabled();

  await enregistrer(page);
  await avecDisposition(page, () => page.reload());
  await ouvrirComposition(page);
  expect(await ordreDesCartes(page)).toEqual(apres);

  await page.getByRole('button', { name: 'Quitter' }).click();
});

test('CHU-DSP-07 · la marque d’une carte se change et survit au rechargement', async ({ page }) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  // Les taux n'ont qu'une tuile. Le classement des statuts se change en tableau.
  const changer = page.getByRole('button', {
    name: 'Changer la présentation de Répartition des statuts de qualification',
  });
  const tableau = page.getByRole('button', { name: /^Tableau/ });
  await changer.click();
  await tableau.click();
  await enregistrer(page);

  // Sans donnée sur la période, la carte montre le même état vide quelle que
  // soit la marque : c'est le choix coché qui prouve ce qui a été enregistré.
  await avecDisposition(page, () => page.reload());
  await ouvrirComposition(page);
  await changer.click();
  await expect(tableau).toHaveAttribute('aria-pressed', 'true');
});

test('CHU-DSP-09 · « Quitter » avec des changements demande confirmation', async ({ page }) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  await page.getByRole('button', { name: 'Retirer Par téléconseiller' }).click();
  await page.getByRole('button', { name: 'Quitter' }).click();

  const confirmation = page.getByRole('dialog');
  await expect(
    confirmation.getByRole('heading', { name: 'Quitter sans enregistrer' }),
  ).toBeVisible();
  await expect(confirmation).toContainText('Les changements faits dans ce mode seront perdus.');

  await confirmation.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  await expect(carte(page, 'Par téléconseiller')).toBeVisible();
});

test('CHU-DSP-10 · « Quitter » sans changement ne demande rien', async ({ page }) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);

  await page.getByRole('button', { name: 'Quitter' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
});

test('CHU-DSP-11 · la disposition est propre à chaque compte', async ({
  page,
  browser,
  baseURL,
}) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);
  await page.getByRole('button', { name: 'Retirer Par téléconseiller' }).click();
  await enregistrer(page);
  await expect(carte(page, 'Par téléconseiller')).toHaveCount(0);

  const contexteDirection = await browser.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    storageState: 'e2e/.auth/direction.json',
  });
  try {
    const pageDirection = await contexteDirection.newPage();
    await pageDirection.goto('/chues/statistiques');
    await expect(
      carte(pageDirection, 'Par téléconseiller'),
      'la disposition d’un superviseur ne touche pas l’écran de la direction',
    ).toBeVisible();
  } finally {
    await contexteDirection.close();
  }

  // Nettoyage par le geste utilisateur, pas par l'API.
  const efface = page.waitForResponse(
    (reponse) => reponse.url().includes(DISPOSITION) && reponse.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Revenir à l’écran par défaut' }).click();
  await efface;
});

test('CHU-DSP-12 · la disposition est propre à chaque écran', async ({ page }) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));
  await ouvrirComposition(page);
  await page.getByRole('button', { name: 'Retirer Taux de qualification' }).click();
  await enregistrer(page);
  await expect(carte(page, 'Taux de qualification')).toHaveCount(0);

  await page.goto('/grand-public/statistiques');
  for (const titre of [
    'Taux de joignabilité des prospects',
    'Prospects saisis',
    'Méthodes obtenues',
    'Par téléconseiller',
  ]) {
    await expect(carte(page, titre), `« ${titre} » d’usine sur l’écran Grand Public`).toBeVisible();
  }
  await expect(carte(page, 'Taux de qualification')).toHaveCount(0);
});

test('CHU-DSP-08 · « Revenir à l’écran par défaut » efface la disposition personnelle', async ({
  page,
}) => {
  await avecDisposition(page, () => page.goto('/chues/statistiques'));

  const efface = page.waitForResponse(
    (reponse) => reponse.url().includes(DISPOSITION) && reponse.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Revenir à l’écran par défaut' }).click();
  await efface;

  await avecDisposition(page, () => page.reload());
  await ouvrirComposition(page);
  expect(await ordreDesCartes(page)).toEqual([...CARTES_USINE]);
  await page.getByRole('button', { name: 'Quitter' }).click();

  await expect(page.getByRole('button', { name: 'Revenir à l’écran par défaut' })).toHaveCount(0);
});
