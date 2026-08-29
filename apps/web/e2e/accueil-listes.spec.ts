import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * `/accueil/listes`, les quatre listes du registre, vues par la DIRECTION
 * (`fixture.direction@cpi.sn`). ACC-LST-01 à ACC-LST-12.
 *
 * Données : UNE entrée d'entreprise, code `E2E_ACC_LST_<RUN>_ENT`, libellé
 * `E2E ACC LST <RUN> …`. Une entrée de référentiel ne se supprime pas : d'où le
 * `RUN` horodaté (§5.1), et la désactivation en fin de parcours — qui est
 * précisément ce que joue ACC-LST-10.
 *
 * Les entrées d'origine (`CPI`, `SANTARGILE`, `MAKE-UP ADDICTION`,
 * `COMMERCIALE`, `MME. NDOYE (RESP. COMM.)`, `AUTRE`, `SUIVI DE DOSSIER`,
 * `ACHAT TERRAIN`) ne sont ni renommées, ni désactivées, ni déplacées (§4.3.6) :
 * elles ne sont que LUES.
 */
test.use({ storageState: 'e2e/.auth/direction.json' });
test.describe.configure({ mode: 'serial' });

const ROUTE = '/accueil/listes';
const RUN = String(Date.now()).slice(-8);
const CODE = `E2E_ACC_LST_${RUN}_ENT`;
const LIBELLE = `E2E ACC LST ${RUN} Entreprise`;
const LIBELLE_BIS = `${LIBELLE} bis`;
const RECHERCHE = `e2e acc lst ${RUN}`;

/**
 * Un message de Sonner 2.0.8 ne porte AUCUN rôle : `getByRole('status')` ne le
 * trouve jamais. Le seul repère stable est la région annoncée du `Toaster`
 * (`<section aria-live="polite" aria-label="Notifications …">`).
 */
const toast = (page: Page, texte: string) =>
  page.getByRole('region', { name: /^Notifications/ }).getByText(texte, { exact: true });

/**
 * Clique et attend LA RÉPONSE du serveur, pas un délai.
 *
 * Un toast de Sonner ne vit que quelques secondes : sous charge, l'API a déjà
 * répondu et le message s'est éteint avant qu'une attente aveugle ne le
 * cherche. On se cale donc sur la requête, puis on lit le message.
 */
async function enregistrer(
  page: Page,
  bouton: Locator,
  correspond: (methode: string, url: string) => boolean,
): Promise<number> {
  const [reponse] = await Promise.all([
    page.waitForResponse((candidate) =>
      correspond(candidate.request().method(), candidate.url()),
    ),
    bouton.click(),
  ]);
  return reponse.status();
}

const CREATION = (methode: string, url: string): boolean =>
  methode === 'POST' && url.endsWith('/api/v1/visites/referentiels/entreprises');

/** Les libellés de la liste, DANS L'ORDRE : chaque ligne porte son « Modifier … ». */
async function libellesDansLOrdre(page: Page): Promise<string[]> {
  return page
    .getByRole('button', { name: /^Modifier / })
    .evaluateAll((boutons) =>
      boutons.map((bouton) => (bouton.getAttribute('aria-label') ?? '').replace(/^Modifier /u, '')),
    );
}

