import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { effacerFiches } from './donnees-chues';
import { apiDe, creerRepresentant, departementQuelconque, ligne } from './donnees-listes';

const superviseur = compteDe('SUPERVISEUR');
const teleconseiller = compteDe('COMMERCIAL');

/** Journée figée : le compte de parcours n'y a que les tentatives semées ici. */
const JOURNEE = '2026-04-07';
const LENDEMAIN = '2026-04-08';
const JOURNEE_VIDE = '2026-04-09';

const TELEPHONES = ['01', '02', '03', '04', '05', '06'].map((rang) => `+2217810800${rang}`);

const TENTATIVES = [
  { rang: 0, outcome: 'REACHED', heure: '10:00:00.000' },
  { rang: 1, outcome: 'REFUSED', heure: '11:00:00.000' },
  { rang: 2, outcome: 'CALLBACK', heure: '12:00:00.000' },
  { rang: 3, outcome: 'UNREACHABLE', heure: '23:59:59.000' },
] as const;

const representants: string[] = [];
let ouvertureId = '';

const carte = (page: Page, titre: string): Locator =>
  page.getByRole('group', { name: `${titre}, graphique` });

/** La tuile rend le chiffre dans son premier paragraphe, le détail dans le second. */
const chiffreDe = (page: Page, titre: string): Locator =>
  carte(page, titre).getByRole('paragraph').first();

const urlChiffres = (du: string, au: string, commercial: string): string =>
  `/chues/statistiques?periode=libre&du=${du}&au=${au}&teleconseiller=${commercial}`;

/** Le seul tableau du volet Activité dont les colonnes se trient. */
const tableauActivite = (page: Page): Locator =>
  page.getByRole('table').filter({ has: page.getByRole('button', { name: 'Non consignés' }) });

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

async function ordreDesCartes(page: Page): Promise<string[]> {
  const boutons = page.getByRole('button', { name: /^Retirer / });
  await expect(boutons.first()).toBeVisible();
  return boutons.evaluateAll((noeuds) =>
    noeuds.map((noeud) => (noeud.getAttribute('aria-label') ?? '').replace(/^Retirer /u, '')),
  );
}

async function enregistrer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
}

test.beforeAll(async () => {
  await effacerFiches(TELEPHONES);
  const departement = await departementQuelconque();
  const encadrement = await apiDe('SUPERVISEUR', '198.51.100.80');
  try {
    for (const [rang, phone] of TELEPHONES.entries()) {
      representants.push(
        await creerRepresentant(encadrement, {
          fullName: `E2E stats representant ${String(rang + 1)}`,
          phone,
          departementId: departement.id,
        }),
      );
    }

    for (const tentative of TENTATIVES) {
      await envoyer(encadrement, '/api/v1/rep-campaigns/attempts', {
        id: randomUUID(),
        representantId: representants[tentative.rang],
        outcome: tentative.outcome,
        clientCreatedAt: `${JOURNEE}T${tentative.heure}Z`,
        ...(tentative.outcome === 'CALLBACK' ? { callbackAt: `${LENDEMAIN}T09:00:00.000Z` } : {}),
      });
    }
    // Hors fenêtre d'une milliseconde : elle ne doit entrer dans aucun taux.
    await envoyer(encadrement, '/api/v1/rep-campaigns/attempts', {
      id: randomUUID(),
      representantId: representants[4],
      outcome: 'UNREACHABLE',
      clientCreatedAt: `${LENDEMAIN}T00:00:00.000Z`,
    });

    // Ouverte par l'encadrement : un teleconseiller ne peut tenir qu'une fiche
    // de ses propres campagnes, et ce parcours n'en monte aucune.
    ouvertureId = randomUUID();
    await envoyer(encadrement, '/api/v1/ouvertures', {
      id: ouvertureId,
      representantId: representants[5],
      openedAt: new Date().toISOString(),
    });
  } finally {
    await encadrement.dispose();
  }

  const semees = await ligne<{ n: string }>(
    'SELECT count(*) AS n FROM rep_call_attempts WHERE "performedById" = $1 AND "representantId" = ANY($2)',
    [superviseur.id, representants],
  );
  expect(Number(semees?.n), 'les cinq tentatives doivent exister en base').toBe(5);
});

