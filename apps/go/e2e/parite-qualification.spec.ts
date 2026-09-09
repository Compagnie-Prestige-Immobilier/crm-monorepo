import { rmSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Client } from 'pg';

import { avecBase, compteDe } from './comptes';
import {
  choisirDansListe,
  effacerFiches,
  marque,
  nationalDe,
  ouvrirFicheDepuisAnnuaire,
  repondre,
  semerProspect,
  semerRepresentant,
  tentativesDuProspect,
  type FicheSemee,
} from './donnees-chues';

const compte = compteDe('COMMERCIAL');
const CONSOLE = '/chues/console';
const LISTE = '/chues/prospects';

const telephones: string[] = [];
const notesDeposees: string[] = [];

interface Fiche extends FicheSemee {
  readonly prenom: string;
  readonly patronyme: string;
}

async function semer(quoi: string, semis: (client: Client, nom: string) => Promise<FicheSemee>) {
  let pose: FicheSemee | null = null;
  const patronyme = `Qualif ${quoi} ${marque()}`;
  await avecBase(async (client) => {
    pose = await semis(client, patronyme);
  });
  if (pose === null) throw new Error(`fiche non semee : ${quoi}`);
  const fiche: FicheSemee = pose;
  telephones.push(fiche.phoneE164);
  return { ...fiche, prenom: 'Awa', patronyme };
}

const semerFiche = (quoi: string): Promise<Fiche> =>
  semer(quoi, (client, nom) => semerProspect(client, nom, 'Awa', compte.id));

const semerRep = (quoi: string): Promise<Fiche> =>
  semer(quoi, (client, nom) => semerRepresentant(client, nom, compte.id));

interface Parcours {
  phase2Status: string;
  enrollmentMethod: string | null;
  profession: string | null;
  syndicatId: string | null;
  banqueId: string | null;
  incomeBandId: string | null;
}

async function lireParcours(prospectId: string): Promise<Parcours> {
  let lu: Parcours | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<Parcours>(
      `SELECT j."phase2Status"::text AS "phase2Status",
              j."enrollmentMethod"::text AS "enrollmentMethod",
              p.profession, p."syndicatId", p."banqueId", p."incomeBandId"
         FROM prospects p JOIN prospect_journeys j ON j."prospectId" = p.id
        WHERE p.id = $1`,
      [prospectId],
    );
    lu = rows[0] ?? null;
  });
  if (lu === null) throw new Error('parcours introuvable');
  return lu;
}

async function lireAppels(prospectId: string): Promise<Record<string, unknown>[]> {
  let lus: Record<string, unknown>[] = [];
  await avecBase(async (client) => {
    lus = await tentativesDuProspect(client, prospectId);
  });
  return lus;
}

async function rappelEnAttente(prospectId: string): Promise<{ assigne: string; quand: Date }> {
  let lu: { assigne: string; quand: Date } | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<{ assigne: string; quand: Date }>(
      `SELECT "assignedToId" AS assigne, "scheduledAt" AS quand FROM scheduled_callbacks
        WHERE "prospectId" = $1 AND status = 'PENDING'`,
      [prospectId],
    );
    expect(rows, 'un rappel promis, et un seul, attend sur la fiche').toHaveLength(1);
    lu = rows[0] ?? null;
  });
  if (lu === null) throw new Error('rappel introuvable');
  return lu;
}

const recherche = (page: Page): Locator => page.getByLabel('Quel prospect avez-vous appelé ?');
const ficheCourante = (page: Page): Locator => page.getByRole('region', { name: 'Fiche courante' });
const enregistre = (page: Page, nom: string): Locator =>
  page.getByRole('status').filter({ hasText: `Appel enregistré pour ${nom}.` });

/** Le numero tel que les listes l'ecrivent : indicatif detache, puis par paires. */
const telephoneAffiche = (e164: string): string =>
  e164.replace(/^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/u, '+221 $1 $2 $3 $4');

/** La fiche visée par `?fiche=` arrive déjà sur sa demande de confirmation. */
async function confirmerOuverture(page: Page, fiche: Fiche): Promise<void> {
  await expect(page.getByRole('dialog')).toContainText(`Ouvrir la fiche de ${fiche.nom} ?`);
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
  await expect(ficheCourante(page).getByRole('heading', { level: 2 })).toHaveText(fiche.nom);
}