test('ACC-LST-01 l’écran ouvre sur les entreprises', async ({ page }) => {
  await page.goto(ROUTE);

  await expect(page).toHaveTitle(/Listes du registre des visites/);
  await expect(
    page.getByText(
      'Les quatre listes proposées à la saisie du registre. Une entrée retirée reste lisible sur ' +
        'les visites déjà enregistrées, et disparaît de la saisie.',
      { exact: true },
    ),
  ).toBeVisible();

  for (const onglet of ['Entreprises', 'Directions', 'Destinataires', 'Objets de visite'] as const) {
    await expect(
      page.getByRole('tab', { name: onglet }),
      `l’onglet « ${onglet} » doit être proposé`,
    ).toBeVisible();
  }
  await expect(page.getByRole('tab', { name: 'Entreprises' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await expect(page.getByRole('heading', { level: 2, name: 'Entreprises' })).toBeVisible();
  await expect(page.getByText('La société ou l’organisme visité.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouvelle entreprise' })).toBeVisible();
});

for (const onglet of [
  {
    nom: 'Entreprises',
    url: /\/accueil\/listes$/,
    bouton: 'Nouvelle entreprise',
    description: 'La société ou l’organisme visité.',
  },
  {
    nom: 'Directions',
    url: /\/accueil\/listes\?onglet=directions$/,
    bouton: 'Nouvelle direction',
    description: 'Le service concerné par la visite, quand il est connu.',
  },
  {
    nom: 'Destinataires',
    url: /\/accueil\/listes\?onglet=destinataires$/,
    bouton: 'Nouveau destinataire',
    description: 'La personne demandée par le visiteur.',
  },
  {
    nom: 'Objets de visite',
    url: /\/accueil\/listes\?onglet=objets$/,
    bouton: 'Nouvel objet',
    description: 'Le motif de la visite.',
  },
] as const) {
  test(`ACC-LST-02 l’onglet « ${onglet.nom} » écrit l’URL et accorde ses libellés`, async ({
    page,
  }) => {
    // On part d'un AUTRE onglet : cliquer celui déjà choisi ne prouverait pas
    // que le choix s'écrit dans l'URL.
    await page.goto(`${ROUTE}?onglet=${onglet.nom === 'Objets de visite' ? 'directions' : 'objets'}`);
    await page.getByRole('tab', { name: onglet.nom }).click();

    await expect(page, `« ${onglet.nom} » doit écrire son onglet dans l’URL`).toHaveURL(onglet.url);
    await expect(page.getByRole('button', { name: onglet.bouton, exact: true })).toBeVisible();
    await expect(page.getByText(onglet.description, { exact: true })).toBeVisible();
  });
}

test('ACC-LST-03 créer une entrée : le code est obligatoire et normalisé', async ({ page }) => {
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() === 'POST' && requete.url().includes('/api/v1/visites/referentiels')) {
      envois.push(requete.url());
    }
  });

  await page.goto(ROUTE);
  await page.getByRole('button', { name: 'Nouvelle entreprise' }).click();

  const dialogue = page.getByRole('dialog', { name: 'Nouvelle entreprise' });
  await expect(dialogue).toBeVisible();
  await expect(
    dialogue.getByText('Le code est définitif, utile pour l’export.', { exact: true }),
  ).toBeVisible();

  await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(dialogue.getByText('Le code est obligatoire.', { exact: true })).toBeVisible();
  await expect(dialogue.getByText('Le libellé est obligatoire.', { exact: true })).toBeVisible();
  expect(envois, 'un formulaire vide ne part pas au serveur').toEqual([]);

  // Saisi en MINUSCULES : c'est le schéma qui met en majuscules, et l'API
  // refuserait le reste en 400 sur `CODE_PATTERN`.
  await dialogue.getByLabel(/^Code/).fill(CODE.toLowerCase());
  await dialogue.getByLabel(/^Libellé/).fill(LIBELLE);
  const statut = await enregistrer(
    page,
    dialogue.getByRole('button', { name: 'Enregistrer' }),
    CREATION,
  );
  expect(statut, 'la création doit aboutir en 201').toBe(201);

  await expect(toast(page, `${LIBELLE} ajouté.`)).toBeVisible();
  await expect(dialogue).toHaveCount(0);
  await expect(page.getByText(`Code ${CODE}`, { exact: false })).toHaveCount(1);
});

test('ACC-LST-04 un code invalide est refusé avec sa règle', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: 'Nouvelle entreprise' }).click();

  const dialogue = page.getByRole('dialog', { name: 'Nouvelle entreprise' });
  await dialogue.getByLabel(/^Code/).fill('E2E-ACC');
  await dialogue.getByLabel(/^Libellé/).fill(`E2E ACC LST ${RUN} Refusée`);
  await dialogue.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(
    dialogue.getByText('Majuscules, chiffres et tirets bas seulement.', { exact: true }),
  ).toBeVisible();

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialogue).toHaveCount(0);
});

