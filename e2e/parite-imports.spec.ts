import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';

import { compteDe } from './comptes';
import { appliquerImport, deposerClasseur, ecrire, lire, marque, numero } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const cle = marque();
const NOM = `Campagne${cle}`;

const SITE_GRAND_PUBLIC = 'https://monespace.cpi.sn/';
const META_CHUES = 'Meta CPI-CHUES ( Facebook & Instagram )';

let dossier = '';
let classeur = '';
const telephones = [numero(), numero(), numero()];

interface FicheLue {
  projet: string;
  email: string | null;
  canal: string | null;
  parcours: number;
}

/**
 * La forme d'un export de campagne, pas celle du modèle : onglet quelconque,
 * données dès la ligne 2, nom complet en une colonne, provenance en clair.
 */
async function classeurDeCampagne(chemin: string): Promise<void> {
  const classeurExcel = new ExcelJS.Workbook();
  const feuille = classeurExcel.addWorksheet('Leads');
  feuille.addRow(['Date', 'Nom complet', 'Email', 'Téléphone', 'Canal']);
  feuille.addRow([
    '10/09/2026',
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
            (SELECT count(*)::int FROM prospect_journeys j
              WHERE j."prospectId" = p.id AND j.projet = p.projet) AS parcours
       FROM prospects p
       LEFT JOIN canaux_provenance c ON c.id = p."canalProvenanceId"
      WHERE p.nom = $1
      ORDER BY p.prenom`,
    [NOM],
  );
}

const NOM_CLASSEUR = `leads-${cle}.xlsx`;

test.beforeAll(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), 'cpi-imports-'));
  classeur = path.join(dossier, NOM_CLASSEUR);
  await classeurDeCampagne(classeur);
});

test.afterAll(async () => {
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
      parcours: 1,
    });
    expect(fiches[1]).toMatchObject({
      projet: 'CHUES',
      email: `moussa.${cle}@example.sn`,
      canal: 'Meta (Facebook et Instagram)',
      parcours: 1,
    });
  });
});
