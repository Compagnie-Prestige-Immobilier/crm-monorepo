import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import {
  appelEnregistre,
  choisirDansListe,
  effacerFiches,
  listeDeLaQuestion,
  marque,
  nationalDe,
  numeroUnique,
  ouvrirFicheDepuisAnnuaire,
  repondre,
  sansDebordementHorizontal,
  semerRepresentant,
  type FicheSemee,
} from './donnees-chues';

const compte = compteDe('COMMERCIAL');
const ANNUAIRE = '/chues/appels-representants';

const telephones: string[] = [];

async function semer(role: string): Promise<FicheSemee> {
  let fiche: FicheSemee | null = null;
  await avecBase(async (client) => {
    fiche = await semerRepresentant(client, `Ndiaye ${role} ${marque()}`, compte.id);
  });
  if (fiche === null) throw new Error('representant non seme');
  telephones.push((fiche as FicheSemee).phoneE164);
  return fiche;
}

interface AppelEnBase {
  outcome: string;
  comment: string | null;
  callbackAt: Date | null;
  etablissementConfirme: boolean | null;
  contacte: boolean | null;
  connaitUES: boolean | null;
  syndicat: string | null;
  statutCode: string | null;
  relationStatus: string;
  etablissement: string | null;
  nextCallbackOrigine: string | null;
  ouvertureFermee: boolean;
  suggestionPhone: string | null;
  suggestionNom: string | null;
  suggestionStatut: string | null;
}

async function lireAppel(representantId: string): Promise<AppelEnBase> {
  let lu: AppelEnBase | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<AppelEnBase>(
      `SELECT a.outcome, a.comment, a."callbackAt", a."etablissementConfirme", a.contacte,
              a."connaitUES", a.syndicat, s.code AS "statutCode",
              r."relationStatus"::text AS "relationStatus", r.etablissement,
              r."nextCallbackOrigine"::text AS "nextCallbackOrigine",
              (o."closedAt" IS NOT NULL AND o."closingAttemptId" = a.id) AS "ouvertureFermee",
              g."suggestedPhoneE164" AS "suggestionPhone", g."suggestedName" AS "suggestionNom",
              g.status::text AS "suggestionStatut"
         FROM rep_call_attempts a
         JOIN representants r ON r.id = a."representantId"
         LEFT JOIN statuts_qualification s ON s.id = a."statutQualificationId"
         LEFT JOIN ouvertures_fiche o ON o."closingAttemptId" = a.id
         LEFT JOIN representant_suggestions g ON g."sourceAttemptId" = a.id
        WHERE a."representantId" = $1`,
      [representantId],
    );
    expect(rows, 'une qualification ecrit une tentative et une seule').toHaveLength(1);
    lu = rows[0] ?? null;
  });
  if (lu === null) throw new Error('tentative introuvable');
  return lu;
}

async function ficheTenue(): Promise<string | null> {
  let tenue: string | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<{ representantId: string }>(
      `SELECT "representantId" FROM ouvertures_fiche
        WHERE "openedById" = $1 AND "closedAt" IS NULL`,
      [compte.id],
    );
    tenue = rows[0]?.representantId ?? null;
  });
  return tenue;
}

/** Injoignable, sans rappel a choisir : le statut arme lui-meme son reessai. */
async function qualifierSansReponse(page: Page): Promise<void> {
  await repondre(page, 'Comment s’est passé l’appel ?', 'Injoignable');
  await choisirDansListe(page.getByLabel('Statut de qualification'), 'Pas de réponse');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
}

test.use({ storageState: compte.etat });

test.afterAll(async () => {
  await effacerFiches(telephones);
});

