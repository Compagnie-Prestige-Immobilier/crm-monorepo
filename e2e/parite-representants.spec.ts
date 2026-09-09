import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { Workbook } from 'exceljs';
import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { sansDebordementHorizontal } from './donnees-chues';
import {
  apiDe,
  compter,
  creerRepresentant,
  departementQuelconque,
  ligne,
  purger,
  suffixe,
} from './donnees-listes';

const REGISTRE = '/chues/representants';
const IMPORT = '/chues/representants/import';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const cle = suffixe();
const nomDe = (quoi: string): string => `E2E rep ${cle} ${quoi}`;

/** Apostrophe courbe et accents : ce que l'aller-retour du classeur doit rendre intact. */
const NOM_IMPORTE = nomDe('Ndèye Coumba N’Diaye-Sy');
const TELEPHONE_IMPORTE = '+221781050001';
const NOM_REFUSE = nomDe('Numero illisible');
const NOM_NON_CLASSEUR = nomDe('Fichier texte');

const CHERCHEE = { nom: nomDe('Mariama Sy'), phone: '+221781050010' };
const TEMOIN = { nom: nomDe('Sans prospect'), phone: '+221781050011' };
const AU_TELECONSEILLER = { nom: nomDe('Fiche du teleconseiller'), phone: '+221781050012' };

const representants: string[] = [];
let departement = { id: '', name: '' };

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function signature(chemin: string): Promise<number[]> {
  const morceaux: Buffer[] = [];
  for await (const morceau of createReadStream(chemin, { start: 0, end: 3 })) {
    morceaux.push(morceau as Buffer);
  }
  return Array.from(Buffer.concat(morceaux));
}

async function vraiClasseur(chemin: string): Promise<void> {
  expect((await stat(chemin)).size).toBeGreaterThan(1_000);
  expect(await signature(chemin), 'un 5xx renommé .xlsx passerait tout le reste').toEqual([
    0x50, 0x4b, 0x03, 0x04,
  ]);
}

/** Ligne 2 : l'exemple du modèle, que le serveur saute (`imports.go:30`). */
async function classeur(lignes: readonly (readonly string[])[]): Promise<Buffer> {
  const livre = new Workbook();
  const feuille = livre.addWorksheet('Représentants');
  feuille.addRow(['Nom complet', 'Téléphone', 'Département', 'IEF', 'Notes']);
  feuille.addRow(['Fatou Ndiaye', '77 123 45 67', departement.name, '', 'Ligne d’exemple']);
  for (const rang of lignes) feuille.addRow([...rang]);
  return Buffer.from(await livre.xlsx.writeBuffer());
}

const classeurNominal = async (): Promise<Buffer> =>
  classeur([
    [NOM_IMPORTE, '78 105 00 01', departement.name, '', 'Déposé par le parcours de parité'],
    [NOM_REFUSE, 'pas-un-numero', departement.name, '', ''],
  ]);

/** Le libellé de la zone porte le nom du fichier dès le premier dépôt ; le champ, lui, ne bouge pas. */
async function deposer(page: Page, nom: string, contenu: Buffer): Promise<void> {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: nom, mimeType: XLSX, buffer: contenu });
}

