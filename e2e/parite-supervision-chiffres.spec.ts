import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { effacerFiches } from './donnees-chues';
import { apiDe, compter, creerRepresentant, departementQuelconque, ligne } from './donnees-listes';

const superviseur = compteDe('SUPERVISEUR');
const teleconseiller = compteDe('COMMERCIAL');

/** Journée figée : le compte de parcours n'y a que les tentatives semées ici. */
const JOURNEE = '2026-04-07';
const LENDEMAIN = '2026-04-08';
const JOURNEE_VIDE = '2026-04-09';

const JOIGNABILITE = 'Taux de joignabilité des représentants';
const ACCEPTATION = 'Taux d’acceptation';
const FICHE_TENUE = 'E2E stats representant 6';

const TELEPHONES = ['01', '02', '03', '04', '05', '06'].map((rang) => `+2217810800${rang}`);

const TENTATIVES = [
  { rang: 0, outcome: 'REACHED', quand: `${JOURNEE}T10:00:00.000Z` },
  { rang: 1, outcome: 'REFUSED', quand: `${JOURNEE}T11:00:00.000Z` },
  { rang: 2, outcome: 'CALLBACK', quand: `${JOURNEE}T12:00:00.000Z` },
  { rang: 3, outcome: 'UNREACHABLE', quand: `${JOURNEE}T23:59:59.000Z` },
  // Hors fenêtre d'une milliseconde : elle ne doit entrer dans aucun taux.
  { rang: 4, outcome: 'UNREACHABLE', quand: `${LENDEMAIN}T00:00:00.000Z` },
] as const;

const representants: string[] = [];
let ouvertureId = '';

const carte = (page: Page, titre: string): Locator =>
  page.getByRole('group', { name: `${titre}, graphique` });

/** Le chiffre vit dans le premier paragraphe de la tuile, son détail dans le second. */
async function tuile(page: Page, titre: string, valeur: string, detail: string): Promise<void> {
  await expect(carte(page, titre).getByRole('paragraph').first()).toHaveText(valeur);
  await expect(carte(page, titre).getByText(detail, { exact: true })).toHaveCount(1);
}

const urlChiffres = (du: string, au: string, commercial: string): string =>
  `/chues/statistiques?periode=libre&du=${du}&au=${au}&teleconseiller=${commercial}`;

const tableauEquipe = (page: Page): Locator =>
  page.getByRole('table', { name: 'Par téléconseiller' });

const ligneDe = (tableau: Locator, page: Page, nom: string): Locator =>
  tableau.getByRole('row').filter({ has: page.getByRole('rowheader', { name: nom, exact: true }) });

async function envoyer(api: APIRequestContext, chemin: string, corps?: unknown): Promise<void> {
  const reponse = await api.post(chemin, corps === undefined ? {} : { data: corps });
  if (!reponse.ok()) {
    throw new Error(`${chemin} a répondu ${String(reponse.status())} : ${await reponse.text()}`);
  }
}

async function composer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Composer l’écran' }).click();
  await expect(page.getByText('Mode organisation')).toBeVisible();
}

async function enregistrer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
}

/** L'ordre des cartes, lu sur les boutons « Retirer … » du mode composition. */
async function ordreDesCartes(page: Page): Promise<string[]> {
  const boutons = page.getByRole('button', { name: /^Retirer / });
  await expect(boutons.first()).toBeVisible();
  return boutons.evaluateAll((noeuds) =>
    noeuds.map((noeud) => (noeud.getAttribute('aria-label') ?? '').replace(/^Retirer /u, '')),
  );
}