test('ACC-LST-05 un code déjà pris est signalé par un message, pas par un silence', async ({
  page,
}) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: 'Nouvelle entreprise' }).click();

  const dialogue = page.getByRole('dialog', { name: 'Nouvelle entreprise' });
  await dialogue.getByLabel(/^Code/).fill(CODE);
  await dialogue.getByLabel(/^Libellé/).fill(`E2E ACC LST ${RUN} Doublon`);
  const statut = await enregistrer(
    page,
    dialogue.getByRole('button', { name: 'Enregistrer' }),
    CREATION,
  );
  expect(statut, 'un code déjà pris se refuse en 409').toBe(409);

  await expect(
    toast(page, `Le code « ${CODE} » est déjà porté par « ${LIBELLE} ».`),
    'le 409 VISITE_REFERENTIEL_CODE_CONFLICT doit être rendu, pas avalé en succès',
  ).toBeVisible();
  await expect(dialogue, 'le dialogue reste ouvert : la saisie n’est pas perdue').toBeVisible();

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByText(`Code ${CODE}`, { exact: false })).toHaveCount(1);
});

test('ACC-LST-06 renommer une entrée sans toucher au code', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: `Modifier ${LIBELLE}` }).click();

  const dialogue = page.getByRole('dialog', { name: `Renommer « ${LIBELLE} »` });
  await expect(dialogue).toBeVisible();
  await expect(
    dialogue.getByText('Le code reste inchangé : les visites déjà enregistrées le désignent.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialogue.getByLabel(/^Code/),
    'le code est définitif : les visites enregistrées le désignent',
  ).toHaveCount(0);

  await dialogue.getByLabel(/^Libellé/).fill(LIBELLE_BIS);
  const statut = await enregistrer(
    page,
    dialogue.getByRole('button', { name: 'Enregistrer' }),
    (methode, url) => methode === 'PATCH' && url.includes('/visites/referentiels/entreprises/'),
  );
  expect(statut, 'le renommage doit aboutir en 200').toBe(200);

  await expect(toast(page, `${LIBELLE_BIS} enregistré.`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Modifier ${LIBELLE_BIS}` })).toBeVisible();
  await expect(page.getByText(`Code ${CODE}`, { exact: false })).toHaveCount(1);
});

test('ACC-LST-07 la recherche filtre sans accent ni casse', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByLabel('Rechercher').fill(RECHERCHE);

  // `URLSearchParams` sérialise l'espace en `+`, jamais en `%20`.
  await expect(page).toHaveURL(new RegExp(`\\?recherche=${RECHERCHE.replaceAll(' ', '\\+')}$`));
  await expect(
    page.getByRole('button', { name: /^Modifier / }),
    'la recherche ne doit laisser que l’entrée du test',
  ).toHaveCount(1);
  await expect(page.getByRole('button', { name: `Modifier ${LIBELLE_BIS}` })).toBeVisible();

  await page.getByLabel('Rechercher').fill(`${RECHERCHE} introuvable`);
  await expect(
    page.getByText('Aucune entrée ne correspond à cette recherche.', { exact: true }),
  ).toBeVisible();

  // L'accent, sur une entrée d'origine LUE et non modifiée : « comptabilité »
  // doit retrouver « FINANCE & COMPTABILITE ».
  await page.goto(`${ROUTE}?onglet=directions`);
  await page.getByLabel('Rechercher').fill('comptabilité');
  await expect(page.getByRole('button', { name: 'Modifier FINANCE & COMPTABILITE' })).toBeVisible();
});

test('ACC-LST-08 la recherche désactive le glisser-déposer', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByLabel('Rechercher').fill(RECHERCHE);
  await expect(page.getByRole('button', { name: `Modifier ${LIBELLE_BIS}` })).toBeVisible();

  await expect(
    page.getByRole('button', { name: `Réordonner ${LIBELLE_BIS} par glisser-déposer` }),
    'réordonner une liste filtrée enregistrerait un ordre qu’on ne voit pas',
  ).toBeDisabled();
});

test('ACC-LST-09 monter et descendre une entrée au clavier', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.getByRole('button', { name: `Modifier ${LIBELLE_BIS}` })).toBeVisible();

  const ordreInitial = await libellesDansLOrdre(page);
  const rang = ordreInitial.indexOf(LIBELLE_BIS);
  expect(rang, 'l’entrée du test doit avoir une voisine au-dessus d’elle').toBeGreaterThan(0);

  const monte = [...ordreInitial];
  const [deplacee] = monte.splice(rang, 1);
  monte.splice(rang - 1, 0, deplacee ?? LIBELLE_BIS);

  await page.getByRole('button', { name: `Monter ${LIBELLE_BIS}` }).click();
  await expect
    .poll(() => libellesDansLOrdre(page), {
      message:
        'l’entrée doit passer devant sa voisine ; observé : POST …/reorder répond 400 ' +
        '« each value in ids must be a UUID » (dto.ts `@IsUUID(\'4\')` contre des identifiants v7)',
    })
    .toEqual(monte);

  await page.reload();
  await expect
    .poll(
      () => libellesDansLOrdre(page),
      { message: 'l’ordre doit être persisté par l’API `reorder`, pas seulement à l’écran' },
    )
    .toEqual(monte);

  await expect(page.getByRole('button', { name: `Monter ${monte[0] ?? ''}` })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: `Descendre ${monte[monte.length - 1] ?? ''}` }),
  ).toBeDisabled();

  // La liste est rendue à l'ordre trouvé : elle est partagée (§4.4.6).
  await page.getByRole('button', { name: `Descendre ${LIBELLE_BIS}` }).click();
  await expect.poll(() => libellesDansLOrdre(page)).toEqual(ordreInitial);
});

