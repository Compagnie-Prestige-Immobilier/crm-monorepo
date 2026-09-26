import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { apiDe, creerProspect, purger } from './donnees-listes';
import {
  appelEnregistre,
  effacerFiches,
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
const ANNUAIRE = '/teleconseil/appels-representants';
const SUGGESTIONS = '/teleconseil/suggestions';

const telephones: string[] = [];

interface Proposition {
  readonly nom: string;
  readonly phoneE164: string;
  readonly remarque: string;
}

async function semer(role: string): Promise<FicheSemee> {
  let fiche: FicheSemee | null = null;
  await avecBase(async (client) => {
    fiche = await semerRepresentant(client, `Gueye ${role} ${marque()}`, compte.id);
  });
  if (fiche === null) throw new Error('representant non seme');
  telephones.push((fiche as FicheSemee).phoneE164);
  return fiche;
}

function proposition(): Proposition {
  const suffixe = marque();
  return {
    nom: `Thiam ${suffixe}`,
    phoneE164: numeroUnique(),
    remarque: `Collègue plus disponible ${suffixe}`,
  };
}

async function lireStatutSuggestion(phoneE164: string): Promise<string> {
  let statut = '';
  await avecBase(async (client) => {
    const { rows } = await client.query<{ status: string; suggestedName: string | null }>(
      `SELECT status::text AS status, "suggestedName"
         FROM representant_suggestions WHERE "suggestedPhoneE164" = $1`,
      [phoneE164],
    );
    expect(rows, 'une proposition ecrit un numero et un seul').toHaveLength(1);
    statut = rows[0]?.status ?? '';
  });
  return statut;
}

/** Le representant decline et donne le numero d'un collegue a sa place. */
async function declinerEnProposant(
  page: Page,
  fiche: FicheSemee,
  propose: Proposition,
): Promise<void> {
  await page.goto(ANNUAIRE);
  await ouvrirFicheDepuisAnnuaire(page, fiche);

  await repondre(page, 'Avez-vous eu la personne au téléphone ?', 'Oui, elle a répondu');
  await repondre(page, 'L’école de la fiche est-elle la bonne ?', 'Oui');
  await repondre(page, 'A-t-il déjà été contacté par CPI ?', 'Non');
  await repondre(page, 'Connaît-il l’UES ?', 'Non');
  await page.getByRole('button', { name: 'Sans syndicat' }).click();
  await repondre(page, 'Accepte-t-il d’être représentant CHUES ?', 'Non');

  // Le refus pose le statut : on le garde et on passe a la personne recommandee.
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Son numéro').fill(nationalDe(propose.phoneE164));
  await page.getByLabel('Son nom et prénom').fill(propose.nom);
  await page.getByLabel('Sa remarque').fill(propose.remarque);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.getByRole('button', { name: 'Enregistrer l’appel' }).click();
  await expect(appelEnregistre(page, fiche.nom)).toBeVisible();
}

const carte = (page: Page, propose: Proposition) =>
  page.getByRole('listitem').filter({ hasText: propose.nom });

test.use({ storageState: compte.etat });

test.afterAll(async () => {
  await effacerFiches(telephones);
});

test.describe('parcours 8, contacts recommandes', () => {
  test('le numero propose pendant un appel se retrouve, s’accepte et reste accepte', async ({
    page,
  }) => {
    const fiche = await semer('Accepte');
    const propose = proposition();

    await declinerEnProposant(page, fiche, propose);
    expect(await lireStatutSuggestion(propose.phoneE164)).toBe('A_APPELER');

    await page.goto(SUGGESTIONS);
    const ligne = carte(page, propose);
    await expect(ligne).toBeVisible();
    await expect(ligne).toContainText(propose.remarque);
    await expect(ligne).toContainText('À appeler');
    await expect(ligne).toContainText(nationalDe(propose.phoneE164).slice(0, 2));

    await ligne.getByRole('button', { name: 'Marquer appelé' }).click();
    await expect(page.getByText('Numéro marqué « Appelé ».')).toBeVisible();
    await expect(ligne).toContainText('Appelé');
    await expect(ligne.getByRole('button', { name: 'Marquer appelé' })).toHaveCount(0);

    expect(await lireStatutSuggestion(propose.phoneE164)).toBe('APPELE');

    await page.reload();
    await expect(carte(page, propose)).toContainText('Appelé');
  });

  test('le numero refuse est abandonne et sort de la file', async ({ page }) => {
    const fiche = await semer('Abandonne');
    const propose = proposition();

    await declinerEnProposant(page, fiche, propose);

    await page.goto(SUGGESTIONS);
    const ligne = carte(page, propose);
    await ligne.getByRole('button', { name: 'Abandonner' }).click();
    await expect(page.getByText('Numéro marqué « Abandonné ».')).toBeVisible();

    expect(await lireStatutSuggestion(propose.phoneE164)).toBe('ABANDONNE');

    await page.getByRole('button', { name: 'À appeler', exact: true }).click();
    await expect(carte(page, propose)).toHaveCount(0);
  });
});

test.describe('parcours 8 en 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('la proposition se recueille et se tranche sur le telephone', async ({ page }) => {
    const fiche = await semer('Telephone');
    const propose = proposition();

    await declinerEnProposant(page, fiche, propose);

    await page.goto(SUGGESTIONS);
    const ligne = carte(page, propose);
    await expect(ligne).toBeVisible();
    await sansDebordementHorizontal(page);

    await ligne.getByRole('button', { name: 'Marquer appelé' }).click();
    await expect(page.getByText('Numéro marqué « Appelé ».')).toBeVisible();
    await sansDebordementHorizontal(page);

    expect(await lireStatutSuggestion(propose.phoneE164)).toBe('APPELE');
  });
});

test.describe('parcours 8, parrains Grand Public', () => {
  test.use({ storageState: compteDe('SUPERVISEUR').etat });

  const nom = `Parrain ${marque()}`;
  const fiches: string[] = [];

  test.beforeAll(async () => {
    const api = await apiDe('COMMERCIAL', '198.51.100.96');
    const telephoneFilleul = numeroUnique();
    for (const [nomFiche, phone] of [
      [nom, numeroUnique()],
      [`Filleul ${marque()}`, telephoneFilleul],
    ] as const) {
      fiches.push(
        await creerProspect(api, { nom: nomFiche, prenom: 'Awa', phone, projet: 'GRAND_PUBLIC' }),
      );
    }
    const appel = await api.post('/api/v1/phase2/call-attempts', {
      data: {
        id: randomUUID(),
        prospectId: fiches[0],
        reasonCode: 'INTERESSE',
        clientCreatedAt: new Date().toISOString(),
        contactsRecommandes: [{ phone: telephoneFilleul }, { phone: numeroUnique() }],
      },
    });
    expect(appel.status(), await appel.text()).toBe(200);
    await api.dispose();
  });

  test.afterAll(async () => {
    await purger({ prospects: fiches });
  });

  test('l’encadrement classe les parrains et retrouve le suivi sur la fiche', async ({ page }) => {
    await page.goto(SUGGESTIONS);
    const classement = page.getByRole('row').filter({ hasText: nom });
    await expect(classement.getByRole('cell')).toHaveText([/Parrain/u, '2', '1', '0', '0']);

    await classement.getByRole('link', { name: new RegExp(nom, 'u') }).click();
    await expect(page).toHaveURL(new RegExp(`/teleconseil/prospects/${fiches[0] ?? ''}$`, 'u'));
    await expect(
      page.getByText('2 numéros recommandés, 1 fiche créée, 0 converti, 0 vendu'),
    ).toBeVisible();
  });
});
