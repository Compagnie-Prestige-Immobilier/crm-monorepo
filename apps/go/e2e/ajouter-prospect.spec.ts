import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import {
  effacerFiches,
  marque,
  nationalDe,
  numeroUnique,
  sansDebordementHorizontal,
  semerRepresentant,
  type FicheSemee,
} from './donnees-chues';

const compte = compteDe('COMMERCIAL');
const FORMULAIRE = '/chues/prospects/nouveau';

const telephones: string[] = [];

interface ProspectEnBase {
  nom: string;
  prenom: string;
  phoneE164: string;
  etablissement: string | null;
  banqueName: string | null;
  syndicatName: string | null;
  representantName: string | null;
  createdById: string;
  projetSuivi: string | null;
}

async function lireProspect(phoneE164: string): Promise<ProspectEnBase> {
  let lu: ProspectEnBase | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<ProspectEnBase>(
      `SELECT p.nom, p.prenom, p."phoneE164", p.etablissement, p."createdById",
              b.name AS "banqueName", s.name AS "syndicatName", r."fullName" AS "representantName",
              j.projet::text AS "projetSuivi"
         FROM prospects p
         LEFT JOIN banques b ON b.id = p."banqueId"
         LEFT JOIN syndicats s ON s.id = p."syndicatId"
         LEFT JOIN representants r ON r.id = p."representantId"
         LEFT JOIN prospect_journeys j ON j."prospectId" = p.id
        WHERE p."phoneE164" = $1`,
      [phoneE164],
    );
    expect(rows, 'un enregistrement ecrit une fiche et une seule').toHaveLength(1);
    lu = rows[0] ?? null;
  });
  if (lu === null) throw new Error('prospect introuvable');
  return lu;
}

/**
 * Une liste cherchee par le serveur : ouvrir, taper, choisir. L'option se vise
 * par son debut, sinon « Créer « ... » » repond au meme terme.
 */
async function choisirDansCombobox(
  page: Page,
  champ: string,
  terme: string,
  debutOption: string,
): Promise<void> {
  const recherche = page.getByPlaceholder('Chercher…');
  await page.getByRole('button', { name: champ }).click();
  await recherche.fill(terme);
  await page.getByRole('option', { name: new RegExp(`^${debutOption}`, 'u') }).click();
  // Le panneau s'efface en fondu : ouvrir le suivant avant sa fin en laisserait deux.
  await expect(recherche).toHaveCount(0);
}

const champ = (page: Page, libelle: RegExp) => page.getByRole('textbox', { name: libelle });

async function saisirIdentite(
  page: Page,
  identite: { prenom: string; nom: string; phoneE164: string },
): Promise<void> {
  await champ(page, /^Prénom/u).fill(identite.prenom);
  await champ(page, /^Nom/u).fill(identite.nom);
  await champ(page, /^Téléphone/u).fill(nationalDe(identite.phoneE164));
}

test.use({ storageState: compte.etat });

test.afterAll(async () => {
  await effacerFiches(telephones);
});

