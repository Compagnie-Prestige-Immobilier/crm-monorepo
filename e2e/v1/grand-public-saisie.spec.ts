import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * GP-13 à GP-21 : la saisie d'un prospect Grand Public (`/grand-public/nouveau`).
 *
 * Écran : `web/src/components/grand-public/nouveau-prospect.tsx`, le formulaire
 * « joignable » de la page d'appel, vierge. Monté en page pleine et en boîte
 * depuis la liste.
 * Plage de téléphones réservée : `+221781002020` à `+221781002039` (E2E.md §5.2).
 * Préfixe de données : `E2E-GP-SAI`, porté par le prénom.
 */

test.use({ storageState: 'v1/.auth/admin.json' });

const PREFIXE = 'E2E-GP-SAI';

const TEMOINS = {
  seule: { nom: 'Temoin01', phone: '+221781002020', national: '781002020' },
  refus: { nom: 'Temoin02', phone: '+221781002021', national: '781002021' },
  rappel: { nom: 'Temoin03', phone: '+221781002022', national: '781002022' },
  boite: { nom: 'Temoin04', phone: '+221781002023', national: '781002023' },
  accents: { nom: 'O’Brien', phone: '+221781002024', national: '781002024' },
  doublon: { nom: 'Temoin05', phone: '+221781002025', national: '781002025' },
} as const;

interface Fiche {
  id: string;
  phoneE164: string;
  prenom: string;
  nom: string;
  phase2Status: string;
  lastOutcome: string | null;
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
  portee: Page | Locator,
  identite: { prenom: string; nom: string; national: string },
): Promise<void> {
  const { prenom, nom, telephone } = champs(portee);
  await prenom.fill(identite.prenom);
  await nom.fill(identite.nom);
  await telephone.fill(identite.national);
}

/** La saisie se fait en trois étapes : les gestes d'envoi vivent sur la dernière. */
async function allerAuxRevenus(portee: Page | Locator): Promise<void> {
  const continuer = portee.getByRole('button', { name: 'Continuer', exact: true });
  await continuer.click();
  await continuer.click();
}

async function uneSeuleFiche(phone: string): Promise<Fiche> {
  const fiches = await fichesSurLeNumero(phone);
  expect(fiches, `une seule fiche doit porter ${phone}`).toHaveLength(1);
  return fiches[0]!;
}

test('GP-13 sans statut, la fiche se crée seule, sans appel', async ({ page }) => {
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.seule });
  await allerAuxRevenus(page);

  await page.getByRole('button', { name: 'Enregistrer sans appel' }).click();

  await expect(page.getByText(`${PREFIXE} ${TEMOINS.seule.nom} enregistré.`)).toBeVisible();
  await expect(page).toHaveURL(/\/grand-public$/u);

  const fiche = await uneSeuleFiche(TEMOINS.seule.phone);
  expect(fiche.lastOutcome, 'sans statut, aucun appel ne doit être consigné').toBeNull();
  expect(fiche.phase2Status).toBe('PENDING');
});

test('GP-15 un numéro déjà pris est refusé en nommant la fiche existante', async ({ page }) => {
  // Les deux saisies se font ICI, sur un numéro propre à ce test : enchaîné
  // derrière GP-13, ce scénario sauterait dès que GP-13 rougit.
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.doublon });
  await allerAuxRevenus(page);
  await page.getByRole('button', { name: 'Enregistrer sans appel' }).click();
  await expect(page).toHaveURL(/\/grand-public$/u);

  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.doublon });
  await allerAuxRevenus(page);
  await page.getByRole('button', { name: 'Enregistrer sans appel' }).click();

  await expect(
    page.getByRole('alert').filter({
      hasText: `Ce numéro est déjà enregistré pour ${PREFIXE} ${TEMOINS.doublon.nom}.`,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/grand-public\/nouveau$/u);

  // Aucune seconde fiche : l'écran ne le montre pas, l'API le prouve.
  await uneSeuleFiche(TEMOINS.doublon.phone);
});

