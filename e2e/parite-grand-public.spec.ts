import { randomUUID } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { avecBase, BASE_URL, compteDe } from './comptes';
import {
  choisirDansListe,
  effacerFiches,
  marque,
  sansDebordementHorizontal,
} from './donnees-chues';
import { apiDe, ligne } from './donnees-listes';

/**
 * Parité v1 → v2 de l'espace Grand Public : ce qu'exigeaient `grand-public-*.spec.ts`
 * et `accessibilite-grand-public.spec.ts` de la v1 (commit 782cb997), rejoué sur
 * les écrans du binaire Go.
 */

const admin = compteDe('ADMIN');
const teleconseiller = compteDe('COMMERCIAL');
const superviseur = compteDe('SUPERVISEUR');

const PRENOM = 'E2E gp';
const cleListe = marque();
const cleFiche = marque();
const cleSaisie = marque();
const METIER = `Menuisière ${cleFiche}`;
const SAISIE = '/grand-public/nouveau';
const CHIFFRES = '/grand-public/statistiques';
const USINE = 'Taux de joignabilité des prospects';

/** Plage réservée à ce parcours : +221 78 111 00 00 à 69. */
const tel = (rang: number): string => `+2217811100${String(rang).padStart(2, '0')}`;
const affiche = (rang: number): string => `+221 78 111 00 ${String(rang).padStart(2, '0')}`;
const PLAGE = Array.from({ length: 70 }, (_, rang) => tel(rang));

/** Une page pleine (25), plus une : la seconde page existe pour de bon. */
const TEMOINS = 26;

const fiches: Record<string, string> = {};

/** Le lien public porte le compte qui l'a partagé, et l'API l'exige en UUID. */
let jetonPublic = '';

const voir = (cible: Locator): Promise<void> => expect(cible).toBeVisible();
const absent = (cible: Locator): Promise<void> => expect(cible).toHaveCount(0);
const bouton = (page: Page | Locator, nom: string, exact = false): Locator =>
  page.getByRole('button', { name: nom, exact });
const lien = (page: Page, nom: string): Locator => page.getByRole('link', { name: nom });
const titre = (page: Page, nom: string, level: 1 | 2): Locator =>
  page.getByRole('heading', { name: nom, level });
const compteur = (page: Page): Locator =>
  page.getByRole('status').filter({ hasText: 'Prospects affichés' });
const carte = (page: Page, nom: string): Locator =>
  page.getByRole('group', { name: `${nom}, graphique` });
const champ = (page: Page, libelle: RegExp): Locator =>
  page.getByRole('textbox', { name: libelle });

/** La valeur d'une ligne de fiche, liée à son libellé par la paire dt / dd. */
const valeur = (page: Page, libelle: string): Locator =>
  page.getByRole('term').filter({ hasText: libelle }).locator('xpath=following-sibling::dd[1]');

async function saisirIdentite(page: Page, nom: string, rang: number): Promise<void> {
  await champ(page, /^Prénom/u).fill(PRENOM);
  await champ(page, /^Nom/u).fill(nom);
  await champ(page, /^Téléphone/u).fill(tel(rang).slice(4));
}

async function creer(api: APIRequestContext, corps: Record<string, unknown>): Promise<string> {
  const reponse = await api.post('/api/v1/prospects', {
    data: { projet: 'GRAND_PUBLIC', prenom: PRENOM, ...corps },
  });
  if (!reponse.ok()) {
    throw new Error(`création refusée : ${String(reponse.status())} ${await reponse.text()}`);
  }
  return ((await reponse.json()) as { id: string }).id;
}

async function fichesSurLeNumero(phoneE164: string): Promise<number> {
  const lu = await ligne<{ n: string }>(
    'SELECT count(*)::text AS n FROM prospects WHERE "phoneE164" = $1 AND "deletedAt" IS NULL',
    [phoneE164],
  );
  return Number(lu?.n ?? '0');
}