test.describe('parcours 4, ajouter un prospect', () => {
  test('la fiche complete se relit dans la liste, sur la fiche et en base', async ({ page }) => {
    let representant: FicheSemee | null = null;
    await avecBase(async (client) => {
      representant = await semerRepresentant(client, `Sow Apporteur ${marque()}`, compte.id);
    });
    if (representant === null) throw new Error('representant non seme');
    const apporteur: FicheSemee = representant;
    telephones.push(apporteur.phoneE164);

    const suffixe = marque();
    const identite = { prenom: `Awa ${suffixe}`, nom: `Diop ${suffixe}`, phoneE164: numeroUnique() };
    const etablissement = `Lycée ${suffixe}`;
    telephones.push(identite.phoneE164);

    await page.goto(FORMULAIRE);
    await choisirDansCombobox(page, 'Représentant', apporteur.nom, apporteur.nom);
    await saisirIdentite(page, identite);
    await champ(page, /^Établissement/u).fill(etablissement);
    await choisirDansCombobox(page, 'Banque', 'CBAO', 'CBAO, Groupe');
    await choisirDansCombobox(page, 'Syndicat', 'CUSEMS', 'Cadre Unitaire');
    await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

    await expect(
      page.getByText(`${identite.prenom} ${identite.nom} enregistré.`),
    ).toBeVisible();

    const enregistre = await lireProspect(identite.phoneE164);
    expect(enregistre.prenom).toBe(identite.prenom);
    expect(enregistre.nom).toBe(identite.nom);
    expect(enregistre.etablissement).toBe(etablissement);
    expect(enregistre.representantName).toBe(apporteur.nom);
    expect(enregistre.createdById).toBe(compte.id);
    expect(enregistre.projetSuivi).toBe('CHUES');
    expect(enregistre.banqueName).toContain('CBAO');
    expect(enregistre.syndicatName).toContain('Cadre Unitaire');

    await page.goto('/chues/prospects');
    await page.getByLabel('Recherche').fill(identite.nom);
    const ligne = page.getByRole('link', { name: `${identite.prenom} ${identite.nom}` });
    await expect(ligne).toBeVisible();

    await ligne.click();
    await expect(
      page.getByRole('heading', { name: `${identite.prenom} ${identite.nom}` }),
    ).toBeVisible();
    await expect(page.getByText(etablissement)).toBeVisible();
    await expect(page.getByText(apporteur.nom).first()).toBeVisible();
  });

  test('le numero est ramene en +221 et le doublon nomme la fiche qui le porte', async ({
    page,
  }) => {
    const suffixe = marque();
    const phoneE164 = numeroUnique();
    const identite = { prenom: `Fatou ${suffixe}`, nom: `Ba ${suffixe}`, phoneE164 };
    telephones.push(phoneE164);

    await page.goto(FORMULAIRE);
    await champ(page, /^Prénom/u).fill(identite.prenom);
    await champ(page, /^Nom/u).fill(identite.nom);
    // Espaces, comme on dicte un numero : ils tombent et l'indicatif +221 reste.
    await champ(page, /^Téléphone/u).fill(
      nationalDe(phoneE164).replace(/(\d{2})(\d{3})(\d{2})(\d{2})/u, '$1 $2 $3 $4'),
    );
    await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();
    await expect(
      page.getByText(`${identite.prenom} ${identite.nom} enregistré.`),
    ).toBeVisible();

    const enregistre = await lireProspect(phoneE164);
    expect(enregistre.phoneE164, 'le numero national est ramene en E.164').toBe(phoneE164);

    const doublon = { prenom: `Moussa ${suffixe}`, nom: `Sarr ${suffixe}`, phoneE164 };
    await saisirIdentite(page, doublon);
    await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

    const refus = page.getByRole('alert');
    await expect(refus).toContainText(
      `Ce numéro est déjà celui de ${identite.prenom} ${identite.nom}.`,
    );
    await expect(refus).toContainText(`Suivi par ${compte.nom}.`);
    await lireProspect(phoneE164);
  });
});

test.describe('parcours 4 en 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('le formulaire tient dans l’ecran du telephone', async ({ page }) => {
    const suffixe = marque();
    const identite = {
      prenom: `Khady ${suffixe}`,
      nom: `Ndour ${suffixe}`,
      phoneE164: numeroUnique(),
    };
    telephones.push(identite.phoneE164);

    await page.goto(FORMULAIRE);
    await sansDebordementHorizontal(page);

    await saisirIdentite(page, identite);
    await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();
    await expect(
      page.getByText(`${identite.prenom} ${identite.nom} enregistré.`),
    ).toBeVisible();
    await sansDebordementHorizontal(page);

    const enregistre = await lireProspect(identite.phoneE164);
    expect(enregistre.phoneE164).toBe(identite.phoneE164);
  });
});
