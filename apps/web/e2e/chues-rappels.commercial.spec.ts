import { expect, request, test } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * La file des rappels promis, vue par le téléconseiller qui les a promis.
 *
 * Les rappels se posent par `POST /api/v1/sync/push` (issue `CALLBACK`), le
 * seul canal qui écrit un `ScheduledCallback` — aucun écran du périmètre ne le
 * fait, la console d'étape 3 ayant été vidée. La poussée part de la session
 * COMMERCIAL : le rappel est rattaché à son auteur, et un téléconseiller ne
 * lit que les siens (`callbacks.service.ts`, `assignedToId = user.id`).
 *
 * `serial` est posé sur le SOUS-ENSEMBLE qui partage les trois fiches, et non
 * sur le fichier entier : les deux scénarios attendus rouges (§1.1 et §2.2) ne
 * partagent aucune donnée avec eux, et sous un `serial` de fichier le premier
 * des deux à rougir emporterait l'autre en « skipped », donc un défaut connu
 * cesserait d'être rapporté.
 */

test.use({ storageState: 'e2e/.auth/commercial.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const COMMERCIAL_STORAGE_STATE = 'e2e/.auth/commercial.json';

/** Plage réservée à ce fichier : +221 78 100 46 0x. */
const FICHES = [
  {
    cle: 'semaine',
    phone: '+221781004601',
    affiche: '+221 78 100 46 01',
    nom: 'E2E-CHUES-RAP Semaine',
    commentaire: 'E2E-CHUES-RAP échéance de demain',
    heures: 26,
  },
  {
    cle: 'annulation',
    phone: '+221781004602',
    affiche: '+221 78 100 46 02',
    nom: 'E2E-CHUES-RAP Annulation',
    commentaire: 'E2E-CHUES-RAP échéance à annuler',
    heures: 27,
  },
  {
    cle: 'retard',
    phone: '+221781004603',
    affiche: '+221 78 100 46 03',
    nom: 'E2E-CHUES-RAP Retard',
    commentaire: 'E2E-CHUES-RAP échéance dépassée',
    heures: -2,
  },
] as const;

const ids = new Map<string, string>();

const fiche = (cle: (typeof FICHES)[number]['cle']): (typeof FICHES)[number] => {
  const trouvee = FICHES.find((row) => row.cle === cle);
  if (trouvee === undefined) throw new Error(`Fiche ${cle} absente de la table du spec`);
  return trouvee;
};

const idDe = (cle: string): string => {
  const id = ids.get(cle);
  if (id === undefined) throw new Error(`Fiche ${cle} non posée par la préparation`);
  return id;
};

const fileVide = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.route('**/api/v1/phase2/callbacks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], serverTime: new Date().toISOString() }),
    });
  });
};

/**
 * Le nettoyage est en TÊTE de parcours : un `afterAll` ne tourne pas après un
 * échec dur, et le reliquat sert au diagnostic. La suppression d'une fiche
 * annule ses rappels en attente (`closeProspectWork`), donc chaque exécution
 * repart d'une file propre pour ces trois numéros.
 */
test.beforeAll(async () => {
  test.setTimeout(120_000);

  const api = await adminApi();
  const commercial = await request.newContext({
    baseURL: WEB_URL,
    storageState: COMMERCIAL_STORAGE_STATE,
  });

  try {
    for (const row of FICHES) {
      const found = (await (
        await api.get('/api/v1/prospects', { params: { search: row.phone, pageSize: '50' } })
      ).json()) as { items: { id: string; phoneE164: string }[] };
      for (const existante of found.items.filter((item) => item.phoneE164 === row.phone)) {
        await api.delete(`/api/v1/prospects/${existante.id}`);
      }

      const cree = await api.post('/api/v1/prospects', {
        data: { nom: row.nom, prenom: 'Fiche', phone: row.phone },
      });
      expect(cree.ok(), `création de ${row.phone} : ${await cree.text()}`).toBe(true);
      const { id } = (await cree.json()) as { id: string };
      ids.set(row.cle, id);

      // `callbackAt` se juge contre `clientCreatedAt`, jamais contre l'heure du
      // serveur : c'est ce qui permet de poser une échéance DÉJÀ dépassée.
      const echeance = new Date(Date.now() + row.heures * 3_600_000);
      echeance.setUTCMinutes(0, 0, 0);
      const appel = new Date(Math.min(Date.now(), echeance.getTime() - 3_600_000));
      const opId = crypto.randomUUID();

      const pousse = await commercial.post('/api/v1/sync/push', {
        headers: { 'Idempotency-Key': opId },
        data: {
          clientBatchId: opId,
          payloadVersion: 1,
          operations: [
            {
              opId,
              seq: 0,
              entity: 'call_attempt',
              op: 'create',
              entityId: opId,
              clientUpdatedAt: appel.toISOString(),
              data: {
                prospectId: id,
                outcome: 'CALLBACK',
                callbackAt: echeance.toISOString(),
                comment: row.commentaire,
                clientCreatedAt: appel.toISOString(),
              },
            },
          ],
        },
      });
      expect(pousse.ok(), `rappel de ${row.phone} : ${await pousse.text()}`).toBe(true);
    }
  } finally {
    await api.dispose();
    await commercial.dispose();
  }
});

