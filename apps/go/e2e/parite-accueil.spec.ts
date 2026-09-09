import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';
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
const FIXTURES = path.join(__dirname, 'fixtures');
const ANNONCE = /^Visite (V-\d{4}-\d{6}) enregistrée\.$/u;

let reference = '';
let referenceImportee = '';

type Racine = Page | Locator;

const bouton = (dans: Racine, nom: string): Locator =>
  dans.getByRole('button', { name: nom, exact: true });
const texte = (dans: Racine, valeur: string): Locator => dans.getByText(valeur, { exact: true });
const titre = (dans: Racine, nom: string): Locator => dans.getByRole('heading', { name: nom });
const boite = (page: Page, nom: string): Locator => page.getByRole('dialog', { name: nom });

/** Le champ que porte ce libellé : « Obligatoire » colle au texte du `<label>`. */
const champ = (dans: Racine, libelle: string): Locator =>
  dans.getByLabel(new RegExp(`^${libelle}`, 'u'));

async function choisir(dans: Locator, libelle: string, option: string): Promise<void> {
  await champ(dans, libelle).click();
  await dans.page().getByRole('option', { name: option, exact: true }).click();
}

async function ouvrirSaisie(page: Page): Promise<Locator> {
  await bouton(page, 'Ajouter une visite').click();
  const formulaire = page.getByRole('form', { name: 'Enregistrer une visite' });
  await expect(formulaire).toBeVisible();
  return formulaire;
}

const rangeeDe = (page: Page, nom: string): Locator =>
  page.getByRole('row').filter({ hasText: nom });

async function nettoyer(): Promise<void> {
  await avecBase(async (client) => {
    await client.query(
      `DELETE FROM visite_import_changes WHERE "importJobId" IN
         (SELECT id FROM import_jobs WHERE "requestedById" = $1)`,
      [DIRECTION.id],
    );
    await client.query('DELETE FROM import_jobs WHERE "requestedById" = $1', [DIRECTION.id]);
    await client.query(`DELETE FROM visites WHERE "visitorName" LIKE 'E2E accueil %'`);
    await client.query(`DELETE FROM visite_entreprises WHERE code LIKE 'E2E\\_ACCUEIL\\_%'`);
    await client.query(`DELETE FROM dashboard_layouts WHERE "userId" = $1 AND ecran = 'visites'`, [
      ACCUEIL.id,
    ]);
  });
}

test.beforeAll(nettoyer);
test.afterAll(nettoyer);

