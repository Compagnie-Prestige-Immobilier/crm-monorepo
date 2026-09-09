import { expect, test, type Locator, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Issues d'appel de l'espace Admin : ADM-ISS-01 à ADM-ISS-07.
 *
 * Un motif d'issue ne se supprime pas : chaque exécution porte son horodatage
 * (E2E.md §5.1). Les six motifs SYSTÈME du semis (`seed-data/call-outcomes.ts`)
 * ne sont ni renommés, ni retirés, ni reconfigurés : ADM-ISS-05 éprouve leur
 * verrou sans jamais rien écrire.
 */

test.use({ storageState: 'e2e/.auth/admin.json' });

const RUN = String(Date.now()).slice(-8);
const CODE = `E2EISS${RUN}`;
const CODE_BIS = `E2EISS${RUN}B`;
const CODE_SERVICE = `E2EISS${RUN}R`;
const LIBELLE = `E2E-ADM-ISS Motif témoin ${RUN}`;
const LIBELLE_BIS = `E2E-ADM-ISS Motif jumeau ${RUN}`;
const LIBELLE_SERVICE = `E2E-ADM-ISS Motif de service ${RUN}`;

/** Motif système du semis, jamais modifié ici. */
const SYSTEME = { code: 'UNREACHABLE', libelle: 'Injoignable' };

const COLONNES = [
  'Code',
  'Libellé',
  'Effet sur le prospect',
  'Couleur',
  'Saisie exigée',
  'Sur les téléphones',
  'Actions',
];

async function ouvrirIssues(page: Page): Promise<void> {
  await page.goto('/admin/referentiels/issues-appel');
  await expect(page).toHaveTitle(/Issues d’appel/);
  await expect(page.getByRole('table')).toBeVisible();
}

function ligne(page: Page, texte: string): Locator {
  // `E2EISS<RUN>` est un préfixe de `E2EISS<RUN>R` : la cellule exacte, pas le sous-texte.
  return page
    .getByRole('table')
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: texte, exact: true }) });
}

/**
 * `DialogContent` n'a ni hauteur maximale ni défilement
 * (`components/ui/dialog.tsx`) : une boîte plus haute que la fenêtre laisse son
 * pied hors champ, et le bouton devient inatteignable à la souris. Sans ce
 * contrôle, l'échec se lit « html intercepts pointer events » après soixante
 * secondes, ce qui ne nomme rien.
 */
async function attendrePiedAtteignable(
  page: Page,
  dialogue: Locator,
  bouton: string,
): Promise<void> {
  const cible = dialogue.getByRole('button', { name: bouton });
  await expect(cible).toBeVisible();
  // Une boîte plus haute que la fenêtre doit défiler jusqu'à son pied.
  await cible.scrollIntoViewIfNeeded();
  const cadre = await cible.boundingBox();
  const hauteur = page.viewportSize()?.height ?? 0;
  expect(cadre, `Le bouton « ${bouton} » doit être mesurable`).not.toBeNull();
  expect(
    (cadre?.y ?? 0) + (cadre?.height ?? 0),
    `Le bouton « ${bouton} » tombe sous le bord de la fenêtre (${String(hauteur)} px) : la boîte ne défile pas, le geste est impossible`,
  ).toBeLessThanOrEqual(hauteur);
}

/**
 * Le motif que ADM-ISS-06 retire puis remet.
 *
 * Posé par l'API parce que l'écran ne PEUT pas le poser : le pied de la boîte
 * de création tombe sous la fenêtre (voir ADM-ISS-02). Sans cette précondition,
 * le retrait et la remise en service ne seraient éprouvés nulle part.
 */
test.beforeAll(async () => {
  const api = await adminApi();
  try {
    const liste = (await (await api.get('/api/v1/call-outcome-reasons/administration')).json()) as {
      items: { code: string }[];
    };
    if (liste.items.some((row) => row.code === CODE_SERVICE)) return;

    const cree = await api.post('/api/v1/call-outcome-reasons', {
      data: { code: CODE_SERVICE, label: LIBELLE_SERVICE, effect: 'KEEP_OPEN' },
    });
    expect(cree.ok(), `Motif de service non créé : ${await cree.text()}`).toBe(true);
  } finally {
    await api.dispose();
  }
});