test.describe('la file posée par ce spec', () => {
  test.describe.configure({ mode: 'serial' });

  test('CHU-RAP-01 les trois onglets et le compteur de retards', async ({ page }) => {
    await page.goto('/chues/rappels');
    await expect(page).toHaveTitle('Rappels · CPI GO');

    await expect(page.getByRole('tab', { name: /^En retard/ })).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Aujourd’hui' })).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Cette semaine' })).toHaveCount(1);

    const compteur = page.getByRole('status').filter({ hasText: /rappels? en retard$/ });
    await expect(compteur).toHaveCount(1);

    const texte = (await compteur.innerText()).replace(/\s+/gu, ' ').trim();
    const nombre = Number(texte.split(' ')[0]);
    expect(Number.isInteger(nombre), `compteur illisible : « ${texte} »`).toBe(true);
    expect(nombre, 'ce spec pose un rappel déjà dépassé').toBeGreaterThan(0);
    expect(texte).toBe(`${String(nombre)} rappel${nombre > 1 ? 's' : ''} en retard`);
  });

  test('CHU-RAP-02 un rappel promis apparaît dans « Cette semaine »', async ({ page }) => {
    const cible = fiche('semaine');
    await page.goto('/chues/rappels');
    await page.getByRole('tab', { name: 'Cette semaine' }).click();

    const tableau = page.getByRole('table');
    await expect(tableau).toHaveCount(1);
    for (const colonne of ['Prospect', 'Échéance', 'Retard', 'Commentaire', 'Actions']) {
      await expect(
        tableau.getByRole('columnheader', { name: colonne, exact: true }),
        `la colonne « ${colonne} » manque à la file des rappels`,
      ).toHaveCount(1);
    }

    // Un téléconseiller ne voit que ses propres rappels : ni la colonne, ni le
    // filtre par collègue n'ont de sens pour lui (CHU-RAP-07, moitié COMMERCIAL).
    await expect(tableau.getByRole('columnheader', { name: 'Téléconseiller' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /^Téléconseiller/ })).toHaveCount(0);

    const lignes = tableau.getByRole('row').filter({ hasText: cible.affiche });
    await expect(lignes).toHaveCount(1);
    await expect(lignes).toContainText(cible.commentaire);
  });

  test('CHU-RAP-03 un rappel à l’heure n’est pas marqué en retard', async ({ page }) => {
    const cible = fiche('semaine');
    await page.goto('/chues/rappels');
    await page.getByRole('tab', { name: 'Cette semaine' }).click();

    const ligne = page.getByRole('table').getByRole('row').filter({ hasText: cible.affiche });
    await expect(ligne).toHaveCount(1);
    await expect(ligne.getByText('Sans objet', { exact: true })).toHaveCount(1);
  });

  test('CHU-RAP-05 « Annuler » retire le rappel et le dit', async ({ page }) => {
    const cible = fiche('annulation');
    await page.goto('/chues/rappels');
    await page.getByRole('tab', { name: 'Cette semaine' }).click();

    const ligne = page.getByRole('table').getByRole('row').filter({ hasText: cible.affiche });
    await expect(ligne).toHaveCount(1);
    await ligne.getByRole('button', { name: 'Annuler' }).click();

    await expect(page.getByText('Rappel annulé.', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('table').getByRole('row').filter({ hasText: cible.affiche }),
      'la liste n’a pas été invalidée après l’annulation',
    ).toHaveCount(0);
  });
});

test('CHU-RAP-06 l’état vide de chaque onglet a son propre texte', async ({ page }) => {
  await fileVide(page);

  await page.goto('/chues/rappels');
  await expect(page.getByRole('heading', { name: 'Aucun rappel en retard', level: 2 })).toBeVisible();

  await page.getByRole('tab', { name: 'Aujourd’hui' }).click();
  await expect(
    page.getByRole('heading', { name: 'Aucun rappel aujourd’hui', level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aucun rappel en retard' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Cette semaine' }).click();
  await expect(
    page.getByRole('heading', { name: 'Aucun rappel cette semaine', level: 2 }),
  ).toBeVisible();
});

test('CHU-RAP-08 la copie de l’état vide ne parle plus d’une touche qui n’existe plus', async ({
  page,
}) => {
  await fileVide(page);

  await page.goto('/chues/rappels');
  await page.getByRole('tab', { name: 'Aujourd’hui' }).click();
  await expect(
    page.getByRole('heading', { name: 'Aucun rappel aujourd’hui', level: 2 }),
  ).toBeVisible();

  await expect(
    page.getByText('touche 5'),
    'l’état vide promet un geste que l’étape 3 ne propose plus',
  ).toHaveCount(0);
});

test('CHU-RAP-04 « Ouvrir dans la console » ouvre bien la fiche', async ({ page }) => {
  const cible = fiche('semaine');
  await page.goto('/chues/rappels');
  await page.getByRole('tab', { name: 'Cette semaine' }).click();

  const ligne = page.getByRole('table').getByRole('row').filter({ hasText: cible.affiche });
  await ligne.getByRole('link', { name: 'Ouvrir dans la console' }).click();

  await page.waitForURL(`**/chues/console?fiche=${idDe('semaine')}`);
  await expect(
    page.getByText(cible.nom),
    'la console d’arrivée ignore ?fiche= et n’ouvre aucune fiche',
  ).toBeVisible();
});
