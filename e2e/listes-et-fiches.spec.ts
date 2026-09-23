import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { compteDe } from './comptes';
import {
  apiDe,
  creerProspect,
  creerRepresentant,
  departementQuelconque,
  ligne,
  mesurerDebordement,
  purger,
  suffixe,
} from './donnees-listes';

/** Une page pleine, plus une : la deuxième page existe pour de bon. */
const REPRESENTANTS = 26;

/** Hors recherche : un filtre perdu ferait remonter ces fiches, et le compte change. */
const TEMOINS = 2;

// La recherche compare aussi ses chiffres aux téléphones : une marque sans chiffre,
// sinon quatre chiffres suffisent à ramener la fiche d'un autre parcours.
const cle = randomUUID().replaceAll(/[\d-]/gu, '').slice(0, 8);
const representants: string[] = [];
const prospects: string[] = [];
let porteur = '';
let prospectChues = '';
let prospectGrandPublic = '';

const nomRepresentant = (rang: number): string =>
  `Representant ${cle} ${String(rang).padStart(2, '0')}`;

test.beforeAll(async () => {
  const api = await apiDe('ADMIN', '198.51.100.73');
  const departement = await departementQuelconque();
  const base = 3_000_000 + Math.floor(Math.random() * 900_000);

  for (let rang = 1; rang <= REPRESENTANTS; rang += 1) {
    const id = await creerRepresentant(api, {
      fullName: nomRepresentant(rang),
      phone: `+22177${String(base + rang)}`,
      departementId: departement.id,
      etablissement: `Ecole ${cle}`,
    });
    representants.push(id);
  }
  porteur = representants[0] ?? '';

  for (let rang = 1; rang <= TEMOINS; rang += 1) {
    representants.push(
      await creerRepresentant(api, {
        fullName: `Temoin ${suffixe()} ${String(rang)}`,
        phone: `+22177${String(base + 500 + rang)}`,
        departementId: departement.id,
      }),
    );
  }

  prospectChues = await creerProspect(api, {
    nom: `CHUES ${cle}`,
    prenom: 'Aminata',
    phone: `+22177${String(base + 900)}`,
    projet: 'CHUES',
    representantId: porteur,
  });
  prospectGrandPublic = await creerProspect(api, {
    nom: `GP ${cle}`,
    prenom: 'Ousmane',
    phone: `+22177${String(base + 901)}`,
    projet: 'GRAND_PUBLIC',
  });
  prospects.push(prospectChues, prospectGrandPublic);
  await api.dispose();
});

test.afterAll(async () => {
  await purger({ prospects, representants });
});

async function chercher(page: Page, libelle: string): Promise<void> {
  await page.getByLabel(libelle, { exact: true }).fill(cle);
  await expect(page).toHaveURL(new RegExp(`search=${cle}`));
}

async function fermerRappelIntrusif(page: Page): Promise<void> {
  const plusTard = page.getByRole('button', { name: 'Plus tard', exact: true });
  await plusTard.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await plusTard.isVisible().catch(() => false)) {
    await plusTard.click();
    await expect(plusTard).toBeHidden();
  }
}

