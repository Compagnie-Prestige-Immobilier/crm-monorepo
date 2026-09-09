import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

import { avecBase, compteDe } from './comptes';
import { apiDe, ligne, suffixe } from './donnees-listes';

const cle = suffixe();
const VISITEUR = `NDOUR ${cle}`;
const VISITEUR_CLASSEUR = `DIALLO ${cle}`;
const VISITEUR_IMPORTE = `SARR ${cle}`;
const COMMENTAIRE = `Reçu au comptoir ${cle}`;
const COMMENTAIRE_CORRIGE = `Corrigé par le classeur ${cle}`;

/** Ligne 1 les intitulés, ligne 2 la consigne, les visites à partir de la 3. */
const PREMIERE_LIGNE = 3;
const COLONNE_REGISTRE = 1;
const COLONNE_DATE = 2;
const COLONNE_NOM = 4;
const COLONNE_ENTREPRISE = 6;
const COLONNE_OBJET = 9;
const COLONNE_COMMENTAIRE = 10;

const classeurTravail = path.join(__dirname, 'test-results', `registre-${cle}.xlsx`);

/** La visite que le classeur vient corriger : posée par l'API, pas par un autre test. */
test.beforeAll(async () => {
  const api = await apiDe('ACCUEIL', '198.51.100.78');
  const referentiels = (await (await api.get('/api/v1/visites/referentiels')).json()) as {
    entreprises: { id: string; label: string }[];
    objets: { id: string; label: string }[];
  };
  const reponse = await api.post('/api/v1/visites', {
    data: {
      date: new Date().toISOString().slice(0, 10),
      time: '09:15',
      visitorName: VISITEUR_CLASSEUR,
      entrepriseId: referentiels.entreprises[0]?.id,
      objetId: referentiels.objets[0]?.id,
      comment: COMMENTAIRE,
    },
  });
  if (!reponse.ok()) throw new Error(`visite de départ refusée : ${await reponse.text()}`);
  await api.dispose();
});

test.afterAll(async () => {
  await avecBase(async (client) => {
    await client.query('DELETE FROM visites WHERE "visitorName" = ANY($1)', [
      [VISITEUR, VISITEUR_CLASSEUR, VISITEUR_IMPORTE],
    ]);
    // `import_jobs.requestedById` est en RESTRICT : le travail laissé derrière
    // empêcherait `global-teardown` de supprimer le compte du parcours.
    await client.query('DELETE FROM import_jobs WHERE "fileName" = $1', [
      path.basename(classeurTravail),
    ]);
  });
});

async function visitesDuJour(): Promise<number> {
  const compte = await ligne<{ n: string }>(
    'SELECT count(*) AS n FROM visites WHERE "visitedAt"::date = current_date',
    [],
  );
  return Number(compte?.n ?? '0');
}

/** D'autres parcours écrivent au registre en même temps : l'écran et la base se relisent ensemble. */
async function attendreLaBase(lecture: () => Promise<string>): Promise<number> {
  let attendu = 0;
  await expect
    .poll(async () => {
      attendu = await visitesDuJour();
      return (await lecture()).includes(String(attendu));
    })
    .toBe(true);
  return attendu;
}

async function choisirDansListe(page: Page, champ: string, valeur: string): Promise<void> {
  await page.getByRole('button', { name: champ }).click();
  await page.getByRole('option', { name: valeur, exact: true }).click();
}

test.describe('parcours 12, le registre des visites', () => {
  test.use({ storageState: compteDe('ACCUEIL').etat });

  test('une visite saisie au comptoir se relit dans le registre et en base', async ({ page }) => {
    await page.goto('/accueil');
    await page.getByRole('button', { name: 'Ajouter une visite' }).click();

    const saisie = page.getByRole('dialog', { name: 'Enregistrer une visite' });
    await saisie.getByRole('textbox', { name: 'HEURE VISITE' }).fill('10:30');
    await saisie.getByRole('textbox', { name: 'PRENOM ET NOMS Obligatoire' }).fill(VISITEUR);
    await saisie.getByRole('textbox', { name: 'TELEPHONES' }).fill('771112233');
    await choisirDansListe(page, 'ENTREPRISE Obligatoire', 'CPI');
    await choisirDansListe(page, 'OBJET VISITE Obligatoire', 'ACHAT TERRAIN');
    await saisie.getByRole('textbox', { name: 'COMMENTAIRES / NOTES' }).fill(COMMENTAIRE);
    await saisie.getByRole('button', { name: 'Enregistrer la visite' }).click();

    // La boîte reste ouverte et se vide : l'accueil enchaîne les visiteurs.
    await expect(page.getByText(/Visite V-\d{4}-\d+ enregistrée\./)).toBeVisible();
    await saisie.getByRole('button', { name: 'Fermer' }).click();
    await expect(saisie).toBeHidden();

    const rangee = page.getByRole('row').filter({ hasText: VISITEUR });
    await expect(rangee).toHaveCount(1);
    await expect(rangee).toContainText('CPI');
    await expect(rangee).toContainText('ACHAT TERRAIN');

    const enBase = await ligne<{
      reference: string;
      visitorName: string;
      phoneE164: string;
      comment: string;
      entreprise: string;
      objet: string;
    }>(
      `SELECT v.reference, v."visitorName", v."phoneE164", v.comment,
              e.label AS entreprise, o.label AS objet
         FROM visites v
         JOIN visite_entreprises e ON e.id = v."entrepriseId"
         JOIN visite_objets o ON o.id = v."objetId"
        WHERE v."visitorName" = $1`,
      [VISITEUR],
    );
    expect(enBase, 'la visite saisie n’est pas en base').not.toBeNull();
    expect(enBase?.comment, 'le commentaire du comptoir est perdu').toBe(COMMENTAIRE);
    expect(enBase?.phoneE164, 'le numéro n’est pas normalisé').toBe('+221771112233');
    expect(enBase?.entreprise).toBe('CPI');
    expect(enBase?.objet).toBe('ACHAT TERRAIN');
    expect(enBase?.reference, 'la visite doit recevoir un numéro de registre').toMatch(/^V-\d{4}-/);
  });

  test('le tableau de bord annonce autant de visites que la base', async ({ page }) => {
    expect(await visitesDuJour(), 'aucune visite du jour à compter').toBeGreaterThan(0);

    await page.goto('/accueil/tableau-de-bord');
    await page.getByRole('button', { name: 'Aujourd’hui', exact: true }).click();

    const total = page.getByRole('group', { name: 'Total des visites, graphique' });
    await attendreLaBase(() => total.innerText());
  });

  test('l’impression prépare la feuille des visites du jour', async ({ page }) => {
    await page.goto('/accueil');
    const entete = page.getByRole('heading', { level: 2 }).filter({ hasText: 'aujourd’hui' });
    const attendu = await attendreLaBase(() => entete.innerText());

    const imprimer = page.getByRole('button', { name: 'Imprimer' });
    await expect(imprimer).toBeEnabled();
    await imprimer.click();

    const boite = page.getByRole('dialog');
    await expect(boite).toBeVisible();
    await expect(boite).toContainText(String(attendu));
  });
});

