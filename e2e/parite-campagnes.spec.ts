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
const banquier = compteDe('BANQUE_FINANCE');
const encadrants = [compteDe('DIRECTION'), compteDe('SUPERVISEUR')] as const;

const cle = marque();
const CAMPAGNE_REPRESENTANTS = `E2E lot representants ${cle}`;
const CAMPAGNE_PROSPECTS = `E2E lot prospects ${cle}`;
const NOM_PROSPECTS = 'Lot E2E campagnes';
const DEPARTEMENT = 'Kaolack';

/** L'ordre alphabetique est celui de la liste des appelants, donc du tourniquet. */
const EQUIPE = [teleconseiller.nom, encadrants[0].nom, encadrants[1].nom] as const;
const [COMPTE_TELECONSEIL, COMPTE_DIRECTION, COMPTE_SUPERVISION] = EQUIPE;

/**
 * Trois comptes et deux jours : six cellules. Supervision et direction
 * appellent en plus de leur travail, d'ou leur fiche unique par jour.
 */
const FICHES_PAR_JOUR = 3;
const ENCADREMENT = 1;
const JOURS = 2;
const PLACES = (FICHES_PAR_JOUR + 2 * ENCADREMENT) * JOURS;
/** Deux fiches de plus que de places : le trop-plein doit rester dehors. */
const VIVIER = PLACES + 2;
const PROSPECTS = FICHES_PAR_JOUR + ENCADREMENT;
const parJourDe = (nom: string): string =>
  String(nom === COMPTE_TELECONSEIL ? FICHES_PAR_JOUR : ENCADREMENT);

/** Plage reservee a ce parcours ; le rang VIVIER nait apres la campagne. */
const telephoneLot = (rang: number): string => `+221781090${String(rang).padStart(3, '0')}`;
const TELEPHONES = Array.from({ length: VIVIER + 1 }, (_, rang) => telephoneLot(rang));
const CLASSEUR = path.join(DOSSIER_FIXTURES, `campagne-${cle}.xlsx`);

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

  // Un departement vide : la cible ne tire alors que les fiches du parcours.
  const departement = await ligne<{ id: string; fiches: string }>(
    `SELECT d.id, count(r.id) AS fiches FROM departements d
       LEFT JOIN representants r ON r."departementId" = d.id AND r."deletedAt" IS NULL
      WHERE d.name = $1 GROUP BY d.id`,
    [DEPARTEMENT],
  );
  departementId = departement.id;
  expect(Number(departement.fiches), `${DEPARTEMENT} n’est pas vide`).toBe(0);

  for (const [rang, telephone] of TELEPHONES.slice(0, VIVIER).entries()) {
    await creerRepresentant({
      nom: `E2E lot Rep ${String(rang).padStart(2, '0')} ${cle}`,
      telephone,
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

async function ouvrirDialogue(page: Page): Promise<Locator> {
  await page.goto('/chues/campagnes');
  await page.getByRole('button', { name: 'Nouvelle campagne' }).click();
  return page.getByRole('dialog');
}

/** La bascule dit le geste restant : « Tout cocher » quand plus rien n’est coche. */
async function viderLEquipe(dialogue: Locator): Promise<void> {
  await expect(dialogue.getByRole('button', { name: /^Tout (co|déco)cher$/u })).toBeVisible();
  const decocher = dialogue.getByRole('button', { name: 'Tout décocher' });
  if ((await decocher.count()) > 0) await decocher.click();
  await expect(dialogue.getByText('Cochez au moins un téléconseiller.')).toBeVisible();
}

async function cocherEquipe(dialogue: Locator, noms: readonly string[]): Promise<void> {
  for (const nom of noms) {
    await dialogue.getByRole('checkbox', { name: nom, exact: true }).check();
  }
  await dialogue.getByLabel('Fiches par jour, à défaut d’objectif').fill(String(FICHES_PAR_JOUR));
}

/** La creation ouvre la campagne : son identifiant est celui de l'adresse. */
async function creerDepuisLeDialogue(page: Page, dialogue: Locator, nom: string): Promise<string> {
  await dialogue.getByRole('button', { name: 'Créer la campagne' }).click();
  await page.waitForURL(/\/chues\/campagnes\/[\da-f-]{36}$/u);
  await expect(page.getByRole('heading', { name: nom, level: 2 })).toBeVisible();
  return page.url().split('/').slice(-1)[0] ?? '';
}

/** Ce que la base tient vraiment, une ligne par cellule du tourniquet. */
async function cellulesEnBase(lotId: string, parJour = true): Promise<string[]> {
  const lignes = await lire<{ nom: string; jour: number; fiches: string }>(
    `SELECT u."fullName" AS nom, ${parJour ? 'i.day' : '0'} AS jour, count(*) AS fiches
       FROM lot_export_items i JOIN users u ON u.id = i."assigneeId"
      WHERE i."lotId" = $1 GROUP BY 1, 2 ORDER BY 1, 2`,
    [lotId],
  );
  return lignes.map(
    (row) => `${row.nom}${parJour ? ` jour ${String(row.jour)}` : ''} : ${row.fiches}`,
  );
}

async function telecharger(page: Page, label: string): Promise<Buffer> {
  const [fichier] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: label }).click(),
  ]);
  return readFile(await fichier.path());
}