async function attendreRapport(page: Page): Promise<void> {
  await expect(page.getByText('Lignes lues', { exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Un cadran du rapport : `<dt>` porte l'intitulé, `<dd>` la valeur, appariés par rang. */
async function cadran(page: Page, intitule: string): Promise<number> {
  const intitules = await page.getByRole('term').allTextContents();
  const rang = intitules.findIndex((texte) => texte.trim() === intitule);
  expect(rang, `le cadran « ${intitule} » manque au rapport`).toBeGreaterThanOrEqual(0);
  const valeur = await page.getByRole('definition').nth(rang).textContent();
  return Number((valeur ?? '').replaceAll(/\D/gu, ''));
}

const fichesSemees = (): Promise<number> =>
  compter('SELECT count(*) AS n FROM representants WHERE "fullName" LIKE $1', [`E2E rep ${cle}%`]);

test.beforeAll(async () => {
  departement = await departementQuelconque();

  const admin = await apiDe('ADMIN', '198.51.100.50');
  for (const fiche of [CHERCHEE, TEMOIN]) {
    representants.push(
      await creerRepresentant(admin, {
        fullName: fiche.nom,
        phone: fiche.phone,
        departementId: departement.id,
      }),
    );
  }
  await admin.dispose();

  const teleconseiller = await apiDe('COMMERCIAL', '198.51.100.51');
  representants.push(
    await creerRepresentant(teleconseiller, {
      fullName: AU_TELECONSEILLER.nom,
      phone: AU_TELECONSEILLER.phone,
      departementId: departement.id,
    }),
  );
  await teleconseiller.dispose();
});

test.afterAll(async () => {
  const importee = await ligne<{ id: string }>(
    'SELECT id FROM representants WHERE "phoneE164" = $1',
    [TELEPHONE_IMPORTE],
  );
  if (importee !== null) representants.push(importee.id);
  await purger({ representants });
  // `import_jobs.requestedById` est en RESTRICT : sans cette ligne, la purge des comptes échoue.
  await avecBase(async (client) => {
    await client.query(`DELETE FROM import_jobs WHERE "fileName" LIKE 'parite-representants-%'`);
  });
});

test.describe('parité CHUES, le registre des représentants', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  test('l’export du registre produit un vrai classeur', async ({ page }) => {
    await page.goto(REGISTRE);
    await expect(page).toHaveTitle('Représentants · CPI GO');
    await expect(page.getByRole('heading', { level: 1, name: 'Représentants' })).toBeVisible();

    const exporter = page.getByRole('link', { name: 'Exporter la vue filtrée' });
    const [fichier] = await Promise.all([page.waitForEvent('download'), exporter.click()]);

    expect(fichier.suggestedFilename()).toMatch(/^representants-cpi-\d{4}-\d{2}-\d{2}\.xlsx$/u);
    await vraiClasseur(await fichier.path());
  });

  test('la recherche atteint le téléphone et laisse les gestes d’écriture à sa portée', async ({
    page,
  }) => {
    await page.goto(REGISTRE);
    const tableau = page.getByRole('table');
    const cherchee = tableau.getByRole('row').filter({ hasText: CHERCHEE.nom });
    const temoin = tableau.getByRole('row').filter({ hasText: TEMOIN.nom });

    await page.getByLabel('Recherche', { exact: true }).fill(CHERCHEE.phone.slice(4));
    await expect(cherchee, 'la recherche par chiffres atteint le téléphone normalisé').toHaveCount(
      1,
    );
    await expect(temoin, 'le témoin ne porte pas ce numéro').toHaveCount(0);

    await expect(
      cherchee.getByRole('button', { name: `Modifier la fiche de ${CHERCHEE.nom}` }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouveau représentant' })).toBeVisible();
  });

  test('un filtre sans résultat le dit sans faire croire à une base vide', async ({ page }) => {
    await page.goto(REGISTRE);
    await page.getByLabel('Recherche', { exact: true }).fill(nomDe('introuvable'));

    await expect(page.getByText('Aucun représentant ne correspond à ces critères.')).toBeVisible();
    await expect(
      page.getByText('Aucun représentant enregistré.'),
      'ce libellé est réservé à la base vide',
    ).toHaveCount(0);
  });

  test('la fiche s’ouvre depuis la liste, sans prospect ni bascule', async ({ page }) => {
    await page.goto(REGISTRE);
    await page.getByLabel('Recherche', { exact: true }).fill(TEMOIN.nom);
    await page.getByRole('link', { name: TEMOIN.nom, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${REGISTRE}/[0-9a-f-]{36}$`, 'u'));
    await expect(page.getByRole('heading', { level: 2, name: TEMOIN.nom })).toBeVisible();
    await expect(page.getByText('Histoire de la relation', { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: 'Jamais appelé' }),
      'la pastille dit où en est la relation, jamais tranchée ici',
    ).toBeVisible();
    await expect(page.getByText('Aucune fiche remise pour l’instant.')).toBeVisible();

    await page.getByRole('tab', { name: /^Statuts/u }).click();
    await expect(page.getByText('Aucune bascule enregistrée.')).toBeVisible();
  });

  test('un identifiant inconnu rend un refus lisible, pas une page blanche', async ({ page }) => {
    const explosions: string[] = [];
    page.on('pageerror', (erreur) => {
      explosions.push(erreur.message);
    });

    await page.goto(`${REGISTRE}/00000000-0000-7000-8000-000000000000`);

    await expect(page.getByRole('heading', { name: 'Introuvable', level: 2 })).toBeVisible();
    expect(explosions, 'aucune exception non rattrapée ne doit remonter').toEqual([]);
  });
});

test.describe('parité CHUES, la supervision lit sans écrire', () => {
  test.use({ storageState: compteDe('SUPERVISEUR').etat });

  test('aucun geste d’écriture n’est offert sur le registre', async ({ page }) => {
    await page.goto(REGISTRE);
    await page.getByLabel('Recherche', { exact: true }).fill(CHERCHEE.nom);

    // Sans cette ligne, l'absence de boutons ne prouverait qu'un écran vide.
    await expect(page.getByRole('row').filter({ hasText: CHERCHEE.nom })).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: /^Modifier la fiche de /u }),
      'la supervision ne modifie aucune fiche : l’API refuserait le geste',
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nouveau représentant' })).toHaveCount(0);
  });
});

test.describe('parité CHUES, le téléconseiller et ses fiches', () => {
  test.use({ storageState: compteDe('COMMERCIAL').etat });

  test('le registre ne lui rend que ses fiches et celles de ses campagnes', async ({ page }) => {
    await page.goto(REGISTRE);
    await page.getByLabel('Recherche', { exact: true }).fill(`E2E rep ${cle}`);

    await expect(
      page.getByRole('row').filter({ hasText: AU_TELECONSEILLER.nom }),
      'sa propre fiche lui revient',
    ).toHaveCount(1);
    await expect(
      page.getByRole('row').filter({ hasText: CHERCHEE.nom }),
      'la fiche d’un autre compte reste hors de sa portée',
    ).toHaveCount(0);
  });
});

test.describe('parité CHUES, import de représentants', () => {
  test.use({
    storageState: compteDe('ADMIN').etat,
    extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.52' },
  });

  test('le modèle se télécharge, et c’est un vrai classeur', async ({ page }) => {
    await page.goto(IMPORT);
    await expect(page.getByText('Partir du modèle')).toBeVisible();

    const [fichier] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Télécharger le modèle Excel' }).click(),
    ]);

    expect(fichier.suggestedFilename()).toMatch(
      /^modele-import-representants-\d{4}-\d{2}-\d{2}\.xlsx$/u,
    );
    await vraiClasseur(await fichier.path());
  });

  test('la simulation chiffre sans écrire, l’application écrit, le redépôt ne double pas', async ({
    page,
  }) => {
    const avant = await fichesSemees();
    await page.goto(IMPORT);
    await deposer(page, 'parite-representants-nominal.xlsx', await classeurNominal());
    await attendreRapport(page);

    expect(await cadran(page, 'Lignes lues'), 'la ligne d’exemple ne compte pas').toBe(2);
    expect(await cadran(page, 'À créer')).toBe(1);
    expect(await cadran(page, 'En erreur')).toBe(1);

    const refusee = page.getByRole('row').filter({ hasText: 'Numéro de téléphone inexploitable.' });
    await expect(refusee, 'le motif est nommé, pas compté').toHaveCount(1);
    await expect(refusee, 'la ligne renvoie au classeur, en-tête compris').toContainText('4');

    expect(await fichesSemees(), 'la simulation n’écrit rien').toBe(avant);

    await page.getByRole('button', { name: 'Écrire 1 fiche' }).click();
    await expect(page.getByText('1 fiche écrite.')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Importer un autre fichier' })).toBeVisible();

    const ecrite = await ligne<{ fullName: string; phoneE164: string }>(
      'SELECT "fullName", "phoneE164" FROM representants WHERE "phoneE164" = $1',
      [TELEPHONE_IMPORTE],
    );
    expect(ecrite?.fullName, 'accents et apostrophe courbe survivent au classeur').toBe(
      NOM_IMPORTE,
    );
    expect(ecrite?.phoneE164, 'le serveur normalise « 78 105 00 01 » en E.164').toBe(
      TELEPHONE_IMPORTE,
    );
    expect(
      await compter('SELECT count(*) AS n FROM representants WHERE "fullName" = $1', [NOM_REFUSE]),
      'la ligne en erreur n’est pas écrite',
    ).toBe(0);

    await page.goto(REGISTRE);
    await page.getByLabel('Recherche', { exact: true }).fill(NOM_IMPORTE);
    await expect(page.getByRole('link', { name: NOM_IMPORTE, exact: true })).toHaveCount(1);

    await page.goto(IMPORT);
    await deposer(page, 'parite-representants-nominal.xlsx', await classeurNominal());
    await attendreRapport(page);

    expect(await cadran(page, 'À créer'), 'le téléphone déjà en base écarte la ligne').toBe(0);
    await expect(
      page.getByRole('row').filter({ hasText: 'Un représentant porte déjà ce numéro en base.' }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Écrire 0 fiche' }),
      'le bouton reste visible mais inerte, plutôt que de laisser croire à un écran cassé',
    ).toBeDisabled();
  });

  test('un fichier qui n’est pas un classeur est refusé avec un motif, sans rien écrire', async ({
    page,
  }) => {
    const avant = await fichesSemees();
    await page.goto(IMPORT);
    await deposer(
      page,
      'parite-representants-faux.xlsx',
      Buffer.from(`${NOM_NON_CLASSEUR};78 105 00 09;Dakar\n`, 'utf8'),
    );

    await expect(page.getByText('Ce fichier n’est pas un classeur Excel (.xlsx).')).toBeVisible();
    await expect(
      page.getByText('Lignes lues', { exact: true }),
      'un fichier illisible ne produit aucun rapport chiffré',
    ).toHaveCount(0);
    expect(await fichesSemees(), 'un fichier refusé n’écrit aucune fiche').toBe(avant);
  });

  test('un classeur sans ligne de données rend un rapport à zéro', async ({ page }) => {
    await page.goto(IMPORT);
    await deposer(page, 'parite-representants-vide.xlsx', await classeur([]));
    await attendreRapport(page);

    expect(await cadran(page, 'Lignes lues'), 'la ligne d’exemple ne compte pas').toBe(0);
    await expect(page.getByRole('button', { name: 'Écrire 0 fiche' })).toBeDisabled();
  });
});

for (const refuse of [
  { role: 'COMMERCIAL', libelle: 'Téléconseiller' },
  { role: 'BANQUE_FINANCE', libelle: 'Banque & Finance' },
] as const) {
  test.describe(`parité CHUES, import interdit à ${refuse.libelle}`, () => {
    test.use({ storageState: compteDe(refuse.role).etat });

    test('l’écran refuse et ne charge aucune donnée de représentant', async ({ page }) => {
      const charges: string[] = [];
      page.on('response', (reponse) => {
        const chemin = new URL(reponse.url()).pathname;
        if (chemin.startsWith('/api/v1/representants') && reponse.status() < 400) {
          charges.push(chemin);
        }
      });

      await page.goto(IMPORT);

      const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
      await expect(refus).toContainText('Cet écran est réservé à un autre rôle.');
      await expect(refus, 'le refus nomme le rôle en cours').toContainText(
        `Rôle en cours : ${refuse.libelle}.`,
      );
      expect(charges, 'un écran refusé ne charge aucune donnée').toEqual([]);
    });
  });
}

test.describe('parité CHUES, le représentant en 390 px', () => {
  test.use({
    storageState: compteDe('ADMIN').etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('la fiche tient dans le téléphone, numéro compris', async ({ page }) => {
    await page.goto(`${REGISTRE}?search=${encodeURIComponent(TEMOIN.nom)}`);
    await page.getByRole('link', { name: TEMOIN.nom, exact: true }).click();

    await expect(page.getByRole('heading', { level: 2, name: TEMOIN.nom })).toBeVisible();
    await expect(page.getByRole('link', { name: '+221 78 105 00 11' })).toBeVisible();
    await expect(page.getByText('Histoire de la relation', { exact: true })).toBeVisible();
    await sansDebordementHorizontal(page);
  });

  test('l’écran d’import tient dans le téléphone', async ({ page }) => {
    await page.goto(IMPORT);

    await expect(page.getByRole('link', { name: 'Télécharger le modèle Excel' })).toBeVisible();
    await expect(page.getByText('Glissez le classeur ici, ou choisissez un fichier')).toBeVisible();
    await sansDebordementHorizontal(page);
  });
});
