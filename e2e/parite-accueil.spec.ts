import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import ExcelJS from 'exceljs';

import { avecBase, compteDe } from './comptes';
import { compter, ligne } from './donnees-listes';

const ACCUEIL = compteDe('ACCUEIL');
const DIRECTION = compteDe('DIRECTION');

const MARQUE = randomUUID().slice(0, 8);
const PREFIXE = `E2E accueil ${MARQUE}`;
const NOM = `${PREFIXE} Awa Diop`;
const NOM_ACCENTUE = `${PREFIXE} Ndèye O’Brien-Sy «ç»`;
const NOTE = 'Accents : é à ù «guillemets» & <balise>';
const TELEPHONE = '+221781120012';
const CODE = `E2E_ACCUEIL_${MARQUE.toUpperCase()}`;
const LIBELLE = `${PREFIXE} Entreprise`;
const RENOMME = `${LIBELLE} bis`;
const ENTREPRISE = 'CPI';
const OBJET = 'SUIVI DE DOSSIER';
const DESTINATAIRE = 'MME. NDOYE (RESP. COMM.)';

const JOUR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(new Date());
const JOUR_FR = `${JOUR.slice(8, 10)}/${JOUR.slice(5, 7)}/${JOUR.slice(0, 4)}`;
const ANNONCE = /^Visite (V-\d{4}-\d{6}) enregistrée\.$/u;
const FIXTURES = path.join(__dirname, 'fixtures');
const ENTREE = 'SELECT label, "isActive" FROM visite_entreprises WHERE code = $1';

let reference = '';
let referenceImportee = '';

type Racine = Page | Locator;

const bouton = (dans: Racine, nom: string): Locator =>
  dans.getByRole('button', { name: nom, exact: true });
const texte = (dans: Racine, valeur: string): Locator => dans.getByText(valeur, { exact: true });
const titre = (dans: Racine, nom: string): Locator => dans.getByRole('heading', { name: nom });
const boite = (page: Page, nom: string): Locator => page.getByRole('dialog', { name: nom });
const rangee = (page: Page, nom: string): Locator => page.getByRole('row').filter({ hasText: nom });
const visitesDuJour = (): Promise<number> =>
  compter(
    `SELECT count(*) AS n FROM visites
      WHERE ("visitedAt" AT TIME ZONE 'Africa/Dakar')::date = (now() AT TIME ZONE 'Africa/Dakar')::date`,
    [],
  );
const visitesAffichees = async (page: Page): Promise<number> =>
  Number.parseInt(
    (await page.getByRole('heading', { name: /^\d+ visites? aujourd’hui$/u }).innerText()).split(
      ' ',
    )[0] ?? '0',
    10,
  );

/** Le champ que porte ce libellé : « Obligatoire » colle au texte du `<label>`. */
const champ = (dans: Racine, libelle: string): Locator =>
  dans.getByLabel(new RegExp(`^${libelle}`, 'u'));

function espionner(page: Page, garde: (requete: Request) => boolean): string[] {
  const vues: string[] = [];
  page.on('request', (requete) => {
    if (garde(requete)) vues.push(requete.url());
  });
  return vues;
}

async function choisir(dans: Locator, libelle: string, option: string): Promise<void> {
  await champ(dans, libelle).click();
  await dans.page().getByRole('option', { name: option, exact: true }).click();
}

async function ouvrirSaisie(page: Page): Promise<Locator> {
  await bouton(page, 'Ajouter une visite').click();
  const saisie = page.getByRole('form', { name: 'Enregistrer une visite' });
  await expect(saisie).toBeVisible();
  return saisie;
}

