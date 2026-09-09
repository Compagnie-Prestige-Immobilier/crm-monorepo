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
const NOM_PRINCIPAL = `${PREFIXE} Awa Diop`;
const NOM_ACCENTUE = `${PREFIXE} Ndèye O’Brien-Sy «ç»`;
const COMMENTAIRE_ACCENTUE = 'Accents : é à ù «guillemets» & <balise>';
const TELEPHONE = '+221781120012';
const CODE_LISTE = `E2E_ACCUEIL_${MARQUE.toUpperCase()}`;
const LIBELLE_LISTE = `${PREFIXE} Entreprise`;
const LIBELLE_RENOMME = `${LIBELLE_LISTE} bis`;

const ENTREPRISE = 'CPI';
const OBJET = 'SUIVI DE DOSSIER';
const DESTINATAIRE = 'MME. NDOYE (RESP. COMM.)';

const JOUR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(new Date());
const JOUR_FR = `${JOUR.slice(8, 10)}/${JOUR.slice(5, 7)}/${JOUR.slice(0, 4)}`;
const FIXTURES = path.join(__dirname, 'fixtures');
const ANNONCE_ENREGISTREE = /^Visite (V-\d{4}-\d{6}) enregistrée\.$/u;

let referencePrincipale = '';
let referenceImportee = '';