test.beforeAll(async () => {
  // Une exécution interrompue laisse une disposition : repartir de l'écran d'usine.
  await avecBase(async (client) => {
    await client.query('DELETE FROM dashboard_layouts WHERE "userId" = $1', [superviseur.id]);
  });
  await effacerFiches(TELEPHONES);
  const departement = await departementQuelconque();
  const encadrement = await apiDe('SUPERVISEUR', '198.51.100.80');
  try {
    for (const [rang, phone] of TELEPHONES.entries()) {
      const fullName = `E2E stats representant ${String(rang + 1)}`;
      const fiche = { fullName, phone, departementId: departement.id };
      representants.push(await creerRepresentant(encadrement, fiche));
    }
    for (const tentative of TENTATIVES) {
      await envoyer(encadrement, '/api/v1/rep-campaigns/attempts', {
        id: randomUUID(),
        representantId: representants[tentative.rang],
        outcome: tentative.outcome,
        clientCreatedAt: tentative.quand,
        ...(tentative.outcome === 'CALLBACK' ? { callbackAt: `${LENDEMAIN}T09:00:00.000Z` } : {}),
      });
    }
    // Tenue par l'encadrement : un teleconseiller n'ouvre qu'une fiche de ses
    // propres campagnes, et ce parcours n'en monte aucune.
    ouvertureId = randomUUID();
    await envoyer(encadrement, '/api/v1/ouvertures', {
      id: ouvertureId,
      representantId: representants[5],
      openedAt: new Date().toISOString(),
    });
  } finally {
    await encadrement.dispose();
  }

  const semees = await compter(
    'SELECT count(*) AS n FROM rep_call_attempts WHERE "performedById" = $1 AND "representantId" = ANY($2)',
    [superviseur.id, representants],
  );
  expect(semees, 'les cinq tentatives doivent exister en base').toBe(5);
});

test.afterAll(async () => {
  await effacerFiches(TELEPHONES);
  await avecBase(async (client) => {
    await client.query('DELETE FROM dashboard_layouts WHERE "userId" = $1', [superviseur.id]);
    await client.query('DELETE FROM agent_activity_slots WHERE "userId" = $1', [teleconseiller.id]);
    await client.query('DELETE FROM agent_heartbeats WHERE "userId" = $1', [teleconseiller.id]);
  });
});

