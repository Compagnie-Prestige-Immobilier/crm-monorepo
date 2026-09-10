import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Comptes utilisateurs de l'espace Admin : ADM-USR-01 à ADM-USR-17.
 *
 * Ce que seul un vrai navigateur éprouve ici : la liste s'ouvre FILTRÉE sur
 * `COMMERCIAL` (`lib/user-filters.ts`), si bien qu'un compte créé avec un autre
 * rôle disparaît de l'écran au moment même où le toast annonce sa création. Ce
 * piège ne se voit que sur l'écran rendu, jamais dans un test de composant.
 *
 * Les identifiants d'un compte supprimé ne se libèrent PAS
 * (`users.service.ts:assertIdentifiersFree` ignore `deletedAt`) : chaque
 * exécution porte donc son horodatage, et le nettoyage de tête ramasse les
 * comptes de la précédente par leur préfixe.
 */

test.use({ storageState: 'v1/.auth/admin.json' });

const RUN = String(Date.now()).slice(-8);
const PREFIXE = 'E2E-ADM-USR';
const MOT_DE_PASSE = `E2eAdmUsr${RUN}`;
const AUTRE_MOT_DE_PASSE = `E2eAdmUsrBis${RUN}`;

/** Plage réservée à ce fichier (E2E.md §5.2) : +221781002200 à 2219. */
const TELEPHONE_PROSPECT = '+221781002200';
const TELEPHONE_CREATION = '+221781002201';

function compte(cle: string): { fullName: string; email: string; username: string } {
  return {
    fullName: `${PREFIXE}-${cle}-${RUN}`,
    email: `e2e-adm-usr-${cle}-${RUN}@cpi.test`,
    username: `e2e.adm.usr.${cle}.${RUN}`,
  };
}

const CREATION = compte('creation');
const DOUBLON = compte('doublon');
const BANQUE = compte('banque');
const SANS_PORTEFEUILLE = compte('sansporte');
const PORTEFEUILLE = compte('porte');
const REPRENEUR = compte('repreneur');
const MOT_DE_PASSE_CIBLE = compte('motdepasse');
const SPECIAL = { ...compte('special'), fullName: `${PREFIXE}-Ndèye O’Brien & Cie ${RUN}` };

interface Compte {
  fullName: string;
  email: string;
  username: string;
}

let sessionUser: { id: string; fullName: string; email: string };

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

/**
 * Le nettoyage est en TÊTE de parcours : un `afterAll` ne tourne pas après un
 * échec dur, et le reliquat sert alors au diagnostic.
 */
async function nettoyer(api: APIRequestContext): Promise<void> {
  const prospects = await json<{ items: { id: string; phoneE164: string }[] }>(
    await api.get('/api/v1/prospects', {
      params: { search: TELEPHONE_PROSPECT, pageSize: '20' },
    }),
  );
  for (const row of prospects.items) {
    if (row.phoneE164 === TELEPHONE_PROSPECT) await api.delete(`/api/v1/prospects/${row.id}`);
  }

  const comptes = await json<{ items: { id: string; fullName: string }[] }>(
    await api.get('/api/v1/users', { params: { search: PREFIXE, pageSize: '100' } }),
  );
  for (const row of comptes.items) {
    if (row.fullName.startsWith(PREFIXE)) {
      const supprime = await api.delete(`/api/v1/users/${row.id}`);
      expect(supprime.ok(), `Compte ${row.fullName} non supprimé : ${await supprime.text()}`).toBe(
        true,
      );
    }
  }
}

async function creerCompte(api: APIRequestContext, cible: Compte): Promise<string> {
  const cree = await json<{ id: string }>(
    await api.post('/api/v1/users', {
      data: { ...cible, password: MOT_DE_PASSE, role: 'COMMERCIAL' },
    }),
  );
  return cree.id;
}

test.beforeAll(async () => {
  const api = await adminApi();
  try {
    await nettoyer(api);

    sessionUser = await json<{ id: string; fullName: string; email: string }>(
      await api.get('/api/v1/auth/me'),
    );

    await creerCompte(api, SANS_PORTEFEUILLE);
    await creerCompte(api, REPRENEUR);
    await creerCompte(api, MOT_DE_PASSE_CIBLE);
    const porteId = await creerCompte(api, PORTEFEUILLE);

    // Aucun écran de ce périmètre ne donne un prospect à un autre compte :
    // c'est la précondition de ADM-USR-12, pas le geste éprouvé.
    const prospect = await json<{ id: string }>(
      await api.post('/api/v1/prospects', {
        data: { nom: `${PREFIXE}-portefeuille`, prenom: RUN, phone: TELEPHONE_PROSPECT },
      }),
    );
    await json(
      await api.post('/api/v1/prospects/reassign', {
        data: { prospectIds: [prospect.id], commercialId: porteId },
      }),
    );
  } finally {
    await api.dispose();
  }
});