test.describe('Issues d’appel', () => {
  test.describe.configure({ mode: 'serial' });

  test('ADM-ISS-01 · l’écran se charge', async ({ page }) => {
    await ouvrirIssues(page);

    await expect(
      page.getByText('Issues proposées au téléconseiller à la fin d’un appel.'),
    ).toBeVisible();
    for (const colonne of COLONNES) {
      await expect(
        page.getByRole('table').getByRole('columnheader', { name: colonne, exact: true }),
      ).toHaveCount(1);
    }
    await expect(page.getByRole('heading', { name: 'Chargement impossible' })).toHaveCount(0);
  });

  test('ADM-ISS-06 · retrait puis remise en service', async ({ page }) => {
    await ouvrirIssues(page);

    await page.getByRole('button', { name: `Retirer ${LIBELLE_SERVICE}` }).click();
    await expect(page.getByText(`${LIBELLE_SERVICE} retiré.`)).toBeVisible();
    await expect(ligne(page, CODE_SERVICE)).toContainText('Retiré des listes');

    await page.getByRole('button', { name: `Remettre ${LIBELLE_SERVICE}` }).click();
    await expect(page.getByText(`${LIBELLE_SERVICE} remis en service.`)).toBeVisible();
    await expect(ligne(page, CODE_SERVICE)).toContainText('Après mise à jour de l’application');
  });

  test('ADM-ISS-05 · motif système non modifiable', async ({ page }) => {
    await ouvrirIssues(page);

    const systeme = ligne(page, SYSTEME.code);
    await expect(systeme).toContainText('Système');
    // Le retrait n'est même pas proposé : `reason.isSystem` supprime le bouton.
    await expect(page.getByRole('button', { name: `Retirer ${SYSTEME.libelle}` })).toHaveCount(0);

    await page.getByRole('button', { name: `Modifier ${SYSTEME.libelle}` }).click();
    const boite = page.getByRole('dialog');
    await expect(boite).toContainText(
      'Motif système : ces règles sont compilées dans l’application de terrain et ne se changent pas ici.',
    );
    for (const regle of [
      'Un commentaire',
      'Une date de rappel',
      'L’appel compte comme joignable dans les statistiques',
    ]) {
      await expect(boite.getByLabel(regle)).toBeDisabled();
    }
    await page.keyboard.press('Escape');
    await expect(boite).toHaveCount(0);

    // L'écran ne propose pas le geste : le refus du SERVEUR, lui, ne se voit
    // qu'en le tentant. La requête est rejetée, donc rien n'est écrit.
    const api = await adminApi();
    try {
      const liste = (await (
        await api.get('/api/v1/call-outcome-reasons/administration')
      ).json()) as { items: { id: string; code: string; requiresComment: boolean }[] };
      const avant = liste.items.find((row) => row.code === SYSTEME.code);
      expect(avant, `Le motif système ${SYSTEME.code} doit exister`).toBeDefined();

      const refus = await api.patch(`/api/v1/call-outcome-reasons/${avant?.id ?? ''}`, {
        data: { requiresComment: !(avant?.requiresComment ?? false) },
      });
      expect(refus.status()).toBe(409);
      expect(await refus.text()).toContain('est un motif système');

      const apres = (await (
        await api.get('/api/v1/call-outcome-reasons/administration')
      ).json()) as { items: { code: string; requiresComment: boolean }[] };
      expect(apres.items.find((row) => row.code === SYSTEME.code)?.requiresComment).toBe(
        avant?.requiresComment,
      );
    } finally {
      await api.dispose();
    }
  });

  test('ADM-ISS-02 · création d’un motif', async ({ page }) => {
    await ouvrirIssues(page);

    await page.getByRole('button', { name: 'Nouveau motif' }).click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue.getByRole('heading', { name: 'Nouveau motif d’issue' })).toBeVisible();

    await dialogue.getByLabel('Code').fill(CODE);
    await dialogue.getByLabel('Libellé').fill(LIBELLE);
    // L'effet neutre est la valeur d'usine du formulaire : on la laisse, et
    // c'est la ligne créée qui prouve laquelle a été retenue.
    await attendrePiedAtteignable(page, dialogue, 'Ajouter');
    await dialogue.getByRole('button', { name: 'Ajouter' }).click();

    await expect(
      page.getByText(
        `${LIBELLE} ajouté. Il atteindra les téléphones après la mise à jour de l’application.`,
      ),
    ).toBeVisible();

    const creee = ligne(page, CODE);
    await expect(creee).toHaveCount(1);
    await expect(creee).toContainText(LIBELLE);
    await expect(creee).toContainText('Laisse le prospect à rappeler');
    await expect(creee).toContainText('Après mise à jour de l’application');
  });

  test('ADM-ISS-03 · code en doublon', async ({ page }) => {
    await ouvrirIssues(page);

    await page.getByRole('button', { name: 'Nouveau motif' }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByLabel('Code').fill(CODE);
    await dialogue.getByLabel('Libellé').fill(LIBELLE_BIS);
    await dialogue.getByRole('button', { name: 'Ajouter' }).click();

    await expect(
      page.getByText(`Le code « ${CODE} » est déjà utilisé par le motif « ${LIBELLE} ».`),
    ).toBeVisible();
    await expect(dialogue).toBeVisible();

    await dialogue.getByRole('button', { name: 'Annuler' }).click();
    await expect(ligne(page, CODE)).toHaveCount(1);
    await expect(ligne(page, LIBELLE_BIS)).toHaveCount(0);
  });

  test('ADM-ISS-04 · libellé en doublon avec un autre code', async ({ page }) => {
    await ouvrirIssues(page);

    await page.getByRole('button', { name: 'Nouveau motif' }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByLabel('Code').fill(CODE_BIS);
    await dialogue.getByLabel('Libellé').fill(LIBELLE);
    await dialogue.getByRole('button', { name: 'Ajouter' }).click();

    await expect(
      page.getByText(`Le libellé « ${LIBELLE} » est déjà porté par le motif « ${CODE} ».`),
    ).toBeVisible();
    await expect(dialogue).toBeVisible();

    await dialogue.getByRole('button', { name: 'Annuler' }).click();
    await expect(ligne(page, CODE_BIS)).toHaveCount(0);
  });
});

/**
 * Hors de la série : ATTENDU ROUGE (E2E.md §1.11). La vue rend
 * `query.data.map(...)` sans vérifier `length`.
 */
test.describe('Liste vide', () => {
  test('ADM-ISS-07 · état vide absent', async ({ page }) => {
    await page.route('**/api/v1/call-outcome-reasons/administration*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      }),
    );

    await ouvrirIssues(page);

    await expect(
      page.getByText('Aucun motif d’issue'),
      'une liste vide doit s’expliquer, comme partout ailleurs dans le panel',
    ).toBeVisible();
  });
});