test.describe('parité accueil, le registre des visites', () => {
  test.use({ storageState: ACCUEIL.etat });
  test.describe.configure({ mode: 'serial' });

  test('la journée part de zéro, la file d’attente enchaîne, la base garde tout', async ({
    page,
  }) => {
    await page.goto('/accueil');
    await expect(titre(page, '0 visite aujourd’hui')).toBeVisible();
    await expect(titre(page, 'Aucune visite enregistrée aujourd’hui')).toBeVisible();
    await expect(bouton(page, 'Voir tout le registre')).toBeVisible();
    await expect(bouton(page, 'Imprimer')).toBeDisabled();

    const saisie = await ouvrirSaisie(page);
    await expect(champ(saisie, 'DATE VISITE')).toHaveValue(JOUR);
    await champ(saisie, 'PRENOM ET NOMS').fill(NOM);
    await champ(saisie, 'TELEPHONES').fill(TELEPHONE);
    await choisir(saisie, 'ENTREPRISE', ENTREPRISE);
    await choisir(saisie, 'OBJET VISITE', OBJET);
    await champ(saisie, 'COMMENTAIRES / NOTES').fill(`${PREFIXE} premiere ligne`);
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
    await expect(champ(saisie, 'COMMENTAIRES / NOTES')).toHaveValue('');

    await champ(saisie, 'PRENOM ET NOMS').fill(NOM_ACCENTUE);
    await choisir(saisie, 'OBJET VISITE', OBJET);
    await champ(saisie, 'COMMENTAIRES / NOTES').fill(NOTE);
    await bouton(saisie, 'Enregistrer la visite').click();
    await expect(champ(saisie, 'PRENOM ET NOMS')).toHaveValue('');

    await page.keyboard.press('Escape');
    await expect(saisie).toHaveCount(0);
    await expect(titre(page, '2 visites aujourd’hui')).toBeVisible();
    const accentuee = rangeeDe(page, NOM_ACCENTUE);
    await expect(accentuee.getByRole('cell', { name: NOTE, exact: true })).toHaveCount(1);
    await expect(page.locator('balise'), 'le nom n’est jamais interprété').toHaveCount(0);

    const gardee = await ligne<{ reference: string; phone: string; entreprise: string }>(
      `SELECT v.reference, v.phone, e.label AS entreprise FROM visites v
         JOIN visite_entreprises e ON e.id = v."entrepriseId" WHERE v."visitorName" = $1`,
      [NOM],
    );
    expect(gardee?.reference).toBe(reference);
    expect(gardee?.phone).toBe(TELEPHONE);
    expect(gardee?.entreprise).toBe(ENTREPRISE);
    const total = await compter('SELECT count(*) AS n FROM visites WHERE "visitorName" LIKE $1', [
      `${PREFIXE}%`,
    ]);
    expect(total, 'deux saisies, deux lignes, aucune perte').toBe(2);
  });

  test('une saisie incomplète ne part pas au serveur', async ({ page }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'POST' && requete.url().endsWith('/api/v1/visites')) {
        envois.push(requete.url());
      }
    });

    await page.goto('/accueil');
    const saisie = await ouvrirSaisie(page);
    await bouton(saisie, 'Enregistrer la visite').click();
    await expect(saisie.getByRole('alert')).toHaveText([
      'À renseigner.',
      'À choisir dans la liste.',
      'À choisir dans la liste.',
    ]);

    await champ(saisie, 'PRENOM ET NOMS').fill('A');
    await bouton(saisie, 'Enregistrer la visite').click();
    await expect(saisie.getByRole('alert').first()).toHaveText('Au moins deux caractères.');

    await champ(saisie, 'PRENOM ET NOMS').fill(`${PREFIXE} Sans date`);
    await choisir(saisie, 'ENTREPRISE', ENTREPRISE);
    await choisir(saisie, 'OBJET VISITE', OBJET);
    await champ(saisie, 'DATE VISITE').fill('');
    await bouton(saisie, 'Enregistrer la visite').click();
    await expect(saisie.getByRole('alert')).toHaveText(['À renseigner.']);
    expect(envois, 'rien ne part tant qu’un champ manque').toEqual([]);
  });

  test('les critères vivent dans l’URL, avec le tri et les deux états vides', async ({ page }) => {
    const requetes: string[] = [];
    page.on('request', (requete) => {
      if (requete.url().includes('/api/v1/visites?')) requetes.push(requete.url());
    });

    await page.goto('/accueil');
    await bouton(page, 'Rechercher et filtrer').click();
    const recherche = page.getByLabel('Rechercher', { exact: true });
    await recherche.fill('E');
    await expect(page).toHaveURL(/\/accueil\?search=E$/u);
    await expect
      .poll(() => requetes.filter((url) => new URL(url).searchParams.has('search')).length, {
        message: 'une recherche d’un seul caractère ne part pas au serveur',
      })
      .toBe(0);

    await recherche.fill(MARQUE);
    await expect(page).toHaveURL(new RegExp(`\\?search=${MARQUE}$`, 'u'));
    await expect(rangeeDe(page, NOM)).toHaveCount(1);
    await bouton(page, 'Tout le registre').click();
    await expect(page).toHaveURL(new RegExp(`search=${MARQUE}&periode=tout$`, 'u'));
    await expect(bouton(page, 'Tout le registre')).toHaveAttribute('aria-pressed', 'true');

    const entete = page.getByRole('columnheader', { name: 'PRENOM ET NOMS' });
    await entete.getByRole('button').click();
    await expect(page).toHaveURL(/sortBy=visitorName&sortDir=asc$/u);
    await expect(entete).toHaveAttribute('aria-sort', 'ascending');
    await entete.getByRole('button').click();
    await expect(page, 'décroissant est le défaut, il ne s’écrit pas').toHaveURL(
      /sortBy=visitorName$/u,
    );
    await page.reload();
    await expect(entete).toHaveAttribute('aria-sort', 'descending');

    await page.goto(`/accueil?search=${MARQUE}-introuvable&periode=tout`);
    await expect(titre(page, 'Aucune visite pour cette recherche')).toBeVisible();
    await expect(bouton(page, 'Imprimer')).toBeDisabled();
    await bouton(page, 'Retirer les filtres').click();
    await expect(page).toHaveURL(/\/accueil$/u);
    await expect(bouton(page, 'Aujourd’hui')).toHaveAttribute('aria-pressed', 'true');
  });

  test('corriger une visite : la date se lit, l’abandon n’écrit rien', async ({ page }) => {
    const patchs: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'PATCH' && requete.url().includes('/api/v1/visites/')) {
        patchs.push(requete.url());
      }
    });

    await page.goto(`/accueil?search=${MARQUE}&periode=tout`);
    await bouton(page, `Modifier la visite de ${NOM_ACCENTUE}`).click();
    let correction = page.getByRole('form', { name: 'Corriger la visite' });
    await champ(correction, 'PRENOM ET NOMS').fill(`${PREFIXE} Nom abandonne`);
    await bouton(correction, 'Annuler').click();
    await expect(correction).toHaveCount(0);
    await expect(rangeeDe(page, NOM_ACCENTUE)).toHaveCount(1);
    expect(patchs, 'une correction abandonnée n’écrit rien').toEqual([]);

    await bouton(page, `Modifier la visite de ${NOM}`).click();
    correction = page.getByRole('form', { name: 'Corriger la visite' });
    const jour = champ(correction, 'DATE VISITE');
    await expect(jour, 'l’API refuse de déplacer une ligne d’un jour à l’autre').toHaveCount(0);
    await choisir(correction, 'DESTINATAIRES', DESTINATAIRE);
    await bouton(correction, 'Enregistrer la correction').click();
    await expect(page.getByText(`Visite ${reference} corrigée.`)).toBeVisible();
    const cellule = rangeeDe(page, NOM).getByRole('cell', { name: DESTINATAIRE, exact: true });
    await expect(cellule).toHaveCount(1);

    const relue = await ligne<{ destinataire: string; nom: string }>(
      `SELECT d.label AS destinataire, v."visitorName" AS nom FROM visites v
         LEFT JOIN visite_destinataires d ON d.id = v."destinataireId" WHERE v.reference = $1`,
      [reference],
    );
    expect(relue?.destinataire).toBe(DESTINATAIRE);
    expect(relue?.nom, 'seul le destinataire change').toBe(NOM);
  });

  test('l’impression retient portée, colonnes verrouillées et orientation', async ({ page }) => {
    await page.goto(`/accueil?search=${MARQUE}&periode=tout`);
    const rangee = rangeeDe(page, NOM_ACCENTUE);
    await expect(rangee).toHaveCount(1);

    await bouton(page, 'Imprimer').click();
    const dialogue = boite(page, 'Préparer l’impression');
    await expect(dialogue.getByRole('radio', { name: /^La page affichée/u })).toBeChecked();
    for (const verrouillee of ['DATE VISITE', 'PRENOM ET NOMS']) {
      const case_ = dialogue.getByRole('checkbox', { name: verrouillee, exact: true });
      await expect(case_, `${verrouillee} identifie la feuille`).toBeDisabled();
      await expect(case_).toBeChecked();
    }
    await dialogue.getByRole('checkbox', { name: 'COMMENTAIRES / NOTES', exact: true }).uncheck();
    await dialogue.getByRole('radio', { name: /^Portrait/u }).check();
    await bouton(dialogue, 'Annuler').click();

    // La règle `@page` ne vit que dans le `<style>` : aucun rôle ne la porte.
    await expect
      .poll(async () => (await page.locator('style[media="print"]').textContent()) ?? '')
      .toContain('size: portrait');

    const note = rangee.getByRole('cell').filter({ hasText: NOTE });
    await page.emulateMedia({ media: 'print' });
    await expect(note, 'une colonne décochée ne sort pas sur la feuille').toBeHidden();
    await expect(page.getByRole('region', { name: 'Rechercher dans le registre' })).toBeHidden();
    await expect(page.getByRole('columnheader', { name: 'CORRIGER' })).toBeHidden();
    await expect(page.getByRole('table')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await expect(note).toBeVisible();
  });

  test.fixme(
    'chercher un visiteur sans toucher à la période : l’en-tête annonce « au registre » quand `plageDe` borne encore la requête à la journée',
    () => {},
  );
});

