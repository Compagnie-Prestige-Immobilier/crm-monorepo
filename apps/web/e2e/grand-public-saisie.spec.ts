import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * GP-13 à GP-21 : la saisie d'un prospect Grand Public (`/grand-public/nouveau`).
 *
 * Écran : `apps/web/src/components/grand-public/prospect-form.tsx`, monté en
 * page pleine et en boîte depuis la liste.
 * Plage de téléphones réservée : `+221781002020` à `+221781002039` (E2E.md §5.2).
 * Préfixe de données : `E2E-GP-SAI`, porté par le prénom.
 */

test.use({ storageState: 'e2e/.auth/admin.json' });

const PREFIXE = 'E2E-GP-SAI';

const TEMOINS = {
  rafale: { nom: 'Temoin01', phone: '+221781002020', national: '781002020' },
  clavier: { nom: 'Temoin02', phone: '+221781002021', national: '781002021' },
  fiche: { nom: 'Temoin03', phone: '+221781002022', national: '781002022' },
  boite: { nom: 'Temoin04', phone: '+221781002023', national: '781002023' },
  accents: { nom: 'O’Brien', phone: '+221781002024', national: '781002024' },
  doublon: { nom: 'Temoin05', phone: '+221781002025', national: '781002025' },
} as const;

const CANAL = 'TikTok';
const DUREE = '5 ans (60 mois)';

interface Fiche {
  id: string;
  phoneE164: string;
  prenom: string;
  nom: string;
}

async function lire<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

/** Compte les fiches vivantes portant ce numéro, après le geste navigateur. */
async function fichesSurLeNumero(phone: string): Promise<Fiche[]> {
  const api = await adminApi();
  try {
    const trouves = await lire<{ items: Fiche[] }>(
      await api.get('/api/v1/prospects', { params: { search: phone, pageSize: '50' } }),
    );
    return trouves.items.filter((fiche) => fiche.phoneE164 === phone);
  } finally {
    await api.dispose();
  }
}

/** Nettoyage EN DÉBUT de parcours (E2E.md §5.1) : le reliquat d'un échec sert au diagnostic. */
test.beforeAll(async () => {
  const api = await adminApi();
  try {
    const trouves = await lire<{ items: Fiche[] }>(
      await api.get('/api/v1/prospects', { params: { search: PREFIXE, pageSize: '100' } }),
    );
    for (const fiche of trouves.items) {
      if (fiche.prenom.startsWith(PREFIXE)) await api.delete(`/api/v1/prospects/${fiche.id}`);
    }
  } finally {
    await api.dispose();
  }
});

function champs(portee: Page | Locator) {
  return {
    prenom: portee.getByRole('textbox', { name: /^Prénom/u }),
    nom: portee.getByRole('textbox', { name: /^Nom/u }),
    telephone: portee.getByRole('textbox', { name: /^Téléphone/u }),
  };
}

async function saisirIdentite(
  page: Page,
  identite: { prenom: string; nom: string; national: string },
): Promise<void> {
  const { prenom, nom, telephone } = champs(page);
  await prenom.fill(identite.prenom);
  await nom.fill(identite.nom);
  await telephone.fill(identite.national);
}

test('GP-13 la saisie minimale enchaîne en gardant le canal et la durée', async ({ page }) => {
  await page.goto('/grand-public/nouveau');

  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.rafale });

  await page.getByRole('combobox', { name: /^Canal de provenance/u }).click();
  await page.getByRole('option', { name: CANAL, exact: true }).click();

  await page.getByRole('combobox', { name: 'Paiement' }).click();
  await page.getByRole('option', { name: 'Échelonné', exact: true }).click();
  await page.getByRole('combobox', { name: 'Durée de remboursement' }).click();
  await page.getByRole('option', { name: DUREE, exact: true }).click();

  await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();

  await expect(page.getByText(`${PREFIXE} ${TEMOINS.rafale.nom} enregistré.`)).toBeVisible();
  await expect(
    page.getByText(`1 prospect enregistré. Dernier : ${PREFIXE} ${TEMOINS.rafale.nom}.`),
  ).toBeVisible();

  const { prenom, nom, telephone } = champs(page);
  await expect(prenom).toHaveValue('');
  await expect(nom).toHaveValue('');
  await expect(telephone).toHaveValue('');

  // Ce que l'aide promet : « Le canal et la durée restent en place. »
  await expect(page.getByRole('combobox', { name: `Canal de provenance ${CANAL}` })).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Durée de remboursement' }),
    'la durée doit rester en place entre deux saisies en rafale',
  ).toBeVisible();
});

