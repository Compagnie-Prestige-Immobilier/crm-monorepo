import { readFile, stat } from 'node:fs/promises';

import {
  expect,
  request,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

import { adminApi, supprimerProspects } from './fixtures';

/**
 * `/chues/prospects` vu par un TÉLÉCONSEILLER (`fixture.awa@cpi.sn`).
 * CHU-PRO-01, 04, 05, 06, 08.
 *
 * Le filtrage par statut, l'URL, le rechargement et l'export simple sont déjà
 * couverts par `prospects.spec.ts` et `workspaces.spec.ts` : ni l'un ni l'autre
 * n'est réécrit ni modifié.
 *
 * Données : préfixe `E2E-CHUES-PRO `, plage `+221 78 100 44 0x` (§5.2). Les
 * fiches sont créées AVEC LA SESSION D'AWA, et non en admin : `chues-prospects
 * .commercial2.spec.ts` a besoin d'une fiche dont Awa est propriétaire.
 *
 * CHU-PRO-07 n'est pas écrit : la volumétrie exigée manque, voir le retour.
 */
test.use({ storageState: 'v1/.auth/commercial.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4000';

const PREFIXE = 'E2E-CHUES-PRO ';

/** Deux fiches BDD1 (syndicat CHUES × banque CBAO) : l'export filtré doit avoir de la matière. */
const FICHES = [
  { nom: `${PREFIXE}Awa Un`, prenom: 'Fiche', phone: '+221781004401' },
  { nom: `${PREFIXE}Awa Deux`, prenom: 'Fiche', phone: '+221781004402' },
] as const;

const RECHERCHE_INTROUVABLE = 'E2E-CHUES-PRO-INTROUVABLE';
const TERME_SPECIAL = "N'Diaye & Cie / 100 %";

/**
 * Relevé une fois : le numéro d'une fiche Grand Public. La recherche de la
 * liste porte sur le téléphone : chercher ce numéro dans l'écran CHUES doit
 * rendre zéro ligne, et la préparation vérifie que la même recherche SANS le
 * cloisonnement de projet la trouve — faute de quoi l'assertion ne prouverait
 * rien.
 */
let temoinGrandPublic = '';

const decompte = (page: Page) => page.getByRole('status').filter({ hasText: 'Prospects affichés' });

const recherche = (page: Page) => page.getByRole('textbox', { name: 'Recherche', exact: true });

const ligne = (page: Page, texte: string) =>
  page.getByRole('table').getByRole('row').filter({ hasText: texte });

async function json<T>(response: APIResponse): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

async function commercialApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: WEB_URL, storageState: 'v1/.auth/commercial.json' });
}

interface FicheEnBase {
  readonly id: string;
  readonly nom: string;
  readonly phoneE164: string;
  readonly segment: string | null;
  readonly ownedByCommercialName: string | null;
}

/**
 * Pose les deux fiches, en le moins d'appels possible.
 *
 * La pile locale est partagée par plusieurs suites à la fois et chaque
 * aller-retour se paie : la liste est relue UNE fois, et les référentiels ne
 * sont chargés que s'il reste vraiment quelque chose à créer.
 */
test.beforeAll(async () => {
  const admin = await adminApi();
  const awa = await commercialApi();
  try {
    const grandPublic = await json<{ items: { phoneE164: string }[] }>(
      await admin.get('/api/v1/prospects', { params: { projet: 'GRAND_PUBLIC', pageSize: '1' } }),
    );
    const temoin = grandPublic.items[0];
    expect(
      temoin,
      'Aucune fiche Grand Public en base : le cloisonnement ne serait pas éprouvé',
    ).toBeDefined();
    if (temoin === undefined) return;
    temoinGrandPublic = temoin.phoneE164;

    // Sans cloisonnement de projet, ce numéro EST trouvable par Awa : c'est ce
    // qui rend le « zéro ligne » de CHU-PRO-01 concluant plutôt que trivial.
    const sansProjet = await json<{ meta: { total: number } }>(
      await awa.get('/api/v1/prospects', {
        params: { search: temoinGrandPublic, pageSize: '1' },
      }),
    );
    expect(
      sansProjet.meta.total,
      `La fiche ${temoinGrandPublic} doit être trouvable hors cloisonnement`,
    ).toBeGreaterThan(0);

    const miennes = await json<{ items: FicheEnBase[] }>(
      await awa.get('/api/v1/prospects', { params: { search: PREFIXE.trim(), pageSize: '50' } }),
    );
    const conforme = (fiche: (typeof FICHES)[number]): boolean =>
      miennes.items.some(
        (row) => row.phoneE164 === fiche.phone && row.nom === fiche.nom && row.segment === 'BDD1',
      );
    const aPoser = FICHES.filter((fiche) => !conforme(fiche));
    if (aPoser.length === 0) return;

    const banques = await json<{ id: string; shortName: string }[]>(
      await awa.get('/api/v1/referentiels/banques', { params: { activeOnly: 'false' } }),
    );
    const syndicats = await json<{ id: string; sigle: string }[]>(
      await awa.get('/api/v1/referentiels/syndicats', { params: { activeOnly: 'false' } }),
    );
    const banqueId = banques.find((row) => row.shortName === 'CBAO')?.id;
    const syndicatId = syndicats.find((row) => row.sigle === 'CHUES')?.id;
    expect(banqueId, 'Banque CBAO absente du référentiel').toBeDefined();
    expect(syndicatId, 'Syndicat CHUES absent du référentiel').toBeDefined();

    for (const fiche of aPoser) {
      await supprimerProspects(
        awa,
        miennes.items.filter((item) => item.phoneE164 === fiche.phone),
      );
      const created = await awa.post('/api/v1/prospects', {
        data: { ...fiche, banqueId, syndicatId },
      });
      expect(
        created.ok(),
        `La création de ${fiche.nom} a répondu ${String(created.status())} : ${await created.text()}`,
      ).toBe(true);
    }
  } finally {
    await admin.dispose();
    await awa.dispose();
  }
});

