import { expect, test, type Page } from '@playwright/test';

import { adminApi, ensureWorkspaceFixtures, supprimerProspects } from './fixtures';

/**
 * La section « Terrain » : console d'appel, saisie de prospect, cascade
 * géographique.
 *
 * Ces écrans sont ouverts à un ADMIN comme à un téléconseiller, et la garde
 * serveur est la même (`guardRoles(['ADMIN', 'COMMERCIAL'])`). On les éprouve
 * donc avec la session administrateur déjà rangée sur disque : ce que ces
 * parcours vérifient est le comportement de l'écran, pas le contrôle d'accès,
 * qui est couvert rôle par rôle dans `roles.anon.spec.ts`. Une connexion de
 * plus coûterait un dixième du quota que l'API accorde par minute.
 *
 * `serial` : le parcours du doublon rejoue le numéro que la saisie en rafale
 * vient d'enregistrer. Le lire d'un test à l'autre est le seul moyen d'éprouver
 * que le 409 NOMME la fiche existante.
 *
 * Ce fichier tourne AVANT `workspaces.spec.ts` dans l'ordre alphabétique, donc
 * avant que le mode démonstration ne soit allumé : la création d'un prospect
 * n'est pas `DemoWritable` et serait refusée sous ce mode.
 */

test.describe.configure({ mode: 'serial' });

/**
 * Deux numéros FIXES, effacés avant le parcours plutôt que tirés au hasard.
 *
 * Un numéro horodaté laisserait une fiche de plus par exécution dans une base
 * de développement, et les compteurs finiraient par mentir. Un numéro fixe sans
 * effacement préalable rendrait 409 dès la deuxième exécution, et le parcours
 * de la rafale n'éprouverait plus rien.
 *
 * Plage +221 78 100 9xxx : hors du jeu de démonstration (+221 77 501 00 xx) et
 * hors des trente fiches d'amorçage (+221 78 100 1xxx).
 */
const RAFALE = [
  { phone: '+221781009001', saisie: '78 100 90 01', prenom: 'Aminata', nom: 'RafaleUn' },
  { phone: '+221781009002', saisie: '78 100 90 02', prenom: 'Ousmane', nom: 'RafaleDeux' },
] as const;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  await ensureWorkspaceFixtures();

  const api = await adminApi();
  try {
    for (const { phone } of RAFALE) {
      const found = (await (
        await api.get('/api/v1/prospects', { params: { search: phone, pageSize: '50' } })
      ).json()) as { items: { id: string; phoneE164: string }[] };
      await supprimerProspects(
        api,
        found.items.filter((item) => item.phoneE164 === phone),
      );
    }
  } finally {
    await api.dispose();
  }
});

/**
 * Choisit une option dans un `FilterCombobox`, qui rend sa liste dans un portail.
 *
 * L'attente finale n'est pas une politesse : le portail survit un instant à la
 * fermeture, et deux champs enchaînés donnaient DEUX zones « Chercher… » dans
 * le document, donc une violation du mode strict.
 */
async function choisir(
  page: Page,
  champ: RegExp,
  recherche: string,
  option: RegExp,
): Promise<void> {
  await page.getByRole('combobox', { name: champ }).click();
  await page.getByPlaceholder('Chercher…').fill(recherche);
  await page.getByRole('option', { name: option }).first().click();
  await expect(page.getByPlaceholder('Chercher…')).toHaveCount(0);
}

// L'étape 3 (convertir un prospect) vit dans `chues-etape3.commercial.spec.ts`.

test('la saisie en rafale garde la banque et le syndicat', async ({ page }) => {
  await page.goto('/prospects/nouveau');
  await expect(page.getByRole('heading', { name: 'Nouveau prospect', level: 1 })).toBeVisible();

  await expect(page.getByText('Ctrl + Entrée enregistre et enchaîne.')).toBeVisible();
  await expect(page.getByText('Aucun prospect noté pour l’instant.')).toBeVisible();

  await choisir(page, /Représentant/, 'Ibrahima Fixture', /Ibrahima Fixture/);
  await choisir(page, /Banque/, 'CBAO', /^CBAO/);
  await choisir(page, /Syndicat/, 'CHUES', /Union des Enseignants/);

  const premier = RAFALE[0];
  await page.getByLabel(/^Prénom/).fill(premier.prenom);
  await page.getByLabel(/^Nom/).fill(premier.nom);
  await page.getByLabel(/^Téléphone/).fill(premier.saisie);
  await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

  await expect(page.getByText('1 prospect noté pour Ibrahima Fixture aujourd’hui')).toBeVisible();

  // L'identité est vidée, le contexte NON : c'est toute la différence entre
  // enchaîner une liste et ressaisir six champs par fiche.
  await expect(page.getByLabel(/^Prénom/)).toHaveValue('');
  await expect(page.getByLabel(/^Nom/)).toHaveValue('');
  await expect(page.getByLabel(/^Téléphone/)).toHaveValue('');
  await expect(page.getByRole('combobox', { name: /Banque/ })).toContainText('CBAO');
  await expect(page.getByRole('combobox', { name: /Banque/ })).not.toContainText(
    'Choisir une banque',
  );
  await expect(page.getByRole('combobox', { name: /Syndicat/ })).not.toContainText(
    'Choisir un syndicat',
  );
  await expect(page.getByRole('combobox', { name: /Représentant/ })).toContainText(
    'Ibrahima Fixture',
  );

  const second = RAFALE[1];
  await page.getByLabel(/^Prénom/).fill(second.prenom);
  await page.getByLabel(/^Nom/).fill(second.nom);
  await page.getByLabel(/^Téléphone/).fill(second.saisie);
  await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

  await expect(page.getByText('2 prospects notés pour Ibrahima Fixture aujourd’hui')).toBeVisible();
});