async function ouvrirDepuisAnnuaire(page: Page, fiche: Fiche): Promise<void> {
  await recherche(page).fill(fiche.patronyme);
  await page.getByRole('button', { name: fiche.nom }).click();
  await confirmerOuverture(page, fiche);
}

/** Une liste de reference : le contenu du referentiel ne doit pas fixer le parcours. */
async function choisirPremiere(page: Page, libelle: RegExp): Promise<void> {
  await page.getByLabel(libelle).click();
  await page.getByRole('option').first().click();
  await expect(page.getByRole('option')).toHaveCount(0);
}

const cocher = (page: Page, groupe: string, choix: string): Promise<void> =>
  page.getByRole('group', { name: groupe }).getByRole('radio', { name: choix }).check();

// Le micro simulé se règle au lancement du navigateur : Playwright refuse cette
// option dans un `describe`, elle vaut donc pour tout le fichier.
test.use({
  storageState: compte.etat,
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.afterAll(async () => {
  await effacerFiches(telephones);
  for (const attemptId of notesDeposees) {
    rmSync(path.join(__dirname, 'storage', 'notes-vocales', `${attemptId}.audio`), { force: true });
  }
});

test.describe('parcours 5, convertir un prospect', () => {
  test('l’annuaire trouve la fiche par son numéro, le lien l’ouvre et l’injoignable se consigne', async ({
    page,
  }) => {
    const fiche = await semerFiche('injoignable');

    await page.goto(CONSOLE);
    await expect(recherche(page)).toBeVisible();
    await expect(page.getByText('Les vingt dernières fiches ajoutées.', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);

    // Dicte comme au telephone : la recherche compare les chiffres, pas la chaine.
    await recherche(page).fill(nationalDe(fiche.phoneE164).replace(/(\d{2})(\d{3})(\d{2})(\d{2})/u, '$1 $2 $3 $4'));
    await expect(page.getByRole('button', { name: fiche.nom })).toHaveCount(1);

    await recherche(page).fill('Introuvable ZZZ');
    await expect(page.getByText('Aucun résultat. Vérifiez le nom ou le numéro.')).toBeVisible();

    await page.goto(`${CONSOLE}?fiche=${fiche.id}`);
    await confirmerOuverture(page, fiche);
    await expect(ficheCourante(page).getByText('Jamais appelée.')).toBeVisible();
    await expect(ficheCourante(page).getByText(telephoneAffiche(fiche.phoneE164))).toBeVisible();

    await page.keyboard.press('3');
    await expect(enregistre(page, fiche.nom)).toBeVisible();
    await expect(recherche(page), 'la consignation rend la main à l’annuaire').toBeVisible();

    const appels = await lireAppels(fiche.id);
    expect(appels, 'une consignation écrit une tentative et une seule').toHaveLength(1);
    expect(appels[0]?.outcome).toBe('UNREACHABLE');
    const parcours = await lireParcours(fiche.id);
    expect(parcours.phase2Status, 'un injoignable ne clôt pas le parcours').toBe('PENDING');
  });

  test('l’adhésion refuse un dossier incomplet, puis s’écrit sur la fiche et dans le parcours', async ({
    page,
  }) => {
    const fiche = await semerFiche('adhesion');

    await page.goto(CONSOLE);
    await ouvrirDepuisAnnuaire(page, fiche);

    await page.keyboard.press('1');
    await expect(page.getByText('Phase 3 · Conversion')).toBeVisible();
    const dossier = page.getByRole('group', { name: 'Phase 3 · Conversion' });
    await expect(
      dossier.getByRole('group', { name: 'Situation' }),
      'un enseignant CHUES n’a ni situation ni mode de paiement à déclarer',
    ).toHaveCount(0);
    await expect(dossier.getByLabel(/^Paiement/u)).toHaveCount(0);

    await page.getByRole('button', { name: /^Enregistrer l’adhésion/u }).click();
    await expect(page.getByText('La profession est obligatoire.')).toBeVisible();
    await expect(page.getByText('Dites s’il est fonctionnaire.')).toBeVisible();
    await expect(page.getByText('Choisissez la méthode d’enrôlement.')).toBeVisible();
    expect(await lireAppels(fiche.id), 'un dossier incomplet ne part pas').toHaveLength(0);

    await page.getByRole('textbox', { name: /^Profession/u }).fill('Professeur de lettres');
    await page.getByRole('spinbutton', { name: /^Durée dans la fonction/u }).fill('48');
    await cocher(page, 'Fonctionnaire', 'Oui');
    await choisirPremiere(page, /^Syndicat/u);
    await choisirPremiere(page, /^Banque/u);
    await cocher(page, 'Engagement en cours à la banque', 'Non');
    await choisirPremiere(page, /^Revenu mensuel/u);
    await page.getByRole('radio', { name: 'Plateforme en ligne' }).check();

    await page.getByRole('button', { name: /^Enregistrer l’adhésion/u }).click();
    await expect(enregistre(page, fiche.nom)).toBeVisible();

    const appels = await lireAppels(fiche.id);
    expect(appels).toHaveLength(1);
    expect(appels[0]?.outcome).toBe('METHOD_OBTAINED');
    expect(appels[0]?.method).toBe('PLATFORM');
    expect(appels[0]?.dureeEtablissementMois).toBe(48);
    expect(appels[0]?.fonctionnaire).toBe(true);
    expect(appels[0]?.engagementEnCours).toBe(false);

    const parcours = await lireParcours(fiche.id);
    expect(parcours.phase2Status).toBe('METHOD_OBTAINED');
    expect(parcours.enrollmentMethod).toBe('PLATFORM');
    expect(parcours.profession).toBe('Professeur de lettres');
    expect(parcours.syndicatId, 'le syndicat choisi rejoint la fiche').not.toBeNull();
    expect(parcours.banqueId).not.toBeNull();
    expect(parcours.incomeBandId).not.toBeNull();
  });

  test('le rappel promis garde le dossier, le retrouve depuis les rappels, et le refus clôt la fiche', async ({
    page,
  }) => {
    const fiche = await semerFiche('rappel');
    const motif = `Rappel promis après l’école ${marque()}`;

    await page.goto(CONSOLE);
    await ouvrirDepuisAnnuaire(page, fiche);

    await page.keyboard.press('1');
    await page.getByRole('spinbutton', { name: /^Durée dans la fonction/u }).fill('48');
    await cocher(page, 'Fonctionnaire', 'Oui');
    await page.getByLabel('Commentaire', { exact: true }).fill(motif);

    await page.getByRole('button', { name: /^À rappeler/u }).click();
    await expect(page.getByText('Quand rappeler')).toBeVisible();
    await expect(page.getByText('Vous retrouverez le dossier déjà rempli au prochain appel.')).toBeVisible();
    await page.getByRole('button', { name: /Dans 1 h/u }).click();
    await expect(enregistre(page, fiche.nom)).toBeVisible();

    const appels = await lireAppels(fiche.id);
    expect(appels[0]?.outcome).toBe('CALLBACK');
    expect(appels[0]?.comment).toBe(motif);
    expect(
      appels[0]?.dureeEtablissementMois,
      'un rappel ne consigne pas le dossier, il le met de côté',
    ).toBeNull();
    const rappel = await rappelEnAttente(fiche.id);
    expect(rappel.assigne).toBe(compte.id);
    expect(rappel.quand.getTime()).toBeGreaterThan(Date.now());

    await page.goto('/chues/rappels');
    await page.getByRole('tab', { name: 'Cette semaine' }).click();
    const ligne = page
      .getByRole('row')
      .filter({ hasText: telephoneAffiche(fiche.phoneE164) });
    await expect(ligne).toHaveCount(1);
    await ligne.getByRole('link', { name: 'Consigner l’appel' }).click();

    await expect(page).toHaveURL(new RegExp(`fiche=${fiche.id}$`));
    await confirmerOuverture(page, fiche);
    await expect(
      page.getByRole('spinbutton', { name: /^Durée dans la fonction/u }),
      'le dossier mis de côté revient tel quel : la base ne porte aucun de ces champs',
    ).toHaveValue('48');
    await expect(page.getByRole('group', { name: 'Fonctionnaire' }).getByRole('radio', { name: 'Oui' })).toBeChecked();
    await expect(page.getByLabel('Commentaire', { exact: true })).toHaveValue(motif);

    await page.getByRole('button', { name: 'Il refuse' }).click();
    await expect(enregistre(page, fiche.nom)).toBeVisible();
    expect((await lireParcours(fiche.id)).phase2Status).toBe('REFUSED');

    await page.goto(`${CONSOLE}?fiche=${fiche.id}`);
    await expect(
      ficheCourante(page).getByRole('status').filter({ hasText: 'Fiche déjà close (refus)' }),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Comment s’est passé l’appel ?' }),
      'une fiche close n’offre plus d’issue à consigner',
    ).toHaveCount(0);
    expect(await lireAppels(fiche.id)).toHaveLength(2);
  });

  test(
    'la console ouvre le curseur dans la recherche, comme la v1',
    async ({ page }) => {
      await page.goto(CONSOLE);
      await expect(recherche(page)).toBeFocused();
    },
  );
});

test.describe('parcours 5, la note vocale', () => {
  test('la note dictée après l’appel part avec la tentative et se réécoute', async ({ page }) => {
    const fiche = await semerFiche('note');

    await page.goto(CONSOLE);
    await ouvrirDepuisAnnuaire(page, fiche);

    await page.getByRole('button', { name: 'Note vocale' }).click();
    // Une seconde pleine, attendue sur le chrono : un blob vide serait refusé.
    await page.getByRole('button', { name: 'Arrêter (00:01)' }).click();
    await expect(page.getByText(/^Note vocale de 00:0\d, envoyée avec l’appel\.$/u)).toBeVisible();

    await page.keyboard.press('3');
    await expect(enregistre(page, fiche.nom)).toBeVisible();

    const appels = await lireAppels(fiche.id);
    expect(appels).toHaveLength(1);
    const attemptId = String(appels[0]?.id);
    notesDeposees.push(attemptId);

    const relue = await page.request.get(
      `/api/v1/phase2/call-attempts/${attemptId}/note-vocale`,
    );
    expect(relue.status(), 'la note dictée doit se réécouter depuis la tentative').toBe(200);
    expect(relue.headers()['content-type']).toContain('audio/');
    expect((await relue.body()).byteLength).toBeGreaterThan(0);
  });
});

test.describe('parcours 3, ce que le script du représentant exige', () => {
  test('la personne proposée exige son numéro, et l’accord pose la relation ambassadeur', async ({
    page,
  }) => {
    const fiche = await semerRep('ambassadeur');
    const propose = `Fall ${marque()}`;

    await page.goto('/chues/appels-representants');
    await page.getByLabel('Qui avez-vous appelé ?').fill('Introuvable ZZZ');
    await expect(page.getByText('Aucun résultat parmi vos fiches.', { exact: false })).toBeVisible();

    await ouvrirFicheDepuisAnnuaire(page, fiche);

    await repondre(page, 'Comment s’est passé l’appel ?', 'Joignable');
    await repondre(page, 'L’établissement de la fiche est-il confirmé ?', 'Oui');
    await repondre(page, 'A-t-il déjà été contacté ?', 'Non');
    await repondre(page, 'Connaît-il l’UES ?', 'Oui');

    const continuer = page.getByRole('button', { name: 'Continuer' });
    await repondre(page, 'Souhaite-t-il être représentant CHUES ?', 'Non');
    await expect(continuer, 'la personne proposée reste facultative').toBeEnabled();

    await page.getByLabel('Son nom et prénom').fill(propose);
    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Écrivez le numéro de la personne proposée')).toBeVisible();
    await page.getByLabel('Son nom et prénom').fill('');
    await expect(continuer).toBeEnabled();

    await repondre(page, 'Souhaite-t-il être représentant CHUES ?', 'Oui');
    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Dites s’il a WhatsApp sur ce numéro')).toBeVisible();
    await repondre(page, 'A-t-il WhatsApp sur ce numéro ?', 'Non');
    await expect(page.getByText('Écrivez le numéro WhatsApp')).toBeVisible();
    await page.getByLabel('Numéro WhatsApp').fill('77 123 45 67');
    await expect(continuer).toBeEnabled();

    await continuer.click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Appel enregistré pour ${fiche.nom}.` }),
    ).toBeVisible();

    await avecBase(async (client) => {
      const { rows } = await client.query<{
        relationStatus: string;
        whatsappStatus: string | null;
        whatsappE164: string | null;
        contacte: boolean | null;
        connaitUES: boolean | null;
        tentatives: string;
      }>(
        `SELECT r."relationStatus"::text AS "relationStatus", r."whatsappStatus"::text AS "whatsappStatus",
                r."whatsappE164", r.contacte, r."connaitUES",
                (SELECT count(*) FROM rep_call_attempts a WHERE a."representantId" = r.id) AS tentatives
           FROM representants r WHERE r.id = $1`,
        [fiche.id],
      );
      const lu = rows[0];
      expect(lu?.relationStatus, 'l’accord pose la relation ambassadeur').toBe('AMBASSADEUR');
      expect(lu?.whatsappStatus).toBe('AUTRE_NUMERO');
      expect(lu?.whatsappE164).toBe('+221771234567');
      expect(lu?.contacte).toBe(false);
      expect(lu?.connaitUES).toBe(true);
      expect(Number(lu?.tentatives), 'le script part en une tentative').toBe(1);
    });
  });
});

test.describe('parcours 7, le périmètre de la liste des prospects', () => {
  test('la fiche d’un téléconseiller reste hors de la liste d’un autre appelant', async ({
    page,
    browser,
  }) => {
    const fiche = await semerFiche('perimetre');
    // La liste range le prénom devant le nom, la console l'inverse : deux écrans,
    // deux usages, et le lien se vise sur ce que la liste écrit.
    const dansLaListe = `${fiche.prenom} ${fiche.patronyme}`;

    await page.goto(`${LISTE}?search=${fiche.patronyme}`);
    await expect(page.getByRole('link', { name: dansLaListe })).toHaveCount(1);

    const autre = await browser.newContext({ storageState: compteDe('CHARGE_CLIENTELE').etat });
    const sien = await autre.newPage();
    await sien.goto(`${LISTE}?search=${fiche.patronyme}`);
    await expect(
      sien.getByRole('status').filter({ hasText: 'Prospects affichés' }),
      `${dansLaListe} appartient à ${compte.nom} : personne d’autre ne l’appelle`,
    ).toHaveText(/Aucun résultat/u);
    await expect(sien.getByRole('link', { name: dansLaListe })).toHaveCount(0);
    await autre.close();
  });

  test('modifier une fiche depuis la liste la réécrit en base', async ({ page }) => {
    const fiche = await semerFiche('edition');
    const corrige = `Aminata ${marque()}`;

    await page.goto(`${LISTE}?search=${fiche.patronyme}`);
    await page
      .getByRole('button', { name: `Actions pour ${fiche.prenom} ${fiche.patronyme}` })
      .click();
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    const dialogue = page.getByRole('dialog');
    await expect(dialogue.getByText(`Saisi par ${compte.nom}.`)).toBeVisible();
    await dialogue.getByRole('textbox', { name: /^Prénom/u }).fill(corrige);
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText(`${corrige} ${fiche.patronyme} enregistré.`)).toBeVisible();
    await avecBase(async (client) => {
      const { rows } = await client.query<{ prenom: string }>(
        'SELECT prenom FROM prospects WHERE id = $1',
        [fiche.id],
      );
      expect(rows[0]?.prenom, 'la correction doit survivre à la fermeture du dialogue').toBe(
        corrige,
      );
    });
  });
});

test.describe('parcours 7, la supervision ne touche pas aux fiches', () => {
  test.use({ storageState: compteDe('SUPERVISEUR').etat });

  test('aucun geste de ligne, mais la liste rend son contenu', async ({ page }) => {
    await page.goto(LISTE);
    await expect(page.getByRole('columnheader', { name: 'Nom' }).first()).toBeVisible();

    await expect(
      page.getByRole('button', { name: /^Actions pour /u }),
      'la supervision ne dispose d’aucun geste de ligne',
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nouveau prospect' })).toHaveCount(0);
  });

  test('la supervision garde l’export de la vue filtrée', async ({ page }) => {
    await page.goto(LISTE);
    await expect(page.getByRole('link', { name: 'Exporter la vue filtrée' })).toBeVisible();
  });
});
