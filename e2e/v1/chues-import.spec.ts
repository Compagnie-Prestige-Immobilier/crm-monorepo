import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

import { adminApi } from './fixtures';
import { buildXlsx } from './xlsx';

/**
 * `/chues/representants/import`, session ADMIN. CHU-IMP-02 à CHU-IMP-05.
 *
 * Les trois parcours nominaux (modèle, simulation puis application, redépôt
 * sans doublon) sont déjà couverts par `e2e/representants-import.spec.ts`, qui
 * n'est ni modifié ni réécrit. Ce fichier n'éprouve que les cas limites.
 *
 * Données : préfixe `E2E-CHUES-IMP `, plage `+221 78 100 47 0x` (§5.2). Les
 * fiches créées sont supprimables : le ménage se fait EN DÉBUT de parcours
 * (§5.1), sur un suffixe stable.
 */
test.use({ storageState: 'v1/.auth/admin.json' });

const PREFIXE = 'E2E-CHUES-IMP ';

/** Le nom qui éprouve l'aller-retour d'encodage : accents ET apostrophe courbe. */
const NOM_ACCENTUE = `${PREFIXE}Ndèye Coumba N’Diaye-Sy`;
const TELEPHONE_SAISI = '78 100 47 01';
const TELEPHONE_E164 = '+221781004701';

/** Le nom porté par le faux classeur : rien ne doit en naître en base. */
const NOM_FICHIER_TEXTE = `${PREFIXE}Fichier Texte`;

const ENTETES = ['Nom complet', 'Téléphone', 'Département', 'IEF', 'Notes'] as const;
/** Ligne 2 du modèle : l'exemple grisé, que le lecteur de l'API saute. */
const EXEMPLE = ['Fatou Ndiaye', '77 123 45 67', 'Dakar', 'Almadies', 'Ligne d’exemple'] as const;

async function json<T>(response: APIResponse): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

/**
 * Les fiches dont le nom contient `fragment`.
 *
 * La liste est relue en entier et filtrée ICI : la recherche serveur des
 * représentants ne resserre pas sur le nom (voir le retour), s'y fier rendrait
 * ce contrôle muet.
 */
async function fichesNommees(api: APIRequestContext, fragment: string): Promise<string[]> {
  const page = await json<{ items: { fullName: string }[] }>(
    await api.get('/api/v1/representants', { params: { pageSize: '100' } }),
  );
  return page.items.map((row) => row.fullName).filter((name) => name.includes(fragment));
}

async function retirer(api: APIRequestContext, phone: string): Promise<void> {
  const found = await json<{ items: { id: string; phoneE164: string }[] }>(
    await api.get('/api/v1/representants', { params: { search: phone, pageSize: '100' } }),
  );
  for (const row of found.items) {
    if (row.phoneE164 !== phone) continue;
    const deleted = await api.delete(`/api/v1/representants/${row.id}`, {
      params: { cascade: 'true' },
    });
    expect(
      deleted.ok(),
      `Le ménage de ${phone} a répondu ${String(deleted.status())} : ${await deleted.text()}`,
    ).toBe(true);
  }
}

/**
 * Dépose un fichier et rend la main.
 *
 * On vise `input[type="file"]` et non son libellé : le libellé de la zone de
 * dépôt affiche le NOM DU FICHIER dès le premier dépôt.
 */
async function deposer(
  page: Page,
  fichier: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  // Le champ existe dans le HTML rendu par le serveur, mais son `onChange` n'est
  // posé qu'à l'hydratation : déposer avant fait disparaître le fichier sans la
  // moindre erreur. On attend que le réseau se taise, pas une durée fixe.
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="file"]').setInputFiles(fichier);
}

/** Le chiffre d'un cadran du rapport : `<dt>` porte l'intitulé, `<dd>` la valeur. */
async function cadran(page: Page, label: string): Promise<number> {
  const labels = await page.getByRole('term').allTextContents();
  const index = labels.findIndex((text) => text.trim() === label);
  expect(index, `Le cadran « ${label} » ne figure pas dans le rapport.`).toBeGreaterThanOrEqual(0);
  const value = await page.getByRole('definition').nth(index).textContent();
  return Number((value ?? '').replace(/[^\d]/gu, ''));
}

test.beforeAll(async () => {
  const api = await adminApi();
  try {
    await retirer(api, TELEPHONE_E164);
  } finally {
    await api.dispose();
  }
});

test('CHU-IMP-02 un fichier qui n’est pas un classeur est refusé avec un motif', async ({
  page,
}) => {
  await page.goto('/chues/representants/import');
  await deposer(page, {
    name: 'faux-classeur.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(`${NOM_FICHIER_TEXTE};78 100 47 09;Dakar\n`, 'utf8'),
  });

  // Le motif est NOMMÉ : « le fichier n'a pas pu être analysé » laisserait
  // croire à une panne du serveur.
  await expect(
    page.getByText('Le fichier n’est pas un classeur Excel lisible (.xlsx).'),
  ).toBeVisible();
  await expect(
    page.getByText('Lignes lues', { exact: true }),
    'un fichier illisible ne produit aucun rapport chiffré',
  ).toHaveCount(0);

  const api = await adminApi();
  try {
    expect(
      await fichesNommees(api, NOM_FICHIER_TEXTE),
      'un fichier refusé ne doit écrire aucune fiche',
    ).toEqual([]);
  } finally {
    await api.dispose();
  }
});

test('CHU-IMP-03 un classeur sans aucune ligne de données rend un rapport à zéro', async ({
  page,
}) => {
  await page.goto('/chues/representants/import');
  await deposer(page, {
    name: 'sans-donnees.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buildXlsx('Représentants', [[...ENTETES], [...EXEMPLE]]),
  });

  await expect(page.getByText('Lignes lues', { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(await cadran(page, 'Lignes lues'), 'la ligne d’exemple ne compte pas').toBe(0);

  // Le bouton reste VISIBLE mais inerte, plutôt que de disparaître et laisser
  // croire à un écran cassé.
  await expect(page.getByRole('button', { name: 'Créer 0 représentant' })).toBeDisabled();
});

test('CHU-IMP-04 un nom avec caractères spéciaux survit à l’aller-retour', async ({ page }) => {
  await page.goto('/chues/representants/import');
  await deposer(page, {
    name: 'accents.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buildXlsx('Représentants', [
      [...ENTETES],
      [...EXEMPLE],
      [NOM_ACCENTUE, TELEPHONE_SAISI, 'Dakar', 'Almadies', 'Déposé par la suite E2E'],
    ]),
  });

  await expect(page.getByText('Lignes lues', { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(await cadran(page, 'Valides')).toBe(1);

  await page.getByRole('button', { name: 'Créer 1 représentant' }).click();
  await expect(page.getByText('1 fiche créée.')).toBeVisible({ timeout: 60_000 });

  await page.goto('/chues/representants');
  await page.getByRole('textbox', { name: 'Recherche', exact: true }).fill(NOM_ACCENTUE);

  // Le nom est relu CARACTÈRE POUR CARACTÈRE : une apostrophe droite ou un
  // accent amputé ne trouverait rien.
  await expect(
    page.getByRole('table').getByRole('link', { name: NOM_ACCENTUE, exact: true }),
  ).toHaveCount(1);
});

test('CHU-IMP-05 l’écran d’import tient sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/chues/representants/import');

  await expect(page.getByRole('button', { name: 'Télécharger le modèle Excel' })).toBeVisible();
  await expect(page.getByText('Glissez le classeur ici, ou choisissez un fichier')).toBeVisible();

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(deborde, 'la page ne doit pas défiler latéralement sur 375 px').toBe(false);
});