test.afterAll(async () => {
  await effacerFiches(TELEPHONES);
  await avecBase(async (client) => {
    await client.query('DELETE FROM dashboard_layouts WHERE "userId" = ANY($1)', [
      [superviseur.id, teleconseiller.id],
    ]);
    await client.query('DELETE FROM agent_activity_slots WHERE "userId" = $1', [teleconseiller.id]);
    await client.query('DELETE FROM agent_heartbeats WHERE "userId" = $1', [teleconseiller.id]);
  });
});

test.describe('parité supervision, le volet Activité', () => {
  test.use({ storageState: superviseur.etat });

  test('les faits semés se relisent colonne par colonne, et le tri les réordonne', async ({
    page,
  }) => {
    await page.goto('/chues/supervision');
    await expect(page.getByRole('tab', { name: 'Activité' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Présence' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    await page.getByRole('button', { name: 'Période libre' }).click();
    await page.getByLabel('Du', { exact: true }).fill(JOURNEE);
    await page.getByLabel('Au', { exact: true }).fill(JOURNEE);

    const tableau = tableauActivite(page);
    // Les tâches d'appel n'existent plus : leurs colonnes ne doivent pas revenir.
    await expect(tableau.getByRole('columnheader', { name: 'Tâches closes' })).toHaveCount(0);

    const notre = ligneDe(tableau, page, superviseur.nom);
    await expect(
      notre.getByRole('cell'),
      'la ligne du superviseur doit relire les cinq tentatives semées, la cinquième exclue',
    ).toHaveText([
      '4',
      '0',
      '0',
      '0',
      '0 %',
      'Sans objet',
      '3',
      '1',
      '1',
      '1',
      '0',
      '0',
      '0',
      '75 %',
      '33,3 %',
      '4',
      '0',
    ]);

    const entete = tableau.getByRole('columnheader', { name: 'Appels' });
    await expect(entete).toHaveAttribute('aria-sort', 'descending');
    const rangs = tableau.locator('tbody').getByRole('rowheader');
    await expect(rangs.first()).toHaveText(superviseur.nom);

    await tableau.getByRole('button', { name: 'Appels' }).click();
    await expect(entete).toHaveAttribute('aria-sort', 'ascending');
    await expect(rangs.last(), 'le tri croissant doit renvoyer la ligne chargée en bas').toHaveText(
      superviseur.nom,
    );
  });

  test.fixme('exporter l’activité en CSV : le bouton « Exporter en CSV » de la v1 n’existe plus, aucun export sur le volet Activité (v1 CHU-SUP-05)', () => {});
});

test.describe('parité supervision, le volet Présence et les fiches restées ouvertes', () => {
  test.use({ storageState: superviseur.etat });

  test('un battement de téléconseiller se lit à l’écran et en base', async ({ page }) => {
    const plateau = await apiDe('COMMERCIAL', '198.51.100.82');
    try {
      await envoyer(plateau, '/api/v1/presence/beat');
    } finally {
      await plateau.dispose();
    }

    await page.goto('/chues/supervision?volet=comptes');
    await expect(
      page.getByText(
        'Présence observée par l’application. Les appels et saisies sont dans le volet Activité.',
      ),
    ).toBeVisible();

    const teleconseillers = page.getByRole('table').filter({ hasText: 'Téléconseillers' });
    const finances = page.getByRole('table').filter({ hasText: 'Banque & Finance' });
    await expect(ligneDe(teleconseillers, page, teleconseiller.nom)).toContainText('Connecté');
    await expect(finances.getByRole('rowheader')).not.toHaveCount(0);
    await expect(page.getByText('Aucun compte téléconseiller.', { exact: true })).toHaveCount(0);

    const battement = await ligne<{ lastPullAt: Date | null }>(
      'SELECT "lastPullAt" FROM agent_heartbeats WHERE "userId" = $1',
      [teleconseiller.id],
    );
    expect(battement?.lastPullAt ?? null, 'le battement doit être écrit en base').not.toBeNull();
  });

  test('une fiche tenue se libère, et la libération est tracée', async ({ page, browser }) => {
    const direction = await browser.newContext({ storageState: compteDe('DIRECTION').etat });
    const vueDirection = await direction.newPage();
    await vueDirection.goto('/chues/supervision?volet=comptes');
    await expect(
      vueDirection.getByText('Fiches restées ouvertes'),
      'libérer une fiche est fermé à la direction : la liste ne doit pas lui être offerte',
    ).toHaveCount(0);
    await direction.close();

    await page.goto('/chues/supervision?volet=comptes');
    const fiches = page.getByRole('table').filter({ hasText: 'Fiches restées ouvertes' });
    const tenue = fiches.getByRole('row').filter({ hasText: 'E2E stats representant 6' });
    await expect(tenue).toHaveCount(1);
    await expect(tenue).toContainText(superviseur.nom);

    await tenue.getByRole('button', { name: 'Libérer' }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText('Elle repasse en « À rappeler »');
    await confirmation.getByRole('button', { name: 'Libérer' }).click();

    await expect(page.getByRole('status')).toContainText(
      `E2E stats representant 6 libérée par ${superviseur.nom}`,
    );

    const trace = await ligne<{ releasedById: string | null; releasedAt: Date | null }>(
      'SELECT "releasedById", "releasedAt" FROM ouvertures_fiche WHERE id = $1',
      [ouvertureId],
    );
    expect(trace?.releasedById, 'la libération doit porter le nom de qui l’a faite').toBe(
      superviseur.id,
    );
    expect(trace?.releasedAt ?? null).not.toBeNull();
  });
});

test.describe('parité chiffres, l’écran d’un superviseur', () => {
  test.use({ storageState: superviseur.etat });

  test('l’écran d’usine pose ses cartes et ferme les montants', async ({ page }) => {
    await page.goto('/chues/statistiques');

    for (const titre of [
      'Taux de contact',
      'Taux de joignabilité des représentants',
      'Taux d’acceptation',
      'Taux de qualification',
      'Par téléconseiller',
    ]) {
      await expect(carte(page, titre), `la carte « ${titre} » doit être posée`).toBeVisible();
    }

    await expect(carte(page, 'Encaissé')).toHaveCount(0);
    await expect(carte(page, 'De l’appel à l’encaissement')).toHaveCount(0);
    for (const panne of ['Erreur serveur', 'Serveur injoignable', 'Accès refusé']) {
      await expect(page.getByRole('heading', { name: panne, level: 2 })).toHaveCount(0);
    }
  });

  test('la période et la plage libre vivent dans l’URL, et la plage trop large est refusée', async ({
    page,
  }) => {
    await page.goto('/chues/statistiques');
    await expect(page.getByRole('group', { name: 'Période affichée' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Comparer à' })).toHaveCount(0);

    for (const [libelle, cle] of [
      ['Ce mois-ci', 'ce-mois'],
      ['Mois dernier', 'mois-dernier'],
      ['Année dernière', 'annee-derniere'],
    ] as const) {
      await page.getByRole('button', { name: libelle, exact: true }).click();
      await expect(page).toHaveURL(`/chues/statistiques?periode=${cle}`);
      await expect(page.getByRole('button', { name: libelle, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.locator('p[aria-live="polite"]').first()).toHaveText(libelle);
    }

    await page.getByRole('button', { name: 'Plage libre' }).click();
    await page.getByLabel('Du', { exact: true }).fill(JOURNEE);
    await page.getByLabel('Au', { exact: true }).fill(JOURNEE);
    await expect(page).toHaveURL(`/chues/statistiques?periode=libre&du=${JOURNEE}&au=${JOURNEE}`);

    await page.goto('/chues/statistiques?periode=libre&du=2024-01-01&au=2026-08-27');
    await expect(page.getByRole('alert').filter({ hasText: 'Cette plage dépasse' })).toHaveText(
      'Cette plage dépasse 400 jours (970 jours) : revenez à une période plus courte.',
    );
  });

  test('le sélecteur nomme l’équipe d’appel et laisse la banque dehors', async ({ page }) => {
    await page.goto('/chues/statistiques');
    const selecteur = page.getByRole('combobox', { name: 'Téléconseiller regardé' });
    await expect(selecteur).toContainText('Toute l’équipe');
    await expect(page).not.toHaveURL(/teleconseiller=/);

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

  test('les taux se relisent sur les tentatives semées, et le filtre les borne', async ({
    page,
  }) => {
    await page.goto(urlChiffres(JOURNEE, JOURNEE, superviseur.id));

    await expect(chiffreDe(page, 'Taux de joignabilité des représentants')).toHaveText('75,0 %');
    await expect(
      carte(page, 'Taux de joignabilité des représentants').getByText('3 joints sur 4 fiches', {
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(chiffreDe(page, 'Taux d’acceptation')).toHaveText('33,3 %');
    await expect(
      carte(page, 'Taux d’acceptation').getByText('1 acceptent sur 3 joints', { exact: true }),
    ).toHaveCount(1);

    const attendu = ['4', '75,0 %', '1', '1', '33,3 %', '0', '0'];
    await expect(ligneDe(tableauEquipe(page), page, superviseur.nom).getByRole('cell')).toHaveText(
      attendu,
    );
    await expect(ligneDe(tableauEquipe(page), page, 'Équipe').getByRole('cell')).toHaveText(
      attendu,
    );

    await page.reload();
    await expect(
      chiffreDe(page, 'Taux de joignabilité des représentants'),
      'un rechargement complet doit rendre le même écran',
    ).toHaveText('75,0 %');

    await page.goto(urlChiffres(JOURNEE_VIDE, JOURNEE_VIDE, superviseur.id));
    await expect(chiffreDe(page, 'Taux de joignabilité des représentants')).toHaveText(
      'Sans objet',
    );
    await expect(
      carte(page, 'Taux de joignabilité des représentants').getByText(
        'Aucun représentant appelé sur la période',
        { exact: true },
      ),
    ).toHaveCount(1);

    await page.goto(urlChiffres(JOURNEE, JOURNEE, teleconseiller.id));
    await expect(
      chiffreDe(page, 'Taux de joignabilité des représentants'),
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

  test('les montants et le taux de rappel du même jeu', async ({ page }) => {
    await page.goto(urlChiffres(JOURNEE, JOURNEE, superviseur.id));

    await expect(carte(page, 'Encaissé')).toContainText('FCFA');
    await expect(carte(page, 'De l’appel à l’encaissement')).toBeVisible();
    await expect(chiffreDe(page, 'Taux de rappel')).toHaveText('25,0 %');
    await expect(
      carte(page, 'Taux de rappel').getByText(
        '1 à rappeler sur 4 fiches · 0 à venir, 0 tenus, 0 en retard',
        { exact: true },
      ),
    ).toHaveCount(1);
  });
});

test.describe('parité disposition, composer l’écran des chiffres', () => {
  test.use({ storageState: superviseur.etat });

  test('retirer une carte : la sortie demande confirmation, l’enregistrement tient', async ({
    page,
    browser,
  }) => {
    await page.goto('/chues/statistiques');
    await composer(page);
    await expect(page.getByRole('button', { name: 'Ajouter un graphique' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Proposer par défaut' }),
      'fixer la disposition de toute l’entreprise reste réservé à l’ADMIN',
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Retirer Taux d’acceptation' }).click();
    await page.getByRole('button', { name: 'Quitter' }).click();
    const sortie = page.getByRole('dialog');
    await expect(sortie).toContainText('Les changements faits dans ce mode seront perdus.');
    await sortie.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await expect(carte(page, 'Taux d’acceptation')).toBeVisible();

    await composer(page);
    await page.getByRole('button', { name: 'Retirer Taux d’acceptation' }).click();
    await enregistrer(page);
    await expect(carte(page, 'Taux d’acceptation')).toHaveCount(0);

    await page.reload();
    await expect(carte(page, 'Taux d’acceptation')).toHaveCount(0);
    const enregistree = await ligne<{ sources: string }>(
      `SELECT string_agg(w->>'source', ',') AS sources
         FROM dashboard_layouts, jsonb_array_elements(layout->'widgets') w
        WHERE "userId" = $1 AND ecran = 'chues'`,
      [superviseur.id],
    );
    expect(enregistree?.sources ?? '').not.toContain('taux-d-acceptation');
    expect(enregistree?.sources ?? '').toContain('taux-de-qualification');

    const direction = await browser.newContext({ storageState: compteDe('DIRECTION').etat });
    const vueDirection = await direction.newPage();
    await vueDirection.goto('/chues/statistiques');
    await expect(
      carte(vueDirection, 'Taux d’acceptation'),
      'la disposition d’un superviseur ne touche pas l’écran de la direction',
    ).toBeVisible();
    await direction.close();

    await page.getByRole('button', { name: 'Revenir à l’écran par défaut' }).click();
    await expect(carte(page, 'Taux d’acceptation')).toBeVisible();
    const restante = await ligne<{ n: string }>(
      'SELECT count(*) AS n FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2',
      [superviseur.id, 'chues'],
    );
    expect(Number(restante?.n), 'revenir au défaut efface la disposition du compte').toBe(0);
  });

  test('l’ordre se change au clavier, il survit, et l’autre écran garde le sien', async ({
    page,
  }) => {
    await page.goto('/chues/statistiques');
    await composer(page);

    const avant = await ordreDesCartes(page);
    const premier = avant[0] ?? '';
    await page.getByRole('button', { name: `Descendre ${premier}` }).click();
    const apres = await ordreDesCartes(page);
    expect(apres[0], 'la carte descendue ne peut pas rester en tête').not.toBe(premier);
    await expect(page.getByRole('button', { name: `Monter ${apres[0] ?? ''}` })).toBeDisabled();

    await enregistrer(page);
    await page.reload();
    await composer(page);
    expect(await ordreDesCartes(page)).toEqual(apres);
    await page.getByRole('button', { name: 'Quitter' }).click();

    await page.goto('/grand-public/statistiques');
    for (const titre of ['Taux de joignabilité', 'Prospects saisis', 'Par téléconseiller']) {
      await expect(
        carte(page, titre),
        `« ${titre} » d’usine sur l’écran Grand Public`,
      ).toBeVisible();
    }

    await page.goto('/chues/statistiques');
    await page.getByRole('button', { name: 'Revenir à l’écran par défaut' }).click();
    await expect(page.getByRole('button', { name: 'Revenir à l’écran par défaut' })).toHaveCount(0);
  });

  test('le tiroir ne propose pas une carte déjà posée et ajoute celle qu’on choisit', async ({
    page,
  }) => {
    await page.goto('/chues/statistiques');
    await composer(page);
    await page.getByRole('button', { name: 'Ajouter un graphique' }).click();

    const tiroir = page.getByRole('dialog');
    await expect(tiroir).toContainText('Choisissez une question.');
    await expect(
      tiroir.getByRole('heading', { name: 'Taux d’acceptation', exact: true }),
      'une source déjà posée ne doit pas être proposée deux fois',
    ).toHaveCount(0);

    const proposee = tiroir
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Prospects saisis', exact: true }) });
    await proposee.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await tiroir.getByRole('button', { name: 'Fermer' }).click();
    await expect(carte(page, 'Prospects saisis')).toBeVisible();

    // On quitte sans enregistrer : ce parcours ne laisse aucune disposition.
    await page.getByRole('button', { name: 'Quitter' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Quitter sans enregistrer' })
      .click();
    await expect(carte(page, 'Prospects saisis')).toHaveCount(0);
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