async function nettoyer(): Promise<void> {
  await avecBase(async (client) => {
    await client.query(
      `DELETE FROM visite_import_changes
        WHERE "importJobId" IN (SELECT id FROM import_jobs WHERE "requestedById" = $1)`,
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

/** Le champ que porte ce libellé : « Obligatoire » colle au texte du `<label>`. */
function champ(racine: Locator, libelle: string): Locator {
  return racine.getByLabel(new RegExp(`^${libelle}`, 'u'));
}

async function choisir(racine: Locator, libelle: string, option: string): Promise<void> {
  await champ(racine, libelle).click();
  await racine.page().getByRole('option', { name: option, exact: true }).click();
}

async function ouvrirSaisie(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Ajouter une visite' }).click();
  const formulaire = page.getByRole('form', { name: 'Enregistrer une visite' });
  await expect(formulaire).toBeVisible();
  return formulaire;
}

function rangeeDe(page: Page, nom: string): Locator {
  return page.getByRole('row').filter({ hasText: nom });
}

async function ouvrirRecherche(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Rechercher et filtrer' }).click();
  const champRecherche = page.getByLabel('Rechercher', { exact: true });
  await expect(champRecherche).toBeVisible();
  return champRecherche;
}

test.describe('parité accueil, le registre des visites', () => {
  test.use({ storageState: ACCUEIL.etat });
  test.describe.configure({ mode: 'serial' });

  test('la journée part de zéro, la file d’attente enchaîne, le registre compte', async ({
    page,
  }) => {
    await page.goto('/accueil');
    await expect(page.getByRole('heading', { level: 2, name: '0 visite aujourd’hui' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 3, name: 'Aucune visite enregistrée aujourd’hui' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voir tout le registre' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimer', exact: true })).toBeDisabled();

    const formulaire = await ouvrirSaisie(page);
    await expect(champ(formulaire, 'DATE VISITE')).toHaveValue(JOUR);
    await champ(formulaire, 'PRENOM ET NOMS').fill(NOM_PRINCIPAL);
    await champ(formulaire, 'TELEPHONES').fill(TELEPHONE);
    await choisir(formulaire, 'ENTREPRISE', ENTREPRISE);
    await choisir(formulaire, 'OBJET VISITE', OBJET);
    await champ(formulaire, 'COMMENTAIRES / NOTES').fill(`${PREFIXE} premiere ligne`);
    await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();

    const annonce = page.getByText(ANNONCE_ENREGISTREE).first();
    await expect(annonce).toBeVisible();
    referencePrincipale = ANNONCE_ENREGISTREE.exec(await annonce.innerText())?.[1] ?? '';
    expect(referencePrincipale, 'la référence attribuée doit être annoncée').toMatch(
      /^V-\d{4}-\d{6}$/u,
    );

    await expect(formulaire, 'le dialogue reste ouvert pour le visiteur suivant').toBeVisible();
    await expect(champ(formulaire, 'PRENOM ET NOMS')).toHaveValue('');
    await expect(champ(formulaire, 'PRENOM ET NOMS')).toBeFocused();
    await expect(champ(formulaire, 'ENTREPRISE'), 'la file garde l’entreprise').toHaveText(
      ENTREPRISE,
    );
    await expect(champ(formulaire, 'OBJET VISITE')).toHaveText('Choisir');
    await expect(champ(formulaire, 'COMMENTAIRES / NOTES')).toHaveValue('');

    await champ(formulaire, 'PRENOM ET NOMS').fill(NOM_ACCENTUE);
    await choisir(formulaire, 'OBJET VISITE', OBJET);
    await champ(formulaire, 'COMMENTAIRES / NOTES').fill(COMMENTAIRE_ACCENTUE);
    await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();
    await expect(champ(formulaire, 'PRENOM ET NOMS')).toHaveValue('');

    await page.keyboard.press('Escape');
    await expect(formulaire).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 2, name: '2 visites aujourd’hui' }),
    ).toBeVisible();

    const accentuee = rangeeDe(page, NOM_ACCENTUE);
    await expect(accentuee).toHaveCount(1);
    await expect(accentuee.getByRole('cell', { name: COMMENTAIRE_ACCENTUE, exact: true })).toHaveCount(1);
    await expect(page.locator('balise'), 'le nom traverse le tour sans être interprété').toHaveCount(
      0,
    );

    const enregistree = await ligne<{
      reference: string;
      phone: string | null;
      comment: string | null;
      entreprise: string;
      objet: string;
    }>(
      `SELECT v.reference, v.phone, v.comment, e.label AS entreprise, o.label AS objet
         FROM visites v
         JOIN visite_entreprises e ON e.id = v."entrepriseId"
         JOIN visite_objets o ON o.id = v."objetId"
        WHERE v."visitorName" = $1`,
      [NOM_PRINCIPAL],
    );
    expect(enregistree?.reference).toBe(referencePrincipale);
    expect(enregistree?.phone).toBe(TELEPHONE);
    expect(enregistree?.entreprise).toBe(ENTREPRISE);
    expect(enregistree?.objet).toBe(OBJET);
    expect(
      await compter('SELECT count(*) AS n FROM visites WHERE "visitorName" LIKE $1', [
        `${PREFIXE}%`,
      ]),
      'deux saisies, deux lignes au registre',
    ).toBe(2);
  });

  test('un formulaire incomplet ne part pas au serveur', async ({ page }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'POST' && requete.url().endsWith('/api/v1/visites')) {
        envois.push(requete.url());
      }
    });

    await page.goto('/accueil');
    const formulaire = await ouvrirSaisie(page);
    await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();
    await expect(formulaire.getByRole('alert')).toHaveText([
      'À renseigner.',
      'À choisir dans la liste.',
      'À choisir dans la liste.',
    ]);

    await champ(formulaire, 'PRENOM ET NOMS').fill('A');
    await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();
    await expect(formulaire.getByRole('alert').first()).toHaveText('Au moins deux caractères.');

    await champ(formulaire, 'PRENOM ET NOMS').fill(`${PREFIXE} Sans date`);
    await choisir(formulaire, 'ENTREPRISE', ENTREPRISE);
    await choisir(formulaire, 'OBJET VISITE', OBJET);
    await champ(formulaire, 'DATE VISITE').fill('');
    await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();
    await expect(formulaire.getByRole('alert')).toHaveText(['À renseigner.']);

    const commentaire = champ(formulaire, 'COMMENTAIRES / NOTES');
    await commentaire.fill('0123456789');
    await expect(formulaire.getByText('10 / 2000 caractères', { exact: true })).toBeVisible();
    await commentaire.fill('x'.repeat(2100));
    await expect(commentaire).toHaveValue('x'.repeat(2000));

    expect(envois, 'une saisie incomplète ne doit rien envoyer').toEqual([]);
    expect(
      await compter('SELECT count(*) AS n FROM visites WHERE "visitorName" LIKE $1', [
        `${PREFIXE} Sans date%`,
      ]),
    ).toBe(0);
  });

  test('les critères vivent dans l’URL, survivent au rechargement et pilotent le tri', async ({
    page,
  }) => {
    const requetes: string[] = [];
    page.on('request', (requete) => {
      if (requete.url().includes('/api/v1/visites?')) requetes.push(requete.url());
    });

    await page.goto('/accueil');
    const recherche = await ouvrirRecherche(page);
    await recherche.fill('E');
    await expect(page).toHaveURL(/\/accueil\?search=E$/u);
    await expect
      .poll(
        () => requetes.filter((url) => new URL(url).searchParams.has('search')).length,
        { message: 'une recherche d’un seul caractère ne part pas au serveur' },
      )
      .toBe(0);

    await recherche.fill(MARQUE);
    await expect(page).toHaveURL(new RegExp(`\\?search=${MARQUE}$`, 'u'));
    await expect(rangeeDe(page, NOM_PRINCIPAL)).toHaveCount(1);

    await page.getByRole('button', { name: 'Tout le registre' }).click();
    await expect(page).toHaveURL(new RegExp(`search=${MARQUE}&periode=tout$`, 'u'));
    await expect(page.getByRole('button', { name: 'Tout le registre' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const entete = page.getByRole('columnheader', { name: 'PRENOM ET NOMS' });
    await entete.getByRole('button').click();
    await expect(page).toHaveURL(/sortBy=visitorName&sortDir=asc$/u);
    await expect(entete).toHaveAttribute('aria-sort', 'ascending');
    await entete.getByRole('button').click();
    await expect(page, 'l’ordre décroissant est le défaut : il ne s’écrit pas').toHaveURL(
      /sortBy=visitorName$/u,
    );
    await expect(entete).toHaveAttribute('aria-sort', 'descending');
    await page.reload();
    await expect(entete).toHaveAttribute('aria-sort', 'descending');

    await page.goto(`/accueil?search=${MARQUE}-introuvable&periode=tout`);
    await expect(
      page.getByRole('heading', { level: 3, name: 'Aucune visite pour cette recherche' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimer', exact: true })).toBeDisabled();

    await page.getByRole('button', { name: 'Retirer les filtres' }).click();
    await expect(page).toHaveURL(/\/accueil$/u);
    await expect(page.getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('corriger une visite : la date se lit, l’abandon n’écrit rien', async ({ page }) => {
    const corrections: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'PATCH' && requete.url().includes('/api/v1/visites/')) {
        corrections.push(requete.url());
      }
    });

    await page.goto(`/accueil?search=${MARQUE}&periode=tout`);
    await page.getByRole('button', { name: `Modifier la visite de ${NOM_ACCENTUE}` }).click();
    let correction = page.getByRole('form', { name: 'Corriger la visite' });
    await champ(correction, 'PRENOM ET NOMS').fill(`${PREFIXE} Nom abandonne`);
    await correction.getByRole('button', { name: 'Annuler' }).click();
    await expect(correction).toHaveCount(0);
    expect(corrections, 'une correction abandonnée n’écrit rien').toEqual([]);
    await expect(rangeeDe(page, NOM_ACCENTUE)).toHaveCount(1);

    await page.getByRole('button', { name: `Modifier la visite de ${NOM_PRINCIPAL}` }).click();
    correction = page.getByRole('form', { name: 'Corriger la visite' });
    await expect(
      champ(correction, 'DATE VISITE'),
      'l’API refuse de déplacer une ligne d’un jour à l’autre : la date ne se saisit pas',
    ).toHaveCount(0);
    await choisir(correction, 'DESTINATAIRES', DESTINATAIRE);
    await correction.getByRole('button', { name: 'Enregistrer la correction' }).click();

    await expect(page.getByText(`Visite ${referencePrincipale} corrigée.`)).toBeVisible();
    await expect(correction).toHaveCount(0);
    await expect(
      rangeeDe(page, NOM_PRINCIPAL).getByRole('cell', { name: DESTINATAIRE, exact: true }),
    ).toHaveCount(1);

    const relue = await ligne<{ destinataire: string | null; nom: string }>(
      `SELECT d.label AS destinataire, v."visitorName" AS nom
         FROM visites v
         LEFT JOIN visite_destinataires d ON d.id = v."destinataireId"
        WHERE v.reference = $1`,
      [referencePrincipale],
    );
    expect(relue?.destinataire).toBe(DESTINATAIRE);
    expect(relue?.nom, 'seul le destinataire est corrigé').toBe(NOM_PRINCIPAL);
  });

  test('le dialogue d’impression retient portée, colonnes et orientation', async ({ page }) => {
    await page.goto(`/accueil?search=${MARQUE}&periode=tout`);
    const rangee = rangeeDe(page, NOM_ACCENTUE);
    await expect(rangee).toHaveCount(1);

    await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
    const dialogue = page.getByRole('dialog', { name: 'Préparer l’impression' });
    await expect(
      dialogue.getByText('Les filtres et la période affichés seront conservés.', { exact: true }),
    ).toBeVisible();
    await expect(dialogue.getByRole('radio', { name: /^La page affichée/u })).toBeChecked();

    for (const verrouillee of ['DATE VISITE', 'PRENOM ET NOMS']) {
      const boite = dialogue.getByRole('checkbox', { name: verrouillee, exact: true });
      await expect(boite, `${verrouillee} identifie la feuille : elle ne se décoche pas`).toBeDisabled();
      await expect(boite).toBeChecked();
    }
    await dialogue.getByRole('checkbox', { name: 'COMMENTAIRES / NOTES', exact: true }).uncheck();
    await dialogue.getByRole('radio', { name: /^Portrait/u }).check();
    await dialogue.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialogue).toHaveCount(0);

    // La règle `@page` ne se lit que dans le `<style>` : aucun rôle ne la porte.
    await expect
      .poll(async () => (await page.locator('style[media="print"]').textContent()) ?? '')
      .toContain('size: portrait');

    const celluleNote = rangee.getByRole('cell').filter({ hasText: COMMENTAIRE_ACCENTUE });
    await page.emulateMedia({ media: 'print' });
    await expect(celluleNote, 'une colonne décochée ne sort pas sur la feuille').toBeHidden();
    await expect(page.getByRole('button', { name: 'Ajouter une visite' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Rechercher dans le registre' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Registre des visites' })).toBeHidden();
    await expect(page.getByRole('columnheader', { name: 'CORRIGER', exact: true })).toBeHidden();
    await expect(page.getByRole('table')).toBeVisible();

    await page.emulateMedia({ media: 'screen' });
    await expect(celluleNote).toBeVisible();
  });

  test.fixme(
    'chercher un visiteur sans changer de période : l’en-tête annonce « N visites au registre » alors que `plageDe` (lib/data/visites.ts) borne encore la requête à la journée (v1 ACC-REG-12)',
    () => {},
  );
});

test.describe('parité accueil, les quatre listes de la saisie', () => {
  test.use({ storageState: DIRECTION.etat });
  test.describe.configure({ mode: 'serial' });

  test('créer une entrée : le code est normalisé, validé, et un doublon est refusé', async ({
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
    await expect(page.getByRole('tab', { name: 'Entreprises' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByText('La société ou l’organisme visité.', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle entreprise' }).click();
    const dialogue = page.getByRole('dialog', { name: 'Nouvelle entreprise' });
    await expect(
      dialogue.getByText('Le code est définitif, utile pour l’export.', { exact: true }),
    ).toBeVisible();
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialogue.getByRole('alert')).toHaveText([
      'Majuscules, chiffres et tirets bas, deux caractères au moins.',
      'Le libellé est obligatoire.',
    ]);
    expect(envois, 'un formulaire vide ne part pas au serveur').toEqual([]);

    await champ(dialogue, 'Code').fill('E2E-ACC');
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialogue.getByRole('alert').first()).toHaveText(
      'Majuscules, chiffres et tirets bas, deux caractères au moins.',
    );

    // Saisi en minuscules : c'est l'écran qui met en majuscules avant l'envoi.
    await champ(dialogue, 'Code').fill(CODE_LISTE.toLowerCase());
    await champ(dialogue, 'Libellé').fill(LIBELLE_LISTE);
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(`${LIBELLE_LISTE} ajouté.`)).toBeVisible();
    await expect(dialogue).toHaveCount(0);

    const creee = await ligne<{ code: string; label: string; isActive: boolean }>(
      'SELECT code, label, "isActive" FROM visite_entreprises WHERE code = $1',
      [CODE_LISTE],
    );
    expect(creee?.label).toBe(LIBELLE_LISTE);
    expect(creee?.isActive).toBe(true);

    await page.getByRole('button', { name: 'Nouvelle entreprise' }).click();
    const doublon = page.getByRole('dialog', { name: 'Nouvelle entreprise' });
    await champ(doublon, 'Code').fill(CODE_LISTE);
    await champ(doublon, 'Libellé').fill(`${LIBELLE_LISTE} doublon`);
    await doublon.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      page.getByText('Cette valeur existe déjà dans cette liste.'),
      'un code déjà pris se refuse par un message, pas par un silence',
    ).toBeVisible();
    await expect(doublon, 'la saisie n’est pas perdue').toBeVisible();
    await doublon.getByRole('button', { name: 'Annuler' }).click();
    expect(
      await compter('SELECT count(*) AS n FROM visite_entreprises WHERE code = $1', [CODE_LISTE]),
    ).toBe(1);
  });

  test('renommer sans toucher au code, chercher sans accent, retirer de la saisie', async ({
    page,
  }) => {
    await page.goto('/accueil/listes');
    await page.getByRole('button', { name: `Modifier ${LIBELLE_LISTE}` }).click();
    const dialogue = page.getByRole('dialog', { name: `Renommer « ${LIBELLE_LISTE} »` });
    await expect(
      dialogue.getByText('Le code reste inchangé : les visites déjà enregistrées le désignent.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(champ(dialogue, 'Code'), 'le code est définitif').toHaveCount(0);
    await champ(dialogue, 'Libellé').fill(LIBELLE_RENOMME);
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(`${LIBELLE_RENOMME} enregistré.`)).toBeVisible();

    const renommee = await ligne<{ code: string; label: string }>(
      'SELECT code, label FROM visite_entreprises WHERE code = $1',
      [CODE_LISTE],
    );
    expect(renommee?.label).toBe(LIBELLE_RENOMME);

    await page.getByRole('tab', { name: 'Directions' }).click();
    await expect(page).toHaveURL(/\?onglet=visite-directions$/u);
    await page.getByLabel('Rechercher', { exact: true }).fill('comptabilité');
    await expect(
      page.getByRole('button', { name: 'Modifier FINANCE & COMPTABILITE' }),
      'la recherche ignore les accents et la casse',
    ).toBeVisible();
    await page.getByLabel('Rechercher', { exact: true }).fill('introuvable-e2e');
    await expect(page.getByText('Aucune entrée ne correspond.', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Entreprises' }).click();
    await page.getByRole('button', { name: `Retirer ${LIBELLE_RENOMME} de la saisie` }).click();
    const retrait = page.getByRole('dialog', { name: `Retirer « ${LIBELLE_RENOMME} » de la saisie` });
    await expect(
      retrait.getByText(
        'Les visites déjà enregistrées la gardent. Elle ne sera plus proposée au comptoir.',
        { exact: true },
      ),
    ).toBeVisible();
    await retrait.getByRole('button', { name: 'Retirer de la saisie' }).click();
    await expect(page.getByText(`${LIBELLE_RENOMME} retiré de la saisie.`)).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Proposer de nouveau ${LIBELLE_RENOMME}` }),
    ).toBeVisible();

    const retiree = await ligne<{ isActive: boolean }>(
      'SELECT "isActive" FROM visite_entreprises WHERE code = $1',
      [CODE_LISTE],
    );
    expect(retiree?.isActive).toBe(false);

    await page.goto('/accueil');
    const formulaire = await ouvrirSaisie(page);
    await champ(formulaire, 'ENTREPRISE').click();
    await expect(page.getByRole('option', { name: ENTREPRISE, exact: true })).toBeVisible();
    await expect(
      page.getByRole('option', { name: LIBELLE_RENOMME, exact: true }),
      'une entrée retirée ne se propose plus au comptoir',
    ).toHaveCount(0);
  });

  test.fixme(
    'classer les entrées d’une liste : `listes-tableau.tsx` n’offre ni « Monter », ni « Descendre », ni glisser-déposer, l’ordre de saisie n’est plus réglable (v1 ACC-LST-08 et ACC-LST-09)',
    () => {},
  );
  test.fixme(
    'retirer une entrée : la confirmation n’annonce plus combien de visites la référencent, v1 affichait « 0 visite référence cette entreprise. » (v1 ACC-LST-10)',
    () => {},
  );
  test.fixme(
    'code déjà pris : « Cette valeur existe déjà dans cette liste. » ne nomme plus l’entrée fautive, v1 disait « Le code « X » est déjà porté par « Y ». » (v1 ACC-LST-05)',
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

interface LigneClasseur {
  numero?: string;
  nom: string;
  commentaire?: string;
}

async function classeurRegistre(nom: string, lignes: readonly LigneClasseur[]): Promise<string> {
  mkdirSync(FIXTURES, { recursive: true });
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Registre');
  feuille.addRow(EN_TETES);
  feuille.addRow(RAPPEL);
  for (const valeurs of lignes) {
    feuille.addRow([
      valeurs.numero ?? '',
      JOUR_FR,
      '',
      valeurs.nom,
      '',
      ENTREPRISE,
      '',
      '',
      OBJET,
      valeurs.commentaire ?? '',
      '',
    ]);
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

test.describe('parité accueil, l’aller-retour Excel du registre', () => {
  test.use({ storageState: DIRECTION.etat });
  test.describe.configure({ mode: 'serial' });

  test('l’écran annonce ses temps, et un classeur trop lourd est refusé avant l’envoi', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (new URL(requete.url()).pathname === '/api/v1/visites/import') envois.push(requete.url());
    });

    await page.goto('/accueil/import');
    await expect(page.getByText('1. Exporter le registre', { exact: true })).toBeVisible();
    await expect(page.getByText('2. Déposer le classeur corrigé', { exact: true })).toBeVisible();
    await expect(page.getByText('Format .xlsx, 25 Mo au maximum.', { exact: true })).toBeVisible();
    await expect(page.getByText(/^3\. Analyse/u)).toHaveCount(0);
    await expect(page.getByText('4. Revue', { exact: true })).toHaveCount(0);

    await page.getByLabel(/^Glissez le classeur ici/u).setInputFiles({
      name: 'parite-accueil-trop-lourd.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.alloc(26 * 1024 * 1024),
    });
    await expect(
      page.getByText('Fichier trop volumineux : 25 Mo au maximum.'),
    ).toBeVisible();
    expect(envois, 'le garde est client : 26 Mo ne partent pas se faire refuser en 413').toEqual([]);
  });

  test('une création se simule, se revoit, n’écrit rien, puis s’applique', async ({ page }) => {
    const nom = `${PREFIXE} Fatou Sarr`;
    await page.goto('/accueil/import');
    await deposer(page, await classeurRegistre('creation', [{ nom, commentaire: `${PREFIXE} note` }]));

    expect(await cadran(page, 'À créer')).toBe(1);
    expect(await cadran(page, 'Refusées')).toBe(0);
    await expect(page.getByText('1 différence, 0 correction, 1 création', { exact: true })).toBeVisible();

    const revue = page.getByRole('listitem').filter({ hasText: `${nom}, ${JOUR_FR}` });
    await expect(revue).toHaveCount(1);
    await expect(revue.getByText('Création', { exact: true })).toBeVisible();
    await expect(revue.getByText('ligne 3', { exact: true })).toBeVisible();
    await expect(revue.getByRole('checkbox')).toBeChecked();

    expect(
      await compter('SELECT count(*) AS n FROM visites WHERE "visitorName" = $1', [nom]),
      'la simulation n’écrit rien avant confirmation',
    ).toBe(0);

    await page.getByRole('button', { name: 'Appliquer 1 création' }).click();
    const boite = page.getByRole('dialog', { name: 'Appliquer 1 création ?' });
    await expect(
      boite.getByText('Cette action écrit les visites cochées dans le registre et ne s’annule pas.', {
        exact: true,
      }),
    ).toBeVisible();
    await boite.getByRole('button', { name: 'Appliquer 1 création' }).click();

    await expect(page.getByText('1 visite créée, 0 corrigée.', { exact: true })).toBeVisible();

    const creee = await ligne<{ reference: string; comment: string | null }>(
      'SELECT reference, comment FROM visites WHERE "visitorName" = $1',
      [nom],
    );
    referenceImportee = creee?.reference ?? '';
    expect(referenceImportee).toMatch(/^V-\d{4}-\d{6}$/u);
    expect(creee?.comment).toBe(`${PREFIXE} note`);

    await page.getByRole('button', { name: 'Déposer un autre fichier' }).click();
    await expect(page.getByText(/^3\. Analyse/u)).toHaveCount(0);
  });

  test('une correction montre l’avant et l’après, et le bouton suit les lignes cochées', async ({
    page,
  }) => {
    expect(referenceImportee, 'le scénario précédent n’a pas relevé la référence créée').not.toBe(
      '',
    );
    const corrige = `${PREFIXE} Fatou Sarr`;
    const nouveau = `${PREFIXE} Mamadou Diop`;

    await page.goto('/accueil/import');
    await deposer(
      page,
      await classeurRegistre('revue', [
        { numero: referenceImportee, nom: corrige, commentaire: `${PREFIXE} note corrigée` },
        { nom: nouveau },
      ]),
    );

    expect(await cadran(page, 'À corriger')).toBe(1);
    expect(await cadran(page, 'À créer')).toBe(1);
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: corrige })
        .getByText(
          `COMMENTAIRES / NOTES : « ${PREFIXE} note » → « ${PREFIXE} note corrigée »`,
          { exact: true },
        ),
    ).toBeVisible();

    await page
      .getByRole('listitem')
      .filter({ hasText: nouveau })
      .getByRole('checkbox')
      .uncheck();
    await expect(
      page.getByRole('button', { name: 'Appliquer 1 correction' }),
      'le bouton annonce exactement ce qui sera écrit',
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Tout décocher' }).click();
    await expect(page.getByRole('button', { name: 'Rien à appliquer' })).toBeDisabled();

    expect(
      await compter('SELECT count(*) AS n FROM visites WHERE "visitorName" = $1', [nouveau]),
      'une revue abandonnée n’écrit rien',
    ).toBe(0);
  });

  test('un numéro de registre inconnu est refusé, jamais replié en création', async ({ page }) => {
    await page.goto('/accueil/import');
    await deposer(
      page,
      await classeurRegistre('inconnu', [
        { numero: 'V-1999-000001', nom: `${PREFIXE} Refus Registre` },
      ]),
    );

    expect(await cadran(page, 'Refusées')).toBe(1);
    expect(await cadran(page, 'À créer'), 'une coquille ne crée pas une visite fantôme').toBe(0);
    await expect(page.getByRole('heading', { name: 'Lignes refusées' })).toBeVisible();
    const refus = page.getByRole('row').filter({ hasText: 'V-1999-000001' });
    await expect(refus).toHaveCount(1);
    await expect(refus.getByRole('cell').first()).toHaveText('3');
    await expect(refus.getByRole('cell').nth(1)).toHaveText('N° REGISTRE');
    await expect(page.getByText('4. Revue', { exact: true })).toHaveCount(0);
  });

  test('le registre exporté puis redéposé tel quel ne propose rien à appliquer', async ({
    page,
  }) => {
    await page.goto('/accueil/import');
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Exporter le registre filtré' }).click(),
    ]);
    expect(telechargement.suggestedFilename()).toMatch(
      /^registre-visites-cpi-\d{4}-\d{2}-\d{2}\.xlsx$/u,
    );
    const chemin = path.join(FIXTURES, 'parite-accueil-aller-retour.xlsx');
    await telechargement.saveAs(chemin);
    // Un vrai classeur : un 502 relayé sous ce nom passerait tout le reste.
    expect([...readFileSync(chemin).subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    await deposer(page, chemin);
    expect(await cadran(page, 'À créer')).toBe(0);
    expect(await cadran(page, 'À corriger')).toBe(0);
    expect(await cadran(page, 'Refusées')).toBe(0);
    expect(await cadran(page, 'Inchangées')).toBeGreaterThan(0);
    await expect(
      page.getByText('Votre classeur est identique au registre. Rien à appliquer.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('4. Revue', { exact: true })).toHaveCount(0);
  });

  test.fixme(
    '« Déposer un autre fichier » ne rend plus le focus au champ de dépôt : `recommencer` (use-import-registre.ts) remet l’état sans replacer le clavier (v1 ACC-XLS-11)',
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
    await expect(pastilles.getByRole('button', { name: 'Ce mois-ci' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    for (const [libelle, parametre] of [
      ['Mois dernier', 'mois-dernier'],
      ['12 derniers mois', 'douze-mois'],
      ['Cette année', 'cette-annee'],
    ] as const) {
      await pastilles.getByRole('button', { name: libelle, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]periode=${parametre}(&|$)`, 'u'));
      await expect(
        pastilles.getByRole('button', { name: libelle, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
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
    expect(
      appels.filter((url) => url.includes(`from=${du}`)),
      'la garde cliente coupe la requête au lieu de laisser l’API refuser',
    ).toEqual([]);
  });

  test('organiser les graphiques : ajout enregistré, retrait abandonné, retour au défaut', async ({
    page,
  }) => {
    await page.goto('/accueil/tableau-de-bord');
    await page.getByRole('button', { name: 'Organiser les graphiques' }).click();
    await expect(page.getByText('Mode organisation', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Proposer par défaut' }),
      'un compte ACCUEIL ne fixe pas la disposition de tous les comptes',
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Ajouter un graphique' }).click();
    const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
    await tiroir.getByLabel('Chercher une question ou un indicateur').fill('Par heure');
    await tiroir
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Par heure', exact: true }) })
      .getByRole('button', { name: 'Ajouter', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await expect(tiroir).toHaveCount(0);

    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Mode organisation', { exact: true })).toHaveCount(0);

    const gardee = await ligne<{ layout: { widgets: { source: string }[] } }>(
      'SELECT layout FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2',
      [ACCUEIL.id, 'visites'],
    );
    expect(gardee?.layout.widgets.map((widget) => widget.source)).toContain('par-heure');

    await page.reload();
    const carte = page.getByRole('button', { name: 'À propos de Par heure' });
    await expect(carte).toBeVisible();

    await page.getByRole('button', { name: 'Organiser les graphiques' }).click();
    await page.getByRole('button', { name: 'Retirer Par heure' }).click();
    await page.getByRole('button', { name: 'Quitter', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Quitter sans enregistrer' });
    await expect(
      confirmation.getByText('Les changements faits dans ce mode seront perdus.', { exact: true }),
    ).toBeVisible();
    await confirmation.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await expect(carte, 'quitter sans enregistrer rétablit la disposition gardée').toBeVisible();

    await page.getByRole('button', { name: 'Revenir à la disposition par défaut' }).click();
    await expect(page.getByRole('button', { name: 'Revenir à la disposition par défaut' })).toHaveCount(
      0,
    );
    expect(
      await compter(
        'SELECT count(*) AS n FROM dashboard_layouts WHERE "userId" = $1 AND ecran = $2',
        [ACCUEIL.id, 'visites'],
      ),
      'revenir au défaut efface la disposition du compte',
    ).toBe(0);
  });

  test.fixme(
    'comparer une période à la précédente : le sélecteur « Comparer à » du tableau de bord v1 n’existe pas en v2 (`selecteur-periode.tsx`), aucun écart n’est affiché (v1 ACC-TDB-05)',
    () => {},
  );
  test.fixme(
    'exporter le détail des visites : v2 n’a plus le CSV ligne à ligne « Exporter le détail », `BoutonExportExcel` n’exporte que les graphiques affichés (v1 ACC-TDB-12)',
    () => {},
  );
});