test('un numéro déjà pris nomme la fiche existante', async ({ page }) => {
  const premier = RAFALE[0];

  await page.goto('/prospects/nouveau');
  await choisir(page, /Représentant/, 'Ibrahima Fixture', /Ibrahima Fixture/);
  await choisir(page, /Banque/, 'CBAO', /^CBAO/);
  await choisir(page, /Syndicat/, 'CHUES', /Union des Enseignants/);

  await page.getByLabel(/^Prénom/).fill('Doublon');
  await page.getByLabel(/^Nom/).fill('Refuse');
  await page.getByLabel(/^Téléphone/).fill(premier.saisie);
  await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

  /**
   * Le refus NOMME la fiche existante, et c'est ce qui le rend utilisable :
   * « ce numéro existe déjà » laisse le téléconseiller sans savoir s'il vient
   * de tomber sur son propre travail ou sur celui d'un collègue.
   */
  const refus = page.getByRole('alert').filter({ hasText: 'Ce numéro est déjà celui de' });
  await expect(refus).toContainText(
    `Ce numéro est déjà celui de ${premier.prenom} ${premier.nom}.`,
  );
  await expect(refus).toContainText('Ibrahima Fixture');
  await expect(refus.getByRole('link', { name: 'Ouvrir la fiche existante' })).toHaveAttribute(
    'href',
    `/prospects?search=${encodeURIComponent(premier.phone)}`,
  );

  // Rien n'a été écrit : la fiche refusée ne doit pas exister.
  await page.goto(`/prospects?search=${encodeURIComponent(premier.phone)}`);
  await expect(page.getByRole('row').filter({ hasText: 'Refuse' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: premier.nom })).toHaveCount(1);
});

test('la cascade région resserre la liste des départements', async ({ page }) => {
  await page.goto('/representants');
  await expect(page.getByRole('heading', { name: 'Représentants', level: 1 })).toBeVisible();

  const region = page.getByRole('combobox', { name: /Région/ });
  const departement = page.getByRole('combobox', { name: /Département/ });

  /**
   * Les options ouvertes, moins l'entrée « tout » en tête.
   *
   * Le texte est replié sur une seule ligne : une option porte son libellé ET
   * son indice sur des lignes distinctes, et deux relevés du même département
   * doivent se comparer à l'identique.
   */
  async function optionsOuvertes(): Promise<string[]> {
    const textes = await page.getByRole('option').allInnerTexts();
    return textes.slice(1).map((texte) => texte.replace(/\s+/gu, ' ').trim());
  }

  /** Le portail survit un instant à la fermeture : sans cette attente, deux listes. */
  async function refermee(): Promise<void> {
    await expect(page.getByRole('option')).toHaveCount(0);
  }

  await departement.click();
  const tous = await optionsOuvertes();
  expect(tous.length).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await refermee();

  // Visées par leur RANG : le nom accessible d'une option joint le libellé et
  // l'indice par une espace, là où son texte les sépare par un retour ligne.
  await region.click();
  expect((await optionsOuvertes()).length).toBeGreaterThan(1);
  await page.getByRole('option').nth(1).click();
  await refermee();

  await departement.click();
  const resserres = await optionsOuvertes();

  expect(resserres.length).toBeGreaterThan(0);
  expect(resserres.length).toBeLessThan(tous.length);
  // Aucun département inventé : la liste resserrée est une PARTIE de l'ancienne.
  expect(tous).toEqual(expect.arrayContaining(resserres));

  // Changer de région retire le département déjà choisi : le laisser en place
  // produirait un filtre qui ne peut rendre aucune ligne.
  await page.getByRole('option').nth(1).click();
  await refermee();
  await expect(departement).not.toContainText('Tous les départements');

  await region.click();
  await page.getByRole('option').nth(2).click();
  await refermee();
  await expect(departement).toContainText('Tous les départements');
});