// ACC-LST-11 n'est pas jouable en navigateur : le décompte est préchargé côté
// serveur (`listes/page.tsx`) et hydraté, aucune requête à couper (E2E.md §7.3.4).

test('ACC-LST-10 désactiver une entrée exige le décompte et le montre', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('button', { name: `Désactiver ${LIBELLE_BIS}` }).click();

  const dialogue = page.getByRole('dialog', { name: `Désactiver « ${LIBELLE_BIS} » ?` });
  await expect(dialogue).toBeVisible();
  await expect(
    dialogue.getByText('Retirée des listes de saisie. Reste disponible en filtre et en export.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialogue.getByText('0 visite référence cette entreprise.', { exact: true }),
  ).toBeVisible();
  await expect(dialogue).toContainText('Aucune visite n’est supprimée.');
  await expect(dialogue.getByRole('button', { name: 'Annuler' })).toBeVisible();

  const statut = await enregistrer(
    page,
    dialogue.getByRole('button', { name: 'Désactiver', exact: true }),
    (methode, url) => methode === 'POST' && url.endsWith('/active'),
  );
  expect(statut, 'la désactivation doit aboutir en 200 ou 201').toBeLessThan(300);

  await expect(toast(page, `${LIBELLE_BIS} désactivé.`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Réactiver ${LIBELLE_BIS}` })).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: LIBELLE_BIS }).getByText('Retirée', { exact: true }),
  ).toHaveCount(1);
});

test('ACC-LST-12 une entrée retirée disparaît de la saisie mais reste lisible', async ({ page }) => {
  await page.goto('/accueil');
  await page.getByRole('button', { name: 'Ajouter une visite' }).click();

  const saisie = page.getByRole('dialog', { name: 'Enregistrer une visite' });
  await saisie.getByRole('combobox', { name: /^ENTREPRISE/ }).click();

  // Le menu est bien peuplé : sans ce repère, un compte de 0 ne prouverait rien.
  await expect(page.getByRole('option', { name: 'CPI', exact: true })).toBeVisible();
  await expect(
    page.getByRole('option', { name: LIBELLE_BIS, exact: true }),
    'une entrée retirée ne doit plus être proposée à la saisie',
  ).toHaveCount(0);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(saisie).toHaveCount(0);

  await page.getByRole('button', { name: 'Rechercher et filtrer' }).click();
  const avances = page.getByRole('button', { name: 'Filtres avancés' });
  if ((await avances.getAttribute('aria-expanded')) !== 'true') await avances.click();
  await expect(avances).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('combobox', { name: /^ENTREPRISE/ }).click();
  await expect(page.getByRole('option', { name: 'CPI', exact: true })).toBeVisible();

  // Q-05, relevé en navigateur : le filtre tire le MÊME
  // `GET /visites/referentiels` avec `activeOnly=true`, donc l'entrée retirée
  // disparaît AUSSI du filtre — ce que le dialogue de désactivation promet
  // pourtant de conserver (« Reste disponible en filtre et en export »).
  await expect(page.getByRole('option', { name: LIBELLE_BIS, exact: true })).toHaveCount(0);
});