test.beforeAll(async () => {
  await effacerFiches(PLAGE);
  const semis = await ligne<{ agent: string; canal: string; banque: string; syndicat: string }>(
    `SELECT (SELECT id FROM users WHERE role = 'COMMERCIAL' AND "isActive" AND "deletedAt" IS NULL
               AND id ~ '^[0-9a-f]{8}-' ORDER BY id LIMIT 1) AS agent,
            (SELECT id FROM canaux_provenance WHERE label = 'TikTok') AS canal,
            (SELECT id FROM banques WHERE "shortName" = 'CBAO') AS banque,
            (SELECT id FROM syndicats WHERE sigle = 'CHUES') AS syndicat`,
    [],
  );
  if (semis === null || semis.agent === null) throw new Error('base non semée : rejouer `make db`');
  jetonPublic = semis.agent;

  const api = await apiDe('ADMIN', '198.51.100.110');
  try {
    for (let rang = 1; rang <= TEMOINS; rang += 1) {
      const deux = String(rang).padStart(2, '0');
      await creer(api, { nom: `Temoin${deux} ${cleListe}`, phone: tel(rang) });
    }
    const complete = { type: 'FONCTIONNAIRE', profession: METIER, paymentMode: 'ECHELONNE' };
    const rattachee = { canalProvenanceId: semis.canal, banqueId: semis.banque };
    fiches.complete = await creer(api, {
      nom: `Complete ${cleFiche}`,
      phone: tel(30),
      dureeSystemeMois: 60,
      syndicatId: semis.syndicat,
      ...complete,
      ...rattachee,
    });
    fiches.minimale = await creer(api, { nom: `Minimale ${cleFiche}`, phone: tel(31) });
    fiches.parcours = await creer(api, { nom: `Parcours ${cleFiche}`, phone: tel(32) });
    fiches.chues = await creer(api, { nom: `Chues ${cleFiche}`, phone: tel(33), projet: 'CHUES' });
    fiches.rappel = await creer(api, { nom: `Rappel ${cleFiche}`, phone: tel(40) });
    fiches.rappelChues = await creer(api, {
      nom: `RapChues ${cleFiche}`,
      phone: tel(41),
      projet: 'CHUES',
    });
    await avecBase(async (client) => {
      for (const cle of ['rappel', 'rappelChues']) {
        await client.query(
          `INSERT INTO scheduled_callbacks (id, "prospectId", "assignedToId", "scheduledAt",
             comment, "sourceAttemptId", "updatedAt")
           VALUES ($1, $2, $3, now() + interval '3 days', $4, $5, now())`,
          [randomUUID(), fiches[cle], teleconseiller.id, `Promis ${cleFiche}`, randomUUID()],
        );
      }
    });
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  await effacerFiches(PLAGE);
  await avecBase(async (client) => {
    await client.query('DELETE FROM dashboard_layouts WHERE "userId" = $1', [superviseur.id]);
  });
});

test.describe('parité Grand Public, vue de l’administrateur', () => {
  test.use({ storageState: admin.etat });

  test('la liste : colonnes, compteur, seconde page, numéro cherché, filtres et état vide', async ({
    page,
  }) => {
    await page.goto(`/grand-public?search=${cleListe}`);
    await expect(page).toHaveTitle(/· CPI GO$/u);
    await voir(page.getByText('Les particuliers démarchés hors syndicat.', { exact: false }));
    const colonnes = 'Nom|Statut|Situation|Profession|Canal|Banque|Segment|Téléconseiller|Saisi le';
    for (const colonne of colonnes.split('|')) {
      await voir(page.getByRole('columnheader', { name: colonne, exact: true }));
    }
    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–25 sur 26$/u);
    await expect(bouton(page, 'Page précédente')).toBeDisabled();
    await bouton(page, 'Page suivante').click();
    await expect(page).toHaveURL(/page=2/u);
    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*26–26 sur 26$/u);
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
    await expect(bouton(page, 'Page suivante')).toBeDisabled();

    await page.goto(`/grand-public?search=${encodeURIComponent(tel(1))}`);
    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–1 sur 1$/u);
    await voir(lien(page, `${PRENOM} Temoin01 ${cleListe} ${affiche(1)}`));

    await page.goto('/grand-public');
    await bouton(page, 'Filtres', true).click();
    const nouveau = bouton(page.getByRole('group', { name: 'Statut' }), 'Nouveau', true);
    await nouveau.click();
    await expect(page).toHaveURL(/\/grand-public\?statut=NOUVEAU$/u);
    await expect(nouveau).toHaveAttribute('aria-pressed', 'true');
    await voir(bouton(page, 'Filtres (1)'));
    // Le filtre a filtré : hors l'en-tête, aucune ligne ne porte un autre statut.
    await expect(page.getByRole('row').filter({ hasNotText: 'Nouveau' })).toHaveCount(1);
    await page.getByLabel('Saisi à partir du').fill('2020-01-01');
    await expect(page).toHaveURL(/dateFrom=2020-01-01/u);
    await voir(bouton(page, 'Filtres (2)'));
    await page.reload();
    await expect(page.getByLabel('Saisi à partir du')).toHaveValue('2020-01-01');
    await bouton(page, 'Tout effacer').click();
    await expect(page).toHaveURL(/\/grand-public$/u);
    await expect(nouveau).toHaveAttribute('aria-pressed', 'false');

    await page.goto('/grand-public?search=zzz-personne-ne-porte-ce-nom');
    await voir(page.getByText('Aucun prospect ne correspond à ces filtres.'));
    await voir(page.getByText('Élargissez la période ou retirez un critère.'));
    await absent(page.getByText('Aucun prospect Grand Public n’a encore été saisi.'));
  });

  test('une panne du référentiel des canaux se dit à l’écran sans emporter la liste', async ({
    page,
  }) => {
    // Seul moyen de provoquer l'état : le référentiel ne tombe pas sur commande.
    await page.route('**/api/v1/referentiels/canaux-provenance*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/grand-public');

    await voir(page.getByRole('table'));
    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–\d+ sur \d+$/u);
    await voir(
      page
        .getByRole('alert')
        .filter({ hasText: 'La liste des canaux de provenance n’a pas pu être chargée.' }),
    );
    await bouton(page, 'Filtres', true).click();
    await voir(bouton(page, 'Canal de provenance'));
  });

  test('la saisie : canal et durée gardés, Ctrl + Entrée, fiche ouverte, doublon refusé', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      const creation = requete.method() === 'POST' && requete.url().includes('/api/v1/prospects');
      if (creation) envois.push(requete.url());
    });

    await page.goto(SAISIE);
    await bouton(page, 'Enregistrer et suivant').click();
    await voir(page.getByText('Le prénom est obligatoire.'));
    await voir(page.getByText('Le nom est obligatoire.'));
    await voir(page.getByText('Le numéro est obligatoire.'));
    expect(envois, 'aucune création ne part sans nom ni téléphone').toEqual([]);

    await saisirIdentite(page, `Rafale ${cleSaisie}`, 60);
    await bouton(page, 'Canal de provenance').click();
    await page.getByRole('option', { name: 'TikTok', exact: true }).click();
    await choisirDansListe(page.getByLabel('Paiement'), 'Échelonné');
    await choisirDansListe(page.getByLabel('Durée de remboursement'), '5 ans (60 mois)');
    await bouton(page, 'Enregistrer et suivant').click();
    await voir(page.getByText(`${PRENOM} Rafale ${cleSaisie} enregistré.`));
    await voir(page.getByText(`1 prospect enregistré. Dernier : ${PRENOM} Rafale ${cleSaisie}.`));
    await expect(champ(page, /^Prénom/u)).toHaveValue('');
    // Ce que l'aide promet : le canal et la durée restent d'une saisie à l'autre.
    await voir(bouton(page, 'Canal de provenance TikTok'));
    await voir(page.getByLabel('Durée de remboursement'));

    await saisirIdentite(page, `Clavier ${cleSaisie}`, 61);
    await page.keyboard.press('Control+Enter');
    await voir(
      page.getByText(`2 prospects enregistrés. Dernier : ${PRENOM} Clavier ${cleSaisie}.`),
    );
    const enregistre = await ligne<{ duree: number; canal: string | null; projet: string }>(
      `SELECT p."dureeSystemeMois" AS duree, p."canalProvenanceId" AS canal, j.projet::text AS projet
         FROM prospects p JOIN prospect_journeys j ON j."prospectId" = p.id
        WHERE p."phoneE164" = $1`,
      [tel(61)],
    );
    expect(enregistre?.projet, 'la saisie ouvre le parcours Grand Public').toBe('GRAND_PUBLIC');
    expect(enregistre?.duree, 'la durée suit la rafale').toBe(60);
    expect(enregistre?.canal, 'le canal suit la rafale').not.toBeNull();

    // Le toast se pose SUR les boutons et reste tant que le pointeur le survole :
    // on écarte la souris, puis on attend sa disparition.
    await page.mouse.move(0, 0);
    await expect(page.getByText(`${PRENOM} Clavier ${cleSaisie} enregistré.`)).toBeHidden();

    await saisirIdentite(page, `Doublon ${cleSaisie}`, 30);
    await bouton(page, 'Enregistrer et suivant').click();
    const refus = page.getByRole('alert').filter({ hasText: 'Ce numéro est déjà celui de' });
    await expect(refus).toContainText(
      `Ce numéro est déjà celui de ${PRENOM} Complete ${cleFiche}.`,
    );
    await expect(refus).toContainText(`Saisi par le téléconseiller ${admin.nom}`);
    await voir(lien(page, 'Ouvrir cette fiche'));
    expect(await fichesSurLeNumero(tel(30)), 'aucune seconde fiche sur ce numéro').toBe(1);

    const accents = `O’Brien-Ndèye ${cleSaisie}`;
    await saisirIdentite(page, accents, 62);
    await bouton(page, 'Enregistrer et ouvrir la fiche').click();
    await page.waitForURL(/\/grand-public\/[0-9a-f-]{36}$/u);
    await voir(titre(page, `${PRENOM} ${accents}`, 1));
    await expect(lien(page, affiche(62))).toHaveAttribute('href', `tel:${tel(62)}`);
  });

  test('la fiche : trois cartes, le statut de la liste, les absences nommées, le cloisonnement', async ({
    page,
  }) => {
    await page.goto(`/grand-public?search=${encodeURIComponent(tel(30))}`);
    const ligneListe = page.getByRole('row').filter({ hasText: `Complete ${cleFiche}` });
    await expect(ligneListe.getByRole('cell').nth(1)).toHaveText('Nouveau');
    await ligneListe.getByRole('link').first().click();
    await page.waitForURL(`**/grand-public/${fiches.complete ?? ''}`);

    await voir(titre(page, `${PRENOM} Complete ${cleFiche}`, 1));
    for (const nom of ['Le prospect', 'Rattachements', 'Suivi']) {
      await voir(page.getByText(nom, { exact: true }));
    }
    for (const [libelle, attendu] of [
      ['Situation', 'Fonctionnaire'],
      ['Profession', METIER],
      ['Canal de provenance', 'TikTok'],
      ['Durée du système', '5 ans (60 mois)'],
      ['Banque de domiciliation', 'CBAO'],
      ['Syndicat', 'CHUES'],
      ['Représentant', 'Sans représentant'],
      ['Téléconseiller', admin.nom],
    ] as const) {
      await expect(valeur(page, libelle), `${libelle} vaut ${attendu}`).toContainText(attendu);
    }
    await expect(lien(page, affiche(30))).toHaveAttribute('href', `tel:${tel(30)}`);
    await voir(lien(page, 'Prospects Grand Public'));

    await page.goto(`/grand-public/${fiches.minimale ?? ''}`);
    await expect(valeur(page, 'Situation')).toHaveText('Question non posée');
    await expect(valeur(page, 'Durée du système')).toHaveText('Non renseignée');
    await expect(valeur(page, 'Segment')).toContainText('Aucun');
    await expect(valeur(page, 'Dernier appel')).toHaveText('Jamais appelé');

    await page.goto(`/grand-public/${fiches.chues ?? ''}`);
    await voir(titre(page, 'Cette fiche relève du projet CHUES', 1));
    await voir(lien(page, 'Ouvrir le suivi CHUES'));
    await absent(bouton(page, 'Intéressé'));

    await page.goto(`/grand-public/${randomUUID()}`);
    await expect(page.getByRole('alert')).toContainText('Introuvable');
    await voir(page.getByRole('navigation', { name: 'Navigation principale' }));
  });

  test('le consentement bascule en base, la conversion fige la fiche', async ({ page }) => {
    const relire = async (): Promise<Record<string, unknown> | null> =>
      ligne(
        `SELECT j.consent::text AS consent, j.statut::text AS statut,
                (j."convertedAt" IS NOT NULL) AS converti, o.label AS offre
           FROM prospect_journeys j
           LEFT JOIN prospect_conversions c ON c."journeyId" = j.id
           LEFT JOIN offers o ON o.id = c."offerId"
          WHERE j."prospectId" = $1 AND j.projet = 'GRAND_PUBLIC'`,
        [fiches.parcours],
      );

    await page.goto(`/grand-public/${fiches.parcours ?? ''}`);
    const interesse = bouton(page, 'Intéressé');
    const refuse = bouton(page, 'Refusé');
    const conversion = bouton(page, 'Confirmer la conversion');

    await interesse.click();
    await voir(page.getByText('Consentement enregistré.'));
    await voir(conversion);
    await refuse.click();
    await absent(conversion);
    expect((await relire())?.consent, 'le refus doit être écrit en base').toBe('REFUSE');

    await interesse.click();
    await conversion.click();
    const boite = page.getByRole('dialog', { name: 'Confirmer la conversion' });
    await choisirDansListe(boite.getByLabel('Offre'), 'Adhésion');
    await bouton(boite, 'Confirmer', true).click();

    await voir(page.getByText('Conversion confirmée.'));
    await voir(page.getByText('Converti', { exact: true }));
    for (const geste of [interesse, refuse, conversion]) await absent(geste);
    const apres = await relire();
    expect(apres?.statut).toBe('CONVERTI');
    expect(apres?.converti, 'la date de conversion est posée').toBe(true);
    expect(apres?.offre, 'l’offre retenue voyage jusqu’à la conversion').toBe('Adhésion');
  });

  const AXE: readonly [string, () => string, (page: Page) => Locator][] = [
    [
      'la liste',
      () => '/grand-public',
      (page) => page.getByRole('columnheader', { name: 'Segment' }),
    ],
    ['la saisie', () => SAISIE, (page) => titre(page, 'Nouveau prospect Grand Public', 1)],
    [
      'la console',
      () => '/grand-public/console',
      (page) => page.getByLabel('Quel prospect avez-vous appelé ?'),
    ],
    [
      'les rappels',
      () => '/grand-public/rappels',
      (page) => page.getByRole('tab', { name: /^En retard/u }),
    ],
    ['les chiffres', () => CHIFFRES, (page) => bouton(page, 'Composer l’écran')],
    [
      'la fiche',
      () => `/grand-public/${fiches.complete ?? ''}`,
      (page) => page.getByText('Rattachements'),
    ],
  ];

  for (const [ou, chemin, repere] of AXE) {
    test(`aucune violation axe sur ${ou}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(chemin());
      await voir(repere(page).first());
      await page.addStyleTag({ content: '* { animation: none !important; transition: none }' });

      const analyse = await new AxeBuilder({ page }).analyze();
      expect(analyse.violations, JSON.stringify(analyse.violations)).toEqual([]);
    });
  }
});

test.describe('parité Grand Public, vue du téléconseiller', () => {
  test.use({ storageState: teleconseiller.etat });

  test('la console renvoie vers la saisie, la file des rappels ignore le CHUES et s’annule', async ({
    page,
  }) => {
    await page.goto('/grand-public/console');
    await expect(page).toHaveTitle('Appeler les prospects · CPI GO');
    const recherche = page.getByLabel('Quel prospect avez-vous appelé ?');
    await expect(recherche, 'le curseur attend le nom sans un clic de plus').toBeFocused();
    await recherche.fill('zzz-personne-ne-porte-ce-nom');
    await voir(page.getByText('Aucun résultat. Vérifiez le nom ou le numéro.'));
    await expect(lien(page, 'Ajouter un prospect')).toHaveAttribute('href', SAISIE);

    await page.goto('/grand-public/rappels');
    await voir(titre(page, 'Aucun rappel en retard', 2));
    await page.getByRole('tab', { name: 'Aujourd’hui' }).click();
    await voir(titre(page, 'Aucun rappel aujourd’hui', 2));
    await page.getByRole('tab', { name: 'Cette semaine' }).click();
    const rappel = page.getByRole('row').filter({ hasText: affiche(40) });
    await expect(rappel).toHaveCount(1);
    await expect(rappel, 'la file nomme le prospect, pas seulement son numéro').toContainText(
      `${PRENOM} Rappel ${cleFiche}`,
    );
    // Le rappel CHUES est promis par le MÊME téléconseiller, à la MÊME échéance :
    // seul le projet le distingue.
    await absent(page.getByRole('row').filter({ hasText: affiche(41) }));
    await absent(page.getByLabel('Téléconseiller'));

    await bouton(rappel, 'Annuler').click();
    await voir(page.getByText('Rappel annulé.', { exact: true }));
    await voir(titre(page, 'Aucun rappel cette semaine', 2));
    const annule = await ligne<{ status: string }>(
      'SELECT status::text AS status FROM scheduled_callbacks WHERE "prospectId" = $1',
      [fiches.rappel],
    );
    expect(annule?.status, 'l’annulation doit être écrite en base').toBe('CANCELLED');
  });
});

test.describe('parité Grand Public, vue de la supervision', () => {
  test.use({ storageState: superviseur.etat });

  test('elle lit la liste et la fiche sans geste, n’entre ni dans la saisie ni dans la console', async ({
    page,
  }) => {
    const metier: string[] = [];
    page.on('response', (reponse) => {
      const chemin = new URL(reponse.url()).pathname;
      const cible =
        chemin.startsWith('/api/v1/prospects') || chemin.startsWith('/api/v1/referentiels');
      if (cible && reponse.status() < 400) metier.push(chemin);
    });

    await page.goto('/grand-public');
    await voir(titre(page, 'Prospects Grand Public', 1));
    await absent(bouton(page, 'Nouveau prospect'));

    await page.goto(`/grand-public/${fiches.complete ?? ''}`);
    await expect(valeur(page, 'Situation')).toHaveText('Fonctionnaire');
    for (const geste of ['Modifier', 'Intéressé', 'Refusé', 'Confirmer la conversion']) {
      await absent(bouton(page, geste));
    }

    metier.length = 0;
    await page.goto(SAISIE);
    await voir(titre(page, 'Accès refusé', 2));
    await voir(
      page.getByText('Cet écran est réservé à un autre rôle. Rôle en cours : Supervision.'),
    );
    await voir(lien(page, 'Retour à l’accueil'));
    expect(metier, 'un écran refusé ne charge aucune donnée métier').toEqual([]);

    await page.goto('/grand-public/console');
    await voir(titre(page, 'Accès refusé', 2));
    await absent(page.getByLabel('Quel prospect avez-vous appelé ?'));

    await page.goto('/grand-public/rappels');
    await voir(page.getByLabel('Téléconseiller'));
  });

  test('les chiffres : cartes d’usine, période dans l’URL, composition, montants réservés', async ({
    page,
  }) => {
    await page.goto(CHIFFRES);
    await voir(carte(page, USINE));
    await voir(carte(page, 'Prospects saisis'));
    // Le libellé du tableau de bord des VISITES n'a rien à faire ici.
    await absent(bouton(page, 'Organiser les graphiques'));

    const periode = page.getByRole('group', { name: 'Période affichée' });
    await bouton(periode, 'Mois dernier').click();
    await expect(page).toHaveURL(/periode=mois-dernier/u);
    await page.reload();
    await expect(bouton(periode, 'Mois dernier')).toHaveAttribute('aria-pressed', 'true');

    await bouton(page, 'Composer l’écran').click();
    await voir(page.getByText('Mode organisation'));
    await voir(bouton(page, 'Enregistrer'));
    await voir(bouton(page, 'Quitter'));
    await expect(
      bouton(page, 'Proposer par défaut'),
      'un SUPERVISEUR ne fixe pas la disposition de tous',
    ).toHaveCount(0);

    await bouton(page, 'Ajouter un graphique').click();
    const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
    for (const montant of ['Encaissé', 'De l’appel à l’encaissement']) {
      await expect(
        tiroir.getByRole('article').filter({ hasText: montant }),
        `${montant} est réservé à l’ADMIN et à la DIRECTION`,
      ).toHaveCount(0);
    }
  });

  test('une carte ajoutée survit au rechargement, le retour à l’écran par défaut l’efface', async ({
    page,
  }) => {
    const ajoutee = 'Par banque';
    await page.goto(CHIFFRES);
    await bouton(page, 'Composer l’écran').click();
    await bouton(page, 'Ajouter un graphique').click();
    const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
    await bouton(tiroir.getByRole('article').filter({ hasText: ajoutee }), 'Ajouter', true).click();
    await page.keyboard.press('Escape');
    const ecriture = page.waitForResponse(
      (reponse) => reponse.request().method() === 'PUT' && reponse.url().includes('/disposition'),
    );
    await bouton(page, 'Enregistrer').click();
    expect((await ecriture).ok(), 'la disposition doit être écrite avant de recharger').toBe(true);
    await page.reload();
    await voir(carte(page, ajoutee));

    await bouton(page, 'Revenir à l’écran par défaut').click();
    // Le bouton s'efface quand l'effacement est revenu du serveur : recharger avant le perdrait.
    await absent(bouton(page, 'Revenir à l’écran par défaut'));
    await page.reload();
    await voir(carte(page, USINE));
    await absent(carte(page, ajoutee));
    await absent(bouton(page, 'Revenir à l’écran par défaut'));
  });

  test.fixme('les chiffres disent leur fraîcheur et se mettent en pause en composition : la v2 n’a ni indicateur ni pause (GP-34, GP-35)', async ({
    page,
  }) => {
    await page.goto(CHIFFRES);
    await voir(bouton(page, 'Mettre en pause'));
  });
});

test.describe('parité Grand Public, en 390 px', () => {
  test.use({ storageState: admin.etat, viewport: { width: 390, height: 844 }, isMobile: true });

  test('la liste et la saisie tiennent dans l’écran du téléphone', async ({ page }) => {
    await page.goto(`/grand-public?search=${cleListe}`);
    await voir(compteur(page));
    await sansDebordementHorizontal(page);

    await page.goto(SAISIE);
    const prenom = await champ(page, /^Prénom/u).boundingBox();
    const nom = await champ(page, /^Nom/u).boundingBox();
    expect(nom?.y ?? 0, 'sous 640 px la grille passe en une colonne').toBeGreaterThan(
      prenom?.y ?? 0,
    );
    await voir(bouton(page, 'Enregistrer et ouvrir la fiche'));
    await sansDebordementHorizontal(page);
  });
});

test.describe('parité Grand Public, le formulaire public', () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.118' },
  });

  test('la page se compose sans compte, et rien ne s’écrit sans vérification anti-robot', async ({
    page,
  }) => {
    await page.goto(`/demande/${jetonPublic}`);
    await voir(page.getByRole('alert').filter({ hasText: 'vérification anti-robot' }));
    await voir(page.getByText('Étape 1 sur 2'));
    await voir(page.getByRole('group', { name: 'Vos coordonnées' }));

    await bouton(page, 'Suivant').click();
    await voir(page.getByRole('alert').filter({ hasText: 'Vérifiez les champs signalés.' }));
    await champ(page, /^Nom/u).fill(`Public ${cleFiche}`);
    await champ(page, /^Prénom/u).fill(PRENOM);
    await champ(page, /^Téléphone/u).fill(tel(50));
    await bouton(page, 'Suivant').click();
    await voir(page.getByText('Étape 2 sur 2'));
    await voir(bouton(page, 'Vérifier ma demande'));

    // Sans TURNSTILE_SECRET_KEY et sans mode dégradé, l'écriture publique est
    // fermée : 503 CAPTCHA_INDISPONIBLE, puis 429 au-delà de cinq envois.
    const corps = { nom: `Limite ${cleFiche}`, prenom: PRENOM, phone: tel(51) };
    const statuts: number[] = [];
    for (let envoi = 0; envoi < 6; envoi += 1) {
      const reponse = await page.request.post(`/api/v1/formulaire-public/${jetonPublic}`, {
        data: corps,
        headers: { Origin: BASE_URL, 'X-Forwarded-For': '198.51.100.119' },
      });
      statuts.push(reponse.status());
    }
    expect(statuts.slice(0, 5), 'aucun envoi ne passe sans vérification').toEqual([
      503, 503, 503, 503, 503,
    ]);
    expect(statuts[5], 'le limiteur ferme la porte au sixième envoi').toBe(429);
    expect(await fichesSurLeNumero(tel(51)), 'aucune fiche écrite sans vérification').toBe(0);
  });
});