test.describe('parité supervision, l’activité et la présence du plateau', () => {
  test.use({ storageState: superviseur.etat });

  test('les faits semés se relisent colonne par colonne, et le tri les réordonne', async ({
    page,
  }) => {
    await page.goto('/chues/supervision');
    const onglet = (nom: string): Locator => page.getByRole('tab', { name: nom });
    await expect(onglet('Activité')).toHaveAttribute('aria-selected', 'true');
    await expect(onglet('Présence')).toHaveAttribute('aria-selected', 'false');

    await page.getByRole('button', { name: 'Période libre' }).click();
    await page.getByLabel('Du', { exact: true }).fill(JOURNEE);
    await page.getByLabel('Au', { exact: true }).fill(JOURNEE);

    // Le seul tableau du volet dont les colonnes se trient.
    const tableau = page
      .getByRole('table')
      .filter({ has: page.getByRole('button', { name: 'Non consignés' }) });
    // Les tâches d'appel n'existent plus : leurs colonnes ne doivent pas revenir.
    await expect(tableau.getByRole('columnheader', { name: 'Tâches closes' })).toHaveCount(0);
    await expect(
      ligneDe(tableau, page, superviseur.nom).getByRole('cell'),
      'la ligne doit relire les quatre tentatives de la journée, la cinquième exclue',
    ).toHaveText('4;0;0;0;0 %;Sans objet;3;1;1;1;0;0;0;75 %;33,3 %;4;0'.split(';'));

    const entete = tableau.getByRole('columnheader', { name: 'Appels', exact: true });
    await expect(entete).toHaveAttribute('aria-sort', 'descending');
    const rangs = tableau.locator('tbody').getByRole('rowheader');
    await expect(rangs.first()).toHaveText(superviseur.nom);

    await tableau.getByRole('button', { name: 'Appels', exact: true }).click();
    await expect(entete).toHaveAttribute('aria-sort', 'ascending');
    await expect(rangs.last(), 'le tri croissant renvoie la ligne chargée en bas').toHaveText(
      superviseur.nom,
    );

    const [fichier] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporter en CSV' }).click(),
    ]);
    expect(fichier.suggestedFilename()).toMatch(
      /^cpi-supervision-activite-\d{4}-\d{2}-\d{2}\.csv$/u,
    );
    const csv = await readFile(await fichier.path(), 'utf8');
    expect(csv.codePointAt(0), 'sans BOM, Excel en français ouvre de travers').toBe(0xfeff);
    const lignesCsv = csv.slice(1).split('\r\n');
    expect(lignesCsv[0]).toBe(
      'Téléconseiller;Appels;Confirmés;Détectés;Non consignés;Confirmation;Durée moy.;Joints;' +
        'Acceptés;À rappeler;Injoignables;Rappels tenus;Rappels en retard;Rappels à venir;' +
        'Joignabilité;Acceptation;Représentants contactés;Prospects saisis',
    );
    expect(lignesCsv, 'le fichier porte les faits semés, sans mise en forme').toContain(
      `${superviseur.nom};4;0;0;0;0;;3;1;1;1;0;0;0;75;33.3;4;0`,
    );
    expect(lignesCsv.at(-1)?.startsWith('Total équipe;')).toBe(true);
  });

  test('la présence suit un battement, et la fiche restée ouverte se libère', async ({
    page,
    browser,
  }) => {
    const plateau = await apiDe('COMMERCIAL', '198.51.100.81');
    try {
      await envoyer(plateau, '/api/v1/presence/beat');
    } finally {
      await plateau.dispose();
    }

    const direction = await browser.newContext({ storageState: compteDe('DIRECTION').etat });
    const vueDirection = await direction.newPage();
    await vueDirection.goto('/chues/supervision?volet=comptes');
    await expect(
      vueDirection.getByText('Fiches restées ouvertes'),
      'libérer une fiche est fermé à la direction : la liste ne doit pas lui être offerte',
    ).toHaveCount(0);
    await direction.close();

    await page.goto('/chues/supervision?volet=comptes');
    await expect(page.getByText('Présence observée par l’application.')).toBeVisible();
    await expect(
      page
        .getByRole('table')
        .filter({ hasText: 'Téléconseillers' })
        .getByRole('row')
        // `e2e.commercial.2` est un préfixe de `e2e.commercial.20`, et les cellules
        // se lisent collées : rien qu'un chiffre de plus est refusé.
        .filter({
          hasText: new RegExp(`${teleconseiller.identifiant.replaceAll('.', '\\.')}(?!\\d)`, 'u'),
        }),
    ).toContainText('Connecté');
    await expect(
      page.getByRole('table').filter({ hasText: 'Banque & Finance' }).getByRole('rowheader'),
    ).not.toHaveCount(0);

    const battement = await ligne<{ lastPullAt: Date | null }>(
      'SELECT "lastPullAt" FROM agent_heartbeats WHERE "userId" = $1',
      [teleconseiller.id],
    );
    expect(battement?.lastPullAt ?? null, 'le battement doit être écrit en base').not.toBeNull();

    const tenue = page
      .getByRole('table')
      .filter({ hasText: 'Fiches restées ouvertes' })
      .getByRole('row')
      .filter({ hasText: FICHE_TENUE });
    await expect(tenue).toContainText(superviseur.nom);
    await tenue.getByRole('button', { name: 'Libérer' }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText('Elle repasse en « À rappeler »');
    await confirmation.getByRole('button', { name: 'Libérer' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'libérée par' })).toContainText(
      `${FICHE_TENUE} libérée par ${superviseur.nom}`,
    );

    const trace = await ligne<{ releasedById: string }>(
      'SELECT "releasedById" FROM ouvertures_fiche WHERE id = $1 AND "releasedAt" IS NOT NULL',
      [ouvertureId],
    );
    expect(trace?.releasedById, 'la libération est datée et porte son auteur').toBe(superviseur.id);
  });
});