test.describe('parité accueil, les quatre listes de la saisie', () => {
  test.use({ storageState: DIRECTION.etat });
  test.describe.configure({ mode: 'serial' });

  test('créer une entrée : code normalisé, code invalide refusé, doublon signalé', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'POST' && requete.url().includes('/api/v1/referentiels/')) {
        envois.push(requete.url());
      }
    });

    await page.goto('/accueil/listes');
    for (const onglet of ['Entreprises', 'Directions', 'Destinataires', 'Objets de visite']) {
      await expect(page.getByRole('tab', { name: onglet })).toBeVisible();
    }
    await bouton(page, 'Nouvelle entreprise').click();
    const dialogue = boite(page, 'Nouvelle entreprise');
    await expect(texte(dialogue, 'Le code est définitif, utile pour l’export.')).toBeVisible();
    await bouton(dialogue, 'Enregistrer').click();
    await expect(dialogue.getByRole('alert')).toHaveText([
      'Majuscules, chiffres et tirets bas, deux caractères au moins.',
      'Le libellé est obligatoire.',
    ]);
    await champ(dialogue, 'Code').fill('E2E-ACC');
    await bouton(dialogue, 'Enregistrer').click();
    await expect(dialogue.getByRole('alert').first()).toHaveText(
      'Majuscules, chiffres et tirets bas, deux caractères au moins.',
    );
    expect(envois, 'une saisie refusée ne part pas au serveur').toEqual([]);

    // Saisi en minuscules : c'est l'écran qui met en majuscules avant l'envoi.
    await champ(dialogue, 'Code').fill(CODE.toLowerCase());
    await champ(dialogue, 'Libellé').fill(LIBELLE);
    await bouton(dialogue, 'Enregistrer').click();
    await expect(page.getByText(`${LIBELLE} ajouté.`)).toBeVisible();
    await expect(dialogue).toHaveCount(0);

    const creee = await ligne<{ label: string; isActive: boolean }>(
      'SELECT label, "isActive" FROM visite_entreprises WHERE code = $1',
      [CODE],
    );
    expect(creee?.label).toBe(LIBELLE);
    expect(creee?.isActive).toBe(true);

    await bouton(page, 'Nouvelle entreprise').click();
    const doublon = boite(page, 'Nouvelle entreprise');
    await champ(doublon, 'Code').fill(CODE);
    await champ(doublon, 'Libellé').fill(`${LIBELLE} doublon`);
    await bouton(doublon, 'Enregistrer').click();
    const refus = page.getByText('Cette valeur existe déjà dans cette liste.');
    await expect(refus, 'un code pris se refuse par un message, pas par un silence').toBeVisible();
    await expect(doublon, 'la saisie n’est pas perdue').toBeVisible();
    await bouton(doublon, 'Annuler').click();
    const combien = await compter('SELECT count(*) AS n FROM visite_entreprises WHERE code = $1', [
      CODE,
    ]);
    expect(combien).toBe(1);
  });

  test('renommer sans toucher au code, chercher sans accent, retirer de la saisie', async ({
    page,
  }) => {
    await page.goto('/accueil/listes');
    await bouton(page, `Modifier ${LIBELLE}`).click();
    const dialogue = boite(page, `Renommer « ${LIBELLE} »`);
    const promesse = 'Le code reste inchangé : les visites déjà enregistrées le désignent.';
    await expect(texte(dialogue, promesse)).toBeVisible();
    await expect(champ(dialogue, 'Code'), 'le code est définitif').toHaveCount(0);
    await champ(dialogue, 'Libellé').fill(RENOMME);
    await bouton(dialogue, 'Enregistrer').click();
    await expect(page.getByText(`${RENOMME} enregistré.`)).toBeVisible();
    const requete = 'SELECT label, "isActive" FROM visite_entreprises WHERE code = $1';
    expect((await ligne<{ label: string }>(requete, [CODE]))?.label).toBe(RENOMME);

    await page.getByRole('tab', { name: 'Directions' }).click();
    await expect(page).toHaveURL(/\?onglet=visite-directions$/u);
    const recherche = page.getByLabel('Rechercher', { exact: true });
    await recherche.fill('comptabilité');
    const trouvee = bouton(page, 'Modifier FINANCE & COMPTABILITE');
    await expect(trouvee, 'la recherche ignore accents et casse').toBeVisible();
    await recherche.fill('introuvable-e2e');
    await expect(texte(page, 'Aucune entrée ne correspond.')).toBeVisible();

    await page.getByRole('tab', { name: 'Entreprises' }).click();
    await bouton(page, `Retirer ${RENOMME} de la saisie`).click();
    const retrait = boite(page, `Retirer « ${RENOMME} » de la saisie`);
    const garde = 'Les visites déjà enregistrées la gardent. Elle ne sera plus proposée au comptoir.';
    await expect(texte(retrait, garde)).toBeVisible();
    await bouton(retrait, 'Retirer de la saisie').click();
    await expect(page.getByText(`${RENOMME} retiré de la saisie.`)).toBeVisible();
    expect((await ligne<{ isActive: boolean }>(requete, [CODE]))?.isActive).toBe(false);

    await page.goto('/accueil');
    const saisie = await ouvrirSaisie(page);
    await champ(saisie, 'ENTREPRISE').click();
    await expect(page.getByRole('option', { name: ENTREPRISE, exact: true })).toBeVisible();
    const retiree = page.getByRole('option', { name: RENOMME, exact: true });
    await expect(retiree, 'une entrée retirée ne se propose plus au comptoir').toHaveCount(0);
  });

  test.fixme(
    'classer les entrées : ni « Monter », ni « Descendre », ni glisser-déposer dans `listes-tableau.tsx` (v1 ACC-LST-08 et 09)',
    () => {},
  );
  test.fixme(
    'retirer une entrée : la confirmation n’annonce plus combien de visites la référencent (v1 ACC-LST-10)',
    () => {},
  );
  test.fixme(
    'code déjà pris : le message ne nomme plus l’entrée qui le porte (v1 ACC-LST-05)',
    () => {},
  );
});

