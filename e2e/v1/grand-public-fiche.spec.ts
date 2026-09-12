import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * GP-22 à GP-28 : la fiche d'un prospect Grand Public (`/grand-public/[id]`).
 *
 * Écran : `apps/web/src/components/grand-public/prospect-detail.tsx`.
 * Plage de téléphones réservée : `+221781002040` à `+221781002059` (E2E.md §5.2).
 * Préfixe de données : `E2E-GP-FIC`, porté par le prénom.
 *
 * Les quatre fiches sont posées par l'API : aucun écran du périmètre ne pose
 * une fiche CHUES ni une fiche complète en un geste (E2E.md §6.7).
 */

test.use({ storageState: 'v1/.auth/admin.json' });

const PREFIXE = 'E2E-GP-FIC';

const FICHES = {
  complete: { nom: 'Complete', phone: '+221781002041', affiche: '+221 78 100 20 41' },
  minimale: { nom: 'Minimale', phone: '+221781002042', affiche: '+221 78 100 20 42' },
  parcours: { nom: 'Parcours', phone: '+221781002043', affiche: '+221 78 100 20 43' },
  chues: { nom: 'Chues', phone: '+221781002044', affiche: '+221 78 100 20 44' },
} as const;

const PROFESSION = 'Menuisière E2E-GP-FIC';
const CANAL = 'TikTok';

interface Fiche {
  id: string;
  phoneE164: string;
  prenom: string;
  nom: string;
  journeys: { projet: string; statut: string; consent: string | null }[];
}

const identifiants: Record<keyof typeof FICHES, string> = {
  complete: '',
  minimale: '',
  parcours: '',
  chues: '',
};

async function lire<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

function exige<T>(valeur: T | undefined, quoi: string): T {
  if (valeur === undefined) throw new Error(`${quoi} — la base est-elle amorcée ?`);
  return valeur;
}

async function relire(id: string): Promise<Fiche> {
  const api = await adminApi();
  try {
    return await lire<Fiche>(await api.get(`/api/v1/prospects/${id}`));
  } finally {
    await api.dispose();
  }
}

/** Nettoyage EN DÉBUT de parcours (E2E.md §5.1), puis pose des quatre fiches. */
test.beforeAll(async () => {
  const api = await adminApi();
  try {
    const trouves = await lire<{ items: Fiche[] }>(
      await api.get('/api/v1/prospects', { params: { search: PREFIXE, pageSize: '100' } }),
    );
    for (const fiche of trouves.items) {
      if (fiche.prenom.startsWith(PREFIXE)) await api.delete(`/api/v1/prospects/${fiche.id}`);
    }

    const banques = await lire<{ id: string; shortName: string }[]>(
      await api.get('/api/v1/referentiels/banques', { params: { activeOnly: 'false' } }),
    );
    const syndicats = await lire<{ id: string; sigle: string }[]>(
      await api.get('/api/v1/referentiels/syndicats', { params: { activeOnly: 'false' } }),
    );
    const canaux = await lire<{ id: string; label: string }[]>(
      await api.get('/api/v1/referentiels/canaux-provenance', { params: { activeOnly: 'false' } }),
    );

    const banque = exige(
      banques.find((ligne) => ligne.shortName === 'CBAO'),
      'Banque CBAO absente du référentiel',
    );
    const syndicat = exige(
      syndicats.find((ligne) => ligne.sigle === 'CHUES'),
      'Syndicat CHUES absent du référentiel',
    );
    const canal = exige(
      canaux.find((ligne) => ligne.label === CANAL),
      `Canal ${CANAL} absent du référentiel`,
    );

    const poser = async (
      cle: keyof typeof FICHES,
      supplement: Record<string, unknown>,
    ): Promise<void> => {
      const creee = await lire<{ id: string }>(
        await api.post('/api/v1/prospects', {
          data: {
            prenom: PREFIXE,
            nom: FICHES[cle].nom,
            phone: FICHES[cle].phone,
            ...supplement,
          },
        }),
      );
      identifiants[cle] = creee.id;
    };

    await poser('complete', {
      projet: 'GRAND_PUBLIC',
      type: 'FONCTIONNAIRE',
      profession: PROFESSION,
      canalProvenanceId: canal.id,
      banqueId: banque.id,
      syndicatId: syndicat.id,
      paymentMode: 'ECHELONNE',
      dureeSystemeMois: 60,
    });
    await poser('minimale', { projet: 'GRAND_PUBLIC' });
    await poser('parcours', { projet: 'GRAND_PUBLIC' });
    await poser('chues', { projet: 'CHUES' });
  } finally {
    await api.dispose();
  }
});