test('GP-15 un numéro déjà pris est refusé en nommant la fiche existante', async ({ page }) => {
  /**
   * Le scénario « rejoue GP-13 » : les deux saisies se font ICI, sur un numéro
   * propre à ce test. Les enchaîner dans un `serial` avec GP-13 ferait sauter
   * ce scénario dès que GP-13 est rouge, et masquerait ce qu'il éprouve.
   */
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.doublon });
  await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();
  const succes = page.getByText(`${PREFIXE} ${TEMOINS.doublon.nom} enregistré.`);
  await expect(succes).toBeVisible();
  // Le toast de Sonner se pose SUR les deux boutons d'enregistrement, et il
  // reste ouvert tant que le pointeur le survole — c'est-à-dire là où le clic
  // vient de le laisser. On écarte le pointeur, puis on attend la disparition :
  // une condition, jamais un délai fixe.
  await page.mouse.move(0, 0);
  await expect(succes).toBeHidden();

  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.doublon });
  await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();

  const refus = page.getByRole('alert').filter({ hasText: 'Ce numéro est déjà celui de' });
  await expect(refus).toBeVisible();
  await expect(refus).toContainText(
    `Ce numéro est déjà celui de ${PREFIXE} ${TEMOINS.doublon.nom}.`,
  );
  await expect(
    page.getByRole('link', { name: 'Chercher cette fiche dans le Grand Public' }),
  ).toBeVisible();

  // Aucune seconde fiche : l'écran ne le montre pas, l'API le prouve.
  expect(await fichesSurLeNumero(TEMOINS.doublon.phone)).toHaveLength(1);
});

test('GP-14 un formulaire vide ne part pas au serveur', async ({ page }) => {
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() === 'POST' && requete.url().includes('/api/v1/prospects')) {
      envois.push(requete.url());
    }
  });

  await page.goto('/grand-public/nouveau');
  await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();

  await expect(page.getByText('Le prénom est obligatoire.')).toBeVisible();
  await expect(page.getByText('Le nom est obligatoire.')).toBeVisible();
  await expect(page.getByText('Le numéro est obligatoire.')).toBeVisible();

  expect(envois, 'aucune création ne doit partir sans nom ni téléphone').toEqual([]);
});

test('GP-16 Ctrl + Entrée enregistre et enchaîne', async ({ page }) => {
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.clavier });

  await page.keyboard.press('Control+Enter');

  await expect(page.getByText(`${PREFIXE} ${TEMOINS.clavier.nom} enregistré.`)).toBeVisible();
  await expect(
    page.getByText(`1 prospect enregistré. Dernier : ${PREFIXE} ${TEMOINS.clavier.nom}.`),
  ).toBeVisible();
  await expect(champs(page).prenom).toHaveValue('');
  await expect(champs(page).nom).toHaveValue('');
});

test('GP-17 « Enregistrer et ouvrir la fiche » ouvre la fiche créée', async ({ page }) => {
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.fiche });

  await page.getByRole('button', { name: 'Enregistrer et ouvrir la fiche' }).click();

  await page.waitForURL(/\/grand-public\/[0-9a-f-]{36}$/);
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { name: `${PREFIXE} ${TEMOINS.fiche.nom}`, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '+221 78 100 20 22' })).toHaveAttribute(
    'href',
    `tel:${TEMOINS.fiche.phone}`,
  );
});

