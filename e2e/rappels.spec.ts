import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import {
  effacerFiches,
  marque,
  sansDebordementHorizontal,
  semerProspect,
  type FicheSemee,
} from './donnees-chues';

const compte = compteDe('COMMERCIAL');
const CONSOLE = '/teleconseil/console';
const RAPPELS = '/teleconseil/rappels';

const telephones: string[] = [];

async function semer(role: string): Promise<FicheSemee> {
  const suffixe = marque();
  let fiche: FicheSemee | null = null;
  await avecBase(async (client) => {
    fiche = await semerProspect(client, `Camara ${suffixe}`, `${role} ${suffixe}`, compte.id);
  });
  if (fiche === null) throw new Error('prospect non seme');
  telephones.push((fiche as FicheSemee).phoneE164);
  return fiche;
}

interface RappelEnBase {
  status: string;
  scheduledAt: Date;
  assignedToId: string;
  effect: string;
  comment: string | null;
}

async function lireRappel(prospectId: string): Promise<RappelEnBase> {
  let lu: RappelEnBase | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<RappelEnBase>(
      `SELECT c.status::text AS status, c."scheduledAt", c."assignedToId", c.comment,
              r.effect::text AS effect
         FROM scheduled_callbacks c
         JOIN call_attempts a ON a.id = c."sourceAttemptId"
         JOIN call_outcome_reasons r ON r.id = a."reasonId"
        WHERE c."prospectId" = $1`,
      [prospectId],
    );
    expect(rows, 'un rappel promis ecrit une echeance et une seule').toHaveLength(1);
    lu = rows[0] ?? null;
  });
  if (lu === null) throw new Error('rappel introuvable');
  return lu;
}

const lisible = (telephoneE164: string): string =>
  telephoneE164.replace(/^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/u, '+221 $1 $2 $3 $4');

/** Le meme rappel, qu'il soit rendu en tableau au bureau ou en carte au pouce. */
function ligneRappel(page: Page, telephoneE164: string) {
  const numero = lisible(telephoneE164);
  return page
    .getByRole('row')
    .filter({ hasText: numero })
    .or(
      page
        .getByRole('list', { name: 'Rappels promis' })
        .getByRole('listitem')
        .filter({ hasText: numero }),
    );
}

const COMMENTAIRE = 'Le prospect demande un rappel dans l’heure.';

async function promettreUnRappel(page: Page, fiche: FicheSemee): Promise<void> {
  await page.goto(CONSOLE);
  await page.getByLabel('Quel prospect avez-vous appelé ?').fill(fiche.nom);
  await page.getByRole('button', { name: fiche.nom }).click();
  await page
    .getByRole('group', { name: 'Avez-vous eu la personne au téléphone ?' })
    .getByRole('button', { name: /Oui, elle a répondu/u })
    .click();
  await page.getByRole('button', { name: /^Continuer/u }).click();
  await page
    .getByRole('group', { name: 'Qu’a dit la personne ?' })
    .getByRole('button', { name: /À rappeler/u })
    .click();
  await page
    .getByRole('group', { name: 'Échéance du rappel' })
    .getByRole('button', { name: /Dans 1 h/u })
    .click();
  // Le creneau se retient et ne part qu'a la validation : le commentaire se
  // saisit APRES le clic sans que l'heure choisie soit perdue.
  await expect(page.getByRole('status').filter({ hasText: /Rappel le/u })).toBeVisible();
  await page.getByLabel('Commentaire, facultatif').fill(COMMENTAIRE);
  await page.getByRole('button', { name: /Enregistrer l’appel/u }).click();
  await expect(
    page.getByRole('status').filter({ hasText: `Appel consigné pour ${fiche.nom}` }),
  ).toBeVisible();
}

/** « Dans 1 h » promis avant minuit tombe demain : l'onglet suit l'échéance, pas l'heure du test. */
function ongletDe(echeance: Date): string {
  const jour = (d: Date) => d.toISOString().slice(0, 10);
  return jour(echeance) === jour(new Date()) ? 'Aujourd’hui' : 'Cette semaine';
}

/** L'écran ouvre sur les représentants : les rappels de prospects sont l'autre onglet. */
async function ouvrirRappelsProspects(page: Page): Promise<void> {
  await page.goto(RAPPELS);
  await page.getByRole('tab', { name: 'Prospects', exact: true }).click();
}

test.use({ storageState: compte.etat });

test.afterAll(async () => {
  await effacerFiches(telephones);
});