const EN_TETES = [
  'N° REGISTRE',
  'DATE VISITE',
  'HEURE VISITE',
  'PRENOM ET NOMS',
  'TELEPHONES',
  'ENTREPRISE',
  'DIRECTION',
  'DESTINATAIRES',
  'OBJET VISITE',
  'COMMENTAIRES / NOTES',
  'SAISIE LE',
];

/** La ligne 2 porte le rappel de l'export, que le lecteur saute : les données commencent en 3. */
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
  for (const valeurs of lignes) {
    const debut = [valeurs.numero ?? '', JOUR_FR, '', valeurs.nom, '', ENTREPRISE, '', ''];
    feuille.addRow([...debut, OBJET, valeurs.commentaire ?? '', '']);
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
  const intitules = await page.getByRole('term').allTextContents();
  const rang = intitules.indexOf(libelle);
  expect(rang, `le cadran « ${libelle} » manque à l’analyse`).toBeGreaterThanOrEqual(0);
  const valeur = await page.getByRole('definition').nth(rang).textContent();
  return Number((valeur ?? '').replace(/\D/gu, ''));
}

const compterVisites = async (nom: string): Promise<number> =>
  compter('SELECT count(*) AS n FROM visites WHERE "visitorName" = $1', [nom]);

test.describe('parité accueil, l’aller-retour Excel du registre', () => {
  test.use({ storageState: DIRECTION.etat });
  test.describe.configure({ mode: 'serial' });

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
    const avertissement = 'Cette action écrit les visites cochées dans le registre et ne s’annule pas.';
    await expect(texte(dialogue, avertissement)).toBeVisible();
    await bouton(dialogue, 'Appliquer 1 création').click();
    await expect(texte(page, '1 visite créée, 0 corrigée.')).toBeVisible();

    const creee = await ligne<{ reference: string; comment: string }>(
      'SELECT reference, comment FROM visites WHERE "visitorName" = $1',
      [nouvelle],
    );
    referenceImportee = creee?.reference ?? '';
    expect(referenceImportee).toMatch(/^V-\d{4}-\d{6}$/u);
    expect(creee?.comment, 'le commentaire du classeur arrive au registre').toBe(NOTE);

    await bouton(page, 'Déposer un autre fichier').click();
    await expect(page.getByText(/^3\. Analyse/u)).toHaveCount(0);
  });

  test('une correction montre l’avant et l’après, le bouton suit les lignes cochées', async ({
    page,
  }) => {
    expect(referenceImportee, 'la référence créée n’a pas été relevée').not.toBe('');
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
    await expect(restant, 'le bouton annonce exactement ce qui sera écrit').toBeEnabled();
    await bouton(page, 'Tout décocher').click();
    await expect(bouton(page, 'Rien à appliquer')).toBeDisabled();
    expect(await compterVisites(nouveau), 'une revue abandonnée n’écrit rien').toBe(0);
  });

  test('un numéro de registre inconnu est refusé, jamais replié en création', async ({ page }) => {
    await page.goto('/accueil/import');
    const nom = `${PREFIXE} Refus Registre`;
    await deposer(page, await classeurRegistre('inconnu', [{ numero: 'V-1999-000001', nom }]));

    expect(await cadran(page, 'Refusées')).toBe(1);
    expect(await cadran(page, 'À créer'), 'une coquille ne crée pas de visite fantôme').toBe(0);
    await expect(titre(page, 'Lignes refusées')).toBeVisible();
    const refus = page.getByRole('row').filter({ hasText: 'V-1999-000001' });
    await expect(refus.getByRole('cell').first()).toHaveText('3');
    await expect(refus.getByRole('cell').nth(1)).toHaveText('N° REGISTRE');
    await expect(texte(page, '4. Revue')).toHaveCount(0);
  });

  test('le registre exporté puis redéposé tel quel ne propose rien à appliquer', async ({
    page,
  }) => {
    await page.goto('/accueil/import');
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Exporter le registre filtré' }).click(),
    ]);
    expect(telechargement.suggestedFilename()).toMatch(/^registre-visites-cpi-[\d-]{10}\.xlsx$/u);
    const chemin = path.join(FIXTURES, 'parite-accueil-aller-retour.xlsx');
    await telechargement.saveAs(chemin);
    // Un vrai classeur : un 502 relayé sous ce nom passerait tout le reste.
    expect([...readFileSync(chemin).subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    await deposer(page, chemin);
    expect(await cadran(page, 'À créer')).toBe(0);
    expect(await cadran(page, 'À corriger')).toBe(0);
    expect(await cadran(page, 'Refusées')).toBe(0);
    expect(await cadran(page, 'Inchangées')).toBeGreaterThan(0);
    const identique = 'Votre classeur est identique au registre. Rien à appliquer.';
    await expect(texte(page, identique)).toBeVisible();
    await expect(texte(page, '4. Revue')).toHaveCount(0);
  });

  test.fixme(
    '« Déposer un autre fichier » ne rend plus le focus au champ de dépôt (v1 ACC-XLS-11)',
    () => {},
  );
  test.fixme(
    'déposer plus de 25 Mo : le garde client de `accepter` n’est pas couvert ici, un fichier de 26 Mo alourdirait le parcours (v1 ACC-XLS-03)',
    () => {},
  );
});

