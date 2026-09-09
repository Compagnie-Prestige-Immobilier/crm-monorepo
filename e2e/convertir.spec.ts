import { existsSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

import { chromium, expect, test, type Page } from '@playwright/test';

import { avecBase, BASE_URL, compteDe } from './comptes';
import {
  choisirDansListe,
  effacerFiches,
  marque,
  sansDebordementHorizontal,
  semerProspect,
  type FicheSemee,
} from './donnees-chues';

const compte = compteDe('COMMERCIAL');
const CONSOLE = '/chues/console';

/** `NOTE_VOCALE_DIR` par defaut, relatif au repertoire d'ou le serveur est lance. */
const NOTES = path.join(__dirname, 'storage', 'notes-vocales');

const MICRO_FEINT = {
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
};

const telephones: string[] = [];
const fichiersNotes: string[] = [];

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
  outcome: string;
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
      `SELECT a.id AS "attemptId", a.outcome::text AS outcome, a.method::text AS method, a.email,
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

async function ouvrirFiche(page: Page, fiche: FicheSemee): Promise<void> {
  await page.goto(CONSOLE);
  await page.getByLabel('Quel prospect avez-vous appelé ?').fill(fiche.nom);
  await page.getByRole('button', { name: fiche.nom }).click();
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Phase 3 · Conversion' })).toHaveCount(0);
}

/** La touche du raccourci entre dans le nom du bouton, sauf en 390 px. */
function issue(page: Page, libelle: RegExp) {
  return page
    .getByRole('group', { name: 'Comment s’est passé l’appel ?' })
    .getByRole('button', { name: libelle });
}

const consigne = (page: Page, nom: string) =>
  page.getByRole('status').filter({ hasText: `Appel enregistré pour ${nom}.` });

const groupe = (page: Page, legende: string) => page.getByRole('group', { name: legende });

async function remplirDossier(
  page: Page,
  dossier: { profession: string; email: string; methode: string },
): Promise<void> {
  await page.getByRole('textbox', { name: /^Profession/u }).fill(dossier.profession);
  await page.getByRole('spinbutton', { name: /^Durée dans la fonction/u }).fill('84');
  await groupe(page, 'Fonctionnaire').getByRole('radio', { name: 'Oui' }).check();
  await groupe(page, 'Ce numéro est-il un numéro WhatsApp ?')
    .getByRole('radio', { name: 'Oui' })
    .check();
  await page.getByRole('textbox', { name: /^E-mail/u }).fill(dossier.email);
  // Le dossier de conversion nomme syndicat et banque par leur sigle.
  await choisirDansListe(page.getByRole('combobox', { name: /^Syndicat/u }), 'CUSEMS');
  await choisirDansListe(page.getByRole('combobox', { name: /^Banque/u }), 'CBAO');
  await groupe(page, 'Engagement en cours à la banque').getByRole('radio', { name: 'Non' }).check();
  await choisirDansListe(
    page.getByRole('combobox', { name: /^Revenu mensuel/u }),
    'Moins de 50 000 F CFA',
  );
  await groupe(page, 'Méthode d’enrôlement').getByRole('radio', { name: dossier.methode }).check();
}

/** Deux jours plus tard a 10 h de Dakar, que le serveur lit en UTC. */
function rendezVousProchain(): string {
  const jour = new Date(Date.now() + 2 * 86_400_000);
  return `${jour.toISOString().slice(0, 10)}T10:00`;
}

// Un micro feint pour tout le fichier : `launchOptions` ne se change pas par
// groupe, le cas « sans micro » ouvre donc son propre navigateur.
test.use({ storageState: compte.etat, launchOptions: MICRO_FEINT });

test.afterAll(async () => {
  for (const fichier of fichiersNotes) rmSync(fichier, { force: true });
  await effacerFiches(telephones);
});

test.describe('parcours 5, convertir un prospect', () => {
  test('le dossier, le rendez-vous et la note vocale survivent a l’enregistrement', async ({
    page,
  }) => {
    const fiche = await semer('Conversion');
    const suffixe = marque();
    const profession = `Instituteur ${suffixe}`;
    const email = `awa.${suffixe}@ecole.sn`;
    const commentaire = `Rendez-vous pris au bureau ${suffixe}`;
    const rendezVous = rendezVousProchain();

    await ouvrirFiche(page, fiche);
    await issue(page, /(^|\s)Joignable$/u).click();
    await remplirDossier(page, { profession, email, methode: 'RDV CPI' });
    await page.getByLabel(/^Date et heure du rendez-vous/u).fill(rendezVous);
    await page.getByLabel('Commentaire').fill(commentaire);

    await page.getByRole('button', { name: 'Note vocale' }).click();
    await expect(page.getByRole('button', { name: 'Arrêter (00:01)' })).toBeVisible();
    await page.getByRole('button', { name: /^Arrêter/u }).click();
    await expect(page.getByText('Note vocale de 00:01, envoyée avec l’appel.')).toBeVisible();

    await page.getByRole('button', { name: 'Enregistrer l’adhésion' }).click();
    await expect(consigne(page, fiche.nom)).toBeVisible();

    const conversion = await lireConversion(fiche.id);
    expect(conversion.outcome).toBe('METHOD_OBTAINED');
    expect(conversion.method).toBe('APPOINTMENT');
    expect(conversion.email).toBe(email);
    expect(conversion.fonctionnaire).toBe(true);
    expect(conversion.engagementEnCours).toBe(false);
    expect(conversion.dureeEtablissementMois).toBe(84);
    expect(conversion.comment).toBe(commentaire);
    expect(conversion.rendezVousAt?.toISOString()).toBe(`${rendezVous}:00.000Z`);
    expect(conversion.profession).toBe(profession);
    expect(conversion.phase2Status).toBe('METHOD_OBTAINED');
    expect(conversion.parcoursStatut).toBe('METHOD_OBTAINED');
    expect(conversion.enrollmentMethod).toBe('APPOINTMENT');
    expect(conversion.banqueName).toContain('CBAO');
    expect(conversion.incomeBandLabel).toBe('Moins de 50 000 F CFA');

    const fichier = path.join(NOTES, `${conversion.attemptId}.audio`);
    fichiersNotes.push(fichier);
    await expect
      .poll(() => existsSync(fichier), { message: 'la note vocale est posee sur le disque' })
      .toBe(true);
    expect(statSync(fichier).size).toBeGreaterThan(0);

    const relecture = await page.request.get(
      `/api/v1/phase2/call-attempts/${conversion.attemptId}/note-vocale`,
    );
    expect(relecture.status()).toBe(200);
    expect(relecture.headers()['content-type']).toContain('audio/');

    await page.goto(`/chues/prospects/${fiche.id}`);
    await expect(page.getByText('Méthode obtenue').first()).toBeVisible();
    await page.getByRole('list', { name: 'Histoire' }).getByText(commentaire).click();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText(profession)).toBeVisible();

    await page.getByRole('button', { name: 'Écouter la note vocale' }).click();
    await expect(page.locator('audio')).toHaveAttribute(
      'src',
      `/api/v1/phase2/call-attempts/${conversion.attemptId}/note-vocale`,
    );
  });
});

test.describe('parcours 5, sans micro', () => {
  test('le refus du micro est dit et rien n’est envoye', async () => {
    const fiche = await semer('SansMicro');
    // `args: []` efface le micro feint du fichier : Chromium se retrouve sans
    // aucun peripherique audio, comme un poste qui n'en a pas.
    const navigateur = await chromium.launch({ args: [] });
    const contexte = await navigateur.newContext({
      baseURL: BASE_URL,
      storageState: compte.etat,
    });
    const page = await contexte.newPage();
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (requete.url().includes('/api/v1/phase2/call-attempts')) envois.push(requete.url());
    });

    try {
      await ouvrirFiche(page, fiche);
      await page.getByRole('button', { name: 'Note vocale' }).click();

      await expect(
        page.getByText('Le micro n’est pas accessible. La note vocale reste indisponible ici.'),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Note vocale' })).toHaveCount(0);
      expect(envois, 'aucune note vocale ne part sans enregistrement').toHaveLength(0);

      // La fiche ne se quitte pas sans consignation : la rendre au suivant.
      await issue(page, /Injoignable$/u).click();
      await expect(consigne(page, fiche.nom)).toBeVisible();
    } finally {
      await contexte.close();
      await navigateur.close();
    }
  });
});

test.describe('parcours 5 en 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('la conversion tient dans l’ecran du telephone', async ({ page }) => {
    const fiche = await semer('Telephone');
    const suffixe = marque();

    await ouvrirFiche(page, fiche);
    await sansDebordementHorizontal(page);
    await issue(page, /(^|\s)Joignable$/u).click();

    await remplirDossier(page, {
      profession: `Professeur ${suffixe}`,
      email: `pape.${suffixe}@ecole.sn`,
      methode: 'Mail',
    });
    await page.getByRole('button', { name: 'Enregistrer l’adhésion' }).click();
    await expect(consigne(page, fiche.nom)).toBeVisible();
    await sansDebordementHorizontal(page);

    const conversion = await lireConversion(fiche.id);
    expect(conversion.method).toBe('VOICE_OR_ELECTRONIC_MESSAGING');
    expect(conversion.phase2Status).toBe('METHOD_OBTAINED');
  });
});
