import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * `/admin/notifications` : onglets, composeur, historique. ADM-NOT-01 à 10.
 *
 * Ce que seul un navigateur éprouve : le composeur est un assistant à DEUX
 * temps, et la promesse centrale de l'écran est qu'aucun envoi ne part du
 * premier. Un test unitaire voit le formulaire, jamais la requête qui n'est pas
 * partie. Les scénarios d'envoi sont donc écrits autour d'un écouteur réseau,
 * pas autour d'un état React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Contrainte de données : un envoi part VRAIMENT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chaque envoi de ce fichier vise l'audience la plus étroite que l'écran
 * permette : `Comptes choisis`, avec le seul identifiant d'un compte témoin
 * créé pour l'occasion. Jamais `Tout le monde`, jamais un rôle entier.
 *
 * Le compte témoin porte le domaine réservé `.test` (RFC 2606) : aucun e-mail
 * ne peut atteindre une vraie boîte. La contrepartie est que le transport
 * échoue nécessairement sur ce domaine, et le toast d'envoi le dit — voir
 * ADM-NOT-02.
 *
 * Une notification ne se supprime pas : les titres portent `RUN` (§5.1), le
 * compte témoin est stable et réutilisé d'une exécution à l'autre.
 */

test.describe.configure({ mode: 'serial' });

const RUN = String(Date.now()).slice(-8);

const TEMOIN = {
  email: 'e2e-adm-not-temoin@cpi.test',
  username: 'e2e_adm_not_temoin',
  fullName: 'E2E-ADM-NOT temoin',
  /** `+221781002220` : première de la plage réservée à ce fichier (§5.2). */
  phone: '+221781002220',
  /**
   * DIRECTION et non COMMERCIAL : un téléconseiller sans acte apparaît dans le
   * compte rendu quotidien de la supervision, et ce compte y polluerait les
   * assertions d'un autre fichier.
   */
  role: 'DIRECTION' as const,
};

const TITRE_ENVOI = `E2E-ADM-NOT ${RUN} envoi témoin`;
const TITRE_PROGRAMME = `E2E-ADM-NOT ${RUN} programmé`;
const MESSAGE = 'Message de vérification automatique, aucune action attendue.';

let temoinId = '';

interface UserRow {
  id: string;
  email: string;
}