test.describe('parité accueil, le tableau de bord des visites', () => {
  test.use({ storageState: ACCUEIL.etat });
  test.describe.configure({ mode: 'serial' });

  test('les préréglages pilotent l’URL, une plage trop large est refusée avant l’appel', async ({
    page,
  }) => {
    await page.goto('/accueil/tableau-de-bord');
    const pastilles = page.getByRole('group', { name: 'Période affichée' });
    await expect(bouton(pastilles, 'Ce mois-ci')).toHaveAttribute('aria-pressed', 'true');
    for (const [libelle, parametre] of [
      ['Mois dernier', 'mois-dernier'],
      ['12 derniers mois', 'douze-mois'],
      ['Cette année', 'cette-annee'],
    ] as const) {
      await bouton(pastilles, libelle).click();
      await expect(page).toHaveURL(new RegExp(`[?&]periode=${parametre}(&|$)`, 'u'));
      await expect(bouton(pastilles, libelle)).toHaveAttribute('aria-pressed', 'true');
    }

    const appels: string[] = [];
    page.on('request', (requete) => {
      if (requete.url().includes('/api/v1/visites/statistiques')) appels.push(requete.url());
    });
    const debut = new Date(`${JOUR}T00:00:00Z`);
    debut.setUTCDate(debut.getUTCDate() - 499);
    const du = debut.toISOString().slice(0, 10);

    await page.goto(`/accueil/tableau-de-bord?periode=libre&du=${du}&au=${JOUR}`);
    await expect(page.getByRole('alert')).toHaveText(
      'Cette plage dépasse 400 jours (500 jours) : revenez à une période plus courte.',
    );
    const partis = appels.filter((url) => url.includes(`from=${du}`));
    expect(partis, 'la garde cliente coupe la requête, l’API n’a rien à refuser').toEqual([]);
  });

  test('organiser les graphiques : ajout enregistré, retrait abandonné, retour au défaut', async ({
    page,
  }) => {
    await page.goto('/accueil/tableau-de-bord');
    await bouton(page, 'Organiser les graphiques').click();
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
    await expect(tiroir).toHaveCount(0);

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
    const sortie = boite(page, 'Quitter sans enregistrer');
    await expect(texte(sortie, 'Les changements faits dans ce mode seront perdus.')).toBeVisible();
    await bouton(sortie, 'Quitter sans enregistrer').click();
    await expect(carte, 'quitter sans enregistrer rétablit la disposition gardée').toBeVisible();

    await bouton(page, 'Revenir à la disposition par défaut').click();
    await expect(bouton(page, 'Revenir à la disposition par défaut')).toHaveCount(0);
    const restantes = await compter(
      'SELECT count(*) AS n FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2',
      [ACCUEIL.id, 'visites'],
    );
    expect(restantes, 'revenir au défaut efface la disposition du compte').toBe(0);
  });

  test.fixme(
    'comparer une période à la précédente : le sélecteur « Comparer à » de la v1 n’existe pas (v1 ACC-TDB-05)',
    () => {},
  );
  test.fixme(
    'exporter le détail des visites en CSV : `BoutonExportExcel` n’exporte que les graphiques (v1 ACC-TDB-12)',
    () => {},
  );
  test.fixme(
    'ajouter « Par heure » en compte ACCUEIL : `SOURCES_ACCUEIL` ne lui laisse que sept indicateurs (v1 ACC-TDB-07)',
    () => {},
  );
});
