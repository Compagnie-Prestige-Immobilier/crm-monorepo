import { expect, test, type Page } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import {
  choisirDansListe,
  effacerFiches,
  marque,
  ouvrirFicheDepuisAnnuaire,
  sansDebordementHorizontal,
  semerProspect,
  semerProspectGrandPublicImporte,
  semerRepresentant,
  type FicheSemee,
} from './donnees-chues';

const compte = compteDe('COMMERCIAL');
const CONSOLE = '/teleconseil/console';

const telephones: string[] = [];

async function semer(role: string): Promise<FicheSemee> {
  const suffixe = marque();
  let fiche: FicheSemee | null = null;
  await avecBase(async (client) => {
    fiche = await semerProspect(client, `Diagne ${suffixe}`, `${role} ${suffixe}`, compte.id);
  });
  if (fiche === null) throw new Error('prospect non seme');
  telephones.push((fiche as FicheSemee).phoneE164);
  return fiche;
}

interface ConversionEnBase {
  attemptId: string;
  method: string | null;
  email: string | null;
  fonctionnaire: boolean | null;
  engagementEnCours: boolean | null;
  dureeEtablissementMois: number | null;
  rendezVousAt: Date | null;
  comment: string | null;
  profession: string | null;
  phase2Status: string;
  enrollmentMethod: string | null;
  banqueName: string | null;
  incomeBandLabel: string | null;
  parcoursStatut: string | null;
}

async function lireConversion(prospectId: string): Promise<ConversionEnBase> {
  let lu: ConversionEnBase | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<ConversionEnBase>(
      `SELECT a.id AS "attemptId", a.method::text AS method, a.email,
              a.fonctionnaire, a."engagementEnCours", a."dureeEtablissementMois", a."rendezVousAt",
              a.comment, p.profession, p."phase2Status"::text AS "phase2Status",
              p."enrollmentMethod"::text AS "enrollmentMethod", b.name AS "banqueName",
              i.label AS "incomeBandLabel", j."phase2Status"::text AS "parcoursStatut"
         FROM call_attempts a
         JOIN prospects p ON p.id = a."prospectId"
         LEFT JOIN banques b ON b.id = p."banqueId"
         LEFT JOIN income_bands i ON i.id = p."incomeBandId"
         LEFT JOIN prospect_journeys j ON j."prospectId" = p.id
        WHERE a."prospectId" = $1`,
      [prospectId],
    );
    expect(rows, 'une consignation ecrit une tentative et une seule').toHaveLength(1);
    lu = rows[0] ?? null;
  });
  if (lu === null) throw new Error('tentative introuvable');
  return lu;
}

interface Classement {
  tentatives: number;
  phase2Status: string;
  enrollmentMethod: string | null;
  parcoursStatut: string;
}

async function lireClassement(prospectId: string): Promise<Classement> {
  let lu: Classement | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<Classement>(
      `SELECT (SELECT count(*)::int FROM call_attempts a WHERE a."prospectId" = p.id) AS tentatives,
              p."phase2Status"::text AS "phase2Status",
              p."enrollmentMethod"::text AS "enrollmentMethod",
              j."phase2Status"::text AS "parcoursStatut"
         FROM prospects p
         JOIN prospect_journeys j ON j."prospectId" = p.id
        WHERE p.id = $1`,
      [prospectId],
    );
    lu = rows[0] ?? null;
  });
  if (lu === null) throw new Error('fiche introuvable');
  return lu;
}

async function ouvrirFiche(page: Page, fiche: FicheSemee): Promise<void> {
  await page.goto(CONSOLE);
  await page.getByLabel('Quel prospect avez-vous appelé ?').fill(fiche.nom);
  await page.getByRole('button', { name: fiche.nom }).click();
  await expect(page.getByRole('group', { name: 'Phase 3 · Conversion' })).toHaveCount(0);
}

const REPONSES = {
  Joignable: /Oui, elle a répondu/u,
  Injoignable: /Non, elle n’a pas répondu/u,
} as const;

/**
 * La consignation pas à pas : la réponse, le formulaire quand la personne a
 * répondu, puis le statut et sa précision. Le nom d'un bouton porte aussi sa
 * touche et son aide : on cherche le libellé, pas la fin du nom.
 */
async function issue(
  page: Page,
  reponse: keyof typeof REPONSES,
  ...statuts: RegExp[]
): Promise<void> {
  await page
    .getByRole('group', { name: 'Avez-vous eu la personne au téléphone ?' })
    .getByRole('button', { name: REPONSES[reponse] })
    .click();
  await qualifier(page, ...statuts);
}

/** Le statut, puis sa précision quand il en porte. */
async function qualifier(page: Page, ...statuts: RegExp[]): Promise<void> {
  for (const statut of statuts) {
    await page.getByRole('button', { name: statut }).click();
  }
}

const enregistrer = (page: Page) =>
  page.getByRole('button', { name: 'Enregistrer l’appel' }).click();

/**
 * Une fiche rouverte reprend le brouillon de sa dernière ouverture : quand le
 * dossier est resté rempli, Échap le referme et rend les issues.
 */
