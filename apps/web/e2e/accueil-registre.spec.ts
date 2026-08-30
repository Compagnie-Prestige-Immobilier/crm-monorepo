import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Registre des visites, ACC-REG-01 à ACC-REG-18 (E2E.md §7.3.1).
 *
 * `VisitesController` n'expose que GET, POST et PATCH : une visite créée ici
 * reste en base pour toujours. D'où le `RUN` horodaté du §5.1 et le filtre sur
 * le préfixe dans CHAQUE comptage.
 *
 * Une seule page pour tout le fichier : ACC-REG-04 prouve que la visite
 * enregistrée apparaît SANS rechargement, ce qu'une page neuve par test
 * rendrait invérifiable.
 */

test.use({ storageState: 'e2e/.auth/accueil.json' });
test.describe.configure({ mode: 'serial' });

const RUN = String(Date.now()).slice(-8);
const PREFIXE = `E2E-ACC-REG-${RUN}`;
const NOM_PRINCIPAL = `${PREFIXE} Awa Diop`;
const NOM_ACCENTUE = `${PREFIXE} Ndèye O’Brien-Sy «ç»`;
const COMMENTAIRE_ACCENTUE = 'Accents : é à ù — «guillemets» & <balise>';
const TELEPHONE = '78 454 44 66';

const COMPTEUR_JOUR = /^[\d\s]+ visites? aujourd’hui$/u;
const COMPTEUR_REGISTRE = /^[\d\s]+ visites? au registre$/u;
/**
 * Le `<li>` de sonner 2.0.8 ne porte AUCUN `role` : `getByRole('status')` ne
 * trouve jamais un toast dans ce dépôt. On vise le libellé.
 */
const TOAST_ENREGISTREE = /^Visite (V-\d{4}-\d{6}) enregistrée\.$/u;

/** Un an en arrière, le 1er janvier : le registre n'y a jamais rien porté. */
const JOUR_VIDE = `${String(new Date().getUTCFullYear() - 1)}-01-01`;
const JOUR_VIDE_ANNEE = JOUR_VIDE.slice(0, 4);
const JOUR_VIDE_CELLULE = `01 janvier ${JOUR_VIDE_ANNEE}`;

/** Ordre des colonnes du classeur : N° REGISTRE, DATE, HEURE, PRENOM ET NOMS. */
const COLONNE_NOM = 3;

let page: Page;
let referencePrincipale = '';
let identifiantEntrepriseCpi = '';