test.describe('parité chiffres, l’écran d’un superviseur', () => {
  test.use({ storageState: superviseur.etat });

  test('la période, la plage libre et le téléconseiller regardé vivent dans l’URL', async ({
    page,
  }) => {
    await page.goto('/chues/statistiques');
    const pastille = page.getByRole('button', { name: 'Mois dernier', exact: true });
    await pastille.click();
    await expect(page).toHaveURL('/chues/statistiques?periode=mois-dernier');
    await expect(pastille).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('p[aria-live="polite"]').first()).toHaveText('Mois dernier');

    await page.getByRole('button', { name: 'Plage libre' }).click();
    await page.getByLabel('Du', { exact: true }).fill(JOURNEE);
    await page.getByLabel('Au', { exact: true }).fill(JOURNEE);
    await expect(page).toHaveURL(`/chues/statistiques?periode=libre&du=${JOURNEE}&au=${JOURNEE}`);

    const selecteur = page.getByRole('combobox', { name: 'Téléconseiller regardé' });
    await expect(selecteur).toContainText('Toute l’équipe');
    await selecteur.click();
    for (const nom of [teleconseiller.nom, superviseur.nom, compteDe('DIRECTION').nom]) {
      await expect(page.getByRole('option', { name: nom, exact: true })).toBeVisible();
    }
    for (const nom of [compteDe('BANQUE_FINANCE').nom, compteDe('ADMIN').nom]) {
      await expect(page.getByRole('option', { name: nom, exact: true })).toHaveCount(0);
    }
    await page.getByRole('option', { name: teleconseiller.nom, exact: true }).click();
    await expect(page).toHaveURL(/[?&]teleconseiller=[0-9a-z-]+$/);
    await expect(selecteur).toContainText(teleconseiller.nom);
    await selecteur.click();
    await page.getByRole('option', { name: 'Toute l’équipe', exact: true }).click();
    await expect(page).not.toHaveURL(/teleconseiller=/);
  });

  test('l’écran d’usine pose ses cartes, ses taux relisent les tentatives semées', async ({
    page,
  }) => {
    await page.goto(urlChiffres(JOURNEE, JOURNEE, superviseur.id));

    for (const titre of ['Taux de contact', 'Taux de qualification', 'Par téléconseiller']) {
      await expect(carte(page, titre), `la carte « ${titre} » doit être posée`).toBeVisible();
    }
    // Les montants restent fermés à la supervision.
    await expect(carte(page, 'Encaissé')).toHaveCount(0);

    await tuile(page, JOIGNABILITE, '75,0 %', '3 joints sur 4 fiches');
    await tuile(page, ACCEPTATION, '33,3 %', '1 acceptent sur 3 joints');
    const attendu = ['4', '75,0 %', '1', '1', '33,3 %', '0', '0'];
    await expect(ligneDe(tableauEquipe(page), page, superviseur.nom).getByRole('cell')).toHaveText(
      attendu,
    );
    await expect(ligneDe(tableauEquipe(page), page, 'Équipe').getByRole('cell')).toHaveText(
      attendu,
    );

    await page.goto(urlChiffres(JOURNEE_VIDE, JOURNEE_VIDE, superviseur.id));
    await tuile(page, JOIGNABILITE, 'Sans objet', 'Aucun représentant appelé sur la période');

    await page.goto(urlChiffres(JOURNEE, JOURNEE, teleconseiller.id));
    await expect(
      carte(page, JOIGNABILITE).getByRole('paragraph').first(),
      'le filtre par téléconseiller doit borner les chiffres',
    ).toHaveText('Sans objet');
    await expect(tableauEquipe(page).getByRole('rowheader')).toHaveText([
      teleconseiller.nom,
      'Équipe',
    ]);
  });
});

