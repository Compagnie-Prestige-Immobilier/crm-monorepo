import path from 'node:path';

import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import {
  compter,
  creerRepresentant,
  DOSSIER_FIXTURES,
  ecrire,
  feuillesDuClasseur,
  ligne,
  lire,
  marque,
  numero,
} from './donnees-admin';

const administrateur = compteDe('ADMIN');
const banquier = compteDe('BANQUE_FINANCE');

const cle = marque();
const TITRE_ENVOI = `Annonce E2E14 ${cle}`;
const TITRE_PROGRAMME = `Programmee E2E14 ${cle}`;
const NOM_REPRESENTANT = `Campagne Rep ${cle}`;
const NOM_DEPARTEMENT = `Departement E2E14 ${cle}`;
const NOM_CAMPAGNE = `Campagne E2E14 ${cle}`;

const CLES_MODIFIEES = ['chues.emailChues', 'conversion.champs.CHUES', 'enrolement.CHUES'];

let departementId = '';
let reglagesAvant: { key: string; value: string }[] = [];

// Ces réglages pilotent des écrans partagés : les laisser modifiés changerait
// le formulaire de conversion des autres parcours.
test.beforeAll(async () => {
  reglagesAvant = await lire<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [CLES_MODIFIEES],
  );
});

test.afterAll(async () => {
  await ecrire(`DELETE FROM app_settings WHERE key = ANY($1)`, [CLES_MODIFIEES]);
  for (const reglage of reglagesAvant) {
    await ecrire(`INSERT INTO app_settings (key, value, "updatedAt") VALUES ($1, $2, now())`, [
      reglage.key,
      reglage.value,
    ]);
  }
  await ecrire(`DELETE FROM notifications WHERE title LIKE $1`, [`%E2E14 ${cle}%`]);
  await ecrire(
    `DELETE FROM lot_export_items WHERE "lotId" IN (SELECT id FROM lots_export WHERE name LIKE $1)`,
    [`%${cle}%`],
  );
  await ecrire(`DELETE FROM lots_export WHERE name LIKE $1`, [`%${cle}%`]);
  await ecrire(`DELETE FROM representants WHERE "departementId" = $1`, [departementId]);
  await ecrire(`DELETE FROM departements WHERE id = $1`, [departementId]);
});