/**
 * Les noms d'une archive ZIP restent en clair, deux fois chacun : en-tete local
 * et repertoire central. Le contenu, lui, y est comprime.
 */
function programmesDuZip(archive: Buffer): number {
  return (archive.toString('latin1').match(/programme-[\w-]+-jour-\d\.pdf/gu) ?? []).length / 2;
}

// Chaque test reprend la campagne ouverte par le precedent.
test.describe.configure({ mode: 'serial' });

test.describe('parcours 11, campagnes d’appels', () => {
  test.use({ storageState: administrateur.etat });

  test('campagne d’appels representants : le serveur compte, refuse sans equipe, puis repartit', async ({
    page,
  }) => {
    const dialogue = await ouvrirDialogue(page);
    await dialogue.getByRole('radio', { name: 'Représentants (CHUES)' }).check();
    await choisirDansListe(dialogue.getByRole('combobox', { name: 'Département' }), DEPARTEMENT);

    await viderLEquipe(dialogue);
    const creer = dialogue.getByRole('button', { name: 'Créer la campagne' });
    await expect(creer, 'une campagne sans destinataire n’a personne a qui donner').toBeDisabled();

    await cocherEquipe(dialogue, EQUIPE);
    await dialogue.getByLabel('Nom de la campagne').fill(CAMPAGNE_REPRESENTANTS);
    // Le cinquieme du teleconseil, propose a la direction avant tout comptage.
    const objectif = dialogue.getByLabel(`Objectif quotidien de ${COMPTE_DIRECTION}`, {
      exact: true,
    });
    await expect(objectif).toHaveAttribute('placeholder', String(ENCADREMENT));
    await dialogue.getByLabel('Nombre de jours').fill(String(JOURS));

    // L'annonce ne porte que des comptes du serveur : vivier, places pondérées
    // (3 + 1 + 1 par jour, sur deux jours), retenues et laissees de cote.
    await expect(dialogue.getByRole('status')).toHaveText(
      `${String(VIVIER)} fiches disponibles pour ${String(PLACES)} places : ` +
        `${String(PLACES)} seront réparties selon les capacités choisies ; ` +
        `${String(VIVIER - PLACES)} attendront une prochaine campagne.`,
    );
    await expect(creer, 'le refus est un etat, pas une impasse').toBeEnabled();

    campagneId = await creerDepuisLeDialogue(page, dialogue, CAMPAGNE_REPRESENTANTS);

    expect(await cellulesEnBase(campagneId)).toEqual(
      EQUIPE.flatMap((nom) =>
        [1, JOURS].map((jour) => `${nom} jour ${String(jour)} : ${parJourDe(nom)}`),
      ),
    );
    expect(
      await compter(
        `SELECT count(DISTINCT "representantId") AS n FROM lot_export_items WHERE "lotId" = $1`,
        [campagneId],
      ),
      'autant de fiches distinctes que de places : aucune en double ni perdue',
    ).toBe(PLACES);

    const tableau = page.getByRole('table', { name: 'Programmes d’appel' });
    await expect(tableau.getByRole('columnheader')).toHaveText([
      'Téléconseiller',
      'Jour 1',
      'Jour 2',
      'Reçues',
    ]);
    await expect(page.getByText('dont 20 % pour la supervision et la direction')).toBeVisible();
    for (const nom of EQUIPE) {
      await expect(
        tableau.getByRole('row').filter({ hasText: nom }).getByRole('cell'),
        `${nom} : deux journees, et rien de recu apres impression`,
      ).toHaveText([...Array.from({ length: JOURS }, () => parJourDe(nom)), '0']);
    }

    // Le lot est fige : un representant cree apres lui n'y entre pas.
    await creerRepresentant({
      nom: `E2E lot Rep tardif ${cle}`,
      telephone: telephoneLot(VIVIER),
      departementId,
      proprietaireId: administrateur.id,
    });
    await page.reload();
    await expect(page.getByText(`${String(PLACES)} fiches réparties entre`)).toBeVisible();
    expect(
      await compter(
        `SELECT count(*) AS n FROM lot_export_items i JOIN representants r ON r.id = i."representantId"
          WHERE i."lotId" = $1 AND r."phoneE164" = $2`,
        [campagneId, telephoneLot(VIVIER)],
      ),
      'la campagne se recalculerait a chaque lecture',
    ).toBe(0);
  });

  test('les programmes s’impriment : un PDF par journee, l’archive, le classeur', async ({
    page,
  }) => {
    await page.goto(`/chues/campagnes/${campagneId}`);

    const [fichier] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: `Programme de ${COMPTE_TELECONSEIL}, jour 1` }).click(),
    ]);
    expect(fichier.suggestedFilename()).toMatch(/^programme-.*-jour-1\.pdf$/u);
    const programme = await readFile(await fichier.path());
    // Un JSON d'erreur relaye sous l'extension `.pdf` passerait le nom.
    expect(programme.subarray(0, 4).toString('latin1'), 'ce n’est pas un PDF').toBe('%PDF');
    expect(programme.byteLength, 'trois lignes pesent plus de deux kilo-octets').toBeGreaterThan(
      2_000,
    );

    const archive = await telecharger(page, 'Tous les programmes (ZIP)');
    expect(programmesDuZip(archive), 'un programme par teleconseiller et par jour').toBe(
      EQUIPE.length * JOURS,
    );

    const [classeur] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Classeur Excel' }).click(),
    ]);
    await classeur.saveAs(CLASSEUR);

    expect(await feuillesDuClasseur(CLASSEUR)).toEqual(['Répartition']);
    const lignes = await contenuFeuille(CLASSEUR, 'Répartition');
    expect(lignes).toHaveLength(PLACES + 1);
    // Deux colonnes « Téléconseiller » : celui qui appelle, puis celui qui a
    // saisi la fiche. Le mot « commercial » ne s’affiche nulle part.
    expect(lignes[0]?.join(' ')).toBe(
      'Téléconseiller Jour Nom complet Téléphone Département IEF Téléconseiller Notes Saisi le',
    );
    expect(
      lignes.filter((valeurs) => valeurs[0] === COMPTE_TELECONSEIL),
      'chaque teleconseiller imprime son bloc, dans l’ordre du tourniquet',
    ).toHaveLength(FICHES_PAR_JOUR * JOURS);
    expect(lignes[1]?.[0]).toBe(COMPTE_TELECONSEIL);
  });

  test('reaffectation : les fiches non traitees changent de main, la trace suit', async ({
    page,
  }) => {
    const deplacees = 2;
    const aDeplacer = await lire<{ nom: string }>(
      `SELECT r."fullName" AS nom FROM lot_export_items i
         JOIN representants r ON r.id = i."representantId"
         JOIN users u ON u.id = i."assigneeId"
        WHERE i."lotId" = $1 AND u."fullName" = $2 ORDER BY i.position LIMIT ${String(deplacees)}`,
      [campagneId, COMPTE_TELECONSEIL],
    );
    expect(aDeplacer).toHaveLength(deplacees);

    await page.goto(`/chues/campagnes/${campagneId}`);
    const fiches = page.getByRole('table', { name: 'Fiches de la campagne' });
    await expect(fiches.getByRole('row')).toHaveCount(PLACES + 1);
    for (const fiche of aDeplacer) {
      await fiches.getByRole('checkbox', { name: `Attribuer la fiche de ${fiche.nom}` }).check();
    }
    await choisirDansListe(
      page.getByRole('combobox', { name: 'Attribuer les fiches à' }),
      COMPTE_DIRECTION,
    );
    await page.getByRole('button', { name: 'Attribuer', exact: true }).click();

    const confirmation = page.getByRole('dialog');
    await expect(confirmation).toContainText(
      `Attribuer ${String(deplacees)} fiches à ${COMPTE_DIRECTION} ?`,
    );
    await confirmation.getByRole('button', { name: 'Attribuer', exact: true }).click();

    // Le papier deja imprime ne porte pas ces fiches : un PDF de complement suit.
    const recues = page.getByRole('dialog');
    await expect(recues).toContainText(`${String(deplacees)} fiches attribuées`);
    const complement = await telecharger(page, 'Télécharger ses fiches reçues (PDF)');
    expect(complement.subarray(0, 4).toString('latin1'), 'ce n’est pas un PDF').toBe('%PDF');
    // Le pied du dialogue et sa croix portent le meme libelle.
    await recues.getByRole('button', { name: 'Fermer' }).first().click();

    expect(
      await cellulesEnBase(campagneId, false),
      'les fiches sont passees, aucune n’a disparu',
    ).toEqual([
      `${COMPTE_TELECONSEIL} : ${String(FICHES_PAR_JOUR * JOURS - deplacees)}`,
      `${COMPTE_DIRECTION} : ${String(ENCADREMENT * JOURS + deplacees)}`,
      `${COMPTE_SUPERVISION} : ${String(ENCADREMENT * JOURS)}`,
    ]);
    expect(
      await ligne<{ fiches: number; positions: number; vers: string }>(
        `SELECT r.fiches, array_length(r.positions, 1) AS positions, t."fullName" AS vers
           FROM lot_export_reaffectations r JOIN users t ON t.id = r."toAssigneeId"
          WHERE r."lotId" = $1`,
        [campagneId],
      ),
    ).toEqual({ fiches: deplacees, positions: deplacees, vers: COMPTE_DIRECTION });

    const programmes = page.getByRole('table', { name: 'Programmes d’appel' });
    await expect(
      programmes.getByRole('row').filter({ hasText: COMPTE_DIRECTION }),
      'les fiches arrivees apres impression sont annoncees a part',
    ).toContainText(`+${String(deplacees)}`);
    await expect(
      page.getByText(`${String(deplacees)} fiches de ${COMPTE_TELECONSEIL} vers`),
    ).toBeVisible();
  });

  test('campagne d’appels prospects, puis cloture de la campagne', async ({ page }) => {
    const dialogue = await ouvrirDialogue(page);
    await dialogue.getByRole('radio', { name: 'Tous les prospects CHUES' }).check();
    await dialogue.getByLabel('Nom de la campagne').fill(CAMPAGNE_PROSPECTS);

    await viderLEquipe(dialogue);
    await cocherEquipe(dialogue, [COMPTE_TELECONSEIL, COMPTE_SUPERVISION]);
    // Le vivier du parcours tient dans les places ; d'autres parcours sèment aussi des
    // prospects CHUES en même temps, et alors le trop-plein attend : les places se remplissent.
    await expect(dialogue.getByRole('status')).toContainText(
      new RegExp(
        `(${String(PROSPECTS)} places pondérées sur 1 jour : les ${String(PROSPECTS)} seront réparties|pour ${String(PROSPECTS)} places : ${String(PROSPECTS)} seront réparties)`,
        'u',
      ),
    );

    campagneProspectsId = await creerDepuisLeDialogue(page, dialogue, CAMPAGNE_PROSPECTS);

    expect(await cellulesEnBase(campagneProspectsId)).toEqual([
      `${COMPTE_TELECONSEIL} jour 1 : ${String(FICHES_PAR_JOUR)}`,
      `${COMPTE_SUPERVISION} jour 1 : ${String(ENCADREMENT)}`,
    ]);
    expect(
      await compter(
        `SELECT count(*) AS n FROM lot_export_items WHERE "lotId" = $1 AND "prospectId" IS NULL`,
        [campagneProspectsId],
      ),
      'une campagne de prospects ne porte que des prospects',
    ).toBe(0);

    await page.goto('/chues/campagnes');
    await page.getByRole('button', { name: `Supprimer ${CAMPAGNE_PROSPECTS}` }).click();
    const suppression = page.getByRole('dialog');
    await expect(suppression).toContainText(`Supprimer « ${CAMPAGNE_PROSPECTS} » ?`);
    const effacement = page.waitForResponse(
      (reponse) =>
        reponse.url().endsWith(campagneProspectsId) && reponse.request().method() === 'DELETE',
    );
    await suppression.getByRole('button', { name: 'Supprimer', exact: true }).click();
    expect((await effacement).status()).toBe(204);
    await expect(page.getByText('Campagne supprimée.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: CAMPAGNE_PROSPECTS }),
      'la carte quitte la liste sans rechargement',
    ).toHaveCount(0);

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
      // Une campagne lue en chemin serait une fuite, meme suivie d'un refus.
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
