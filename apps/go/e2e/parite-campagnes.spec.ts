import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import {
  compter,
  contenuFeuille,
  creerRepresentant,
  DOSSIER_FIXTURES,
  ecrire,
  feuillesDuClasseur,
  ligne,
  lire,
  marque,
} from './donnees-admin';
import { choisirDansListe, effacerFiches, semerProspect } from './donnees-chues';

const administrateur = compteDe('ADMIN');
const teleconseiller = compteDe('COMMERCIAL');
const superviseur = compteDe('SUPERVISEUR');
const direction = compteDe('DIRECTION');
const banquier = compteDe('BANQUE_FINANCE');

const cle = marque();
const CAMPAGNE_REPRESENTANTS = `E2E lot representants ${cle}`;
const CAMPAGNE_PROSPECTS = `E2E lot prospects ${cle}`;
const NOM_PROSPECTS = 'Lot E2E campagnes';
const DEPARTEMENT = 'Kaolack';

/**
 * Trois comptes et deux jours : six cellules. Un seul compte ne prouverait pas
 * que le tourniquet tourne, un seul jour qu'il change de page. La supervision
 * et la direction appellent en plus de leur travail : une fiche par jour.
 */
const EQUIPE = [teleconseiller.nom, direction.nom, superviseur.nom] as const;
const FICHES_PAR_JOUR = 3;
const ENCADREMENT = 1;
const JOURS = 2;
const PLACES = (FICHES_PAR_JOUR + 2 * ENCADREMENT) * JOURS;
/** Deux fiches de plus que de places : le trop-plein doit rester dehors. */
const VIVIER = PLACES + 2;
const PROSPECTS = FICHES_PAR_JOUR + ENCADREMENT;

/** Plage reservee a ce parcours : le rang VIVIER nait apres la campagne. */
const telephoneLot = (rang: number): string => `+221781090${String(rang).padStart(3, '0')}`;
const TELEPHONES = Array.from({ length: VIVIER + 1 }, (_, rang) => telephoneLot(rang));

let departementId = '';
let campagneId = '';
let campagneProspectsId = '';

async function nettoyer(): Promise<void> {
  await ecrire(`DELETE FROM lots_export WHERE name LIKE $1`, ['E2E lot %']);
  await ecrire(
    `DELETE FROM prospect_journeys WHERE "prospectId" IN (SELECT id FROM prospects WHERE nom = $1)`,
    [NOM_PROSPECTS],
  );
  await ecrire(`DELETE FROM prospects WHERE nom = $1`, [NOM_PROSPECTS]);
  await effacerFiches(TELEPHONES);
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  await nettoyer();

  departementId = (
    await ligne<{ id: string }>(`SELECT id FROM departements WHERE name = $1`, [DEPARTEMENT])
  ).id;
  expect(
    await compter(
      `SELECT count(*) AS n FROM representants WHERE "departementId" = $1 AND "deletedAt" IS NULL`,
      [departementId],
    ),
    `le departement ${DEPARTEMENT} doit etre vide : la cible tire alors les seules fiches du parcours`,
  ).toBe(0);

  for (let rang = 0; rang < VIVIER; rang += 1) {
    await creerRepresentant({
      nom: `E2E lot Rep ${String(rang).padStart(2, '0')} ${cle}`,
      telephone: telephoneLot(rang),
      departementId,
      proprietaireId: administrateur.id,
    });
  }
  await avecBase(async (client) => {
    for (let rang = 0; rang < PROSPECTS; rang += 1) {
      await semerProspect(client, NOM_PROSPECTS, `P${String(rang)}`, administrateur.id);
    }
  });
});

test.afterAll(nettoyer);

interface Apercu {
  eligible: number;
  places: number;
  retenues: number;
}

/**
 * L'apercu est lu sur le reseau, et sur la reponse qui porte EXACTEMENT la
 * repartition demandee : le champ est temporise, plusieurs apercus partent, et
 * lire le premier venu ferait passer un compte pour un autre.
 */