test.beforeAll(async ({ browser }) => {
  const contexte = await browser.newContext({
    storageState: 'e2e/.auth/accueil.json',
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
  });
  page = await contexte.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

/**
 * La liste des visites est demandée par le composant client : attendre sa
 * réponse prouve que l'hydratation a eu lieu. Sans cela, un clic ou une frappe
 * posés sur le rendu serveur sont perdus, et l'écran ne bouge jamais.
 */
async function ouvrirRegistre(url: string): Promise<void> {
  const chargement = page.waitForResponse((reponse) =>
    reponse.url().includes('/api/v1/visites?'),
  );
  // `load` attend toutes les sous-ressources du serveur de développement ; la
  // vraie condition de départ est la réponse du registre, attendue juste après.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await chargement;
}

function periode(): Locator {
  return page.getByRole('group', { name: 'Période' });
}

function lignes(nom: string): Locator {
  return page.getByRole('table').getByRole('row').filter({ hasText: nom });
}

async function ouvrirRecherche(): Promise<Locator> {
  await page.getByRole('button', { name: 'Rechercher et filtrer' }).click();
  const champ = page.getByRole('textbox', { name: 'Recherche', exact: true });
  await expect(champ).toBeVisible();
  return champ;
}

async function choisir(racine: Locator, champ: string, option: string): Promise<void> {
  await racine.getByRole('combobox', { name: new RegExp(`^${champ}`, 'u') }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/**
 * Les deux calendriers restent montés côte à côte : sans cette portée, `Effacer`
 * et les sélecteurs de mois trouvent deux éléments. La grille porte le libellé
 * du champ, c'est le seul repère qui distingue `Du` de `Au`.
 */
function calendrier(champ: 'Du' | 'Au'): Locator {
  return page
    .locator('[data-slot="popover-content"]')
    .filter({ has: page.getByRole('grid', { name: champ, exact: true }) });
}

function cleDate(champ: 'Du' | 'Au'): string {
  return champ === 'Du' ? 'dateFrom' : 'dateTo';
}

/**
 * Chaque date est publiée dans l'URL avant la suivante : `setFilters` lit les
 * filtres de son rendu, et enchaîner deux choix sans attendre la navigation
 * republie l'ancien état par-dessus le premier.
 */
async function poserDate(champ: 'Du' | 'Au'): Promise<void> {
  await page.getByRole('button', { name: champ, exact: true }).click();
  const boite = calendrier(champ);
  await boite.getByRole('combobox', { name: 'Année affichée' }).click();
  await page.getByRole('option', { name: JOUR_VIDE_ANNEE, exact: true }).click();
  await boite.getByRole('combobox', { name: 'Mois affiché' }).click();
  await page.getByRole('option', { name: 'janvier', exact: true }).click();
  await boite.getByRole('gridcell', { name: JOUR_VIDE_CELLULE, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]${cleDate(champ)}=${JOUR_VIDE}(?:&|$)`, 'u'));
}

function nombreAnnonce(texte: string): number {
  return Number(texte.replace(/\D/gu, ''));
}

async function ouvrirSaisie(): Promise<Locator> {
  await page.getByRole('button', { name: 'Ajouter une visite' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Enregistrer une visite' });
  await expect(dialogue).toBeVisible();
  return dialogue.getByRole('form', { name: 'Enregistrer une visite' });
}

test('ACC-REG-01 l’écran s’ouvre sur la journée, sans état d’erreur', async () => {
  await ouvrirRegistre('/accueil');

  await expect(page.getByRole('button', { name: 'Ajouter une visite' })).toBeVisible();

  await expect(periode().getByRole('button')).toHaveCount(2);
  await expect(periode().getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(periode().getByRole('button', { name: 'Tout le registre' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await expect(page.getByRole('heading', { level: 2, name: COMPTEUR_JOUR })).toHaveCount(1);

  for (const titre of ['Serveur injoignable', 'Chargement impossible', 'Accès refusé']) {
    await expect(
      page.getByRole('heading', { name: titre, exact: true }),
      `« ${titre} » ne doit pas s’afficher sur /accueil en session ACCUEIL`,
    ).toHaveCount(0);
  }
});

test('ACC-REG-02 les deux états vides ne se confondent pas', async () => {
  await ouvrirRegistre('/accueil');
  await ouvrirRecherche();

  await poserDate('Du');
  await poserDate('Au');
  await expect(page).toHaveURL(new RegExp(`dateFrom=${JOUR_VIDE}&dateTo=${JOUR_VIDE}`, 'u'));

  await expect(
    page.getByRole('heading', { level: 2, name: 'Aucune visite pour cette recherche' }),
  ).toBeVisible();
  await expect(
    page.getByText('Élargissez la période ou retirez un filtre.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Voir tout le registre' }),
    'sur une recherche filtrée, « Voir tout le registre » effacerait les critères posés',
  ).toHaveCount(0);

  // Le second état vide de ACC-REG-02 — journée sans aucune visite, titre
  // « Aucune visite enregistrée aujourd’hui » et bouton « Voir tout le
  // registre » — n'est PAS joué : la journée porte déjà des visites
  // `E2E-ACC-XLS-*` et le registre n'a aucune route de suppression. Voir le
  // retour d'agent ; prérequis à trancher par le mainteneur central (§3.4).
  await page.getByRole('button', { name: 'Retirer les filtres' }).click();
  await expect(page).toHaveURL(/\/accueil$/u);
  await periode().getByRole('button', { name: 'Aujourd’hui' }).click();
  await expect(periode().getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('ACC-REG-03 enregistrer une visite, la file d’attente conserve l’entreprise', async () => {
  await ouvrirRegistre('/accueil');
  const formulaire = await ouvrirSaisie();
  await expect(formulaire).toHaveCount(1);

  const nom = formulaire.getByRole('textbox', { name: /^PRENOM ET NOMS/u });
  const entreprise = formulaire.getByRole('combobox', { name: /^ENTREPRISE/u });
  const objet = formulaire.getByRole('combobox', { name: /^OBJET VISITE/u });
  const commentaire = formulaire.getByRole('textbox', {
    name: 'COMMENTAIRES / NOTES',
    exact: true,
  });

  await expect(entreprise, 'nom accessible du FilterCombobox requis (E2E.md §8, Q-09)')
    .toHaveAccessibleName('ENTREPRISE Obligatoire Choisir');

  await nom.fill(NOM_PRINCIPAL);
  await formulaire.getByRole('textbox', { name: 'TELEPHONES', exact: true }).fill(TELEPHONE);
  await choisir(formulaire, 'ENTREPRISE', 'CPI');
  await choisir(formulaire, 'OBJET VISITE', 'SUIVI DE DOSSIER');
  await commentaire.fill('E2E premiere ligne');

  await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();

  const toast = page.getByText(TOAST_ENREGISTREE);
  await expect(toast).toBeVisible();
  const texte = (await toast.innerText()).trim();
  expect(texte).toMatch(TOAST_ENREGISTREE);
  referencePrincipale = TOAST_ENREGISTREE.exec(texte)?.[1] ?? '';

  await expect(page.getByRole('dialog', { name: 'Enregistrer une visite' })).toBeVisible();
  await expect(nom).toHaveValue('');
  await expect(nom).toBeFocused();
  await expect(entreprise).toHaveText('CPI');
  await expect(objet).toHaveText('Choisir');
  await expect(commentaire).toHaveValue('');
});

test('ACC-REG-04 la nouvelle visite apparaît en tête du registre', async () => {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Enregistrer une visite' })).toHaveCount(0);

  const champ = await ouvrirRecherche();
  await champ.fill(PREFIXE);

  const ligne = lignes(PREFIXE);
  await expect(ligne).toHaveCount(1);
  await expect(ligne.getByRole('cell', { name: NOM_PRINCIPAL, exact: true })).toHaveCount(1);
  await expect(ligne.getByRole('cell', { name: referencePrincipale, exact: true })).toHaveCount(1);
  await expect(ligne.getByRole('cell', { name: 'CPI', exact: true })).toHaveCount(1);
  await expect(ligne.getByRole('cell', { name: 'SUIVI DE DOSSIER', exact: true })).toHaveCount(1);
});

test('ACC-REG-05 le nom vide est refusé, champ par champ', async () => {
  await ouvrirRegistre('/accueil');

  const envois: string[] = [];
  const espion = (requete: { method: () => string; url: () => string }): void => {
    if (requete.method() === 'POST' && requete.url().includes('/api/v1/visites')) {
      envois.push(requete.url());
    }
  };
  page.on('request', espion);

  const formulaire = await ouvrirSaisie();
  await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();

  await expect(formulaire.getByRole('alert')).toHaveText([
    'À renseigner.',
    'À choisir dans la liste.',
    'À choisir dans la liste.',
  ]);
  await expect(formulaire.getByRole('textbox', { name: /^PRENOM ET NOMS/u })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByRole('dialog', { name: 'Enregistrer une visite' })).toBeVisible();

  page.off('request', espion);
  expect(envois, 'un formulaire incomplet ne doit rien envoyer à l’API').toEqual([]);
});

test('ACC-REG-06 un nom d’un seul caractère est refusé', async () => {
  await ouvrirRegistre('/accueil');
  const formulaire = await ouvrirSaisie();

  const nom = formulaire.getByRole('textbox', { name: /^PRENOM ET NOMS/u });
  await nom.fill('A');
  await nom.blur();

  await expect(formulaire.getByRole('alert')).toHaveText(['Au moins deux caractères.']);
});

test('ACC-REG-07 la date effacée est signalée', async () => {
  await ouvrirRegistre('/accueil');

  const envois: string[] = [];
  const espion = (requete: { method: () => string; url: () => string }): void => {
    if (requete.method() === 'POST' && requete.url().includes('/api/v1/visites')) {
      envois.push(requete.url());
    }
  };
  page.on('request', espion);

  const formulaire = await ouvrirSaisie();
  await formulaire.getByRole('button', { name: 'DATE VISITE', exact: true }).click();
  await page.getByRole('button', { name: 'Effacer', exact: true }).click();

  await formulaire.getByRole('textbox', { name: /^PRENOM ET NOMS/u }).fill(`${PREFIXE} Sans date`);
  await choisir(formulaire, 'ENTREPRISE', 'CPI');
  await choisir(formulaire, 'OBJET VISITE', 'SUIVI DE DOSSIER');
  await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();

  await expect(formulaire.getByRole('alert')).toHaveText(['À renseigner.']);
  await expect(page.getByRole('dialog', { name: 'Enregistrer une visite' })).toBeVisible();

  page.off('request', espion);
  expect(envois, 'une date effacée ne doit pas partir à l’API').toEqual([]);
});

test('ACC-REG-08 le commentaire compte ses caractères et s’arrête à 2000', async () => {
  await ouvrirRegistre('/accueil');
  const formulaire = await ouvrirSaisie();

  const commentaire = formulaire.getByRole('textbox', {
    name: 'COMMENTAIRES / NOTES',
    exact: true,
  });
  await commentaire.fill('0123456789');
  await expect(formulaire.getByText('10 / 2000 caractères', { exact: true })).toBeVisible();

  await commentaire.fill('x'.repeat(2100));
  await expect(commentaire).toHaveValue('x'.repeat(2000));
  await expect(formulaire.getByText('2000 / 2000 caractères', { exact: true })).toBeVisible();
  // Le champ du nom, autofocalisé puis quitté, porte déjà son propre message :
  // ce qui est vérifié ici est que le COMMENTAIRE n'en porte aucun.
  await expect(commentaire).toHaveAttribute('aria-invalid', 'false');
  await expect(
    formulaire.getByText('2000 caractères au maximum.', { exact: true }),
  ).toHaveCount(0);
});

test('ACC-REG-09 les caractères spéciaux et les accents traversent le tour complet', async () => {
  await ouvrirRegistre('/accueil');
  const formulaire = await ouvrirSaisie();

  await formulaire.getByRole('textbox', { name: /^PRENOM ET NOMS/u }).fill(NOM_ACCENTUE);
  await choisir(formulaire, 'ENTREPRISE', 'CPI');
  await choisir(formulaire, 'OBJET VISITE', 'SUIVI DE DOSSIER');
  await formulaire
    .getByRole('textbox', { name: 'COMMENTAIRES / NOTES', exact: true })
    .fill(COMMENTAIRE_ACCENTUE);
  await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();

  await expect(page.getByText(TOAST_ENREGISTREE)).toBeVisible();

  await page.keyboard.press('Escape');
  const champ = await ouvrirRecherche();
  await champ.fill(PREFIXE);

  const ligne = lignes(NOM_ACCENTUE);
  await expect(ligne).toHaveCount(1);
  await expect(ligne.getByRole('cell', { name: NOM_ACCENTUE, exact: true })).toHaveCount(1);
  await expect(ligne.getByRole('cell', { name: COMMENTAIRE_ACCENTUE, exact: true })).toHaveCount(1);
  await expect(page.getByText('&lt;balise&gt;')).toHaveCount(0);
  await expect(page.locator('balise')).toHaveCount(0);
});

test('ACC-REG-10 les filtres vivent dans l’URL et survivent au rechargement', async () => {
  await ouvrirRegistre('/accueil');
  const champ = await ouvrirRecherche();
  await champ.fill(PREFIXE);
  await expect(page).toHaveURL(new RegExp(`\\?search=${PREFIXE}$`, 'u'));

  await page.getByRole('button', { name: /^Filtres avancés/u }).click();
  await choisir(page.locator('body'), 'ENTREPRISE', 'CPI');
  await expect(page).toHaveURL(
    /[?&]entrepriseId=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:&|$)/u,
  );

  identifiantEntrepriseCpi = new URL(page.url()).searchParams.get('entrepriseId') ?? '';
  const avant = page.url();
  const comptees = await lignes(PREFIXE).count();

  await page.reload();

  await expect(page).toHaveURL(avant);
  await expect(page.getByRole('textbox', { name: 'Recherche', exact: true })).toHaveValue(PREFIXE);
  await expect(page.getByRole('combobox', { name: /^ENTREPRISE/u })).toHaveText('CPI');
  await expect(lignes(PREFIXE)).toHaveCount(comptees);
});

test('ACC-REG-11 une recherche d’un seul caractère n’est pas envoyée', async () => {
  await ouvrirRegistre('/accueil');

  const appels: string[] = [];
  const espion = (requete: { method: () => string; url: () => string }): void => {
    if (requete.method() === 'GET' && requete.url().includes('/api/v1/visites?')) {
      appels.push(requete.url());
    }
  };
  page.on('request', espion);

  const champ = await ouvrirRecherche();
  const attendue = page.waitForResponse(
    (reponse) =>
      reponse.request().method() === 'GET' && reponse.url().includes('/api/v1/visites?'),
  );
  await champ.fill('E');
  await expect(page).toHaveURL(/\/accueil\?search=E$/u);
  const reponse = await attendue;

  page.off('request', espion);
  expect(
    new URL(reponse.url()).searchParams.has('search'),
    `SEARCH_MIN_LENGTH contourné : ${reponse.url()}`,
  ).toBe(false);
  expect(appels.filter((url) => new URL(url).searchParams.has('search'))).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Requête refusée', exact: true })).toHaveCount(0);
});

test('ACC-REG-12 la bascule « Tout le registre » élargit et se voit dans l’URL', async () => {
  await ouvrirRegistre('/accueil');

  const compteurJour = page.getByRole('heading', { level: 2, name: COMPTEUR_JOUR });
  await expect(compteurJour).toHaveCount(1);
  const totalJour = nombreAnnonce(await compteurJour.innerText());

  await periode().getByRole('button', { name: 'Tout le registre' }).click();

  await expect(page).toHaveURL(/\/accueil\?periode=tout$/u);
  await expect(periode().getByRole('button', { name: 'Tout le registre' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(periode().getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  const compteurRegistre = page.getByRole('heading', { level: 2, name: COMPTEUR_REGISTRE });
  await expect(compteurRegistre).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: COMPTEUR_JOUR })).toHaveCount(0);
  expect(nombreAnnonce(await compteurRegistre.innerText())).toBeGreaterThanOrEqual(totalJour);
});

test('ACC-REG-13 « Retirer les filtres » remet l’écran à zéro', async () => {
  await ouvrirRegistre(`/accueil?search=${PREFIXE}&entrepriseId=${identifiantEntrepriseCpi}`);

  await page.getByRole('button', { name: 'Retirer les filtres' }).click();

  await expect(page).toHaveURL(/\/accueil$/u);
  await expect(page.getByRole('textbox', { name: 'Recherche', exact: true })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: /^ENTREPRISE/u })).toHaveText('Toutes');
  await expect(periode().getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('ACC-REG-14 corriger une visite : la date est montrée, jamais modifiable', async () => {
  await ouvrirRegistre(`/accueil?search=${PREFIXE}&periode=tout`);

  await page.getByRole('button', { name: `Modifier la visite de ${NOM_PRINCIPAL}` }).click();

  const correction = page.getByRole('form', { name: 'Corriger la visite' });
  await expect(correction).toHaveCount(1);
  await expect(
    correction.getByRole('button', { name: 'DATE VISITE', exact: true }),
    'l’API refuse de déplacer une ligne d’un jour à l’autre : la date ne se propose pas',
  ).toHaveCount(0);
  await expect(correction.getByRole('button', { name: 'Enregistrer la correction' })).toBeVisible();
  await expect(correction.getByRole('button', { name: 'Annuler' })).toBeVisible();

  await choisir(correction, 'DESTINATAIRES', 'MME. NDOYE (RESP. COMM.)');
  await correction.getByRole('button', { name: 'Enregistrer la correction' }).click();

  await expect(
    page.getByText(`Visite ${referencePrincipale} corrigée.`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('form', { name: 'Corriger la visite' })).toHaveCount(0);

  const ligne = lignes(NOM_PRINCIPAL);
  await expect(
    ligne.getByRole('cell', { name: 'MME. NDOYE (RESP. COMM.)', exact: true }),
  ).toHaveCount(1);
  await expect(ligne.getByRole('cell', { name: referencePrincipale, exact: true })).toHaveCount(1);
});

test('ACC-REG-15 « Annuler » une correction ne modifie rien', async () => {
  await ouvrirRegistre(`/accueil?search=${PREFIXE}&periode=tout`);

  const corrections: string[] = [];
  const espion = (requete: { method: () => string; url: () => string }): void => {
    if (requete.method() === 'PATCH' && requete.url().includes('/api/v1/visites/')) {
      corrections.push(requete.url());
    }
  };
  page.on('request', espion);

  await page.getByRole('button', { name: `Modifier la visite de ${NOM_ACCENTUE}` }).click();
  const correction = page.getByRole('form', { name: 'Corriger la visite' });
  await correction
    .getByRole('textbox', { name: /^PRENOM ET NOMS/u })
    .fill(`${PREFIXE} Nom abandonne`);
  await correction.getByRole('button', { name: 'Annuler' }).click();

  await expect(page.getByRole('form', { name: 'Corriger la visite' })).toHaveCount(0);
  await expect(
    lignes(NOM_ACCENTUE).getByRole('cell', { name: NOM_ACCENTUE, exact: true }),
  ).toHaveCount(1);
  await expect(lignes(`${PREFIXE} Nom abandonne`)).toHaveCount(0);

  page.off('request', espion);
  expect(corrections, 'une correction abandonnée ne doit rien écrire').toEqual([]);
});

test('ACC-REG-16 le tri par colonne change l’URL et l’ordre', async () => {
  await ouvrirRegistre('/accueil?periode=tout');

  const entete = page.getByRole('columnheader', { name: 'PRENOM ET NOMS' });
  const corps = page.getByRole('table').getByRole('rowgroup').nth(1);
  const premierNom = corps.getByRole('row').first().getByRole('cell').nth(COLONNE_NOM);

  await entete.getByRole('button').click();
  await expect(page).toHaveURL(/\/accueil\?periode=tout&sortBy=visitorName&sortDir=asc$/u);
  await expect(entete).toHaveAttribute('aria-sort', 'ascending');
  const croissant = await premierNom.innerText();

  await entete.getByRole('button').click();
  // `serializeVisiteFilters` (lib/data/visites.ts:153) n'écrit la direction que
  // si elle diffère de `desc` : l'ordre décroissant se lit à l'absence du
  // paramètre, et le rechargement le prouve.
  await expect(page).toHaveURL(/\/accueil\?periode=tout&sortBy=visitorName$/u);
  await expect(entete).toHaveAttribute('aria-sort', 'descending');
  await expect(premierNom).not.toHaveText(croissant);

  await page.reload();
  await expect(entete).toHaveAttribute('aria-sort', 'descending');
});

test('ACC-REG-18 le bouton « Imprimer » est désactivé quand il n’y a rien à imprimer', async () => {
  await ouvrirRegistre(
    `/accueil?search=${PREFIXE}-INTROUVABLE&dateFrom=${JOUR_VIDE}&dateTo=${JOUR_VIDE}`,
  );

  await expect(
    page.getByRole('heading', { level: 2, name: 'Aucune visite pour cette recherche' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimer', exact: true })).toBeDisabled();
});