async function revenirAuxIssues(page: Page): Promise<void> {
  // La fiche est rendue quand son bouton de copie l'est : avant, Échap
  // fermerait le dialogue d'ouverture et non le dossier.
  await expect(page.getByRole('button', { name: /^Copier/u })).toBeVisible();
  const issues = page.getByRole('group', { name: 'Avez-vous eu la personne au téléphone ?' });
  if (await issues.isVisible()) return;
  await page.keyboard.press('Escape');
  await expect(issues).toBeVisible();
}

const consigne = (page: Page, nom: string) =>
  page.getByRole('status').filter({ hasText: `Appel consigné pour ${nom}` });

const groupe = (page: Page, legende: string) => page.getByRole('group', { name: legende });

async function remplirDossier(
  page: Page,
  dossier: { profession: string; email: string },
): Promise<void> {
  await page.getByRole('textbox', { name: /^Profession/u }).fill(dossier.profession);
  await page.getByRole('spinbutton', { name: /^Durée dans la fonction/u }).fill('84');
  await groupe(page, 'Fonctionnaire').getByRole('radio', { name: 'Oui', exact: true }).check();
  await groupe(page, 'Ce numéro est-il un numéro WhatsApp ?')
    .getByRole('radio', { name: 'Oui', exact: true })
    .check();
  await page.getByRole('textbox', { name: /^E-mail/u }).fill(dossier.email);
  // Le dossier de conversion nomme syndicat et banque par leur sigle.
  await choisirDansListe(page.getByRole('combobox', { name: /^Syndicat/u }), 'CUSEMS');
  await choisirDansListe(page.getByRole('combobox', { name: /^Banque/u }), 'CBAO');
  await groupe(page, 'Engagement en cours à la banque')
    .getByRole('radio', { name: 'Non', exact: true })
    .check();
  await choisirDansListe(
    page.getByRole('combobox', { name: /^Revenu mensuel/u }),
    'Moins de 50 000 F CFA',
  );
}

// Un micro feint pour tout le fichier : `launchOptions` ne se change pas par
// groupe, le cas « sans micro » ouvre donc son propre navigateur.
test.use({ storageState: compte.etat });

test.afterAll(async () => {
  await effacerFiches(telephones);
});