test.describe('parcours 12, les listes et l’import du registre', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  test('les quatre listes de la saisie se lisent et se cherchent', async ({ page }) => {
    await page.goto('/accueil/listes');
    await expect(page.getByRole('tab', { name: 'Entreprises' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'CPI' })).toHaveCount(1);

    await page.getByRole('tab', { name: 'Objets de visite' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'ACHAT TERRAIN' })).toHaveCount(1);
  });

  test('un classeur corrigé se rejoue ligne par ligne avant d’écrire', async ({ page }) => {
    await page.goto('/accueil/import');

    const attente = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Exporter le registre filtré' }).click();
    const telecharge = await attente;
    const origine = await telecharge.path();
    expect(origine, 'le classeur exporté n’a pas été écrit').not.toBeNull();

    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.readFile(String(origine));
    const feuille = classeur.worksheets[0];
    if (feuille === undefined) throw new Error('le classeur exporté n’a aucune feuille');

    let rangeeVisite = 0;
    feuille.eachRow((rangee, numero) => {
      const nom = rangee.getCell(COLONNE_NOM).value;
      if (numero >= PREMIERE_LIGNE && nom === VISITEUR_CLASSEUR) rangeeVisite = numero;
    });
    expect(rangeeVisite, 'la visite de départ manque à l’export').toBeGreaterThan(0);

    const existante = feuille.getRow(rangeeVisite);
    existante.getCell(COLONNE_COMMENTAIRE).value = COMMENTAIRE_CORRIGE;

    const ajoutee = feuille.getRow(feuille.rowCount + 1);
    ajoutee.getCell(COLONNE_REGISTRE).value = null;
    ajoutee.getCell(COLONNE_DATE).value = existante.getCell(COLONNE_DATE).value;
    ajoutee.getCell(COLONNE_NOM).value = VISITEUR_IMPORTE;
    ajoutee.getCell(COLONNE_ENTREPRISE).value = 'CPI';
    ajoutee.getCell(COLONNE_OBJET).value = 'ACHAT TERRAIN';
    ajoutee.commit();
    await classeur.xlsx.writeFile(classeurTravail);

    await page.getByLabel(/Glissez le classeur ici/).setInputFiles(classeurTravail);

    const revue = page.getByText('Correction', { exact: true }).first();
    await expect(revue).toBeVisible();
    await expect(page.getByText(COMMENTAIRE_CORRIGE).first()).toBeVisible();
    await expect(page.getByText('Création', { exact: true }).first()).toBeVisible();

    const avant = await ligne<{ comment: string }>(
      'SELECT comment FROM visites WHERE "visitorName" = $1',
      [VISITEUR_CLASSEUR],
    );
    expect(avant?.comment, 'la revue a écrit avant confirmation').toBe(COMMENTAIRE);

    await page.getByRole('button', { name: /^Appliquer / }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText('ne s’annule pas');
    await confirmation.getByRole('button', { name: /^Appliquer / }).click();

    await expect(page.getByText('Import appliqué au registre.')).toBeVisible();

    const corrigee = await ligne<{ comment: string }>(
      'SELECT comment FROM visites WHERE "visitorName" = $1',
      [VISITEUR_CLASSEUR],
    );
    expect(corrigee?.comment, 'la correction du classeur n’a pas été écrite').toBe(
      COMMENTAIRE_CORRIGE,
    );

    const creee = await ligne<{ reference: string }>(
      'SELECT reference FROM visites WHERE "visitorName" = $1',
      [VISITEUR_IMPORTE],
    );
    expect(creee?.reference, 'la ligne ajoutée au classeur n’a pas créé de visite').toMatch(
      /^V-\d{4}-/,
    );
  });
});