test('GP-18 la boîte de la liste rafraîchit le tableau sans rechargement', async ({ page }) => {
  await page.goto('/grand-public');
  await page.getByRole('button', { name: 'Nouveau prospect' }).click();

  const boite = page.getByRole('dialog', { name: 'Nouveau prospect Grand Public' });
  await expect(boite).toBeVisible();
  await expect(
    boite.getByText('Le nom, le prénom et le téléphone suffisent.', { exact: true }),
  ).toBeVisible();

  const dansLaBoite = champs(boite);
  await dansLaBoite.prenom.fill(PREFIXE);
  await dansLaBoite.nom.fill(TEMOINS.boite.nom);
  await dansLaBoite.telephone.fill(TEMOINS.boite.national);
  await boite.getByRole('button', { name: 'Enregistrer et ouvrir la fiche' }).click();

  await expect(boite).toHaveCount(0);
  await expect(page).toHaveURL(/\/grand-public$/);
  await expect(
    page
      .getByRole('table')
      .getByRole('row')
      .filter({ hasText: `${PREFIXE} ${TEMOINS.boite.nom}` }),
  ).toHaveCount(1);
});

test('GP-19 les accents et l’apostrophe traversent la saisie sans se déformer', async ({
  page,
}) => {
  const prenom = `${PREFIXE} Ndèye-Awa`;
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom, ...TEMOINS.accents });

  await page.getByRole('button', { name: 'Enregistrer et ouvrir la fiche' }).click();

  await page.waitForURL(/\/grand-public\/[0-9a-f-]{36}$/);
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { name: `${prenom} ${TEMOINS.accents.nom}`, level: 1 }),
  ).toBeVisible();

  await page.goto(`/grand-public?search=${encodeURIComponent(TEMOINS.accents.phone)}`);
  await expect(
    page
      .getByRole('table')
      .getByRole('link', { name: `${prenom} ${TEMOINS.accents.nom} +221 78 100 20 24` }),
  ).toBeVisible();
});

test.describe('GP-20 refus de rôle', () => {
  test.use({ storageState: 'e2e/.auth/superviseur.json' });

  test('GP-20 un SUPERVISEUR ne peut pas ouvrir la saisie', async ({ page }) => {
    // §6.5 : l'écouteur est posé AVANT la navigation, pour distinguer « refus
    // affiché » de « données chargées puis refus posé par-dessus ».
    const metier: string[] = [];
    page.on('response', async (reponse) => {
      const chemin = new URL(reponse.url()).pathname;
      const cible =
        chemin.startsWith('/api/v1/prospects') || chemin.startsWith('/api/v1/referentiels');
      if (cible && reponse.status() < 400) metier.push(chemin);
    });

    await page.goto('/grand-public/nouveau');

    await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
    await expect(
      page.getByText(
        'La saisie d’un prospect Grand Public est réservé à un autre rôle. Rôle en cours : Supervision.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toBeVisible();

    expect(metier, 'un écran refusé ne doit charger aucune donnée métier').toEqual([]);
  });
});

test.describe('GP-21 largeur 375 px', () => {
  test.use({ viewport: { width: 375, height: 780 } });

  test('GP-21 le formulaire passe en une colonne et garde ses deux boutons', async ({ page }) => {
    await page.goto('/grand-public/nouveau');

    const { prenom, nom } = champs(page);
    const cadrePrenom = await prenom.boundingBox();
    const cadreNom = await nom.boundingBox();
    expect(cadrePrenom, 'le champ Prénom doit être rendu').not.toBeNull();
    expect(cadreNom, 'le champ Nom doit être rendu').not.toBeNull();
    expect(
      cadreNom!.y,
      'sous 640 px la grille sm:grid-cols-2 doit passer en une colonne',
    ).toBeGreaterThan(cadrePrenom!.y);

    for (const libelle of ['Enregistrer et ouvrir la fiche', 'Enregistrer et suivant']) {
      const bouton = page.getByRole('button', { name: libelle });
      await expect(bouton).toBeVisible();
      const cadre = await bouton.boundingBox();
      expect(cadre, `${libelle} doit être rendu`).not.toBeNull();
      expect(cadre!.x, `${libelle} déborde à gauche`).toBeGreaterThanOrEqual(0);
      expect(cadre!.x + cadre!.width, `${libelle} déborde à droite`).toBeLessThanOrEqual(375);
    }

    const document375 = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(document375, 'la page ne doit pas défiler latéralement').toBe(true);
  });
});