test.describe('parcours 5, convertir un prospect', () => {
  test('le dossier survit a l’enregistrement', async ({ page }) => {
    const fiche = await semer('Conversion');
    const suffixe = marque();
    const profession = `Instituteur ${suffixe}`;
    const email = `awa.${suffixe}@ecole.sn`;
    const commentaire = `Rendez-vous pris au bureau ${suffixe}`;

    await ouvrirFiche(page, fiche);
    await issue(page, 'Joignable');
    await remplirDossier(page, { profession, email });
    await page.getByRole('button', { name: 'Continuer' }).click();
    await qualifier(page, /Intéressé/u, /Terrain/u);
    await page.getByLabel(/^Commentaire/u).fill(commentaire);

    await enregistrer(page);
    await expect(consigne(page, fiche.nom)).toBeVisible();

    const conversion = await lireConversion(fiche.id);
    expect(conversion.method).toBeNull();
    expect(conversion.email).toBe(email);
    expect(conversion.fonctionnaire).toBe(true);
    expect(conversion.engagementEnCours).toBe(false);
    expect(conversion.dureeEtablissementMois).toBe(84);
    expect(conversion.comment).toBe(commentaire);
    expect(conversion.profession).toBe(profession);
    expect(conversion.enrollmentMethod).toBeNull();
    expect(conversion.banqueName).toContain('CBAO');
    expect(conversion.incomeBandLabel).toBe('Moins de 50 000 F CFA');

    await page.goto(`/teleconseil/prospects/${fiche.id}`);
    await page.getByRole('list', { name: 'Histoire' }).getByText(commentaire).click();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText(profession)).toBeVisible();
  });

  test('une fiche deja classee accepte un nouvel appel, la derniere issue l’emporte', async ({
    page,
  }) => {
    const fiche = await semer('Reclassement');
    const suffixe = marque();

    await ouvrirFiche(page, fiche);
    await issue(page, 'Joignable');
    await remplirDossier(page, {
      profession: `Greffier ${suffixe}`,
      email: `omar.${suffixe}@ecole.sn`,
    });
    await page.getByRole('button', { name: 'Continuer' }).click();
    await qualifier(page, /Hésitant/u);
    await enregistrer(page);
    await expect(consigne(page, fiche.nom)).toBeVisible();

    await page.goto(`/teleconseil/appel/${fiche.id}`);
    await expect(
      page.getByRole('status').filter({ hasText: 'Déjà classée : hésitant.' }),
    ).toBeVisible();
    await revenirAuxIssues(page);
    await issue(page, 'Injoignable', /NRP/u);
    await enregistrer(page);
    await expect
      .poll(() => lireClassement(fiche.id))
      .toMatchObject({
        tentatives: 2,
        phase2Status: 'UNREACHABLE',
      });

    await page.goto(`/teleconseil/appel/${fiche.id}`);
    await revenirAuxIssues(page);
    await issue(page, 'Injoignable', /Faux numéro/u);
    await enregistrer(page);
    await expect
      .poll(() => lireClassement(fiche.id))
      .toMatchObject({
        tentatives: 3,
        phase2Status: 'WRONG_NUMBER',
        enrollmentMethod: null,
        parcoursStatut: 'WRONG_NUMBER',
      });
  });

  test('un prospect Grand Public importe se qualifie par le teleconseiller a qui il est attribue', async ({
    page,
  }) => {
    const suffixe = marque();
    const lotId = crypto.randomUUID();
    const importeur = compteDe('ADMIN').id;
    let fiche: FicheSemee | null = null;
    await avecBase(async (client) => {
      fiche = await semerProspectGrandPublicImporte(
        client,
        `GrandPublic ${suffixe}`,
        `Import ${suffixe}`,
        importeur,
      );
      await client.query(
        `INSERT INTO lots_export (id, name, cible, projet, filters, "itemCount", "createdById")
         VALUES ($1, $2, 'PROSPECTS', 'GRAND_PUBLIC', '{}'::jsonb, 1, $3)`,
        [lotId, `Leads ${suffixe}`, importeur],
      );
      await client.query(
        `INSERT INTO lot_export_items ("lotId", "prospectId", position, "assigneeId", day)
         VALUES ($1, $2, 1, $3, 1)`,
        [lotId, (fiche as FicheSemee).id, compte.id],
      );
    });
    if (fiche === null) throw new Error('prospect Grand Public non seme');
    const semee = fiche as FicheSemee;
    telephones.push(semee.phoneE164);

    try {
      await page.goto(`/teleconseil/appel/${semee.id}`);
      await issue(page, 'Injoignable', /NRP/u);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/teleconseil$/u);
      await expect.poll(async () => (await lireClassement(semee.id)).tentatives).toBe(1);
    } finally {
      await avecBase(async (client) => {
        await client.query('DELETE FROM lots_export WHERE id = $1', [lotId]);
      });
    }
  });

  test('un appel sans reponse se consigne en trois clics et rend la main a la page d’origine', async ({
    page,
  }) => {
    const fiche = await semer('SansReponse');
    await page.goto(`/teleconseil/prospects/${fiche.id}`);
    await page.getByRole('link', { name: 'Consigner un appel' }).click();
    // Personne d'autre ne tient la fiche : elle s'ouvre sans confirmation.
    await expect(page.getByRole('heading', { name: fiche.nom, level: 2 })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await issue(page, 'Injoignable', /NRP/u);
    await expect(
      page.getByRole('group', { name: 'Pourquoi n’a-t-elle pas répondu ?' }),
    ).toBeVisible();
    await expect(page.getByLabel('Commentaire, facultatif')).toBeVisible();
    await enregistrer(page);

    await expect(page).toHaveURL(new RegExp(`/teleconseil/prospects/${fiche.id}$`, 'u'));
    await expect
      .poll(() => lireClassement(fiche.id))
      .toMatchObject({ tentatives: 1, phase2Status: 'UNREACHABLE' });
  });

  test('une fiche ouverte n’empeche pas d’en ouvrir une autre ailleurs', async ({ page }) => {
    const fiche = await semer('EnMain');
    let representant: FicheSemee | null = null;
    await avecBase(async (client) => {
      representant = await semerRepresentant(client, `Rep ${marque()}`, compte.id);
    });
    if (representant === null) throw new Error('representant non seme');
    telephones.push((representant as FicheSemee).phoneE164);

    await ouvrirFiche(page, fiche);
    await page.goto('/teleconseil/appels-representants');
    await ouvrirFicheDepuisAnnuaire(page, representant);
    await expect(page.getByText(/en main/u)).toHaveCount(0);

    // Les deux ouvertures restent : le parcours suivant les reprendrait au montage.
    const representantId = (representant as FicheSemee).id;
    await avecBase(async (client) => {
      await client.query(
        'DELETE FROM ouvertures_fiche WHERE "prospectId" = $1 OR "representantId" = $2',
        [fiche.id, representantId],
      );
    });
  });
});

test.describe('parcours 5 en 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('la conversion tient dans l’ecran du telephone', async ({ page }) => {
    const fiche = await semer('Telephone');
    const suffixe = marque();

    await ouvrirFiche(page, fiche);
    await sansDebordementHorizontal(page);
    await issue(page, 'Joignable');

    await remplirDossier(page, {
      profession: `Professeur ${suffixe}`,
      email: `pape.${suffixe}@ecole.sn`,
    });
    await page.getByRole('button', { name: 'Continuer' }).click();
    await qualifier(page, /Intéressé/u);
    await page.getByRole('button', { name: 'Sans précision' }).click();
    await enregistrer(page);
    await expect(consigne(page, fiche.nom)).toBeVisible();
    await sansDebordementHorizontal(page);

    const conversion = await lireConversion(fiche.id);
    expect(conversion.method).toBeNull();
    expect(conversion.phase2Status).toBe('INTERESTED');
  });
});
