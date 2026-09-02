import {
  expect,
  request,
  test,
  type APIRequestContext,
  type APIResponse,
  type Locator,
  type Page,
} from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * CHU-CHF-13 à CHU-CHF-19 : les taux de l'écran « Chiffres » du projet CHUES,
 * contre un jeu de cinq tentatives calculé à la main (E2E.md §7.4.5).
 *
 * L'écran se lit en SUPERVISEUR ; les cinq représentants se posent en ADMIN et
 * les cinq tentatives en SUPERVISEUR, seul chemin qui écrit `performedById` sur
 * le compte dont les chiffres sont regardés.
 */

test.use({ storageState: 'e2e/.auth/superviseur.json' });
test.describe.configure({ mode: 'serial' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

const PREFIXE = 'E2E-CHUES-TAUX';

/** Journée d'observation figée (E2E.md §7.4.5, Q-03). */
const JOURNEE = '2026-02-03';
/** Journée sans le moindre acte, pour le dénominateur nul de CHU-CHF-17. */
const JOURNEE_VIDE = '2026-02-05';

const REPRESENTANTS = [
  { cle: 'R1', fullName: `${PREFIXE} Rep Un`, phone: '+221781004001' },
  { cle: 'R2', fullName: `${PREFIXE} Rep Deux`, phone: '+221781004002' },
  { cle: 'R3', fullName: `${PREFIXE} Rep Trois`, phone: '+221781004003' },
  { cle: 'R4', fullName: `${PREFIXE} Rep Quatre`, phone: '+221781004004' },
  { cle: 'R5', fullName: `${PREFIXE} Rep Cinq`, phone: '+221781004005' },
] as const;

/**
 * Identifiants constants : `id` est la clé d'idempotence de
 * `POST /rep-campaigns/attempts`, donc une relance ne double aucun compteur.
 */
const TENTATIVES = [
  {
    cle: 'R1',
    id: '019a0203-0400-7001-8a01-e2ecfe000001',
    outcome: 'REACHED',
    relationStatus: 'AMBASSADEUR',
    clientCreatedAt: `${JOURNEE}T10:00:00.000Z`,
  },
  {
    cle: 'R2',
    id: '019a0203-0400-7002-8a02-e2ecfe000002',
    outcome: 'REFUSED',
    relationStatus: 'REFUS',
    clientCreatedAt: `${JOURNEE}T11:00:00.000Z`,
  },
  {
    cle: 'R3',
    id: '019a0203-0400-7003-8a03-e2ecfe000003',
    outcome: 'CALLBACK',
    callbackAt: '2026-02-04T12:00:00.000Z',
    clientCreatedAt: `${JOURNEE}T12:00:00.000Z`,
  },
  {
    cle: 'R4',
    id: '019a0203-0400-7004-8a04-e2ecfe000004',
    outcome: 'UNREACHABLE',
    clientCreatedAt: `${JOURNEE}T23:59:59.999Z`,
  },
  // Hors fenêtre d'une milliseconde : elle ne doit JAMAIS entrer dans les taux.
  {
    cle: 'R5',
    id: '019a0203-0400-7005-8a05-e2ecfe000005',
    outcome: 'UNREACHABLE',
    clientCreatedAt: '2026-02-04T00:00:00.000Z',
  },
] as const;

const TITRES_DE_TAUX = ['Taux de contact', 'Taux de rendez-vous', 'Taux de qualification'] as const;

let superviseurId = '';
let awaId = '';

async function lu<T>(reponse: APIResponse, quoi: string): Promise<T> {
  expect(
    reponse.ok(),
    `${quoi} : ${reponse.url()} a répondu ${String(reponse.status())} — ${await reponse.text()}`,
  ).toBe(true);
  return (await reponse.json()) as T;
}

async function idDuCompte(api: APIRequestContext, email: string): Promise<string> {
  const page = await lu<{ items: { id: string; email: string }[] }>(
    await api.get('/api/v1/users', { params: { search: email, pageSize: '50' } }),
    `Compte ${email}`,
  );
  const trouve = page.items.find((item) => item.email === email);
  expect(trouve, `Compte ${email} absent : la base est-elle amorcée ?`).toBeDefined();
  return trouve?.id ?? '';
}

/**
 * Les fiches ne sont PAS supprimées puis recréées : les tentatives portent des
 * identifiants figés, et une suppression en ferait des doublons rattachés à des
 * fiches disparues au lieu de compteurs remis à leur valeur.
 */
async function poserRepresentants(api: APIRequestContext): Promise<Map<string, string>> {
  const departements = await lu<{ id: string }[]>(
    await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
    'Référentiel des départements',
  );
  const departementId = departements[0]?.id;
  expect(departementId, 'Aucun département dans le référentiel').toBeDefined();

  const parCle = new Map<string, string>();
  for (const fiche of REPRESENTANTS) {
    const existants = await lu<{ items: { id: string; phoneE164: string }[] }>(
      await api.get('/api/v1/representants', {
        params: { search: fiche.phone, pageSize: '50' },
      }),
      `Recherche du représentant ${fiche.phone}`,
    );
    const deja = existants.items.find((item) => item.phoneE164 === fiche.phone);
    if (deja !== undefined) {
      parCle.set(fiche.cle, deja.id);
      continue;
    }

    const cree = await lu<{ id: string }>(
      await api.post('/api/v1/representants', {
        data: { fullName: fiche.fullName, phone: fiche.phone, departementId },
      }),
      `Création du représentant ${fiche.fullName}`,
    );
    parCle.set(fiche.cle, cree.id);
  }
  return parCle;
}

async function poserTentatives(
  api: APIRequestContext,
  representants: Map<string, string>,
): Promise<void> {
  for (const tentative of TENTATIVES) {
    const representantId = representants.get(tentative.cle);
    expect(representantId, `Représentant ${tentative.cle} introuvable`).toBeDefined();
    const { cle, ...corps } = tentative;
    const resultat = await lu<{ status: string; attemptId: string }>(
      await api.post('/api/v1/rep-campaigns/attempts', {
        data: { ...corps, representantId },
      }),
      `Tentative ${cle} (${tentative.outcome})`,
    );
    expect(['applied', 'duplicate'], `Tentative ${cle} : statut ${resultat.status}`).toContain(
      resultat.status,
    );
  }
}

function urlDuJeu(du: string, au: string, teleconseiller: string): string {
  return `/chues/statistiques?periode=libre&du=${du}&au=${au}&teleconseiller=${teleconseiller}`;
}

/** Une carte de la grille : `ChartCard` nomme sa région « <titre> graphique ». */
function carte(page: Page, titre: string): Locator {
  return page.getByRole('group', { name: `${titre} graphique` });
}

/** La tuile rend d'abord le chiffre, puis son détail : le premier paragraphe. */
function chiffreDe(page: Page, titre: string): Locator {
  return carte(page, titre).getByRole('paragraph').first();
}

function tableauEquipe(page: Page): Locator {
  return page.getByRole('table', { name: 'Par téléconseiller' });
}

test.beforeAll(async () => {
  const admin = await adminApi();
  const superviseur = await request.newContext({
    baseURL: WEB_URL,
    storageState: 'e2e/.auth/superviseur.json',
  });
  try {
    superviseurId = await idDuCompte(admin, 'fixture.superviseur@cpi.sn');
    awaId = await idDuCompte(admin, 'fixture.awa@cpi.sn');
    const representants = await poserRepresentants(admin);
    await poserTentatives(superviseur, representants);
    // Les cartes lues ici sont celles de l'usine : une disposition laissée par
    // une autre suite (chues-disposition) les aurait retirées.
    const remise = await superviseur.delete('/api/v1/tableaux-de-bord/chues/disposition');
    if (!remise.ok() && remise.status() !== 404) {
      throw new Error(`Disposition CHUES non remise à l’usine : ${String(remise.status())}`);
    }
  } finally {
    await admin.dispose();
    await superviseur.dispose();
  }
});

test('CHU-CHF-13 le taux de contact vaut exactement 50 % sur 2 joints pour 4 appels', async ({
  page,
}) => {
  await page.goto(urlDuJeu(JOURNEE, JOURNEE, superviseurId));

  await expect(chiffreDe(page, 'Taux de contact')).toHaveText('50,0 %');
  await expect(
    carte(page, 'Taux de contact').getByText('2 joints sur 4 appels', { exact: true }),
  ).toHaveCount(1);
});

test('CHU-CHF-14 le taux de rappel vaut exactement 25 % sur 1 rappel pour 4 appels', async ({
  page,
}) => {
  await page.goto(urlDuJeu(JOURNEE, JOURNEE, superviseurId));

  await expect(chiffreDe(page, 'Taux de rendez-vous')).toHaveText('25,0 %');
  await expect(
    carte(page, 'Taux de rendez-vous').getByText('1 rendez-vous sur 4 appels', { exact: true }),
  ).toHaveCount(1);
});

test('CHU-CHF-15 le taux de qualification vaut exactement 50 % sur 1 accepté pour 2 interrogés', async ({
  page,
}) => {
  await page.goto(urlDuJeu(JOURNEE, JOURNEE, superviseurId));

  await expect(chiffreDe(page, 'Taux de qualification')).toHaveText('50,0 %');
  await expect(
    carte(page, 'Taux de qualification').getByText('1 acceptent sur 2 interrogés', {
      exact: true,
    }),
  ).toHaveCount(1);
});

test('CHU-CHF-16 la ligne du superviseur porte ses trois taux, et le pied « Équipe » les mêmes', async ({
  page,
}) => {
  await page.goto(urlDuJeu(JOURNEE, JOURNEE, superviseurId));

  const attendu = ['4', '50,0 %', '25,0 %', '50,0 %', '0', '0'];
  const ligne = tableauEquipe(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Superviseur Fixture', exact: true }) });
  await expect(ligne.getByRole('cell')).toHaveText(attendu);

  const equipe = tableauEquipe(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Équipe', exact: true }) });
  await expect(equipe.getByRole('cell')).toHaveText(attendu);
});

test('CHU-CHF-17 une journée sans aucun appel ne se lit pas « 0 % »', async ({ page }) => {
  await page.goto(urlDuJeu(JOURNEE_VIDE, JOURNEE_VIDE, superviseurId));

  await expect(chiffreDe(page, 'Taux de contact')).toHaveText('Sans objet');
  await expect(
    carte(page, 'Taux de contact').getByText('Aucun appel sur la période', { exact: true }),
  ).toHaveCount(1);
  await expect(carte(page, 'Taux de contact').getByText('0,0 %')).toHaveCount(0);
});

test('CHU-CHF-18 le filtre par téléconseiller borne réellement les chiffres', async ({ page }) => {
  await page.goto(urlDuJeu(JOURNEE, JOURNEE, superviseurId));
  await expect(chiffreDe(page, 'Taux de contact')).toHaveText('50,0 %');

  await page.goto(urlDuJeu(JOURNEE, JOURNEE, awaId));
  await expect(chiffreDe(page, 'Taux de contact')).toHaveText('Sans objet');
  // Une ligne pour Awa, et le pied « Équipe » qui ne dit plus qu'elle.
  await expect(tableauEquipe(page).getByRole('rowheader')).toHaveText(['Awa Fixture', 'Équipe']);
  await expect(tableauEquipe(page).getByRole('row')).toHaveCount(3);
});

test('CHU-CHF-19 un rechargement complet rend exactement le même écran', async ({ page }) => {
  const url = urlDuJeu(JOURNEE, JOURNEE, superviseurId);
  await page.goto(url);

  const avant: string[] = [];
  for (const titre of TITRES_DE_TAUX) {
    avant.push((await chiffreDe(page, titre).innerText()).trim());
  }

  await page.reload();

  await expect(page).toHaveURL(url);
  for (const [index, titre] of TITRES_DE_TAUX.entries()) {
    await expect(chiffreDe(page, titre), `${titre} après rechargement`).toHaveText(
      avant[index] ?? '',
    );
  }
});