test.describe('parcours 7, les listes CHUES', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  test('la recherche, le tri et la page vivent dans l’URL et survivent au rechargement', async ({
    page,
  }) => {
    await page.goto('/teleconseil/representants');
    await chercher(page, 'Recherche');

    const affichage = page.getByRole('status').filter({ hasText: 'Représentants affichés' });
    await expect(affichage).toContainText(`1–25 sur ${String(REPRESENTANTS)}`);

    // Le tri vit sur l'en-tête de colonne, plus dans les filtres avancés.
    await page.getByRole('button', { name: 'Représentant', exact: true }).click();
    await expect(page).toHaveURL(/sortBy=fullName/);
    await expect(page).toHaveURL(/sortDir=asc/);

    const premiere = page.getByRole('row').filter({ hasText: cle }).first();
    await expect(premiere).toContainText(nomRepresentant(1));

    await page.reload();
    await expect(page.getByLabel('Recherche', { exact: true })).toHaveValue(cle);
    await expect(affichage).toContainText(`1–25 sur ${String(REPRESENTANTS)}`);
    await expect(page.getByRole('row').filter({ hasText: cle }).first()).toContainText(
      nomRepresentant(1),
    );

    await page.getByRole('button', { name: 'Page suivante' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(affichage).toContainText(`26–26 sur ${String(REPRESENTANTS)}`);
    await expect(page.getByRole('row').filter({ hasText: cle })).toHaveCount(1);
  });

  test('la fiche d’un représentant rend son histoire et le prospect qu’il a apporté', async ({
    page,
  }) => {
    const enBase = await ligne<{ fullName: string; phoneE164: string; etablissement: string }>(
      'SELECT "fullName", "phoneE164", etablissement FROM representants WHERE id = $1',
      [porteur],
    );
    expect(enBase, 'le représentant a disparu de la base').not.toBeNull();

    await page.goto(`/teleconseil/representants/${porteur}`);
    await expect(page.getByRole('heading', { name: new RegExp(nomRepresentant(1)) })).toBeVisible();
    await expect(page.getByRole('link', { name: /^\+221/ })).toBeVisible();
    await expect(page.getByText(String(enBase?.etablissement))).toBeVisible();

    const histoire = page.getByRole('list', { name: 'Histoire' });
    await expect(histoire.getByRole('button', { name: /Fiche créée/ })).toBeVisible();

    await page.getByRole('link', { name: new RegExp(`CHUES ${cle}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/teleconseil/prospects/${prospectChues}$`));
    await expect(page.getByRole('heading', { level: 2 })).toContainText(`CHUES ${cle}`);
    await expect(page.getByRole('link', { name: 'Ouvrir la fiche du représentant' })).toBeVisible();
  });

  test('la liste des prospects CHUES retrouve la fiche par son nom', async ({ page }) => {
    await page.goto('/teleconseil/prospects?projet=CHUES');
    await chercher(page, 'Recherche');

    await expect(page.getByRole('link', { name: new RegExp(`CHUES ${cle}`) })).toHaveCount(1);
  });

  test('la liste des prospects CHUES ne montre pas les fiches Grand Public', async ({ page }) => {
    await page.goto('/teleconseil/prospects?projet=CHUES');
    await chercher(page, 'Recherche');

    await expect(page.getByRole('link', { name: new RegExp(`GP ${cle}`) })).toHaveCount(0);
  });
});

test.describe('parcours 7, la liste et la fiche Grand Public', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  test('la fiche saisie hors syndicat se retrouve et se relit', async ({ page }) => {
    const enBase = await ligne<{ projet: string; nom: string }>(
      `SELECT j.projet, p.nom FROM prospects p
         JOIN prospect_journeys j ON j."prospectId" = p.id
        WHERE p.id = $1`,
      [prospectGrandPublic],
    );
    expect(enBase?.projet, 'le parcours Grand Public manque en base').toBe('GRAND_PUBLIC');

    await page.goto('/teleconseil/prospects/nouveau?projet=GRAND_PUBLIC');
    await fermerRappelIntrusif(page);
    // Premier pas du parcours unifié : le type de contact, pas encore le formulaire.
    await expect(page.getByRole('button', { name: 'Appel entrant', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'SMS / Whatsapp', exact: true })).toBeVisible();

    await page.goto('/teleconseil/prospects?projet=Grand+Public');
    await chercher(page, 'Recherche');

    const ligneGp = page.getByRole('row').filter({ hasText: `GP ${cle}` });
    await expect(ligneGp).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: `CHUES ${cle}` })).toHaveCount(0);

    await ligneGp.getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/teleconseil/prospects/${prospectGrandPublic}$`));
    await page.goto(`/teleconseil/appel/${prospectGrandPublic}`);
    await expect(page.getByRole('heading', { name: `GP ${cle} Ousmane`, level: 2 })).toBeVisible();

    // Pas à pas : la réponse, le formulaire, le statut, sa précision, la note.
    // Un Retour ne perd pas ce qui a été saisi dans le formulaire.
    await page.getByRole('button', { name: /Oui, elle a répondu/u }).click();
    // « Aucun » coche par défaut la méthode d'enrôlement : c'est le seul radio actif ici.
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
    await expect(page.getByRole('radio', { name: 'Aucun', checked: true })).toBeVisible();
    await page.getByRole('textbox', { name: /^Nom/ }).fill(`Dossier ${cle}`);
    await page.getByRole('button', { name: /^Retour/u }).click();
    await page.getByRole('button', { name: /Oui, elle a répondu/u }).click();
    await expect(page.getByRole('textbox', { name: /^Nom/ })).toHaveValue(`Dossier ${cle}`);
    await page.getByRole('button', { name: /^Continuer/u }).click();
    await page.getByRole('button', { name: /Intéressé/u }).click();
    await page.getByRole('button', { name: /^Sans précision/u }).click();
    await page.getByRole('textbox').fill('Souhaite recevoir les informations.');
    await page.getByRole('button', { name: /Enregistrer l’appel/ }).click();
    // L'ADMIN atterrit sur son tableau de bord, le téléconseiller sur Mon travail.
    await expect(page).toHaveURL(/\/teleconseil(\/tableau-de-bord)?$/u);
    const appel = await ligne<{ code: string; nom: string }>(
      `SELECT r.code, o.draft->'conversion'->>'nom' AS nom
         FROM call_attempts a
         JOIN call_outcome_reasons r ON r.id = a."reasonId"
         JOIN ouvertures_fiche o ON o."closingAttemptId" = a.id
        WHERE a."prospectId" = $1`,
      [prospectGrandPublic],
    );
    expect(appel).toEqual({ code: 'INTERESSE', nom: `Dossier ${cle}` });
    await page.goto('/teleconseil/prospects?projet=Grand+Public');
    await chercher(page, 'Recherche');
    // Le nom saisi dans le formulaire corrige l'identité de la fiche
    // (`CorrigerProspectParTentative`) : la liste rend le nouveau nom, pas l'ancien.
    const ligneApresAppel = page.getByRole('row').filter({ hasText: `Dossier ${cle}` });
    await expect(ligneApresAppel).toContainText('Intéressé');

    await page.goto(`/teleconseil/prospects/${prospectGrandPublic}`);
    await expect(
      page.getByRole('heading', { name: `Ousmane Dossier ${cle}`, level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /^\+221/ })).toBeVisible();
  });
});

test.describe('parcours 7 en 390 px, les listes passent en cartes', () => {
  test.use({
    storageState: compteDe('ADMIN').etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('le tableau des représentants cède la place à une carte par fiche', async ({ page }) => {
    await page.goto(`/teleconseil/representants?search=${cle}`);
    await expect(page.getByRole('status')).toHaveText(new RegExp(`sur ${String(REPRESENTANTS)}`));

    await expect(page.getByRole('table')).toBeHidden();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(25);

    const mesure = await mesurerDebordement(page);
    expect(
      mesure.largeur,
      `la liste déborde de ${String(mesure.largeur - mesure.ecran)} px. Coupables : ${mesure.coupables.join(' | ')}`,
    ).toBeLessThanOrEqual(mesure.ecran + 1);
  });
});

// La liste des prospects suit le travail des autres : le téléconseiller et le
// chargé de clientèle appellent depuis leur console, pas depuis cet écran.
test.describe('parcours 5, la liste des prospects reste à l’encadrement', () => {
  test.use({ storageState: compteDe('COMMERCIAL').etat });

  test('le téléconseiller n’a ni l’onglet ni l’écran', async ({ page }) => {
    await page.goto('/teleconseil/console');
    const menu = page.getByRole('navigation', { name: 'Navigation principale' });
    // L'entrée vit sous le repli « Plus » : fermé, il masquerait aussi bien un
    // onglet resté visible qu'un onglet correctement retiré.
    await menu.getByText('Plus', { exact: true }).click();
    await expect(menu.getByRole('link', { name: 'Prospects', exact: true })).toHaveCount(0);

    await page.goto('/teleconseil/prospects');
    const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
    await expect(refus.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
  });
});

test.describe('parcours 7, creer un prospect depuis la liste', () => {
  // Le superviseur ne modifie pas les lignes du tableau, mais il cree des
  // fiches : la lecture seule effaçait pourtant son bouton.
  test.use({ storageState: compteDe('SUPERVISEUR').etat });

  test('le superviseur garde le bouton sans filtre de projet, et choisit ensuite', async ({
    page,
  }) => {
    await page.goto('/teleconseil/prospects');

    const bouton = page.getByRole('button', { name: 'Nouveau prospect' });
    await expect(bouton).toBeVisible();
    await bouton.click();

    const fenetre = page.getByRole('dialog');
    await expect(fenetre.getByRole('heading', { name: 'Nouveau prospect' })).toBeVisible();

    // Le type de contact puis le canal de provenance precedent desormais la
    // console : le canal se propose deja rempli par le choix precedent.
    await fenetre.getByRole('button', { name: 'Appel entrant' }).click();
    await expect(fenetre.getByRole('combobox', { name: 'Canal de provenance' })).toContainText(
      'Appel entrant',
    );
    await fenetre.getByRole('button', { name: 'Continuer' }).click();

    // Le projet se choisit au dernier pas de la console : les etapes suivantes
    // restent fermees tant que la fiche n'est pas saisie.
    const etapes = fenetre.getByRole('navigation', { name: 'Progression du formulaire' });
    await expect(etapes.getByRole('button', { name: 'Identité' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    const dernier = etapes.getByRole('listitem').last().getByRole('button');
    await expect(dernier).toHaveAccessibleName(/Projet/u);
    await expect(dernier).toBeDisabled();
  });
});