/** La valeur d'une ligne de fiche, liée à son libellé par la paire `dt` / `dd`. */
function valeur(page: Page, libelle: string) {
  return page
    .getByRole('term')
    .filter({ hasText: libelle })
    .locator('xpath=following-sibling::dd[1]');
}

function gestes(page: Page) {
  return {
    interesse: page.getByRole('button', { name: 'Intéressé' }),
    refuse: page.getByRole('button', { name: 'Refusé' }),
    conversion: page.getByRole('button', { name: 'Confirmer la conversion' }),
  };
}

test('GP-22 la fiche complète rend ses trois cartes et le statut de la liste', async ({ page }) => {
  await page.goto(`/grand-public?search=${encodeURIComponent(FICHES.complete.phone)}`);
  const ligne = page
    .getByRole('table')
    .getByRole('row')
    .filter({ hasText: `${PREFIXE} ${FICHES.complete.nom}` });
  await expect(ligne).toHaveCount(1);
  // Deuxième cellule : la colonne « Statut », deuxième des neuf en-têtes.
  const statutListe = (await ligne.getByRole('cell').nth(1).innerText()).trim();
  expect(statutListe.length).toBeGreaterThan(0);

  await page.goto(`/grand-public/${identifiants.complete}`);
  await expect(page).toHaveTitle(/Fiche Grand Public/);
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { name: `${PREFIXE} ${FICHES.complete.nom}`, level: 1 }),
  ).toBeVisible();

  for (const carte of ['Le prospect', 'Rattachements', 'Suivi']) {
    await expect(
      page.getByText(carte, { exact: true }),
      `la carte « ${carte} » devrait être rendue`,
    ).toBeVisible();
  }

  for (const [libelle, attendu] of [
    ['Situation', 'Fonctionnaire'],
    ['Profession', PROFESSION],
    ['Canal de provenance', CANAL],
    ['Durée du système', '5 ans (60 mois)'],
    ['Banque de domiciliation', 'CBAO'],
    ['Représentant', 'Sans représentant'],
    ['Téléconseiller', 'Administrateur CPI'],
  ] as const) {
    await expect(valeur(page, libelle), `${libelle} devrait valoir ${attendu}`).toContainText(
      attendu,
    );
  }
  await expect(valeur(page, 'Syndicat')).toContainText('CHUES');

  await expect(page.getByRole('link', { name: FICHES.complete.affiche })).toHaveAttribute(
    'href',
    `tel:${FICHES.complete.phone}`,
  );
  await expect(
    page.getByRole('main').getByText(statutListe, { exact: true }),
    'le badge de la fiche doit porter le statut annoncé par la liste',
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Appeler', exact: true }),
  ).toHaveAttribute('href', `/grand-public/appel/${identifiants.complete}`);
  await expect(page.getByRole('link', { name: 'Prospects Grand Public' })).toHaveAttribute(
    'href',
    '/grand-public',
  );
});

test('GP-23 chaque absence est nommée, jamais rendue par un tiret muet', async ({ page }) => {
  await page.goto(`/grand-public/${identifiants.minimale}`);

  await expect(valeur(page, 'Situation')).toHaveText('Question non posée');
  await expect(valeur(page, 'Durée du système')).toHaveText('Non renseignée');
  await expect(valeur(page, 'Segment')).toContainText('Aucun');
  await expect(valeur(page, 'Dernier appel')).toHaveText('Jamais appelé');
});