async function nettoyer(): Promise<void> {
  await avecBase(async (client) => {
    const travaux = 'SELECT id FROM import_jobs WHERE "requestedById" = $1';
    await client.query(`DELETE FROM visite_import_changes WHERE "importJobId" IN (${travaux})`, [
      DIRECTION.id,
    ]);
    await client.query('DELETE FROM import_jobs WHERE "requestedById" = $1', [DIRECTION.id]);
    await client.query('DELETE FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2', [
      ACCUEIL.id,
      'visites',
    ]);
    await client.query(`DELETE FROM visites WHERE "visitorName" LIKE 'E2E accueil %';
       DELETE FROM visite_entreprises WHERE code LIKE 'E2E\\_ACCUEIL\\_%'`);
  });
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(nettoyer);
test.afterAll(nettoyer);

test.describe('parité accueil, le registre et son tableau de bord', () => {
  test.use({ storageState: ACCUEIL.etat });

  test('la journée part de zéro, la file enchaîne, la saisie incomplète reste', async ({
    page,
  }) => {
    const envois = espionner(
      page,
      (requete) => requete.method() === 'POST' && requete.url().endsWith('/api/v1/visites'),
    );
    // D'autres parcours écrivent aussi au registre pendant ce temps : le compteur
    // part de ce que la base tient, et l'état vide ne se montre que s'il dit zéro.
    const deja = await visitesDuJour();
    await page.goto('/accueil');
    await expect.poll(() => visitesAffichees(page)).toBeGreaterThanOrEqual(deja);
    if ((await visitesAffichees(page)) === 0) {
      await expect(titre(page, 'Aucune visite enregistrée aujourd’hui')).toBeVisible();
    }

    const saisie = await ouvrirSaisie(page);
    await bouton(saisie, 'Enregistrer la visite').click();
    await expect(saisie.getByRole('alert')).toHaveText([
      'À renseigner.',
      'À choisir dans la liste.',
      'À choisir dans la liste.',
    ]);
    expect(envois, 'rien ne part tant qu’un champ manque').toEqual([]);

    await expect(champ(saisie, 'DATE VISITE')).toHaveValue(JOUR);
    await champ(saisie, 'PRENOM ET NOMS').fill(NOM);
    await champ(saisie, 'TELEPHONES').fill(TELEPHONE);
    await choisir(saisie, 'ENTREPRISE', ENTREPRISE);
    await choisir(saisie, 'OBJET VISITE', OBJET);
    await bouton(saisie, 'Enregistrer la visite').click();

    const annonce = page.getByText(ANNONCE).first();
    await expect(annonce).toBeVisible();
    reference = ANNONCE.exec(await annonce.innerText())?.[1] ?? '';
    expect(reference).toMatch(/^V-\d{4}-\d{6}$/u);

    await expect(saisie, 'le dialogue reste ouvert pour le suivant').toBeVisible();
    await expect(champ(saisie, 'PRENOM ET NOMS')).toHaveValue('');
    await expect(champ(saisie, 'PRENOM ET NOMS')).toBeFocused();
    await expect(champ(saisie, 'ENTREPRISE'), 'la file garde l’entreprise').toHaveText(ENTREPRISE);
    await expect(champ(saisie, 'OBJET VISITE')).toHaveText('Choisir');

    await champ(saisie, 'PRENOM ET NOMS').fill(NOM_ACCENTUE);
    await choisir(saisie, 'OBJET VISITE', OBJET);
    await champ(saisie, 'COMMENTAIRES / NOTES').fill(NOTE);
    await bouton(saisie, 'Enregistrer la visite').click();
    await expect(champ(saisie, 'PRENOM ET NOMS')).toHaveValue('');
    await page.keyboard.press('Escape');

    await expect.poll(() => visitesAffichees(page)).toBeGreaterThanOrEqual(deja + 2);
    const accentuee = rangee(page, NOM_ACCENTUE);
    await expect(accentuee.getByRole('cell', { name: NOTE, exact: true })).toHaveCount(1);
    await expect(page.locator('balise'), 'le nom n’est jamais interprété').toHaveCount(0);

    const requete = 'SELECT reference, phone FROM visites WHERE "visitorName" = $1';
    const gardee = await ligne<{ reference: string; phone: string }>(requete, [NOM]);
    expect(gardee?.reference).toBe(reference);
    expect(gardee?.phone, 'le téléphone saisi arrive en base').toBe(TELEPHONE);
    const total = await compter('SELECT count(*) AS n FROM visites WHERE "visitorName" LIKE $1', [
      `${PREFIXE}%`,
    ]);
    expect(total, 'deux saisies, deux lignes, aucune perte').toBe(2);
  });

  test('les critères et le tri vivent dans l’URL, l’état vide le dit', async ({ page }) => {
    const listes = espionner(page, (requete) => requete.url().includes('/api/v1/visites?'));
    await page.goto('/accueil');
    await bouton(page, 'Rechercher et filtrer').click();
    const recherche = page.getByLabel('Rechercher', { exact: true });
    await recherche.fill('E');
    await expect(page).toHaveURL(/\/accueil\?search=E$/u);
    const avecTerme = (): number => listes.filter((url) => url.includes('search=')).length;
    await expect.poll(avecTerme, { message: 'un caractère ne part pas au serveur' }).toBe(0);

    await recherche.fill(MARQUE);
    await expect(rangee(page, NOM)).toHaveCount(1);
    await bouton(page, 'Tout le registre').click();
    await expect(page).toHaveURL(new RegExp(`search=${MARQUE}&periode=tout$`, 'u'));

    const entete = page.getByRole('columnheader', { name: 'PRENOM ET NOMS' });
    await entete.getByRole('button').click();
    await expect(page).toHaveURL(/sortBy=visitorName&sortDir=asc$/u);
    await expect(entete).toHaveAttribute('aria-sort', 'ascending');
    // Décroissant est le défaut : il se lit à l'absence du paramètre.
    await entete.getByRole('button').click();
    await expect(page).toHaveURL(/sortBy=visitorName$/u);

    await page.goto(`/accueil?search=${MARQUE}-introuvable&periode=tout`);
    await expect(titre(page, 'Aucune visite pour cette recherche')).toBeVisible();
    await bouton(page, 'Retirer les filtres').click();
    await expect(page).toHaveURL(/\/accueil$/u);
    await expect(bouton(page, 'Aujourd’hui')).toHaveAttribute('aria-pressed', 'true');
  });

  test('corriger une visite, puis préparer l’impression du registre filtré', async ({ page }) => {
    const patchs = espionner(
      page,
      (requete) => requete.method() === 'PATCH' && requete.url().includes('/api/v1/visites/'),
    );
    await page.goto(`/accueil?search=${MARQUE}&periode=tout`);
    await bouton(page, `Modifier la visite de ${NOM_ACCENTUE}`).click();
    let correction = page.getByRole('form', { name: 'Corriger la visite' });
    await champ(correction, 'PRENOM ET NOMS').fill(`${PREFIXE} Nom abandonne`);
    await bouton(correction, 'Annuler').click();
    await expect(rangee(page, NOM_ACCENTUE)).toHaveCount(1);
    expect(patchs, 'une correction abandonnée n’écrit rien').toEqual([]);

    await bouton(page, `Modifier la visite de ${NOM}`).click();
    correction = page.getByRole('form', { name: 'Corriger la visite' });
    const jour = champ(correction, 'DATE VISITE');
    await expect(jour, 'l’API refuse de déplacer une ligne d’un jour à l’autre').toHaveCount(0);
    await choisir(correction, 'DESTINATAIRES', DESTINATAIRE);
    await bouton(correction, 'Enregistrer la correction').click();
    await expect(page.getByText(`Visite ${reference} corrigée.`)).toBeVisible();
    const relue = await ligne<{ destinataire: string; nom: string }>(
      `SELECT d.label AS destinataire, v."visitorName" AS nom FROM visites v
         LEFT JOIN visite_destinataires d ON d.id = v."destinataireId" WHERE v.reference = $1`,
      [reference],
    );
    expect(relue?.destinataire).toBe(DESTINATAIRE);
    expect(relue?.nom, 'seul le destinataire change').toBe(NOM);

    await bouton(page, 'Imprimer').click();
    const dialogue = boite(page, 'Préparer l’impression');
    await expect(dialogue.getByRole('radio', { name: /^La page affichée/u })).toBeChecked();
    const identite = dialogue.getByRole('checkbox', { name: 'PRENOM ET NOMS', exact: true });
    await expect(identite, 'la colonne qui identifie la feuille ne se décoche pas').toBeDisabled();
    await expect(identite).toBeChecked();
    await dialogue.getByRole('checkbox', { name: 'COMMENTAIRES / NOTES', exact: true }).uncheck();
    await dialogue.getByRole('radio', { name: /^Portrait/u }).check();
    await bouton(dialogue, 'Annuler').click();
    // La règle `@page` ne vit que dans le `<style>` : aucun rôle ne la porte.
    await expect
      .poll(async () => (await page.locator('style[media="print"]').textContent()) ?? '')
      .toContain('size: portrait');

    const note = rangee(page, NOM_ACCENTUE).getByRole('cell').filter({ hasText: NOTE });
    await page.emulateMedia({ media: 'print' });
    await expect(note, 'une colonne décochée ne sort pas sur la feuille').toBeHidden();
    await expect(page.getByRole('columnheader', { name: 'CORRIGER' })).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  });

  test('le tableau de bord : période dans l’URL, garde des 400 jours, disposition', async ({
    page,
  }) => {
    await page.goto('/accueil/tableau-de-bord');
    const pastilles = page.getByRole('group', { name: 'Période affichée' });
    await expect(bouton(pastilles, 'Ce mois-ci')).toHaveAttribute('aria-pressed', 'true');
    await bouton(pastilles, 'Mois dernier').click();
    await expect(page).toHaveURL(/[?&]periode=mois-dernier(&|$)/u);
    const stats = espionner(page, (requete) => requete.url().includes('/visites/statistiques'));
    const debut = new Date(`${JOUR}T00:00:00Z`);
    debut.setUTCDate(debut.getUTCDate() - 499);
    const du = debut.toISOString().slice(0, 10);
    await page.goto(`/accueil/tableau-de-bord?periode=libre&du=${du}&au=${JOUR}`);
    await expect(page.getByRole('alert')).toHaveText(
      'Cette plage dépasse 400 jours (500 jours) : revenez à une période plus courte.',
    );
    const partis = stats.filter((url) => url.includes(`from=${du}`));
    expect(partis, 'la garde cliente coupe la requête, l’API n’a rien à refuser').toEqual([]);

    await page.goto('/accueil/tableau-de-bord');
    await bouton(page, 'Organiser les graphiques').click();
    // `onEntrer` sort sans rien faire tant que la disposition n'est pas arrivée.
    await expect(texte(page, 'Mode organisation')).toBeVisible();
    const reserve = bouton(page, 'Proposer par défaut');
    await expect(reserve, 'un compte ACCUEIL ne fixe pas la disposition des autres').toHaveCount(0);

    await bouton(page, 'Ajouter un graphique').click();
    const tiroir = boite(page, 'Ajouter un graphique');
    await tiroir.getByLabel('Chercher une question ou un indicateur').fill('téléphone');
    await tiroir
      .getByRole('article')
      .filter({ has: titre(page, 'Avec téléphone') })
      .getByRole('button', { name: 'Ajouter', exact: true })
      .click();
    // Le tiroir ne se referme pas sur le choix : son calque intercepterait la suite.
    await page.keyboard.press('Escape');
    await bouton(page, 'Enregistrer').click();
    await expect(texte(page, 'Mode organisation')).toHaveCount(0);

    const gardee = await ligne<{ layout: { widgets: { source: string }[] } }>(
      'SELECT layout FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2',
      [ACCUEIL.id, 'visites'],
    );
    expect(gardee?.layout.widgets.map((widget) => widget.source)).toContain('avec-telephone');

    await page.reload();
    const carte = bouton(page, 'À propos de Avec téléphone');
    await expect(carte).toBeVisible();
    await bouton(page, 'Organiser les graphiques').click();
    await bouton(page, 'Retirer Avec téléphone').click();
    await bouton(page, 'Quitter').click();
    await bouton(boite(page, 'Quitter sans enregistrer'), 'Quitter sans enregistrer').click();
    await expect(carte, 'quitter sans enregistrer rétablit ce qui est gardé').toBeVisible();

    await bouton(page, 'Revenir à la disposition par défaut').click();
    await expect(bouton(page, 'Revenir à la disposition par défaut')).toHaveCount(0);
    const restantes = await compter(
      'SELECT count(*) AS n FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2',
      [ACCUEIL.id, 'visites'],
    );
    expect(restantes, 'revenir au défaut efface la disposition').toBe(0);
  });

  test('une recherche sans date choisie parcourt tout le registre', async ({ page }) => {
    const requete = page.waitForRequest(
      (r) => r.url().includes('/api/v1/visites?') && r.url().includes(`search=${MARQUE}`),
    );
    await page.goto(`/accueil?search=${MARQUE}`);
    const url = (await requete).url();
    expect(url, 'sans date choisie, la recherche ne se borne pas au jour').not.toContain('from=');
    await expect(page.getByRole('heading', { name: /visites? au registre$/u })).toBeVisible();
    await expect(texte(page, NOM)).toBeVisible();
  });
  test.fixme('sélecteur « Comparer à » absent du tableau de bord', () => {});
  test.fixme('export CSV du détail des visites remplacé par les graphiques', () => {});
  test('le compte ACCUEIL dispose de tout le catalogue d’indicateurs', async ({ page }) => {
    await page.goto('/accueil/tableau-de-bord');
    await bouton(page, 'Organiser les graphiques').click();
    await expect(texte(page, 'Mode organisation')).toBeVisible();
    await bouton(page, 'Ajouter un graphique').click();
    const tiroir = boite(page, 'Ajouter un graphique');
    await tiroir.getByLabel('Chercher une question ou un indicateur').fill('heure');
    await expect(
      tiroir.getByRole('article').filter({ has: titre(page, 'Par heure') }),
      'v1 ouvrait « Par heure » à l’accueil',
    ).toHaveCount(1);
  });
});

/** En-têtes ligne 1 ; ligne 2 = rappel de l'export, sauté par le lecteur ; données ligne 3. */
const EN_TETES = (
  'N° REGISTRE|DATE VISITE|HEURE VISITE|PRENOM ET NOMS|TELEPHONES|ENTREPRISE|' +
  'DIRECTION|DESTINATAIRES|OBJET VISITE|COMMENTAIRES / NOTES|SAISIE LE'
).split('|');
const RAPPEL = ['N° REGISTRE vide = nouvelle visite. Ne renommez ni ne déplacez les colonnes.'];

async function classeurRegistre(
  nom: string,
  lignes: readonly { numero?: string; nom: string; commentaire?: string }[],
): Promise<string> {
  mkdirSync(FIXTURES, { recursive: true });
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Registre');
  feuille.addRow(EN_TETES);
  feuille.addRow(RAPPEL);
  for (const valeur of lignes) {
    const debut = [valeur.numero ?? '', JOUR_FR, '', valeur.nom, '', ENTREPRISE, '', ''];
    feuille.addRow([...debut, OBJET, valeur.commentaire ?? '', '']);
  }
  const chemin = path.join(FIXTURES, `parite-accueil-${nom}.xlsx`);
  await classeur.xlsx.writeFile(chemin);
  return chemin;
}

async function deposer(page: Page, chemin: string): Promise<void> {
  await page.getByLabel(/^Glissez le classeur ici/u).setInputFiles(chemin);
  await expect(page.getByText(/^3\. Analyse, déposé le /u)).toBeVisible();
  await expect(page.getByText(/^Analyse terminée/u)).toBeVisible();
}

/** Les quatre cadrans sont une liste de définitions : `<dt>` et `<dd>` s'apparient par rang. */
async function cadran(page: Page, libelle: string): Promise<number> {
  const rang = (await page.getByRole('term').allTextContents()).indexOf(libelle);
  expect(rang, `le cadran « ${libelle} » manque à l’analyse`).toBeGreaterThanOrEqual(0);
  const valeur = await page.getByRole('definition').nth(rang).textContent();
  return Number((valeur ?? '').replace(/\D/gu, ''));
}

const compterVisites = (nom: string): Promise<number> =>
  compter('SELECT count(*) AS n FROM visites WHERE "visitorName" = $1', [nom]);

test.describe('parité accueil, les listes de saisie et l’aller-retour Excel', () => {
  test.use({ storageState: DIRECTION.etat });

  test('tenir une liste : code normalisé, doublon refusé, renommage, retrait', async ({ page }) => {
    const envois = espionner(
      page,
      (requete) => requete.method() === 'POST' && requete.url().includes('/api/v1/referentiels/'),
    );
    await page.goto('/accueil/listes');
    await bouton(page, 'Nouvelle entreprise').click();
    const creation = boite(page, 'Nouvelle entreprise');
    await bouton(creation, 'Enregistrer').click();
    await expect(creation.getByRole('alert')).toHaveText([
      'Majuscules, chiffres et tirets bas, deux caractères au moins.',
      'Le libellé est obligatoire.',
    ]);
    expect(envois, 'une saisie refusée ne part pas au serveur').toEqual([]);

    // Saisi en minuscules : c'est l'écran qui met en majuscules avant l'envoi.
    await champ(creation, 'Code').fill(CODE.toLowerCase());
    await champ(creation, 'Libellé').fill(LIBELLE);
    await bouton(creation, 'Enregistrer').click();
    await expect(page.getByText(`${LIBELLE} ajouté.`)).toBeVisible();
    expect((await ligne<{ label: string }>(ENTREE, [CODE]))?.label).toBe(LIBELLE);

    await bouton(page, 'Nouvelle entreprise').click();
    const doublon = boite(page, 'Nouvelle entreprise');
    await champ(doublon, 'Code').fill(CODE);
    await champ(doublon, 'Libellé').fill(`${LIBELLE} doublon`);
    await bouton(doublon, 'Enregistrer').click();
    const refus = page.getByText('Cette valeur existe déjà dans cette liste.');
    await expect(refus, 'un code pris se refuse par un message, pas un silence').toBeVisible();
    await expect(doublon, 'la saisie n’est pas perdue').toBeVisible();
    await bouton(doublon, 'Annuler').click();

    await bouton(page, `Modifier ${LIBELLE}`).click();
    const renommage = boite(page, `Renommer « ${LIBELLE} »`);
    await expect(champ(renommage, 'Code'), 'le code reste définitif').toHaveCount(0);
    await champ(renommage, 'Libellé').fill(RENOMME);
    await bouton(renommage, 'Enregistrer').click();
    await expect(page.getByText(`${RENOMME} enregistré.`)).toBeVisible();
    expect((await ligne<{ label: string }>(ENTREE, [CODE]))?.label).toBe(RENOMME);

    await page.getByRole('tab', { name: 'Directions' }).click();
    await expect(page).toHaveURL(/\?onglet=visite-directions$/u);
    // Les quatre panneaux restent montés : chaque champ se vise dans le sien.
    const directions = page.getByRole('tabpanel', { name: 'Directions' });
    await directions.getByLabel('Rechercher', { exact: true }).fill('comptabilité');
    const trouvee = bouton(directions, 'Modifier FINANCE & COMPTABILITE');
    await expect(trouvee, 'la recherche ignore accents et casse').toBeVisible();

    await page.getByRole('tab', { name: 'Entreprises' }).click();
    await bouton(page, `Retirer ${RENOMME} de la saisie`).click();
    const retrait = boite(page, `Retirer « ${RENOMME} » de la saisie`);
    await bouton(retrait, 'Retirer de la saisie').click();
    await expect(page.getByText(`${RENOMME} retiré de la saisie.`)).toBeVisible();
    expect((await ligne<{ isActive: boolean }>(ENTREE, [CODE]))?.isActive).toBe(false);

    await page.goto('/accueil');
    const saisie = await ouvrirSaisie(page);
    await champ(saisie, 'ENTREPRISE').click();
    await expect(page.getByRole('option', { name: ENTREPRISE, exact: true })).toBeVisible();
    const retiree = page.getByRole('option', { name: RENOMME, exact: true });
    await expect(retiree, 'une entrée retirée ne se propose plus au comptoir').toHaveCount(0);
  });

  test('une création se simule, se revoit, n’écrit rien, puis s’applique', async ({ page }) => {
    const nouvelle = `${PREFIXE} Fatou Sarr`;
    await page.goto('/accueil/import');
    await expect(texte(page, '1. Exporter le registre')).toBeVisible();
    await expect(texte(page, '2. Déposer le classeur corrigé')).toBeVisible();
    await expect(page.getByText(/^3\. Analyse/u), 'rien avant le dépôt').toHaveCount(0);

    await deposer(page, await classeurRegistre('creation', [{ nom: nouvelle, commentaire: NOTE }]));
    expect(await cadran(page, 'À créer')).toBe(1);
    expect(await cadran(page, 'Refusées')).toBe(0);
    await expect(page.getByText('1 différence, 0 correction, 1 création')).toBeVisible();
    const revue = page.getByRole('listitem').filter({ hasText: `${nouvelle}, ${JOUR_FR}` });
    await expect(texte(revue, 'Création')).toBeVisible();
    await expect(texte(revue, 'ligne 3')).toBeVisible();
    await expect(revue.getByRole('checkbox')).toBeChecked();
    expect(await compterVisites(nouvelle), 'la simulation n’écrit rien').toBe(0);

    await bouton(page, 'Appliquer 1 création').click();
    const dialogue = boite(page, 'Appliquer 1 création ?');
    const avert = 'Cette action écrit les visites cochées dans le registre et ne s’annule pas.';
    await expect(texte(dialogue, avert)).toBeVisible();
    await bouton(dialogue, 'Appliquer 1 création').click();
    await expect(texte(page, '1 visite créée, 0 corrigée.')).toBeVisible();

    const creee = await ligne<{ reference: string; comment: string }>(
      'SELECT reference, comment FROM visites WHERE "visitorName" = $1',
      [nouvelle],
    );
    referenceImportee = creee?.reference ?? '';
    expect(referenceImportee).toMatch(/^V-\d{4}-\d{6}$/u);
    expect(creee?.comment, 'le commentaire du classeur arrive au registre').toBe(NOTE);
  });

  test('l’avant et l’après, les lignes cochées, le numéro inconnu, l’aller-retour', async ({
    page,
  }) => {
    const corrige = `${PREFIXE} Fatou Sarr`;
    const nouveau = `${PREFIXE} Mamadou Diop`;
    await page.goto('/accueil/import');
    await deposer(
      page,
      await classeurRegistre('revue', [
        { numero: referenceImportee, nom: corrige, commentaire: `${NOTE} corrigée` },
        { nom: nouveau },
      ]),
    );
    expect(await cadran(page, 'À corriger')).toBe(1);
    expect(await cadran(page, 'À créer')).toBe(1);
    const avant = page.getByRole('listitem').filter({ hasText: corrige });
    await expect(
      texte(avant, `COMMENTAIRES / NOTES : « ${NOTE} » → « ${NOTE} corrigée »`),
    ).toBeVisible();

    const case_ = page.getByRole('listitem').filter({ hasText: nouveau }).getByRole('checkbox');
    await case_.click();
    await expect(case_).not.toBeChecked();
    const restant = bouton(page, 'Appliquer 1 correction');
    await expect(restant, 'le bouton annonce ce qui sera écrit').toBeEnabled();
    await bouton(page, 'Tout décocher').click();
    await expect(bouton(page, 'Rien à appliquer')).toBeDisabled();
    expect(await compterVisites(nouveau), 'une revue abandonnée n’écrit rien').toBe(0);

    const nom = `${PREFIXE} Refus Registre`;
    await bouton(page, 'Déposer un autre fichier').click();
    await deposer(page, await classeurRegistre('inconnu', [{ numero: 'V-1999-000001', nom }]));
    expect(await cadran(page, 'Refusées')).toBe(1);
    expect(await cadran(page, 'À créer'), 'une coquille ne crée pas de visite fantôme').toBe(0);
    await expect(titre(page, 'Lignes refusées')).toBeVisible();
    const refus = page.getByRole('row').filter({ hasText: 'V-1999-000001' });
    await expect(refus.getByRole('cell').first()).toHaveText('3');
    await expect(refus.getByRole('cell').nth(1)).toHaveText('N° REGISTRE');
    await expect(texte(page, '4. Revue')).toHaveCount(0);

    await bouton(page, 'Déposer un autre fichier').click();
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Exporter le registre filtré' }).click(),
    ]);
    expect(telechargement.suggestedFilename()).toMatch(/^registre-visites-cpi-[\d-]{10}\.xlsx$/u);
    const chemin = path.join(FIXTURES, 'parite-accueil-aller-retour.xlsx');
    await telechargement.saveAs(chemin);

    await deposer(page, chemin);
    expect(await cadran(page, 'À créer'), 'l’export redéposé n’invente rien').toBe(0);
    expect(await cadran(page, 'À corriger')).toBe(0);
    expect(await cadran(page, 'Refusées')).toBe(0);
    expect(await cadran(page, 'Inchangées')).toBeGreaterThan(0);
    await expect(
      texte(page, 'Votre classeur est identique au registre. Rien à appliquer.'),
    ).toBeVisible();
  });

  test.fixme('ordre des entrées : ni monter, ni descendre, ni glisser-déposer', () => {});
  test.fixme('retrait d’une entrée : le décompte des visites a disparu', () => {});
  test.fixme('code pris : le message ne nomme plus l’entrée qui le porte', () => {});
  test.fixme('« Déposer un autre fichier » ne rend plus le focus au dépôt', () => {});
  test.fixme('dépôt de plus de 25 Mo : garde client non couvert ici', () => {});
});