function ligne(page: Page, texte: string): Locator {
  return page.getByRole('table').getByRole('row').filter({ hasText: texte });
}

async function ouvrirListe(page: Page): Promise<void> {
  await page.goto('/admin/commerciaux');
  await expect(page).toHaveTitle(/Téléconseillers/);
  await expect(page.getByRole('table')).toBeVisible();
}

/**
 * Chaque filtre publié passe par `router.replace`, donc par un aller-retour
 * RSC : on attend la CONDITION « l'URL porte le critère », jamais un délai.
 */
async function chercher(page: Page, terme: string): Promise<void> {
  await page.getByLabel('Recherche').fill(terme);
  // `URLSearchParams` encode l'espace en `+`, là où `encodeURIComponent` rend
  // `%20` : c'est la forme réellement écrite dans la barre d'adresse.
  const attendu = new URLSearchParams({ search: terme }).toString();
  await page.waitForURL((url) => url.search.includes(attendu));
}

/**
 * Le filtre et le champ du dialogue portent le MÊME nom accessible « Rôle » :
 * un sélecteur non borné viole le mode strict dès que la boîte est ouverte.
 */
async function choisirRoleFiltre(page: Page, libelle: string): Promise<void> {
  const combo = page
    .getByRole('region', { name: 'Filtres' })
    .getByRole('combobox', { name: 'Rôle' });
  await combo.click();
  await page.getByRole('option', { name: libelle, exact: true }).click();
  await expect(combo).toHaveAttribute('aria-expanded', 'false');
}

async function choisirRoleDialogue(page: Page, libelle: string): Promise<void> {
  const combo = page.getByRole('dialog').getByRole('combobox', { name: 'Rôle' });
  await combo.click();
  await page.getByRole('option', { name: libelle, exact: true }).click();
  await expect(combo).toHaveAttribute('aria-expanded', 'false');
}

async function remplirCreation(
  page: Page,
  cible: Compte,
  options: { role: string; telephone?: string; motDePasse?: string },
): Promise<void> {
  const dialogue = page.getByRole('dialog');
  await dialogue.getByLabel('Nom complet').fill(cible.fullName);
  await dialogue.getByLabel('Adresse e-mail').fill(cible.email);
  await dialogue.getByLabel('Identifiant').fill(cible.username);
  if (options.telephone !== undefined) {
    await dialogue.getByLabel('Téléphone').fill(options.telephone);
  }
  await choisirRoleDialogue(page, options.role);
  await dialogue.getByLabel('Mot de passe').fill(options.motDePasse ?? MOT_DE_PASSE);
}

/** Les envois de création, pour prouver qu'un formulaire refusé ne part pas. */
function espionnerCreations(page: Page): string[] {
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() === 'POST' && requete.url().includes('/api/v1/users')) {
      envois.push(requete.url());
    }
  });
  return envois;
}