test('GP-14 un formulaire vide ne part pas au serveur', async ({ page }) => {
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() === 'POST' && requete.url().includes('/api/v1/prospects')) {
      envois.push(requete.url());
    }
  });

  await page.goto('/grand-public/nouveau');
  await allerAuxRevenus(page);
  await page.getByRole('button', { name: 'Enregistrer sans appel' }).click();

  await expect(page.getByText('Le nom est obligatoire.')).toBeVisible();
  await expect(page.getByText('Le numéro est obligatoire.')).toBeVisible();

  expect(envois, 'aucune création ne doit partir sans nom ni téléphone').toEqual([]);
});

test('GP-16 « Il refuse » crée la fiche puis consigne le refus', async ({ page }) => {
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.refus });
  await allerAuxRevenus(page);

  await page.getByRole('button', { name: 'Il refuse', exact: true }).click();

  await expect(
    page.getByText(`Appel enregistré pour ${PREFIXE} ${TEMOINS.refus.nom}.`),
  ).toBeVisible();
  const fiche = await uneSeuleFiche(TEMOINS.refus.phone);
  expect(fiche.phase2Status, 'le refus doit clore la fiche créée').toBe('REFUSED');
});

test('GP-17 « À rappeler » crée la fiche et pose l’échéance choisie', async ({ page }) => {
  await page.goto('/grand-public/nouveau');
  await saisirIdentite(page, { prenom: PREFIXE, ...TEMOINS.rappel });
  await allerAuxRevenus(page);

  await page.getByRole('button', { name: 'À rappeler', exact: true }).click();
  await page.getByRole('button', { name: /Dans 1 h/u }).click();

  await expect(
    page.getByText(`Appel enregistré pour ${PREFIXE} ${TEMOINS.rappel.nom}.`),
  ).toBeVisible();
  const fiche = await uneSeuleFiche(TEMOINS.rappel.phone);
  expect(fiche.lastOutcome).toBe('CALLBACK');
  expect(fiche.phase2Status, 'un rappel laisse la fiche ouverte').toBe('PENDING');
});

test('GP-18 la boîte de la liste rafraîchit le tableau sans rechargement', async ({ page }) => {
  await page.goto('/grand-public');
  await page.getByRole('button', { name: 'Nouveau prospect' }).first().click();

  const boite = page.getByRole('dialog', { name: 'Nouveau prospect Grand Public' });
  await expect(boite).toBeVisible();
  await expect(boite.getByText('Le nom et le téléphone suffisent.', { exact: true })).toBeVisible();

  await saisirIdentite(boite, { prenom: PREFIXE, ...TEMOINS.boite });
  await allerAuxRevenus(boite);
  await boite.getByRole('button', { name: 'Enregistrer sans appel' }).click();

  await expect(boite).toHaveCount(0);
  await expect(page).toHaveURL(/\/grand-public$/u);
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
  await allerAuxRevenus(page);

  await page.getByRole('button', { name: 'Enregistrer sans appel' }).click();
  await expect(page).toHaveURL(/\/grand-public$/u);

  const fiche = await uneSeuleFiche(TEMOINS.accents.phone);
  expect(fiche.prenom).toBe(prenom);
  expect(fiche.nom).toBe(TEMOINS.accents.nom);

  await page.goto(`/grand-public?search=${encodeURIComponent(TEMOINS.accents.phone)}`);
  await expect(
    page
      .getByRole('table')
      .getByRole('link', { name: `${prenom} ${TEMOINS.accents.nom} +221 78 100 20 24` }),
  ).toBeVisible();
});

test.describe('GP-20 refus de rôle', () => {
  test.use({ storageState: 'v1/.auth/superviseur.json' });

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

  test('GP-21 le formulaire passe en une colonne et garde ses boutons', async ({ page }) => {
    await page.goto('/grand-public/nouveau');

    const { prenom, nom } = champs(page);
    const cadreNom = await nom.boundingBox();
    const cadrePrenom = await prenom.boundingBox();
    expect(cadreNom, 'le champ Nom doit être rendu').not.toBeNull();
    expect(cadrePrenom, 'le champ Prénom doit être rendu').not.toBeNull();
    expect(
      cadrePrenom!.y,
      'sous 640 px la grille sm:grid-cols-2 doit passer en une colonne',
    ).toBeGreaterThan(cadreNom!.y);

    await allerAuxRevenus(page);

    for (const libelle of [
      'Enregistrer l’adhésion',
      'Il refuse',
      'À rappeler',
      'Enregistrer sans appel',
    ]) {
      const bouton = page.getByRole('button', { name: libelle, exact: true });
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