test.describe('consentement puis conversion, sur une même fiche', () => {
  /** GP-25 reprend la fiche que GP-24 a laissée : les deux se suivent. */
  test.describe.configure({ mode: 'serial' });

  test('GP-24 le consentement bascule et retire la conversion quand il refuse', async ({
    page,
  }) => {
    await page.goto(`/grand-public/${identifiants.parcours}`);
    const { interesse, refuse, conversion } = gestes(page);

    // `POST /prospects` ouvre déjà le parcours Grand Public sur INTERESSE : le
    // scénario éprouve la BASCULE, pas l'état de départ.
    await interesse.click();

    await expect(page.getByText('Consentement enregistré.')).toBeVisible();
    await expect(conversion).toBeVisible();

    await refuse.click();
    await expect(conversion).toHaveCount(0);

    const relue = await relire(identifiants.parcours);
    expect(
      relue.journeys.find((parcours) => parcours.projet === 'GRAND_PUBLIC')?.consent,
      'le refus doit être écrit en base, pas seulement à l’écran',
    ).toBe('REFUSE');
  });

  test('GP-25 la conversion fige la fiche et retire les gestes de consentement', async ({
    page,
  }) => {
    await page.goto(`/grand-public/${identifiants.parcours}`);
    const { interesse, refuse, conversion } = gestes(page);

    await interesse.click();
    await expect(conversion).toBeVisible();
    await conversion.click();

    const boite = page.getByRole('dialog', { name: 'Confirmer la conversion' });
    await expect(boite).toBeVisible();
    await boite.getByRole('combobox', { name: 'Offre' }).click();
    await page.getByRole('option', { name: 'Adhésion', exact: true }).click();
    await boite.getByRole('button', { name: 'Confirmer la conversion', exact: true }).click();

    await expect(page.getByText('Conversion confirmée.')).toBeVisible();
    await expect(page.getByRole('main').getByText('Converti', { exact: true })).toBeVisible();
    await expect(interesse).toHaveCount(0);
    await expect(refuse).toHaveCount(0);
    await expect(conversion).toHaveCount(0);
  });
});

test('GP-26 une fiche CHUES ouverte ici renvoie vers son propre suivi', async ({ page }) => {
  await page.goto(`/grand-public/${identifiants.chues}`);

  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { name: 'Cette fiche relève du projet CHUES', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Les deux projets ne partagent aucun écran. Elle se consulte depuis le suivi CHUES.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ouvrir le suivi CHUES' })).toHaveAttribute(
    'href',
    '/chues/prospects',
  );

  const { interesse, refuse, conversion } = gestes(page);
  await expect(interesse).toHaveCount(0);
  await expect(refuse).toHaveCount(0);
  await expect(conversion).toHaveCount(0);
});

test('GP-27 un identifiant invalide rend l’état d’erreur annoncé par la page', async ({ page }) => {
  await page.goto('/grand-public/pas-un-uuid');

  await expect(
    page.getByRole('heading', { name: 'Page introuvable', level: 1 }),
    'un identifiant mal formé est une fiche introuvable, pas une panne',
  ).toBeVisible();
  await expect(page.getByText('Cette adresse ne correspond à aucun écran du panel.')).toBeVisible();
});

test.describe('GP-28 rôle lecteur', () => {
  test.use({ storageState: 'v1/.auth/superviseur.json' });

  test('GP-28 un SUPERVISEUR lit la fiche sans se voir proposer de geste', async ({ page }) => {
    await page.goto(`/grand-public/${identifiants.complete}`);

    await expect(
      page
        .getByRole('main')
        .getByRole('heading', { name: `${PREFIXE} ${FICHES.complete.nom}`, level: 1 }),
    ).toBeVisible();
    await expect(valeur(page, 'Situation')).toHaveText('Fonctionnaire');

    const { interesse, refuse, conversion } = gestes(page);
    await expect(interesse).toHaveCount(0);
    await expect(refuse).toHaveCount(0);
    await expect(conversion).toHaveCount(0);
  });
});