async function lireTemoin(api: APIRequestContext): Promise<UserRow | undefined> {
  const response = await api.get('/api/v1/users', {
    params: { search: TEMOIN.email, pageSize: '10' },
  });
  expect(
    response.ok(),
    `GET /api/v1/users a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  const body = (await response.json()) as { items: UserRow[] };
  return body.items.find((row) => row.email === TEMOIN.email);
}

test.beforeAll(async () => {
  const api = await adminApi();
  try {
    const existant = await lireTemoin(api);
    if (existant !== undefined) {
      temoinId = existant.id;
      return;
    }
    // Aucun écran de ce périmètre ne crée un compte : la précondition passe par
    // l'API (§6.7). Le mot de passe n'est jamais utilisé — le témoin ne se
    // connecte pas, il reçoit.
    const cree = await api.post('/api/v1/users', {
      data: { ...TEMOIN, password: `E2E-ADM-NOT-temoin-${RUN}` },
    });
    expect(
      cree.ok(),
      `Création du compte témoin refusée (${String(cree.status())}) : ${await cree.text()}`,
    ).toBe(true);
    temoinId = ((await cree.json()) as UserRow).id;
  } finally {
    await api.dispose();
  }
});

/** Tout envoi réellement parti vers l'API, dans l'ordre. */
function watchSends(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request: Request) => {
    const { pathname } = new URL(request.url());
    if (request.method() === 'POST' && pathname === '/api/v1/notifications') seen.push(pathname);
  });
  return seen;
}

async function ouvrirHistorique(page: Page): Promise<void> {
  await page.goto('/admin/notifications');
  await expect(page).toHaveTitle(/Notifications/);
  await expect(page.getByRole('tab', { name: 'Historique' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // La liste est chargée par le CLIENT : la voir rendue prouve que l'arbre React
  // est hydraté. Sans cette borne, un clic d'onglet part dans le vide et l'URL
  // ne bouge pas, pour une raison qui n'a rien à voir avec le scénario.
  await expect(page.getByRole('table')).toBeVisible();
}

async function ouvrirComposeur(page: Page) {
  await page.getByRole('button', { name: 'Nouvelle notification' }).click();
  const dialogue = page.getByRole('dialog');
  await expect(dialogue.getByRole('heading', { name: 'Nouvelle notification' })).toBeVisible();
  await expect(dialogue.getByText('Envoi push aux destinataires choisis.')).toBeVisible();
  return dialogue;
}

/** Titre, message et audience du compte témoin : le socle de tout envoi ici. */
async function redigerVersTemoin(
  dialogue: ReturnType<Page['getByRole']>,
  page: Page,
  titre: string,
): Promise<void> {
  await dialogue.getByLabel(/^Titre/).fill(titre);
  await dialogue.getByLabel(/^Message/).fill(MESSAGE);
  await dialogue.getByLabel(/^Destinataires/).click();
  await page.getByRole('option', { name: 'Comptes choisis' }).click();
  await dialogue.getByLabel(/^Identifiants des comptes/).fill(temoinId);
}

test('ADM-NOT-01 · les trois onglets vivent dans l’URL', async ({ page }) => {
  await ouvrirHistorique(page);

  await expect(page.getByRole('tab')).toHaveText([
    'Boîte de réception',
    'Historique',
    'Gabarits',
  ]);

  await page.getByRole('tab', { name: 'Boîte de réception' }).click();
  await expect(page).toHaveURL(/\/admin\/notifications\?onglet=reception$/);

  // Le lien partagé ouvre le bon volet : c'est l'objet du scénario.
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Boîte de réception' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.goto('/admin/notifications?onglet=gabarits');
  await expect(page.getByRole('tab', { name: 'Gabarits' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // Retour au volet par défaut de l'ADMIN : il ne laisse aucun paramètre
  // derrière lui, `serializeNotificationFilters` omettant les valeurs par défaut.
  await page.getByRole('tab', { name: 'Historique' }).click();
  await expect(page).toHaveURL(/\/admin\/notifications$/);
});

test('ADM-NOT-02 · l’envoi ne part qu’après confirmation, et vers le seul témoin', async ({
  page,
}) => {
  const envois = watchSends(page);
  await ouvrirHistorique(page);

  const dialogue = await ouvrirComposeur(page);
  await redigerVersTemoin(dialogue, page, TITRE_ENVOI);

  await dialogue.getByRole('button', { name: 'Voir les destinataires' }).click();

  // Deuxième temps : l'écran annonce l'audience AVANT d'engager quoi que ce soit.
  await expect(dialogue.getByRole('heading', { name: 'Confirmer l’envoi' })).toBeVisible();
  await expect(dialogue.getByText('L’envoi est irréversible.')).toBeVisible();
  await expect(dialogue.getByText('1 destinataire', { exact: true })).toBeVisible();
  await expect(dialogue.getByText('Cet envoi s’adresse à 1 personne.')).toBeVisible();
  expect(envois, 'aucun envoi ne part avant la confirmation').toEqual([]);

  const envoyer = dialogue.getByRole('button', { name: 'Envoyer maintenant' });
  await expect(envoyer).toBeEnabled();
  await envoyer.click();

  /*
   * Le toast nomme le résultat par destinataire. Le témoin porte le domaine
   * réservé `.test` : le transport ne peut pas le remettre, et le compte
   * d'échecs vaut donc 1. C'est le prix de ne jamais écrire vers une vraie
   * boîte ; l'audience, elle, est bien d'UNE personne.
   */
  await expect(
    page.getByText('Envoyée à 0 destinataire(s), 1 échec(s).', { exact: true }),
  ).toBeVisible();

  const premiere = page.getByRole('table').getByRole('row').nth(1);
  await expect(premiere).toContainText(TITRE_ENVOI);
  await expect(premiere, 'un seul compte visé, jamais un rôle entier').toContainText(
    '1 compte choisi',
  );
  await expect(premiere).toContainText('1 au total');
  await expect(premiere).toContainText('Envoyée');
});

test('ADM-NOT-03 · un formulaire vide n’atteint jamais l’API', async ({ page }) => {
  const envois = watchSends(page);
  await ouvrirHistorique(page);

  const dialogue = await ouvrirComposeur(page);

  // Trois champs marqués obligatoires : titre, message, destinataires.
  await expect(dialogue.getByText('Obligatoire', { exact: true })).toHaveCount(3);

  const avancer = dialogue.getByRole('button', { name: 'Voir les destinataires' });
  await expect(avancer).toBeDisabled();
  await expect(avancer).toHaveAttribute('title', 'Le titre est obligatoire.');

  // Le champ manquant est nommé un par un : remplir le titre déplace le refus
  // sur le message, il ne le lève pas.
  await dialogue.getByLabel(/^Titre/).fill(`E2E-ADM-NOT ${RUN} incomplet`);
  await expect(avancer).toBeDisabled();
  await expect(avancer).toHaveAttribute('title', 'Le message est obligatoire.');

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialogue).toHaveCount(0);
  expect(envois, 'un envoi incomplet ne doit pas atteindre l’API').toEqual([]);
});

test('ADM-NOT-04 · un titre de plus de 120 caractères bloque l’envoi', async ({ page }) => {
  const envois = watchSends(page);
  await ouvrirHistorique(page);

  const dialogue = await ouvrirComposeur(page);
  const trop = `E2E-ADM-NOT ${RUN} `.padEnd(130, 'x');
  expect(trop).toHaveLength(130);

  await redigerVersTemoin(dialogue, page, trop);

  // Le compteur dit le dépassement, et l'erreur le chiffre : un titre coupé sur
  // les téléphones ne doit pas être une découverte.
  await expect(
    dialogue.getByText('130 / 120 caractères une fois les variables remplacées'),
  ).toBeVisible();
  await expect(
    dialogue.getByRole('alert').filter({ hasText: 'Le titre rendu fait 130 caractères' }),
  ).toContainText('Le titre rendu fait 130 caractères, 120 au maximum.');

  await expect(dialogue.getByRole('button', { name: 'Voir les destinataires' })).toBeDisabled();

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  expect(envois, 'un titre trop long ne doit pas partir').toEqual([]);
});

test('ADM-NOT-05 · une date passée est refusée, une date à venir programme l’envoi', async ({
  page,
}) => {
  await ouvrirHistorique(page);

  const dialogue = await ouvrirComposeur(page);
  await redigerVersTemoin(dialogue, page, TITRE_PROGRAMME);

  await dialogue.getByRole('radio', { name: 'Programmer' }).check();
  const quand = dialogue.getByLabel(/^Date et heure/);

  await quand.fill('2020-01-01T09:00');
  await expect(
    dialogue.getByRole('alert').filter({ hasText: 'Choisissez une date et une heure à venir.' }),
  ).toBeVisible();
  await expect(
    dialogue.getByRole('button', { name: 'Voir les destinataires' }),
    'une notification datée du passé partirait immédiatement',
  ).toBeDisabled();

  // Le fuseau du champ est celui de Dakar (UTC+0) : l'ISO en UTC s'y écrit tel quel.
  const demain = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  await quand.fill(demain);
  await expect(
    dialogue.getByRole('alert').filter({ hasText: 'Choisissez une date et une heure à venir.' }),
  ).toHaveCount(0);

  await dialogue.getByRole('button', { name: 'Voir les destinataires' }).click();
  const programmer = dialogue.getByRole('button', { name: 'Programmer' });
  await expect(programmer).toBeEnabled();
  await programmer.click();

  await expect(
    page.getByText('Notification programmée. Annulable jusqu’au départ.', { exact: true }),
  ).toBeVisible();

  const ligne = page.getByRole('table').getByRole('row').filter({ hasText: TITRE_PROGRAMME });
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText('Programmée');
});

test('ADM-NOT-06 · l’envoi programmé s’annule et la ligne change d’état', async ({ page }) => {
  await ouvrirHistorique(page);

  const ligne = page.getByRole('table').getByRole('row').filter({ hasText: TITRE_PROGRAMME });
  await ligne.getByRole('button', { name: 'Annuler l’envoi' }).click();

  const boite = page.getByRole('dialog');
  // La boîte nomme l'envoi visé : sans lui, on annule le mauvais.
  await expect(boite.getByRole('heading')).toContainText('Annuler l’envoi');
  await expect(boite.getByRole('heading')).toContainText(TITRE_PROGRAMME);

  await boite.getByRole('button', { name: 'Annuler l’envoi' }).click();

  await expect(page.getByText('Envoi annulé.', { exact: true })).toBeVisible();
  await expect(ligne).toContainText('Annulée');
  await expect(
    ligne.getByRole('button', { name: 'Annuler l’envoi' }),
    'un envoi annulé ne se réannule pas',
  ).toHaveCount(0);
});

test('ADM-NOT-07 · les filtres d’historique vivent dans l’URL et se vident', async ({ page }) => {
  await ouvrirHistorique(page);

  await page.getByLabel('État').click();
  await page.getByRole('option', { name: 'Annulée' }).click();
  await expect(page).toHaveURL(/\/admin\/notifications\?statut=CANCELLED$/);

  await page.getByLabel('Catégorie').click();
  await page.getByRole('option', { name: 'Campagne' }).click();
  await expect(page).toHaveURL(/\/admin\/notifications\?statut=CANCELLED&categorie=CAMPAGNE$/);

  // Aucun envoi annulé ne porte la catégorie Campagne : l'état vide FILTRÉ ne
  // dit pas la même chose que l'état vide initial.
  await expect(
    page.getByRole('heading', { name: 'Aucun envoi ne correspond à ces critères' }),
  ).toBeVisible();
  await expect(page.getByText('Changez d’état ou de catégorie.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Composer la première' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await expect(page.getByRole('table')).toBeVisible();
});

test('ADM-NOT-08 · le détail d’un envoi porte le titre de la notification', async ({ page }) => {
  await ouvrirHistorique(page);

  await page.getByRole('button', { name: TITRE_ENVOI }).click();

  const boite = page.getByRole('dialog');
  await expect(boite.getByRole('heading', { name: TITRE_ENVOI })).toBeVisible();
  // « Détail de l’envoi » n'est que le repli du chargement : le voir persister,
  // c'est ne pas savoir quel envoi on regarde.
  await expect(boite.getByRole('heading', { name: 'Détail de l’envoi' })).toHaveCount(0);
  await expect(boite.getByText('Une ligne par destinataire.')).toBeVisible();
  await expect(boite.getByRole('table').getByRole('row').filter({ hasText: TEMOIN.fullName })).toHaveCount(
    1,
  );
});

test('ADM-NOT-10 · le composeur reste utilisable à 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await ouvrirHistorique(page);

  const dialogue = await ouvrirComposeur(page);
  await redigerVersTemoin(dialogue, page, `E2E-ADM-NOT ${RUN} largeur`);

  // Aucun champ ne déborde de la fenêtre : un champ coupé à droite ne se
  // remplit pas.
  for (const champ of [
    dialogue.getByLabel(/^Titre/),
    dialogue.getByLabel(/^Message/),
    dialogue.getByLabel(/^Identifiants des comptes/),
  ]) {
    const boite = await champ.boundingBox();
    expect(boite, 'le champ doit être rendu').not.toBeNull();
    expect(boite?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((boite?.x ?? 0) + (boite?.width ?? 0)).toBeLessThanOrEqual(375);
  }

  // Le bouton d'envoi est atteignable au défilement, pas hors du dialogue.
  const avancer = dialogue.getByRole('button', { name: 'Voir les destinataires' });
  await avancer.scrollIntoViewIfNeeded();
  await expect(avancer).toBeInViewport();
  await expect(avancer).toBeEnabled();

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
});

/*
 * ADM-NOT-09 ferme la marche : le fichier est `serial` (§5.6), et ce scénario
 * est ROUGE sur un manque réel de l'application. Le placer plus haut ferait
 * sauter tout ce qui suit et masquerait neuf scénarios derrière un seul.
 */
test('ADM-NOT-09 · le lien profond signale une route inconnue', async ({ page }) => {
  await ouvrirHistorique(page);

  const dialogue = await ouvrirComposeur(page);
  const lien = dialogue.getByLabel('Lien profond');

  // Repère : le champ SAIT marquer un lien fautif. Un rouge sur l'assertion
  // suivante désignera donc l'application, pas le sélecteur.
  await lien.fill('chemin-sans-barre');
  await expect(lien).toHaveAttribute('aria-invalid', 'true');
  await expect(
    dialogue.getByRole('alert').filter({ hasText: 'Le lien doit être une route interne' }),
  ).toContainText('Le lien doit être une route interne commençant par « / ».');

  // Une route inconnue de `cpi-routes` part vers les téléphones et le tap ne
  // mène nulle part : le champ doit la signaler avant l'envoi.
  await lien.fill('/chemin-inexistant');
  await expect(
    lien,
    '« /chemin-inexistant » ne figure pas dans la liste `cpi-routes`',
  ).toHaveAttribute('aria-invalid', 'true');

  // Une route de la liste ne produit aucune erreur.
  await lien.fill('/phase2');
  await expect(lien).toHaveAttribute('aria-invalid', 'false');

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
});