test.describe('parité chiffres, ce que la direction voit en plus', () => {
  test.use({ storageState: compteDe('DIRECTION').etat });

  test('les montants, et le taux de rappel du même jeu', async ({ page }) => {
    await page.goto(urlChiffres(JOURNEE, JOURNEE, superviseur.id));

    await expect(carte(page, 'Encaissé')).toContainText('FCFA');
    await expect(carte(page, 'De l’appel à l’encaissement')).toBeVisible();
    await tuile(
      page,
      'Taux de rappel',
      '25,0 %',
      '1 à rappeler sur 4 fiches · 0 à venir, 0 tenus, 0 en retard',
    );
  });
});

test.describe('parité disposition, composer l’écran des chiffres', () => {
  test.use({ storageState: superviseur.etat });

  test('retirer une carte, la ranger, l’enregistrer : l’écran tient et reste personnel', async ({
    page,
    browser,
  }) => {
    await page.goto('/chues/statistiques');
    await composer(page);
    await page.getByRole('button', { name: `Retirer ${ACCEPTATION}` }).click();
    const premier = (await ordreDesCartes(page))[0] ?? '';
    await page.getByRole('button', { name: `Descendre ${premier}` }).click();
    const ordre = await ordreDesCartes(page);
    expect(ordre[0], 'la carte descendue ne peut pas rester en tête').not.toBe(premier);
    await expect(page.getByRole('button', { name: `Monter ${ordre[0] ?? ''}` })).toBeDisabled();
    await enregistrer(page);

    await page.reload();
    await expect(carte(page, ACCEPTATION)).toHaveCount(0);
    await composer(page);
    expect(await ordreDesCartes(page), 'l’ordre enregistré doit survivre au rechargement').toEqual(
      ordre,
    );
    await page.getByRole('button', { name: 'Quitter' }).click();

    const enregistree = await ligne<{ sources: string }>(
      `SELECT string_agg(w->>'source', ',') AS sources FROM dashboard_layouts,
         jsonb_array_elements(layout->'widgets') w WHERE "userId" = $1 AND ecran = 'chues'`,
      [superviseur.id],
    );
    expect(enregistree?.sources ?? '').not.toContain('taux-d-acceptation');
    expect(enregistree?.sources ?? '').toContain('taux-de-qualification');

    const direction = await browser.newContext({ storageState: compteDe('DIRECTION').etat });
    const vueDirection = await direction.newPage();
    await vueDirection.goto('/chues/statistiques');
    await expect(
      carte(vueDirection, ACCEPTATION),
      'la disposition d’un superviseur ne touche pas l’écran de la direction',
    ).toBeVisible();
    await direction.close();

    await page.goto('/grand-public/statistiques');
    await expect(
      carte(page, 'Taux de joignabilité des prospects'),
      'chaque écran garde sa disposition : le Grand Public reste d’usine',
    ).toBeVisible();

    await page.goto('/chues/statistiques');
    await page.getByRole('button', { name: 'Revenir à l’écran par défaut' }).click();
    await expect(carte(page, ACCEPTATION)).toBeVisible();
    const restante = await compter(
      'SELECT count(*) AS n FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2',
      [superviseur.id, 'chues'],
    );
    expect(restante, 'revenir au défaut efface la disposition du compte').toBe(0);
  });
});

test.describe('parité disposition, la proposition par défaut', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  test('« Proposer par défaut » n’est offert qu’à l’ADMIN et demande confirmation', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (requete.url().includes('/disposition/par-defaut')) envois.push(requete.method());
    });

    await page.goto('/chues/statistiques');
    await composer(page);
    await page.getByRole('button', { name: 'Proposer par défaut' }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText('Fixer la disposition par défaut');
    await expect(confirmation).toContainText(
      'Les comptes qui n’ont rien enregistré verront cette organisation.',
    );

    // On ferme SANS confirmer : le geste changerait l'écran de tous les comptes.
    await confirmation.getByRole('button', { name: 'Annuler' }).click();
    await page.getByRole('button', { name: 'Quitter' }).click();
    await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
    expect(envois, 'aucun appel ne doit partir vers la disposition par défaut').toEqual([]);
  });
});