function attendreApercu(page: Page, jours: number, comptes: number): Promise<Apercu> {
  return page
    .waitForResponse((reponse) => {
      if (!reponse.url().includes('/api/v1/lots-export/apercu')) return false;
      const corps = reponse.request().postDataJSON() as {
        distribution?: { teleconseillerIds?: string[]; jours?: number; fichesParJour?: number };
      } | null;
      return (
        corps?.distribution?.jours === jours &&
        corps.distribution.fichesParJour === FICHES_PAR_JOUR &&
        corps.distribution.teleconseillerIds?.length === comptes
      );
    })
    .then(async (recue) => {
      expect(recue.status(), await recue.text()).toBe(200);
      return (await recue.json()) as Apercu;
    });
}

async function ouvrirDialogue(page: Page): Promise<Locator> {
  await page.goto('/chues/campagnes');
  await page.getByRole('button', { name: 'Nouvelle campagne' }).click();
  const dialogue = page.getByRole('dialog');
  await expect(dialogue.getByRole('heading', { name: 'Nouvelle campagne' })).toBeVisible();
  return dialogue;
}

/** La bascule dit le geste restant : « Tout cocher » quand plus rien n’est coché. */
async function viderLEquipe(dialogue: Locator): Promise<void> {
  await expect(dialogue.getByRole('button', { name: /^Tout (co|déco)cher$/u })).toBeVisible();
  const decocher = dialogue.getByRole('button', { name: 'Tout décocher' });
  if ((await decocher.count()) > 0) await decocher.click();
  await expect(dialogue.getByText('Cochez au moins un téléconseiller.')).toBeVisible();
}

// Aucun objectif nominatif : le contrat exige un UUID, et les comptes du
// harnais portent des identifiants lisibles (`e2e-commercial`).
async function cocherEquipe(dialogue: Locator, noms: readonly string[]): Promise<void> {
  for (const nom of noms) {
    await dialogue.getByRole('listitem').filter({ hasText: nom }).getByRole('checkbox').check();
  }
  await dialogue.getByLabel('Fiches par jour, à défaut d’objectif').fill(String(FICHES_PAR_JOUR));
}

async function creerDepuisLeDialogue(page: Page, dialogue: Locator, nom: string): Promise<string> {
  const creation = page.waitForResponse(
    (reponse) =>
      reponse.url().endsWith('/api/v1/lots-export') && reponse.request().method() === 'POST',
  );
  await dialogue.getByRole('button', { name: 'Créer la campagne' }).click();
  const recue = await creation;
  expect(recue.status(), await recue.text()).toBe(201);
  const cree = (await recue.json()) as { id: string; itemCount: number };
  await page.waitForURL(`**/chues/campagnes/${cree.id}`);
  await expect(page.getByRole('heading', { name: nom, level: 2 })).toBeVisible();
  return cree.id;
}

/** Ce que la base tient vraiment : un libelle par cellule du tourniquet. */
async function cellulesEnBase(lotId: string): Promise<string[]> {
  const lignes = await lire<{ nom: string; jour: number; fiches: string }>(
    `SELECT u."fullName" AS nom, i.day AS jour, count(*) AS fiches
       FROM lot_export_items i JOIN users u ON u.id = i."assigneeId"
      WHERE i."lotId" = $1 GROUP BY 1, 2 ORDER BY 1, 2`,
    [lotId],
  );
  return lignes.map((row) => `${row.nom} jour ${String(row.jour)} : ${row.fiches}`);
}

async function telecharger(page: Page, label: string): Promise<Buffer> {
  const [fichier] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: label }).click(),
  ]);
  return readFile(await fichier.path());
}