test.describe('parcours 14, notifications', () => {
  test.use({ storageState: administrateur.etat });

  test('envoyee sans clef Brevo, recue dans la boite du destinataire', async ({
    page,
    browser,
  }) => {
    await page.goto('/admin/notifications');
    await expect(
      page.getByRole('heading', { name: 'Envoyer une notification', level: 1 }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle notification' }).click();
    const boite = page.getByRole('dialog');
    await boite.getByLabel('Titre').fill(TITRE_ENVOI);
    await boite.getByLabel('Message').fill('Le classeur des dossiers est disponible.');
    await boite.getByRole('combobox', { name: 'Public' }).click();
    await page.getByRole('option', { name: 'Par rôle' }).click();
    await boite.getByRole('combobox', { name: 'Rôle' }).click();
    await page.getByRole('option', { name: 'Banque & Finance' }).click();
    await boite.getByRole('button', { name: 'Continuer' }).click();
    await boite.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText('Notification envoyée.')).toBeVisible();

    // Sans clef Brevo, le serveur reste en mode dégradé : la notification part
    // dans le panneau et le transport le dit.
    const envoi = await ligne<{
      status: string;
      transportStatus: string | null;
      audienceRole: string;
    }>(`SELECT status, "transportStatus", "audienceRole" FROM notifications WHERE title = $1`, [
      TITRE_ENVOI,
    ]);
    expect(envoi.status).toBe('SENT');
    expect(envoi.audienceRole).toBe('BANQUE_FINANCE');
    expect(envoi.transportStatus).toBe('NOT_CONFIGURED');

    const lecture = await browser.newContext({ storageState: banquier.etat });
    const vue = await lecture.newPage();
    await vue.goto('/notifications');
    await expect(vue.getByText(TITRE_ENVOI)).toBeVisible();
    await expect(vue.getByText('Le classeur des dossiers est disponible.')).toBeVisible();
    await lecture.close();
  });

  test('programmee puis annulee, rien ne part', async ({ page }) => {
    await page.goto('/admin/notifications');
    await page.getByRole('button', { name: 'Nouvelle notification' }).click();
    const boite = page.getByRole('dialog');
    await boite.getByLabel('Titre').fill(TITRE_PROGRAMME);
    await boite.getByLabel('Message').fill('Réunion de service.');
    await boite.getByLabel('Programmer l’envoi').check();
    const demain = new Date(Date.now() + 24 * 3_600_000).toISOString().slice(0, 16);
    await boite.getByRole('textbox').last().fill(demain);
    await boite.getByRole('button', { name: 'Continuer' }).click();
    await boite.getByRole('button', { name: 'Programmer' }).click();
    await expect(page.getByText('Notification programmée.')).toBeVisible();

    const programmee = await ligne<{ status: string; sentAt: string | null }>(
      `SELECT status, "sentAt" FROM notifications WHERE title = $1`,
      [TITRE_PROGRAMME],
    );
    expect(programmee.status).toBe('SCHEDULED');
    expect(programmee.sentAt).toBeNull();

    await page.getByRole('tab', { name: 'Envois' }).click();
    const rangee = page.getByRole('row').filter({ hasText: TITRE_PROGRAMME });
    await expect(rangee.getByRole('cell', { name: 'Programmée' })).toBeVisible();
    await rangee.getByRole('button', { name: 'Annuler' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Annuler l’envoi' }).click();
    await expect(page.getByText('Envoi annulé.')).toBeVisible();

    const annulee = await ligne<{ status: string; sentAt: string | null }>(
      `SELECT status, "sentAt" FROM notifications WHERE title = $1`,
      [TITRE_PROGRAMME],
    );
    expect(annulee.status).toBe('CANCELLED');
    expect(annulee.sentAt, 'une notification annulée ne doit jamais partir').toBeNull();
  });
});

test.describe('parcours 14, reglages', () => {
  test.use({ storageState: administrateur.etat });

  test('parametres CHUES modifies et relus', async ({ page }) => {
    const adresse = `contact.${cle}@cpi.sn`;
    await page.goto('/chues/parametres-chues');
    await expect(page.getByRole('heading', { name: 'Paramètres CHUES', level: 1 })).toBeVisible();

    await page.getByLabel('Adresse e-mail CHUES').fill(adresse);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Paramètres enregistrés.')).toBeVisible();

    const stocke = await ligne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'chues.emailChues'`,
    );
    expect(stocke.value).toBe(adresse);

    await page.reload();
    await expect(page.getByLabel('Adresse e-mail CHUES')).toHaveValue(adresse);
  });

  test('champs de conversion reordonnes et champ ajoute', async ({ page }) => {
    await page.goto('/admin/champs-conversion');
    await expect(
      page.getByRole('heading', { name: 'Champs de la conversion', level: 1 }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Ajouter un champ' }).click();
    await page.getByLabel('Libellé').last().fill(`Question ${cle}`);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Formulaire enregistré.')).toBeVisible();

    const reglages = await ligne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'conversion.champs.CHUES'`,
    );
    expect(reglages.value).toContain(`Question ${cle}`);

    await page.reload();
    await expect(page.getByLabel('Libellé').last()).toHaveValue(`Question ${cle}`);
  });

  test('la plateforme d enrolement non configuree ne tire rien', async ({ page }) => {
    await page.goto('/admin/enrolement');
    await expect(
      page.getByRole('heading', { name: 'Plateformes d’enrôlement', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole('alert').filter({ hasText: 'ne sont pas renseignés' }),
    ).toBeVisible();

    // Le réglage est global et survit aux exécutions : une valeur identique n'enregistre rien.
    const frequence = page.getByLabel('Tirer toutes les');
    await expect(frequence).toHaveValue(/^\d+$/u);
    const voulue = (await frequence.inputValue()) === '45' ? 40 : 45;
    await frequence.fill(String(voulue));
    await page.getByLabel('Reprendre depuis').focus();
    await expect(page.getByText('Réglages enregistrés.')).toBeVisible();

    const reglage = await ligne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'enrolement.CHUES'`,
    );
    expect(JSON.parse(reglage.value)).toMatchObject({ frequenceMinutes: voulue });
    expect(
      await compter(`SELECT count(*) AS n FROM inscriptions_plateforme`),
      'aucun tirage sans plateforme configurée',
    ).toBe(0);
  });
});

test.describe('parcours 14, exports', () => {
  test.use({ storageState: administrateur.etat });

  test('lot d export de campagne cree, reparti et telecharge', async ({ page }) => {
    const region = await ligne<{ id: string }>(`SELECT id FROM regions ORDER BY name LIMIT 1`);
    departementId = await creerDepartement(region.id);
    for (const rang of [1, 2, 3]) {
      await creerRepresentant({
        nom: `${NOM_REPRESENTANT} ${String(rang)}`,
        telephone: numero(),
        departementId,
        proprietaireId: administrateur.id,
      });
    }

    await page.goto('/chues/campagnes');
    await page.getByRole('button', { name: 'Nouvelle campagne' }).click();
    const boite = page.getByRole('dialog');
    await boite.getByRole('radio', { name: /^Représentants \(CHUES\)/u }).check();
    await boite.getByRole('combobox', { name: 'Département' }).click();
    await page.getByRole('option', { name: NOM_DEPARTEMENT }).click();
    // Le serveur borne l'équipe à 50 : le harnais, lui, crée un jeu de comptes par
    // travailleur. Une équipe d'un seul téléconseiller suffit à répartir trois fiches.
    await boite.getByRole('button', { name: 'Tout décocher' }).click();
    await boite.getByRole('checkbox', { name: compteDe('COMMERCIAL').nom, exact: true }).check();
    await boite.getByLabel('Nom de la campagne').fill(NOM_CAMPAGNE);
    const creer = boite.getByRole('button', { name: 'Créer la campagne' });
    await expect(creer).toBeEnabled({ timeout: 20_000 });
    await creer.click();
    await expect(page.getByText('Campagne créée : 3 fiches réparties.')).toBeVisible();

    const lot = await ligne<{ id: string; itemCount: number }>(
      `SELECT l.id, (SELECT count(*)::int FROM lot_export_items i WHERE i."lotId" = l.id) AS "itemCount"
       FROM lots_export l WHERE l.name = $1`,
      [NOM_CAMPAGNE],
    );
    expect(lot.itemCount, 'les trois représentants doivent être répartis').toBe(3);
    const orphelines = await compter(
      `SELECT count(*) AS n FROM lot_export_items WHERE "lotId" = $1 AND "assigneeId" IS NULL`,
      [lot.id],
    );
    expect(orphelines, 'aucune fiche ne reste sans téléconseiller').toBe(0);

    const attente = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Classeur Excel de la campagne' }).click();
    const chemin = path.join(DOSSIER_FIXTURES, `campagne-${cle}.xlsx`);
    await (await attente).saveAs(chemin);
    expect((await feuillesDuClasseur(chemin)).length).toBeGreaterThan(0);
  });

  test('le classeur global se telecharge et porte plusieurs feuilles', async ({ page }) => {
    await page.goto('/admin/commerciaux');
    const attente = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export Excel global' }).click();
    const chemin = path.join(DOSSIER_FIXTURES, `global-${cle}.xlsx`);
    await (await attente).saveAs(chemin);
    expect((await feuillesDuClasseur(chemin)).length).toBeGreaterThan(1);
  });

  // La purge et le dump ne sont jamais lancés ici : ils détruisent ou exportent
  // toute la base. Seule la présence de la carte est relue.
  test('l ecran des parametres annonce la suppression comme irreversible', async ({ page }) => {
    await page.goto('/admin/parametres');
    await expect(page.getByText('Suppression des données')).toBeVisible();
    await expect(page.getByText('Irréversible')).toBeVisible();
  });
});

async function creerDepartement(regionId: string): Promise<string> {
  const rows = await lire<{ id: string }>(
    `INSERT INTO departements (id, code, name, "regionId", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, now()) RETURNING id`,
    [`E2E14${cle.slice(0, 4)}`, NOM_DEPARTEMENT, regionId],
  );
  if (rows[0] === undefined) throw new Error('département non créé');
  return rows[0].id;
}