test.describe('Comptes utilisateurs', () => {
  test.describe.configure({ mode: 'serial' });

  test('ADM-USR-01 · création d’un téléconseiller', async ({ page }) => {
    await ouvrirListe(page);

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await expect(page.getByRole('dialog')).toContainText(
      'Le rôle décide de ce que le compte pourra consulter.',
    );
    await remplirCreation(page, CREATION, {
      role: 'Téléconseiller',
      telephone: TELEPHONE_CREATION,
    });
    await page.getByRole('button', { name: 'Créer le compte' }).click();

    await expect(page.getByText(`Compte de ${CREATION.fullName} créé.`)).toBeVisible();

    const creee = ligne(page, CREATION.fullName);
    await expect(creee).toHaveCount(1);
    await expect(creee).toContainText(CREATION.email);
    await expect(creee).toContainText(`@${CREATION.username}`);
    await expect(creee).toContainText('Jamais connecté');
    // La cellule « Prospects », visée par son contenu et non par son rang :
    // l'ordre des colonnes n'a pas à figer ce parcours.
    await expect(creee.getByRole('cell', { name: '0', exact: true })).toHaveCount(1);
  });

  test('ADM-USR-02 · formulaire vide', async ({ page }) => {
    await ouvrirListe(page);
    const envois = espionnerCreations(page);

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await page.getByRole('button', { name: 'Créer le compte' }).click();

    const dialogue = page.getByRole('dialog');
    for (const message of [
      'Le nom complet est obligatoire.',
      'Adresse e-mail invalide.',
      "L'identifiant compte au moins 3 caractères.",
      'Le mot de passe compte au moins 12 caractères.',
      'Choisissez le rôle du compte.',
    ]) {
      await expect(dialogue.getByText(message, { exact: true })).toBeVisible();
    }

    expect(envois, 'un formulaire refusé ne doit rien envoyer').toEqual([]);
  });

  test('ADM-USR-03 · e-mail déjà pris', async ({ page }) => {
    await ouvrirListe(page);

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await remplirCreation(page, { ...DOUBLON, email: CREATION.email }, { role: 'Téléconseiller' });
    await page.getByRole('button', { name: 'Créer le compte' }).click();

    await expect(page.getByText('Cette adresse e-mail est déjà utilisée.')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(ligne(page, CREATION.email)).toHaveCount(1);
  });

  test('ADM-USR-04 · un compte Banque & Finance est invisible sous le filtre par défaut', async ({
    page,
  }) => {
    await ouvrirListe(page);

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await remplirCreation(page, BANQUE, { role: 'Banque & Finance' });
    await page.getByRole('button', { name: 'Créer le compte' }).click();

    await expect(page.getByText(`Compte de ${BANQUE.fullName} créé.`)).toBeVisible();
    await expect(ligne(page, BANQUE.fullName)).toHaveCount(0);

    await choisirRoleFiltre(page, 'Banque & Finance');
    await page.waitForURL(/role=BANQUE_FINANCE/);
    await expect(ligne(page, BANQUE.fullName)).toHaveCount(1);
  });

  test('ADM-USR-05 · identifiant invalide', async ({ page }) => {
    await ouvrirListe(page);

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await page.getByRole('dialog').getByLabel('Identifiant').fill('e2e adm usr');
    await page.getByRole('button', { name: 'Créer le compte' }).click();

    await expect(
      page
        .getByRole('dialog')
        .getByText('Lettres, chiffres, point et tiret bas uniquement, sans espace ni accent.', {
          exact: true,
        }),
    ).toBeVisible();
  });

  test('ADM-USR-06 · mot de passe trop court', async ({ page }) => {
    await ouvrirListe(page);

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await page.getByRole('dialog').getByLabel('Mot de passe').fill('12345678901');
    await page.getByRole('button', { name: 'Créer le compte' }).click();

    await expect(
      page
        .getByRole('dialog')
        .getByText('Le mot de passe compte au moins 12 caractères.', { exact: true }),
    ).toBeVisible();
  });

  test('ADM-USR-07 · modification du rôle', async ({ page }) => {
    await ouvrirListe(page);
    await chercher(page, PREFIXE);

    await page.getByRole('button', { name: `Actions pour ${CREATION.fullName}` }).click();
    await page.getByRole('menuitem', { name: 'Modifier' }).click();
    await expect(page.getByRole('dialog')).toContainText(
      'Le mot de passe n’est pas modifiable ici.',
    );

    await choisirRoleDialogue(page, 'Supervision');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText(`Compte de ${CREATION.fullName} mis à jour.`)).toBeVisible();
    await expect(ligne(page, CREATION.fullName)).toHaveCount(0);

    await choisirRoleFiltre(page, 'Supervision');
    await page.waitForURL(/role=SUPERVISEUR/);
    await expect(ligne(page, CREATION.fullName)).toHaveCount(1);
  });

  test('ADM-USR-08 · recherche temporisée et partageable', async ({ page }) => {
    await ouvrirListe(page);
    await chercher(page, PREFIXE);

    const lignes = page.getByRole('table').getByRole('row');
    await expect(ligne(page, REPRENEUR.fullName)).toHaveCount(1);
    // Seule la ligne d'en-tête échappe au préfixe : rien d'autre n'est listé.
    await expect(lignes.filter({ hasNotText: PREFIXE })).toHaveCount(1);
    const attendues = await lignes.filter({ hasText: PREFIXE }).count();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`search=${PREFIXE}`));
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: PREFIXE })).toHaveCount(
      attendues,
    );
    await expect(
      page.getByRole('table').getByRole('row').filter({ hasNotText: PREFIXE }),
    ).toHaveCount(1);
  });

  test('ADM-USR-09 · recherche sans résultat', async ({ page }) => {
    await ouvrirListe(page);
    await chercher(page, `${PREFIXE}-inexistant`);

    await expect(page.getByText('Aucun compte ne correspond à ces critères.')).toBeVisible();
    await expect(page.getByText('Élargissez la recherche ou créez un compte.')).toBeVisible();
  });

  test('ADM-USR-10 · caractères spéciaux', async ({ page }) => {
    await ouvrirListe(page);

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    await remplirCreation(page, SPECIAL, { role: 'Téléconseiller' });
    await page.getByRole('button', { name: 'Créer le compte' }).click();

    await expect(page.getByText(`Compte de ${SPECIAL.fullName} créé.`)).toBeVisible();

    await chercher(page, 'Ndèye');
    await expect(ligne(page, SPECIAL.fullName)).toHaveCount(1);
  });

  test('ADM-USR-11 · désactivation sans portefeuille', async ({ page }) => {
    await ouvrirListe(page);
    await chercher(page, PREFIXE);

    await page.getByRole('button', { name: `Actions pour ${SANS_PORTEFEUILLE.fullName}` }).click();
    await page.getByRole('menuitem', { name: 'Désactiver le compte' }).click();

    const dialogue = page.getByRole('dialog');
    await expect(
      dialogue.getByRole('heading', {
        name: `Désactiver le compte de ${SANS_PORTEFEUILLE.fullName} ?`,
      }),
    ).toBeVisible();
    await expect(dialogue).toContainText('0 prospects sont rattachés à ce compte.');
    await expect(dialogue.getByRole('combobox')).toHaveCount(0);
    await expect(dialogue).toContainText('Rien n’est supprimé.');

    await dialogue.getByRole('button', { name: 'Désactiver le compte' }).click();

    await expect(
      page.getByText(
        `${SANS_PORTEFEUILLE.fullName} désactivé. Ses prospects et représentants sont conservés.`,
      ),
    ).toBeVisible();
    await expect(ligne(page, SANS_PORTEFEUILLE.fullName)).toContainText('Désactivé');
  });

  test('ADM-USR-12 · désactivation avec portefeuille', async ({ page }) => {
    await ouvrirListe(page);
    await chercher(page, PREFIXE);

    const bascules: string[] = [];
    page.on('request', (requete) => {
      if (/\/api\/v1\/users\/[^/]+\/active/u.test(requete.url())) bascules.push(requete.method());
    });

    await page.getByRole('button', { name: `Actions pour ${PORTEFEUILLE.fullName}` }).click();
    await page.getByRole('menuitem', { name: 'Désactiver le compte' }).click();

    const dialogue = page.getByRole('dialog');
    await expect(dialogue).toContainText('1 prospect est rattaché à ce compte.');
    await dialogue.getByRole('button', { name: 'Désactiver le compte' }).click();

    await expect(
      dialogue.getByText('Désignez le téléconseiller qui reprend le portefeuille.', {
        exact: true,
      }),
    ).toBeVisible();
    expect(bascules, 'aucune bascule ne part sans repreneur').toEqual([]);

    const repreneur = dialogue.getByRole('combobox', { name: 'Qui reprend le portefeuille' });
    await repreneur.click();
    await page.getByRole('option', { name: REPRENEUR.fullName, exact: true }).click();
    await expect(repreneur).toHaveAttribute('aria-expanded', 'false');
    await dialogue.getByRole('button', { name: 'Désactiver le compte' }).click();

    await expect(
      page.getByText(
        `${PORTEFEUILLE.fullName} désactivé. Ses prospects et représentants sont conservés.`,
      ),
    ).toBeVisible();
  });

  test('ADM-USR-13 · réactivation', async ({ page }) => {
    await ouvrirListe(page);
    await chercher(page, PREFIXE);

    await expect(ligne(page, SANS_PORTEFEUILLE.fullName)).toContainText('Désactivé');
    await page.getByRole('button', { name: `Actions pour ${SANS_PORTEFEUILLE.fullName}` }).click();
    await page.getByRole('menuitem', { name: 'Réactiver le compte' }).click();

    await expect(page.getByText(`${SANS_PORTEFEUILLE.fullName} réactivé.`)).toBeVisible();
    await expect(
      ligne(page, SANS_PORTEFEUILLE.fullName).getByText('Désactivé', { exact: true }),
    ).toHaveCount(0);
  });

  test('ADM-USR-14 · auto-protection de l’administrateur connecté', async ({ page }) => {
    await ouvrirListe(page);

    const bascules: string[] = [];
    page.on('request', (requete) => {
      if (/\/api\/v1\/users\/[^/]+\/active/u.test(requete.url())) bascules.push(requete.url());
    });

    await choisirRoleFiltre(page, 'Administrateur');
    await page.waitForURL(/role=ADMIN/);
    await expect(ligne(page, sessionUser.email)).toHaveCount(1);

    await page.getByRole('button', { name: `Actions pour ${sessionUser.fullName}` }).click();
    await expect(page.getByRole('menuitem', { name: 'Désactiver le compte' })).toBeDisabled();

    await page.keyboard.press('Escape');
    expect(bascules, 'aucune bascule ne part sur le compte de la session').toEqual([]);
  });

  test('ADM-USR-15 · réinitialisation de mot de passe', async ({ page }) => {
    await ouvrirListe(page);
    await chercher(page, PREFIXE);

    await page.getByRole('button', { name: `Actions pour ${MOT_DE_PASSE_CIBLE.fullName}` }).click();
    await page.getByRole('menuitem', { name: 'Réinitialiser le mot de passe' }).click();

    const dialogue = page.getByRole('dialog');
    await expect(dialogue).toContainText(
      `Compte de ${MOT_DE_PASSE_CIBLE.fullName} (${MOT_DE_PASSE_CIBLE.email}). Les sessions ouvertes seront fermées.`,
    );

    await dialogue.getByLabel('Nouveau mot de passe').fill(AUTRE_MOT_DE_PASSE);
    await dialogue.getByLabel('Confirmation').fill(`${AUTRE_MOT_DE_PASSE}x`);
    await dialogue.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(
      dialogue.getByText('Les deux mots de passe diffèrent.', { exact: true }),
    ).toBeVisible();

    await dialogue.getByLabel('Confirmation').fill(AUTRE_MOT_DE_PASSE);
    await dialogue.getByRole('button', { name: 'Réinitialiser' }).click();

    await expect(
      page.getByText(`Mot de passe réinitialisé. ${MOT_DE_PASSE_CIBLE.fullName} est déconnecté.`),
    ).toBeVisible();
  });

  test('ADM-USR-16 · largeur 375 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await ouvrirListe(page);

    await expect(page.getByRole('button', { name: 'Ouvrir la navigation' })).toBeVisible();

    const creer = page.getByRole('button', { name: 'Nouvel utilisateur' });
    const cadre = await creer.boundingBox();
    expect(cadre, 'le bouton de création doit être mesurable').not.toBeNull();
    expect((cadre?.x ?? 0) + (cadre?.width ?? 0)).toBeLessThanOrEqual(375);

    await chercher(page, PREFIXE);
    await page.getByRole('button', { name: `Actions pour ${REPRENEUR.fullName}` }).click();
    for (const entree of ['Modifier', 'Réinitialiser le mot de passe', 'Désactiver le compte']) {
      await expect(page.getByRole('menuitem', { name: entree })).toBeVisible();
    }
    await page.keyboard.press('Escape');
  });
});

/**
 * Hors de la série : ce parcours est ATTENDU ROUGE (E2E.md §1.10). Le laisser
 * dans la série ferait sauter les seize autres au premier échec.
 */
test.describe('Pagination', () => {
  test('ADM-USR-17 · la pagination par URL', async ({ page }) => {
    await page.goto('/admin/commerciaux?page=2');
    await expect(page).toHaveTitle(/Téléconseillers/);
    await expect(page.getByRole('table')).toBeVisible();
    // Q-24 : le paramètre est lu, le serveur sert bien une deuxième page — vide.
    await expect(page.getByText('Aucun compte ne correspond à ces critères.')).toBeVisible();

    await expect(
      page.getByRole('button', { name: /Page suivante|Suivant|Page précédente/ }),
      'la deuxième page est demandée au serveur, mais aucun contrôle ne permet d’y aller ni d’en revenir',
    ).not.toHaveCount(0);
  });
});