test('CHU-PRO-01 l’écran est borné au projet CHUES', async ({ page }) => {
  // La recherche est visée sur le NUMÉRO de la fiche Grand Public, et non sur
  // la première page de la liste : la volumétrie appartient à tout le monde,
  // et une fiche absente parce qu'elle est en page 2 ne prouverait rien.
  await page.goto(`/chues/prospects?search=${encodeURIComponent(temoinGrandPublic)}`);

  await expect(
    decompte(page),
    `« ${temoinGrandPublic} » est une fiche Grand Public : elle n’a rien à faire ici`,
  ).toHaveText(/^Prospects affichés\s*:\s*Aucun résultat$/u);
  await expect(page.getByText('Aucun prospect ne correspond à ces filtres.')).toBeVisible();

  // Le navigateur n'appelle JAMAIS `/api/v1/prospects` sur cet écran : la liste
  // est rendue par le serveur Next et hydratée, et un changement de critère
  // repasse par une navigation. Le seul porteur observable du cloisonnement est
  // donc l'URL, que `useProspectFilters` force à `CHUES` sur toute route
  // `/chues`. L'interception décrite au §7.4.12 n'a rien à intercepter : voir le
  // retour.
  await recherche(page).fill(PREFIXE.trim());
  await expect
    .poll(() => new URL(page.url()).searchParams.get('projet'), {
      message: 'un changement de critère doit reconduire le seul projet CHUES',
    })
    .toBe('CHUES');
});

test('CHU-PRO-04 une recherche sans résultat le dit et n’efface pas les filtres', async ({
  page,
}) => {
  // La recherche vient de l'URL, comme un lien filtré : mes fiches sont ainsi
  // à l'écran quelle que soit la volumétrie du moment.
  await page.goto(`/chues/prospects?statut=NOUVEAU&search=${encodeURIComponent(PREFIXE.trim())}`);
  await expect(
    ligne(page, FICHES[0].nom),
    'le filtre de statut doit rendre mes fiches',
  ).toHaveCount(1);

  await recherche(page).fill(RECHERCHE_INTROUVABLE);

  await expect(decompte(page)).toHaveText(/^Prospects affichés\s*:\s*Aucun résultat$/u);
  // `keepPreviousData` laisserait l'ancien tableau et l'utilisateur croirait
  // que son filtre n'a rien changé.
  await expect(ligne(page, FICHES[0].nom)).toHaveCount(0);
  expect(
    new URL(page.url()).searchParams.get('statut'),
    'la recherche ne doit pas emporter le filtre de statut',
  ).toBe('NOUVEAU');
});

test('CHU-PRO-05 un caractère spécial dans la recherche ne casse pas l’URL', async ({ page }) => {
  await page.goto('/chues/prospects');
  await recherche(page).fill(TERME_SPECIAL);

  await expect
    .poll(() => new URL(page.url()).searchParams.get('search'), {
      message: 'le terme cherché doit voyager encodé dans l’URL',
    })
    .toBe(TERME_SPECIAL);
  expect(page.url(), 'la barre d’adresse porte la valeur ENCODÉE').toContain('%2F');

  await page.reload();
  await expect(recherche(page), 'le rechargement doit restituer le terme entier').toHaveValue(
    TERME_SPECIAL,
  );
});

test('CHU-PRO-06 l’export suit le filtre affiché', async ({ page }) => {
  const exporter = async (): Promise<number> => {
    await page.getByRole('button', { name: 'Exporter' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Exporter la vue filtrée' }).click(),
    ]);
    const chemin = await download.path();
    // Un vrai classeur, pas un JSON d'erreur relayé sous une extension `.xlsx`.
    expect([...(await readFile(chemin)).subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    return (await stat(chemin)).size;
  };

  await page.goto('/chues/prospects?segment=BDD1');
  // Le segment filtré n'est PAS vide, sans quoi les deux classeurs pourraient
  // différer pour une raison qui n'a rien à voir avec le filtre.
  await expect(decompte(page)).not.toHaveText(/Aucun résultat$/u);
  const filtre = await exporter();

  await page.goto('/chues/prospects');
  const complet = await exporter();

  expect(filtre, 'un export qui ignore le filtre rendrait deux fois le même classeur').not.toBe(
    complet,
  );
});

test('CHU-PRO-08 le tableau reste utilisable sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/chues/prospects');

  await expect(decompte(page)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nom' })).toBeVisible();

  const debordePage = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(debordePage, 'la page entière ne doit pas défiler latéralement').toBe(false);

  // Le débordement est CONFINÉ au conteneur du tableau : c'est lui qui défile.
  const tableauDefile = await page.getByRole('table').evaluate((table) => {
    const conteneur = table.parentElement;
    if (conteneur === null) return false;
    return conteneur.scrollWidth > conteneur.clientWidth;
  });
  expect(tableauDefile, 'le tableau doit porter son propre défilement').toBe(true);
});