test.describe('parcours 3, qualifier un representant', () => {
  test('le script rempli se relit sur la fiche et en base', async ({ page }) => {
    const fiche = await semer('script');
    const etablissement = `Ecole ${marque()}`;
    const proposeE164 = numeroUnique();
    const proposeNom = `Fall ${marque()}`;
    const motif = `Rappel demandé avant de décider ${marque()}`;

    await page.goto(ANNUAIRE);
    await ouvrirFicheDepuisAnnuaire(page, fiche);

    await repondre(page, 'Comment s’est passé l’appel ?', 'Joignable');
    await repondre(page, 'L’établissement de la fiche est-il confirmé ?', 'Non');
    await page.getByLabel('Nouvel établissement').fill(etablissement);
    await repondre(page, 'A-t-il déjà été contacté ?', 'Oui');
    await repondre(page, 'Connaît-il l’UES ?', 'Non');
    await choisirDansListe(listeDeLaQuestion(page, 'Sur quel syndicat ?'), 'CUSEMS');
    await repondre(page, 'Souhaite-t-il être représentant CHUES ?', 'Non');

    await page.getByLabel('Son numéro').fill(nationalDe(proposeE164));
    await page.getByLabel('Son nom et prénom').fill(proposeNom);
    await page.getByLabel('Sa remarque').fill('Il connaît mieux le dossier.');

    await choisirDansListe(page.getByLabel('Statut de qualification'), 'À rappeler');
    await page.getByRole('group', { name: 'Quand rappeler ?' }).getByRole('button').first().click();
    await page.getByLabel('Commentaire').fill(motif);

    await page.getByRole('button', { name: 'Continuer' }).click();
    const recap = page.getByRole('definition');
    await expect(recap.filter({ hasText: nationalDe(proposeE164) })).toBeVisible();
    await expect(recap.filter({ hasText: 'À rappeler' })).toBeVisible();

    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(appelEnregistre(page, fiche.nom)).toBeVisible();

    const appel = await lireAppel(fiche.id);
    expect(appel.outcome).toBe('CALLBACK');
    expect(appel.statutCode).toBe('A_RAPPELER');
    expect(appel.comment).toBe(motif);
    expect(appel.callbackAt).not.toBeNull();
    expect(appel.etablissementConfirme).toBe(false);
    expect(appel.contacte).toBe(true);
    expect(appel.connaitUES).toBe(false);
    expect(appel.syndicat).not.toBeNull();
    expect(appel.relationStatus).toBe('REFUS');
    expect(appel.etablissement).toBe('ROUGISSEMENT');
    expect(appel.nextCallbackOrigine).toBe('PROMIS');
    expect(appel.ouvertureFermee, 'la tentative referme l’ouverture').toBe(true);
    expect(appel.suggestionPhone).toBe(proposeE164);
    expect(appel.suggestionNom).toBe(proposeNom);
    expect(appel.suggestionStatut).toBe('A_APPELER');
    expect(await ficheTenue(), 'le verrou est rendu apres la qualification').toBeNull();

    await page.goto(`/chues/representants/${fiche.id}`);
    await expect(page.getByRole('term').filter({ hasText: 'Établissement' })).toBeVisible();
    await expect(page.getByText(etablissement)).toBeVisible();
    await page.getByRole('list', { name: 'Histoire' }).getByText(motif).click();
    await expect(page.getByText(proposeNom)).toBeVisible();
    await expect(page.getByText('Personne proposée')).toBeVisible();
  });

  test('une seule fiche a la fois, l’autre onglet est renvoye sur celle qui est tenue', async ({
    page,
    context,
  }) => {
    const premiere = await semer('tenue');
    const seconde = await semer('refusee');

    const second = await context.newPage();
    await second.goto(ANNUAIRE);
    await expect(second.getByLabel('Qui avez-vous appelé ?')).toBeVisible();

    await page.goto(ANNUAIRE);
    await ouvrirFicheDepuisAnnuaire(page, premiere);

    await second.getByLabel('Qui avez-vous appelé ?').fill(seconde.nom);
    await second.getByRole('button', { name: seconde.nom }).click();
    await second.getByRole('button', { name: 'Ouvrir', exact: true }).click();

    await expect(
      second.getByText(`Vous aviez déjà ${premiere.nom} en main : la voici.`),
    ).toBeVisible();
    await expect(second.getByRole('heading', { name: premiere.nom, level: 2 })).toBeVisible();
    expect(await ficheTenue()).toBe(premiere.id);

    await second.close();
    await qualifierSansReponse(page);
    await expect(appelEnregistre(page, premiere.nom)).toBeVisible();
    expect(await ficheTenue(), 'la qualification libere le verrou').toBeNull();
  });
});

test.describe('parcours 3 en 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('la qualification tient dans l’ecran du telephone', async ({ page }) => {
    const fiche = await semer('telephone');

    await page.goto(ANNUAIRE);
    await ouvrirFicheDepuisAnnuaire(page, fiche);
    await sansDebordementHorizontal(page);

    await qualifierSansReponse(page);
    await expect(appelEnregistre(page, fiche.nom)).toBeVisible();
    await sansDebordementHorizontal(page);

    const appel = await lireAppel(fiche.id);
    expect(appel.outcome).toBe('UNREACHABLE');
    expect(appel.statutCode).toBe('PAS_DE_REPONSE');
  });
});
