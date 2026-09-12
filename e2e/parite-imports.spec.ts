import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';

import { compteDe } from './comptes';
import { appliquerImport, deposerClasseur, ecrire, lire, marque, numero } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const teleconseiller = compteDe('COMMERCIAL');
const cle = marque();
const NOM = `Campagne${cle}`;
const NOM_CLASSEUR = `leads-${cle}.xlsx`;

const SITE_GRAND_PUBLIC = 'https://monespace.cpi.sn/';
const META_CHUES = 'Meta CPI-CHUES ( Facebook & Instagram )';
const JOUR_DU_LEAD = '2026-09-10';

let dossier = '';
let classeur = '';
let lotId: string | null = null;
const telephones = [numero(), numero(), numero()];

interface FicheLue {
  projet: string;
  email: string | null;
  canal: string | null;
  lead: string;
  parcours: number;
}

/**
 * La forme d'un export de campagne, pas celle du modèle : onglet quelconque,
 * données dès la ligne 2, nom complet en une colonne, provenance en clair, et
 * la date du lead tantôt en cellule date, tantôt en texte.
 */
async function classeurDeCampagne(chemin: string): Promise<void> {
  const classeurExcel = new ExcelJS.Workbook();
  const feuille = classeurExcel.addWorksheet('Leads');
  feuille.addRow(['Date', 'Nom complet', 'Email', 'Téléphone', 'Canal']);
  feuille.addRow([
    new Date(`${JOUR_DU_LEAD}T00:00:00.000Z`),
    `Fatou ${NOM}`,
    `fatou.${cle}@example.sn`,
    telephones[0],
    SITE_GRAND_PUBLIC,
  ]);
  feuille.addRow([
    '10/09/2026',
    `Moussa ${NOM}`,
    `moussa.${cle}@example.sn`,
    telephones[1],
    META_CHUES,
  ]);
  feuille.addRow([
    '10/09/2026',
    `Awa ${NOM}`,
    `awa.${cle}@example.sn`,
    telephones[2],
    'Campagne jamais vue',
  ]);
  await classeurExcel.xlsx.writeFile(chemin);
}

function fichesDuClasseur(): Promise<FicheLue[]> {
  return lire<FicheLue>(
    `SELECT p.projet, p.email, c.label AS canal,
            to_char(p."clientCreatedAt", 'YYYY-MM-DD') AS lead,
            (SELECT count(*)::int FROM prospect_journeys j
              WHERE j."prospectId" = p.id AND j.projet = p.projet) AS parcours
       FROM prospects p
       LEFT JOIN canaux_provenance c ON c.id = p."canalProvenanceId"
      WHERE p.nom = $1
      ORDER BY p.prenom`,
    [NOM],
  );
}

test.beforeAll(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), 'cpi-imports-'));
  classeur = path.join(dossier, NOM_CLASSEUR);
  await classeurDeCampagne(classeur);
});

test.afterAll(async () => {
  if (lotId !== null) await ecrire('DELETE FROM lots_export WHERE id = $1', [lotId]);
  await ecrire(
    `DELETE FROM prospect_journeys WHERE "prospectId" IN (SELECT id FROM prospects WHERE nom = $1)`,
    [NOM],
  );
  await ecrire('DELETE FROM prospects WHERE nom = $1', [NOM]);
  // `import_jobs` retient son demandeur : sans ce ménage, la suite ne peut plus
  // supprimer ses comptes à la fin.
  await ecrire('DELETE FROM import_jobs WHERE "fileName" = $1', [NOM_CLASSEUR]);
  await rm(dossier, { recursive: true, force: true });
});

test.describe('parité imports, un export de campagne entre tel quel', () => {
  test.use({ storageState: administrateur.etat });

  test('la provenance décide du canal et du projet, la campagne inconnue est refusée', async ({
    page,
  }) => {
    await page.goto('/admin/imports');
    await deposerClasseur(page, 'Prospects Grand Public', classeur);
    await appliquerImport(page, 'Créer 2 prospects Grand Public', 'Appliqué');

    const fiches = await fichesDuClasseur();
    expect(fiches, 'la campagne inconnue ne doit rien écrire').toHaveLength(2);
    expect(fiches[0]).toMatchObject({
      projet: 'GRAND_PUBLIC',
      email: `fatou.${cle}@example.sn`,
      canal: 'Site web',
      lead: JOUR_DU_LEAD,
      parcours: 1,
    });
    expect(fiches[1]).toMatchObject({
      projet: 'CHUES',
      email: `moussa.${cle}@example.sn`,
      canal: 'Meta (Facebook et Instagram)',
      lead: JOUR_DU_LEAD,
      parcours: 1,
    });
  });

  test('l’import devient une campagne, que le superviseur met en pause', async ({
    page,
    browser,
  }) => {
    await page.goto('/chues/campagnes');
    await page.getByRole('button', { name: 'Nouvelle campagne' }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByRole('radio', { name: /Fiches importées/u }).check();
    await dialogue.getByRole('combobox', { name: 'Import', exact: true }).click();
    await page.getByRole('option', { name: NOM_CLASSEUR }).click();
    await dialogue.getByRole('button', { name: 'Tout décocher' }).click();
    await dialogue.getByRole('checkbox', { name: teleconseiller.nom, exact: true }).check();
    await dialogue.getByRole('button', { name: 'Créer la campagne' }).click();

    await expect(page).toHaveURL(/\/chues\/campagnes\/[0-9a-f-]+$/u);
    lotId = page.url().split('/').at(-1) ?? null;
    await expect(page.getByRole('heading', { level: 2, name: /^Import CHUES du/u })).toBeVisible();
    await expect(page.getByText('CHUES, fiches importées')).toBeVisible();

    const contexte = await browser.newContext({ storageState: teleconseiller.etat });
    const console = await contexte.newPage();
    const chercher = async () => {
      await console.goto('/chues/console');
      await console.getByLabel('Quel prospect avez-vous appelé ?').fill(NOM);
    };
    await chercher();
    await expect(console.getByRole('button', { name: new RegExp(NOM, 'u') })).toBeVisible();

    await page.getByRole('button', { name: 'Mettre en pause' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Mettre en pause' }).click();
    await expect(page.getByText(/En pause depuis le/u)).toBeVisible();
    await chercher();
    await expect(console.getByText('Aucun résultat. Vérifiez le nom ou le numéro.')).toBeVisible();

    await page.getByRole('button', { name: 'Reprendre' }).click();
    await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    await chercher();
    await expect(console.getByRole('button', { name: new RegExp(NOM, 'u') })).toBeVisible();
    await contexte.close();
  });
});