/** Le repertoire central d'une archive : la seule liste qui dise sa verite. */
function entreesZip(archive: Buffer): string[] {
  let fin = archive.length - 22;
  while (fin >= 0 && archive.readUInt32LE(fin) !== 0x06054b50) fin -= 1;
  expect(fin, 'aucun repertoire central : ce n’est pas une archive ZIP').toBeGreaterThanOrEqual(0);

  let position = archive.readUInt32LE(fin + 16);
  const noms: string[] = [];
  for (let index = 0; index < archive.readUInt16LE(fin + 10); index += 1) {
    const nom = archive.readUInt16LE(position + 28);
    noms.push(archive.toString('utf8', position + 46, position + 46 + nom));
    position +=
      46 + nom + archive.readUInt16LE(position + 30) + archive.readUInt16LE(position + 32);
  }
  return noms;
}

// Chaque test reprend la campagne ouverte par le precedent.
test.describe.configure({ mode: 'serial' });

test.describe('parcours 11, campagnes d’appels', () => {
  test.use({ storageState: administrateur.etat });

  test('campagne d’appels representants : le serveur compte, refuse sans equipe, puis fige', async ({
    page,
  }) => {
    const dialogue = await ouvrirDialogue(page);
    await expect(
      page.getByText('Une campagne répartit des fiches entre les téléconseillers'),
    ).toBeVisible();

    await dialogue.getByRole('radio', { name: 'Représentants (CHUES)' }).check();
    await choisirDansListe(dialogue.getByRole('combobox', { name: 'Département' }), DEPARTEMENT);

    await viderLEquipe(dialogue);
    const creer = dialogue.getByRole('button', { name: 'Créer la campagne' });
    await expect(creer, 'une campagne sans destinataire n’a personne a qui donner ses fiches')
      .toBeDisabled();

    await cocherEquipe(dialogue, EQUIPE);
    await dialogue.getByLabel('Nom de la campagne').fill(CAMPAGNE_REPRESENTANTS);
    const attendu = attendreApercu(page, JOURS, EQUIPE.length);
    await dialogue.getByLabel('Nombre de jours').fill(String(JOURS));
    const apercu = await attendu;

    expect(apercu.eligible, 'le vivier seme dans le departement').toBe(VIVIER);
    expect(apercu.places, '(3 + 1 + 1) fiches par jour sur deux jours').toBe(PLACES);
    expect(apercu.retenues, 'la repartition remplit toutes ses places').toBe(PLACES);
    // Le texte affiche est compare a la reponse : un compte estime dans le
    // navigateur divergerait du tirage reel sans que rien ne le dise.
    const annonce = dialogue.getByRole('status');
    await expect(annonce).toContainText(`${String(PLACES)} seront réparties`);
    await expect(annonce).toContainText(
      `${String(VIVIER - PLACES)} attendront une prochaine campagne`,
    );
    await expect(creer, 'le refus est un etat, pas une impasse').toBeEnabled();

    campagneId = await creerDepuisLeDialogue(page, dialogue, CAMPAGNE_REPRESENTANTS);

    expect(await cellulesEnBase(campagneId)).toEqual([
      `${teleconseiller.nom} jour 1 : ${String(FICHES_PAR_JOUR)}`,
      `${teleconseiller.nom} jour 2 : ${String(FICHES_PAR_JOUR)}`,
      `${direction.nom} jour 1 : ${String(ENCADREMENT)}`,
      `${direction.nom} jour 2 : ${String(ENCADREMENT)}`,
      `${superviseur.nom} jour 1 : ${String(ENCADREMENT)}`,
      `${superviseur.nom} jour 2 : ${String(ENCADREMENT)}`,
    ]);
    expect(
      await compter(
        `SELECT count(DISTINCT "representantId") AS n FROM lot_export_items WHERE "lotId" = $1`,
        [campagneId],
      ),
      'autant de fiches distinctes que de places, aucune en double ni perdue',
    ).toBe(PLACES);

    const tableau = page.getByRole('table', { name: 'Programmes d’appel' });
    await expect(tableau.getByRole('rowheader')).toHaveCount(EQUIPE.length);
    await expect(
      page.getByText('dont 20 % pour la supervision et la direction'),
      'la regle de ponderation est dite a l’ecran',
    ).toBeVisible();
    for (const nom of EQUIPE) {
      const attendues = nom === teleconseiller.nom ? FICHES_PAR_JOUR : ENCADREMENT;
      const rangee = tableau.getByRole('row').filter({ hasText: nom });
      for (let jour = 1; jour <= JOURS; jour += 1) {
        await expect(
          tableau.getByRole('columnheader', { name: `Jour ${String(jour)}` }),
        ).toBeVisible();
        await expect(
          rangee.getByRole('cell').filter({
            has: page.getByRole('link', { name: `Programme de ${nom}, jour ${String(jour)}` }),
          }),
          `${nom}, jour ${String(jour)}`,
        ).toContainText(String(attendues));
      }
    }
  });

  test('les programmes s’impriment : un PDF par journee, l’archive, le classeur', async ({
    page,
  }) => {
    await page.goto(`/chues/campagnes/${campagneId}`);

    const [fichier] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: `Programme de ${EQUIPE[0]}, jour 1` }).click(),
    ]);
    expect(fichier.suggestedFilename()).toMatch(/^programme-.*jour-1\.pdf$/u);
    const programme = await readFile(await fichier.path());
    // Un JSON d'erreur relaye sous l'extension `.pdf` passerait le nom.
    expect(programme.subarray(0, 4).toString('latin1'), 'ce n’est pas un PDF').toBe('%PDF');
    expect(programme.byteLength, 'trois lignes numerotees pesent plus de deux kilo-octets')
      .toBeGreaterThan(2_000);

    const archive = await telecharger(page, 'Tous les programmes, archive ZIP');
    expect(
      entreesZip(archive).filter((nom) => nom.endsWith('.pdf')),
      'un programme par teleconseiller et par jour',
    ).toHaveLength(EQUIPE.length * JOURS);

    const [classeur] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Classeur Excel de la campagne' }).click(),
    ]);
    const chemin = path.join(DOSSIER_FIXTURES, `campagne-${cle}.xlsx`);
    await classeur.saveAs(chemin);

    expect(await feuillesDuClasseur(chemin)).toEqual(['Répartition']);
    const lignes = await contenuFeuille(chemin, 'Répartition');
    expect(lignes).toHaveLength(PLACES + 1);
    expect(lignes[0]?.slice(0, 6)).toEqual([
      'Téléconseiller',
      'Jour',
      'Nom complet',
      'Téléphone',
      'Département',
      'IEF',
    ]);
    expect(lignes[1]?.[0], 'le classeur suit l’ordre du tourniquet').toBe(EQUIPE[0]);
    expect(
      lignes.filter((valeurs) => valeurs[0] === EQUIPE[0]),
      'chaque teleconseiller imprime son bloc',
    ).toHaveLength(FICHES_PAR_JOUR * JOURS);
  });

  test.fixme(
    'le classeur nomme « Commercial » la colonne du proprietaire de la fiche',
    async () => {
      // `campagnes_export.go:36` reprend l'entete de la v1
      // (`lots-export.service.ts:515`). Le mot est interdit a l'ecran ; l'entete
      // attendue est « Téléconseiller », deja pris par la colonne d'affectation.
      // Renommage a trancher par le proprietaire, il change un fichier livre.
      expect((await contenuFeuille(path.join(DOSSIER_FIXTURES, `campagne-${cle}.xlsx`), 'Répartition'))[0]).not.toContain(
        'Commercial',
      );
    },
  );

  test('la campagne est figee : un representant cree apres elle n’y entre pas', async ({
    page,
  }) => {
    await creerRepresentant({
      nom: `E2E lot Rep tardif ${cle}`,
      telephone: telephoneLot(VIVIER),
      departementId,
      proprietaireId: administrateur.id,
    });

    expect(
      await compter(
        `SELECT count(*) AS n FROM representants WHERE "departementId" = $1 AND "deletedAt" IS NULL`,
        [departementId],
      ),
      'le vivier n’a pas bouge : le gel ne serait pas eprouve',
    ).toBe(VIVIER + 1);
    expect(
      await compter(`SELECT count(*) AS n FROM lot_export_items WHERE "lotId" = $1`, [campagneId]),
    ).toBe(PLACES);
    expect(
      await compter(
        `SELECT count(*) AS n FROM lot_export_items i JOIN representants r ON r.id = i."representantId"
          WHERE i."lotId" = $1 AND r."phoneE164" = $2`,
        [campagneId, telephoneLot(VIVIER)],
      ),
      'la campagne se recalculerait a chaque lecture',
    ).toBe(0);

    await page.goto(`/chues/campagnes/${campagneId}`);
    await expect(page.getByText(`${String(PLACES)} fiches réparties entre`)).toBeVisible();
  });

  test('reaffectation : les fiches non traitees changent de main, la trace suit', async ({
    page,
  }) => {
    await page.goto(`/chues/campagnes/${campagneId}`);
    await choisirDansListe(
      page.getByRole('combobox', { name: 'Téléconseiller' }),
      teleconseiller.nom,
    );

    const deplacees = FICHES_PAR_JOUR * JOURS;
    const fiches = page.getByRole('table', { name: 'Fiches de la campagne' });
    await expect(fiches.getByRole('row')).toHaveCount(deplacees + 1);
    await fiches.getByRole('checkbox', { name: 'Cocher toutes les fiches non traitées' }).check();
    await choisirDansListe(
      page.getByRole('combobox', { name: 'Attribuer les fiches à' }),
      direction.nom,
    );
    await page.getByRole('button', { name: 'Attribuer', exact: true }).click();

    const confirmation = page.getByRole('dialog');
    await expect(
      confirmation.getByRole('heading', {
        name: `Attribuer ${String(deplacees)} fiches à ${direction.nom} ?`,
      }),
    ).toBeVisible();
    await confirmation.getByRole('button', { name: 'Attribuer', exact: true }).click();

    const recues = page.getByRole('dialog');
    await expect(
      recues.getByRole('heading', {
        name: `${String(deplacees)} fiches attribuées à ${direction.nom}`,
      }),
    ).toBeVisible();
    const complement = await telecharger(page, `Fiches reçues par ${direction.nom}`);
    expect(complement.subarray(0, 4).toString('latin1'), 'le complement n’est pas un PDF').toBe(
      '%PDF',
    );
    await recues.getByRole('button', { name: 'Fermer' }).click();

    expect(await cellulesEnBase(campagneId), 'les fiches sont passees, aucune n’a disparu').toEqual([
      `${direction.nom} jour 1 : ${String(ENCADREMENT + FICHES_PAR_JOUR)}`,
      `${direction.nom} jour 2 : ${String(ENCADREMENT + FICHES_PAR_JOUR)}`,
      `${superviseur.nom} jour 1 : ${String(ENCADREMENT)}`,
      `${superviseur.nom} jour 2 : ${String(ENCADREMENT)}`,
    ]);
    const trace = await ligne<{ fiches: number; deplacees: number; de: string; vers: string }>(
      `SELECT r.fiches, array_length(r.positions, 1) AS deplacees,
              f."fullName" AS de, t."fullName" AS vers
         FROM lot_export_reaffectations r
         JOIN users f ON f.id = r."fromAssigneeId" JOIN users t ON t.id = r."toAssigneeId"
        WHERE r."lotId" = $1`,
      [campagneId],
    );
    expect(trace).toEqual({
      fiches: deplacees,
      deplacees,
      de: teleconseiller.nom,
      vers: direction.nom,
    });

    await expect(
      page.getByText(`${String(deplacees)} fiches de ${teleconseiller.nom} vers ${direction.nom}`),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: `Programme de ${teleconseiller.nom}, jour 1` }),
      'un compte sans fiche n’a plus de programme a imprimer',
    ).toHaveCount(0);
  });

  test('campagne d’appels prospects, puis cloture de la campagne', async ({ page }) => {
    const dialogue = await ouvrirDialogue(page);
    await dialogue.getByRole('radio', { name: 'Tous les prospects CHUES' }).check();
    await dialogue.getByLabel('Nom de la campagne').fill(CAMPAGNE_PROSPECTS);

    await viderLEquipe(dialogue);
    const attendu = attendreApercu(page, 1, 2);
    await cocherEquipe(dialogue, [teleconseiller.nom, superviseur.nom]);
    const apercu = await attendu;
    expect(apercu.eligible, 'les prospects CHUES semes par le parcours').toBe(PROSPECTS);
    expect(apercu.retenues).toBe(PROSPECTS);
    await expect(dialogue.getByRole('status')).toContainText(
      `${String(PROSPECTS)} places pondérées sur 1 jour`,
    );

    campagneProspectsId = await creerDepuisLeDialogue(page, dialogue, CAMPAGNE_PROSPECTS);

    expect(await cellulesEnBase(campagneProspectsId)).toEqual([
      `${teleconseiller.nom} jour 1 : ${String(OBJECTIF)}`,
      `${superviseur.nom} jour 1 : ${String(OBJECTIF)}`,
    ]);
    expect(
      await compter(
        `SELECT count(*) AS n FROM lot_export_items WHERE "lotId" = $1 AND "prospectId" IS NOT NULL`,
        [campagneProspectsId],
      ),
      'une campagne de prospects ne porte pas de representants',
    ).toBe(PROSPECTS);
    await expect(
      page.getByRole('table', { name: 'Fiches de la campagne' }).getByRole('row'),
    ).toHaveCount(PROSPECTS + 1);

    await page.goto('/chues/campagnes');
    await page.getByRole('button', { name: `Supprimer ${CAMPAGNE_PROSPECTS}` }).click();
    const suppression = page.getByRole('dialog');
    await expect(
      suppression.getByRole('heading', { name: `Supprimer « ${CAMPAGNE_PROSPECTS} » ?` }),
    ).toBeVisible();
    await suppression.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(page.getByText('Campagne supprimée.')).toBeVisible();

    expect(
      await compter(`SELECT count(*) AS n FROM lots_export WHERE id = $1`, [campagneProspectsId]),
    ).toBe(0);
    expect(
      await compter(`SELECT count(*) AS n FROM lot_export_items WHERE "lotId" = $1`, [
        campagneProspectsId,
      ]),
      'la repartition part avec la campagne',
    ).toBe(0);
    expect(
      await compter(`SELECT count(*) AS n FROM prospects WHERE nom = $1`, [NOM_PROSPECTS]),
      'les fiches, elles, restent en base',
    ).toBe(PROSPECTS);
  });
});

test.describe('parcours 11, campagnes fermees au teleconseil et a la banque', () => {
  for (const compte of [teleconseiller, banquier]) {
    test(`${compte.role} n’ouvre pas les campagnes et n’en lit aucune`, async ({ browser }) => {
      const contexte = await browser.newContext({ storageState: compte.etat });
      const page = await contexte.newPage();
      const lues: string[] = [];
      page.on('response', (reponse) => {
        const chemin = new URL(reponse.url()).pathname;
        if (chemin.startsWith('/api/v1/lots-export') && reponse.status() < 400) lues.push(chemin);
      });

      await page.goto('/chues/campagnes');

      await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nouvelle campagne' })).toHaveCount(0);
      expect(lues, `${compte.role} ne doit lire aucune campagne`).toEqual([]);
      await contexte.close();
    });
  }
});