test.describe('parcours 6, rappels promis', () => {
  test('l’echeance promise arrive au bon jour, se traite et disparait', async ({ page }) => {
    const fiche = await semer('Rappel');
    const avant = Date.now();

    await promettreUnRappel(page, fiche);

    const promis = await lireRappel(fiche.id);
    expect(promis.status).toBe('PENDING');
    expect(promis.effect).toBe('SCHEDULE_CALLBACK');
    expect(promis.assignedToId).toBe(compte.id);
    expect(promis.comment).toBe(COMMENTAIRE);
    // « Dans 1 h » : le creneau clique est bien celui enregistre, une heure
    // apres l'ouverture du panneau, et il est devant nous.
    const ecart = promis.scheduledAt.getTime() - avant;
    expect(ecart).toBeGreaterThan(59 * 60_000);
    expect(ecart).toBeLessThan(70 * 60_000);
    expect(promis.scheduledAt.getTime()).toBeGreaterThan(Date.now());

    await ouvrirRappelsProspects(page);
    const ligne = ligneRappel(page, fiche.phoneE164);
    await expect(page.getByRole('tab', { name: /En retard/u })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(ligne).toHaveCount(0);

    await page.getByRole('tab', { name: ongletDe(promis.scheduledAt) }).click();
    await expect(ligne).toBeVisible();
    await expect(ligne.getByRole('link', { name: 'Consigner l’appel' })).toBeVisible();

    // L'onglet vit dans l'URL : un rechargement ou un retour de la fiche d'appel y retombe.
    await page.reload();
    await expect(page.getByRole('tab', { name: ongletDe(promis.scheduledAt) })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await ligne.getByRole('button', { name: /Autres actions/u }).click();
    await page.getByRole('menuitem', { name: 'Annuler le rappel' }).click();
    await expect(page.getByText('Rappel annulé.')).toBeVisible();
    await expect(ligne).toHaveCount(0);
    expect((await lireRappel(fiche.id)).status).toBe('CANCELLED');

    await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
    await expect(page.getByText('Rappel rétabli.')).toBeVisible();
    await expect(ligne).toBeVisible();
    const retabli = await lireRappel(fiche.id);
    expect(retabli.status).toBe('PENDING');
    expect(retabli.scheduledAt.getTime()).toBe(promis.scheduledAt.getTime());
  });
});

test.describe('parcours 6, rappel en retard reporté', () => {
  test('« Rappeler dans 1 h » repousse l’échéance d’une heure à partir de maintenant', async ({
    page,
  }) => {
    const fiche = await semer('Report');
    await promettreUnRappel(page, fiche);
    await avecBase(async (client) => {
      await client.query(
        `UPDATE scheduled_callbacks SET "scheduledAt" = now() - interval '30 minutes'
          WHERE "prospectId" = $1`,
        [fiche.id],
      );
    });

    await ouvrirRappelsProspects(page);
    const ligne = ligneRappel(page, fiche.phoneE164);
    await expect(ligne).toBeVisible();
    const avant = Date.now();
    await ligne.getByRole('button', { name: 'Rappeler dans' }).click();
    await page.getByRole('menuitem', { name: '1 h', exact: true }).click();
    await expect(page.getByText('Rappel reporté d’une heure.')).toBeVisible();
    await expect(ligne).toHaveCount(0);

    const reporte = await lireRappel(fiche.id);
    expect(reporte.status).toBe('PENDING');
    const ecart = reporte.scheduledAt.getTime() - avant;
    expect(ecart).toBeGreaterThan(59 * 60_000);
    expect(ecart).toBeLessThan(62 * 60_000);
    // Reporté à aujourd'hui, il repousserait la carte du parcours en 390 px hors de l'écran.
    await effacerFiches([fiche.phoneE164]);
  });
});

test.describe('parcours 6 en 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('le rappel promis se lit en carte sur le telephone', async ({ page }) => {
    const fiche = await semer('Telephone');

    await promettreUnRappel(page, fiche);

    const promis = await lireRappel(fiche.id);
    await ouvrirRappelsProspects(page);
    await page.getByRole('tab', { name: ongletDe(promis.scheduledAt) }).click();
    const carte = ligneRappel(page, fiche.phoneE164);
    await expect(carte).toBeVisible();
    await expect(carte.getByRole('link', { name: lisible(fiche.phoneE164) })).toHaveAttribute(
      'href',
      `tel:${fiche.phoneE164}`,
    );
    await expect(carte.getByRole('link', { name: 'Consigner l’appel' })).toBeInViewport();
    await sansDebordementHorizontal(page);

    expect(promis.status).toBe('PENDING');
  });
});
