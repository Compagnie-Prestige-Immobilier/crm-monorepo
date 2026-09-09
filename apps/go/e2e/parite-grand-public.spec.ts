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
 * Parité v1 → v2 de l'espace Grand Public : ce que les parcours
 * `grand-public-*.spec.ts` et `accessibilite-grand-public.spec.ts` de la v1
 * (commit 782cb997) exigeaient, rejoué sur les écrans du binaire Go.
 */

const ADRESSE_SEMIS = '198.51.100.110';
const ADRESSE_PUBLIC = '198.51.100.118';
const ADRESSE_LIMITEUR = '198.51.100.119';

const admin = compteDe('ADMIN');
const teleconseiller = compteDe('COMMERCIAL');
const superviseur = compteDe('SUPERVISEUR');

const PRENOM = 'E2E gp';
const cleListe = marque();
const cleFiche = marque();
const cleSaisie = marque();
const PROFESSION = `Menuisière ${cleFiche}`;

/** Plage réservée à ce parcours : +221 78 111 00 00 à 69. */
const tel = (rang: number): string => `+2217811100${String(rang).padStart(2, '0')}`;
const affiche = (rang: number): string => `+221 78 111 00 ${String(rang).padStart(2, '0')}`;
const national = (rang: number): string => tel(rang).slice(4);
const PLAGE = Array.from({ length: 70 }, (_, rang) => tel(rang));

/** Une page pleine (25), plus une : la seconde page existe pour de bon. */
const TEMOINS = 26;

const COLONNES = [
  'Nom',
  'Statut',
  'Situation',
  'Profession',
  'Canal',
  'Banque',
  'Segment',
  'Téléconseiller',
  'Saisi le',
];

const fiches = { complete: '', minimale: '', parcours: '', chues: '', rappel: '' };

const compteur = (page: Page) => page.getByRole('status').filter({ hasText: 'Prospects affichés' });

/** La valeur d'une ligne de fiche, liée à son libellé par la paire dt / dd. */
const valeur = (page: Page, libelle: string) =>
  page.getByRole('term').filter({ hasText: libelle }).locator('xpath=following-sibling::dd[1]');

const champ = (portee: Page | Locator, libelle: RegExp): Locator =>
  portee.getByRole('textbox', { name: libelle });

async function saisirIdentite(portee: Page, nom: string, rang: number): Promise<void> {
  await champ(portee, /^Prénom/u).fill(PRENOM);
  await champ(portee, /^Nom/u).fill(nom);
  await champ(portee, /^Téléphone/u).fill(national(rang));
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
  const compte = await ligne<{ n: string }>(
    'SELECT count(*)::text AS n FROM prospects WHERE "phoneE164" = $1 AND "deletedAt" IS NULL',
    [phoneE164],
  );
  return Number(compte?.n ?? '0');
}

interface ParcoursEnBase {
  consent: string;
  statut: string;
  converti: boolean;
  offre: string | null;
}

async function parcoursDe(prospectId: string): Promise<ParcoursEnBase | null> {
  return ligne<ParcoursEnBase>(
    `SELECT j.consent::text AS consent, j.statut::text AS statut,
            (j."convertedAt" IS NOT NULL) AS converti, o.label AS offre
       FROM prospect_journeys j
       LEFT JOIN prospect_conversions c ON c."journeyId" = j.id
       LEFT JOIN offers o ON o.id = c."offerId"
      WHERE j."prospectId" = $1 AND j.projet = 'GRAND_PUBLIC'`,
    [prospectId],
  );
}

test.beforeAll(async () => {
  await effacerFiches(PLAGE);
  const api = await apiDe('ADMIN', ADRESSE_SEMIS);
  try {
    for (let rang = 1; rang <= TEMOINS; rang += 1) {
      await creer(api, {
        nom: `Temoin${String(rang).padStart(2, '0')} ${cleListe}`,
        phone: tel(rang),
      });
    }
    const banque = await ligne<{ id: string }>('SELECT id FROM banques WHERE "shortName" = $1', [
      'CBAO',
    ]);
    const syndicat = await ligne<{ id: string }>('SELECT id FROM syndicats WHERE sigle = $1', [
      'CHUES',
    ]);
    const canal = await ligne<{ id: string }>('SELECT id FROM canaux_provenance WHERE label = $1', [
      'TikTok',
    ]);
    if (banque === null || syndicat === null || canal === null) {
      throw new Error('référentiels absents : la base n’est pas semée');
    }
    fiches.complete = await creer(api, {
      nom: `Complete ${cleFiche}`,
      phone: tel(30),
      type: 'FONCTIONNAIRE',
      profession: PROFESSION,
      canalProvenanceId: canal.id,
      banqueId: banque.id,
      syndicatId: syndicat.id,
      paymentMode: 'ECHELONNE',
      dureeSystemeMois: 60,
    });
    fiches.minimale = await creer(api, { nom: `Minimale ${cleFiche}`, phone: tel(31) });
    fiches.parcours = await creer(api, { nom: `Parcours ${cleFiche}`, phone: tel(32) });
    fiches.chues = await creer(api, {
      nom: `Chues ${cleFiche}`,
      phone: tel(33),
      projet: 'CHUES',
    });
    fiches.rappel = await creer(api, { nom: `Rappel ${cleFiche}`, phone: tel(40) });
    const rappelChues = await creer(api, {
      nom: `RappelChues ${cleFiche}`,
      phone: tel(41),
      projet: 'CHUES',
    });
    await avecBase(async (client) => {
      for (const prospectId of [fiches.rappel, rappelChues]) {
        await client.query(
          `INSERT INTO scheduled_callbacks
             (id, "prospectId", "assignedToId", "scheduledAt", comment, "sourceAttemptId", "updatedAt")
           VALUES ($1, $2, $3, now() + interval '3 days', $4, $5, now())`,
          [randomUUID(), prospectId, teleconseiller.id, `Promis ${cleFiche}`, randomUUID()],
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

test.describe('parité Grand Public, la liste', () => {
  test.use({ storageState: admin.etat });

  test('les colonnes, le compteur, la seconde page et la recherche par numéro', async ({
    page,
  }) => {
    await page.goto(`/grand-public?search=${cleListe}`);
    await expect(
      page.getByText(
        'Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.',
      ),
    ).toBeVisible();
    for (const colonne of COLONNES) {
      await expect(
        page.getByRole('columnheader', { name: colonne, exact: true }),
        `la colonne ${colonne} devrait être rendue`,
      ).toBeVisible();
    }

    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–25 sur 26$/u);
    await expect(page.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    await page.getByRole('button', { name: 'Page suivante' }).click();
    await expect(page).toHaveURL(/page=2/u);
    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*26–26 sur 26$/u);
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();

    await page.goto(`/grand-public?search=${encodeURIComponent(tel(1))}`);
    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–1 sur 1$/u);
    await expect(
      page
        .getByRole('table')
        .getByRole('link', { name: `${PRENOM} Temoin01 ${cleListe} ${affiche(1)}` }),
    ).toBeVisible();
  });

  test('les filtres se comptent, vivent dans l’URL, survivent au rechargement', async ({
    page,
  }) => {
    await page.goto('/grand-public');
    await page.getByRole('button', { name: 'Filtres', exact: true }).click();

    const statut = page.getByRole('group', { name: 'Statut' });
    await statut.getByRole('button', { name: 'Nouveau', exact: true }).click();
    await expect(page).toHaveURL(/\/grand-public\?statut=NOUVEAU$/u);
    await expect(statut.getByRole('button', { name: 'Nouveau', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Filtres (1)' })).toBeVisible();
    // Le filtre a filtré : hors l'en-tête, aucune ligne ne porte un autre statut.
    await expect(
      page.getByRole('table').getByRole('row').filter({ hasNotText: 'Nouveau' }),
    ).toHaveCount(1);

    await page.getByLabel('Saisi à partir du').fill('2020-01-01');
    await expect(page).toHaveURL(/dateFrom=2020-01-01/u);
    await expect(page.getByRole('button', { name: 'Filtres (2)' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Filtres (2)' })).toBeVisible();
    await expect(page.getByLabel('Saisi à partir du')).toHaveValue('2020-01-01');

    await page.getByRole('button', { name: 'Tout effacer' }).click();
    await expect(page).toHaveURL(/\/grand-public$/u);
    await expect(
      page
        .getByRole('group', { name: 'Statut' })
        .getByRole('button', { name: 'Nouveau', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Filtres', exact: true })).toBeVisible();
  });

  test('un filtre sans résultat le dit sans se confondre avec la liste vierge', async ({
    page,
  }) => {
    await page.goto('/grand-public?search=zzz-personne-ne-porte-ce-nom');

    await expect(page.getByText('Aucun prospect ne correspond à ces filtres.')).toBeVisible();
    await expect(page.getByText('Élargissez la période ou retirez un critère.')).toBeVisible();
    await expect(page.getByText('Aucun prospect Grand Public n’a encore été saisi.')).toHaveCount(
      0,
    );
  });

  test('une panne du référentiel des canaux ne fait pas tomber la liste', async ({ page }) => {
    await page.route('**/api/v1/referentiels/canaux-provenance*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"panne"}' }),
    );

    await page.goto('/grand-public');
    await expect(page.getByRole('table')).toBeVisible();
    await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–\d+ sur \d+$/u);
    await page.getByRole('button', { name: 'Filtres', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Canal de provenance' })).toBeVisible();
  });

  test.fixme('la panne du référentiel des canaux se dit à l’écran : la v2 rend la liste des canaux vide, sans message, là où la v1 nommait la panne (GP-10)', async ({
    page,
  }) => {
    await page.route('**/api/v1/referentiels/canaux-provenance*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"panne"}' }),
    );
    await page.goto('/grand-public');
    await expect(
      page.getByText(
        'La liste des canaux de provenance n’a pas pu être chargée. Les autres filtres restent utilisables.',
      ),
    ).toBeVisible();
  });
});

test.describe('parité Grand Public, la saisie', () => {
  test.use({ storageState: admin.etat });

  const FORMULAIRE = '/grand-public/nouveau';

  test('la saisie enchaîne : le canal et la durée restent, Ctrl + Entrée enregistre', async ({
    page,
  }) => {
    await page.goto(FORMULAIRE);
    await saisirIdentite(page, `Rafale ${cleSaisie}`, 60);
    await page.getByRole('button', { name: 'Canal de provenance' }).click();
    await page.getByRole('option', { name: 'TikTok', exact: true }).click();
    await choisirDansListe(page.getByLabel('Paiement'), 'Échelonné');
    await choisirDansListe(page.getByLabel('Durée de remboursement'), '5 ans (60 mois)');

    await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();
    await expect(page.getByText(`${PRENOM} Rafale ${cleSaisie} enregistré.`)).toBeVisible();
    await expect(
      page.getByText(`1 prospect enregistré. Dernier : ${PRENOM} Rafale ${cleSaisie}.`),
    ).toBeVisible();
    await expect(champ(page, /^Prénom/u)).toHaveValue('');
    await expect(champ(page, /^Téléphone/u)).toHaveValue('');
    // Ce que l'aide promet : le canal et la durée restent en place.
    await expect(page.getByRole('button', { name: 'Canal de provenance TikTok' })).toBeVisible();
    await expect(page.getByLabel('Durée de remboursement')).toBeVisible();

    await saisirIdentite(page, `Clavier ${cleSaisie}`, 61);
    await page.keyboard.press('Control+Enter');
    await expect(
      page.getByText(`2 prospects enregistrés. Dernier : ${PRENOM} Clavier ${cleSaisie}.`),
    ).toBeVisible();

    const enregistre = await ligne<{ duree: number; canal: string | null; projet: string }>(
      `SELECT p."dureeSystemeMois" AS duree, p."canalProvenanceId" AS canal, j.projet::text AS projet
         FROM prospects p JOIN prospect_journeys j ON j."prospectId" = p.id
        WHERE p."phoneE164" = $1`,
      [tel(61)],
    );
    expect(enregistre?.projet, 'la saisie Grand Public ouvre le parcours Grand Public').toBe(
      'GRAND_PUBLIC',
    );
    expect(enregistre?.duree, 'la durée suit la rafale').toBe(60);
    expect(enregistre?.canal, 'le canal suit la rafale').not.toBeNull();
  });

  test('un formulaire vide ne part pas, un numéro déjà pris nomme la fiche qui le porte', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'POST' && requete.url().includes('/api/v1/prospects')) {
        envois.push(requete.url());
      }
    });

    await page.goto(FORMULAIRE);
    await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();
    await expect(page.getByText('Le prénom est obligatoire.')).toBeVisible();
    await expect(page.getByText('Le nom est obligatoire.')).toBeVisible();
    await expect(page.getByText('Le numéro est obligatoire.')).toBeVisible();
    expect(envois, 'aucune création ne doit partir sans nom ni téléphone').toEqual([]);

    await saisirIdentite(page, `Doublon ${cleSaisie}`, 30);
    await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();

    const refus = page.getByRole('alert').filter({ hasText: 'Ce numéro est déjà celui de' });
    await expect(refus).toContainText(
      `Ce numéro est déjà celui de ${PRENOM} Complete ${cleFiche}.`,
    );
    await expect(refus).toContainText(`Saisi par le téléconseiller ${admin.nom}`);
    await expect(page.getByRole('link', { name: 'Ouvrir cette fiche' })).toBeVisible();
    expect(await fichesSurLeNumero(tel(30)), 'aucune seconde fiche sur ce numéro').toBe(1);
  });

  test('« Enregistrer et ouvrir la fiche » ouvre la fiche créée, accents compris', async ({
    page,
  }) => {
    const nom = `O’Brien-Ndèye ${cleSaisie}`;
    await page.goto(FORMULAIRE);
    await saisirIdentite(page, nom, 62);
    await page.getByRole('button', { name: 'Enregistrer et ouvrir la fiche' }).click();

    await page.waitForURL(/\/grand-public\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole('heading', { name: `${PRENOM} ${nom}`, level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: affiche(62) })).toHaveAttribute(
      'href',
      `tel:${tel(62)}`,
    );
  });

  test('la boîte de la liste enregistre et rafraîchit le tableau sans quitter la liste', async ({
    page,
  }) => {
    await page.goto(`/grand-public?search=${cleSaisie}`);
    await page.getByRole('button', { name: 'Nouveau prospect' }).click();

    const boite = page.getByRole('dialog', { name: 'Nouveau prospect Grand Public' });
    await expect(
      boite.getByText('Le nom, le prénom et le téléphone suffisent.', { exact: true }),
    ).toBeVisible();
    await champ(boite, /^Prénom/u).fill(PRENOM);
    await champ(boite, /^Nom/u).fill(`Boite ${cleSaisie}`);
    await champ(boite, /^Téléphone/u).fill(national(63));
    await boite.getByRole('button', { name: 'Enregistrer et ouvrir la fiche' }).click();

    await expect(boite).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/grand-public\\?search=${cleSaisie}$`, 'u'));
    await expect(
      page
        .getByRole('table')
        .getByRole('row')
        .filter({ hasText: `Boite ${cleSaisie}` }),
    ).toHaveCount(1);
    expect(await fichesSurLeNumero(tel(63))).toBe(1);
  });
});

test.describe('parité Grand Public, la fiche', () => {
  test.use({ storageState: admin.etat });

  test('la fiche rend ses trois cartes, le statut de la liste, et nomme chaque absence', async ({
    page,
  }) => {
    await page.goto(`/grand-public?search=${encodeURIComponent(tel(30))}`);
    const ligneListe = page
      .getByRole('table')
      .getByRole('row')
      .filter({ hasText: `Complete ${cleFiche}` });
    await expect(ligneListe).toHaveCount(1);
    await expect(ligneListe.getByRole('cell').nth(1)).toHaveText('Nouveau');

    await ligneListe.getByRole('link').first().click();
    await page.waitForURL(`**/grand-public/${fiches.complete}`);
    await expect(
      page.getByRole('heading', { name: `${PRENOM} Complete ${cleFiche}`, level: 1 }),
    ).toBeVisible();
    for (const carte of ['Le prospect', 'Rattachements', 'Suivi']) {
      await expect(page.getByText(carte, { exact: true })).toBeVisible();
    }
    for (const [libelle, attendu] of [
      ['Situation', 'Fonctionnaire'],
      ['Profession', PROFESSION],
      ['Canal de provenance', 'TikTok'],
      ['Durée du système', '5 ans (60 mois)'],
      ['Banque de domiciliation', 'CBAO'],
      ['Syndicat', 'CHUES'],
      ['Représentant', 'Sans représentant'],
      ['Téléconseiller', admin.nom],
    ] as const) {
      await expect(valeur(page, libelle), `${libelle} devrait valoir ${attendu}`).toContainText(
        attendu,
      );
    }
    await expect(page.getByRole('link', { name: affiche(30) })).toHaveAttribute(
      'href',
      `tel:${tel(30)}`,
    );
    await expect(page.getByRole('link', { name: 'Prospects Grand Public' })).toBeVisible();

    await page.goto(`/grand-public/${fiches.minimale}`);
    await expect(valeur(page, 'Situation')).toHaveText('Question non posée');
    await expect(valeur(page, 'Durée du système')).toHaveText('Non renseignée');
    await expect(valeur(page, 'Segment')).toContainText('Aucun');
    await expect(valeur(page, 'Dernier appel')).toHaveText('Jamais appelé');
  });

  test('le consentement bascule en base, la conversion fige la fiche', async ({ page }) => {
    await page.goto(`/grand-public/${fiches.parcours}`);
    const interesse = page.getByRole('button', { name: 'Intéressé' });
    const refuse = page.getByRole('button', { name: 'Refusé' });
    const conversion = page.getByRole('button', { name: 'Confirmer la conversion' });

    await interesse.click();
    await expect(page.getByText('Consentement enregistré.')).toBeVisible();
    await expect(conversion).toBeVisible();

    await refuse.click();
    await expect(conversion).toHaveCount(0);
    expect(
      (await parcoursDe(fiches.parcours))?.consent,
      'le refus doit être écrit en base, pas seulement à l’écran',
    ).toBe('REFUSE');

    await interesse.click();
    await expect(conversion).toBeVisible();
    await conversion.click();

    const boite = page.getByRole('dialog', { name: 'Confirmer la conversion' });
    await choisirDansListe(boite.getByLabel('Offre'), 'Adhésion');
    await boite.getByRole('button', { name: 'Confirmer', exact: true }).click();

    await expect(page.getByText('Conversion confirmée.')).toBeVisible();
    await expect(page.getByText('Converti', { exact: true })).toBeVisible();
    for (const geste of [interesse, refuse, conversion]) await expect(geste).toHaveCount(0);

    const apres = await parcoursDe(fiches.parcours);
    expect(apres?.statut).toBe('CONVERTI');
    expect(apres?.converti, 'la date de conversion doit être posée').toBe(true);
    expect(apres?.offre, 'l’offre retenue voyage jusqu’à la conversion').toBe('Adhésion');
  });

  test('une fiche CHUES renvoie vers son suivi, un identifiant inconnu ne rend pas de page blanche', async ({
    page,
  }) => {
    await page.goto(`/grand-public/${fiches.chues}`);
    await expect(
      page.getByRole('heading', { name: 'Cette fiche relève du projet CHUES', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Les deux projets ne partagent aucun écran. Elle se consulte depuis le suivi CHUES.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ouvrir le suivi CHUES' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Intéressé' })).toHaveCount(0);

    await page.goto(`/grand-public/${randomUUID()}`);
    await expect(page.getByRole('alert')).toContainText('Introuvable');
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
      'une fiche absente ne doit pas emporter la barre latérale',
    ).toBeVisible();
  });
});

test.describe('parité Grand Public, la console', () => {
  test.use({ storageState: teleconseiller.etat });

  test('la console ouvre sur la recherche et renvoie vers la saisie quand rien ne correspond', async ({
    page,
  }) => {
    await page.goto('/grand-public/console');
    const recherche = page.getByLabel('Quel prospect avez-vous appelé ?');
    await expect(recherche).toBeVisible();

    await recherche.fill('zzz-personne-ne-porte-ce-nom');
    await expect(page.getByText('Aucun résultat. Vérifiez le nom ou le numéro.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ajouter un prospect' })).toHaveAttribute(
      'href',
      '/grand-public/nouveau',
    );
  });

  test.fixme('la console pose le curseur dans la recherche : la v2 n’y met pas le focus, le téléconseiller doit cliquer avant de taper (GP-29)', async ({
    page,
  }) => {
    await page.goto('/grand-public/console');
    await expect(page.getByLabel('Quel prospect avez-vous appelé ?')).toBeFocused();
  });

  test('la file des rappels ignore le CHUES, et l’annulation la vide', async ({ page }) => {
    await page.goto('/grand-public/rappels');
    await expect(
      page.getByRole('heading', { name: 'Aucun rappel en retard', level: 2 }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Aujourd’hui' }).click();
    await expect(
      page.getByRole('heading', { name: 'Aucun rappel aujourd’hui', level: 2 }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Cette semaine' }).click();
    const ligneRappel = page.getByRole('row').filter({ hasText: affiche(40) });
    await expect(ligneRappel).toHaveCount(1);
    // Le rappel CHUES est promis par le MÊME téléconseiller, à la MÊME échéance :
    // seul le projet le distingue.
    await expect(page.getByRole('row').filter({ hasText: affiche(41) })).toHaveCount(0);
    await expect(page.getByLabel('Téléconseiller')).toHaveCount(0);

    await ligneRappel.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByText('Rappel annulé.', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Aucun rappel cette semaine', level: 2 }),
    ).toBeVisible();

    const annule = await ligne<{ status: string }>(
      'SELECT status::text AS status FROM scheduled_callbacks WHERE "prospectId" = $1',
      [fiches.rappel],
    );
    expect(annule?.status, 'l’annulation doit être écrite en base').toBe('CANCELLED');
  });
});

test.describe('parité Grand Public, ce que la supervision voit', () => {
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
    await expect(
      page.getByRole('heading', { name: 'Prospects Grand Public', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouveau prospect' })).toHaveCount(0);

    await page.goto(`/grand-public/${fiches.complete}`);
    await expect(valeur(page, 'Situation')).toHaveText('Fonctionnaire');
    for (const geste of ['Modifier', 'Intéressé', 'Refusé', 'Confirmer la conversion']) {
      await expect(page.getByRole('button', { name: geste })).toHaveCount(0);
    }

    metier.length = 0;
    await page.goto('/grand-public/nouveau');
    await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
    await expect(
      page.getByText('Cet écran est réservé à un autre rôle. Rôle en cours : Supervision.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toBeVisible();
    expect(metier, 'un écran refusé ne doit charger aucune donnée métier').toEqual([]);

    await page.goto('/grand-public/console');
    await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
    await expect(page.getByLabel('Quel prospect avez-vous appelé ?')).toHaveCount(0);

    await page.goto('/grand-public/rappels');
    await expect(page.getByLabel('Téléconseiller')).toBeVisible();
  });
});

test.describe('parité Grand Public, les chiffres', () => {
  test.use({ storageState: superviseur.etat });

  const ECRAN = '/grand-public/statistiques';
  const USINE = ['Taux de joignabilité des prospects', 'Prospects saisis', 'Par téléconseiller'];
  const AJOUTEE = 'Par banque';
  const MONTANTS = ['Encaissé', 'De l’appel à l’encaissement'];

  const carte = (page: Page, titre: string) =>
    page.getByRole('group', { name: `${titre}, graphique` });

  const composer = (page: Page) => page.getByRole('button', { name: 'Composer l’écran' });

  test.beforeEach(async () => {
    await avecBase(async (client) => {
      await client.query('DELETE FROM dashboard_layouts WHERE "userId" = $1', [superviseur.id]);
    });
  });

  test('l’écran rend ses cartes d’usine et se compose depuis « Composer l’écran »', async ({
    page,
  }) => {
    await page.goto(ECRAN);
    for (const titre of USINE) await expect(carte(page, titre)).toBeVisible();
    // Le libellé du tableau de bord des VISITES n'a rien à faire ici.
    await expect(page.getByRole('button', { name: 'Organiser les graphiques' })).toHaveCount(0);

    await composer(page).click();
    await expect(page.getByText('Mode organisation')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quitter' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Proposer par défaut' }),
      'un SUPERVISEUR ne fixe pas la disposition de tous',
    ).toHaveCount(0);
  });

  test('une carte ajoutée survit au rechargement, le retour à l’écran par défaut l’efface', async ({
    page,
  }) => {
    await page.goto(ECRAN);
    await composer(page).click();
    await page.getByRole('button', { name: 'Ajouter un graphique' }).click();

    const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
    for (const montant of MONTANTS) {
      await expect(
        tiroir.getByRole('article').filter({ hasText: montant }),
        `${montant} est réservé à l’ADMIN et à la DIRECTION`,
      ).toHaveCount(0);
    }
    await tiroir
      .getByRole('article')
      .filter({ hasText: AJOUTEE })
      .getByRole('button', { name: 'Ajouter', exact: true })
      .click();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Mode organisation')).toHaveCount(0);
    await page.reload();
    await expect(carte(page, AJOUTEE)).toBeVisible();

    await page.getByRole('button', { name: 'Revenir à l’écran par défaut' }).click();
    await expect(carte(page, AJOUTEE)).toHaveCount(0);
    await page.reload();
    await expect(carte(page, USINE[0] ?? '')).toBeVisible();
    await expect(carte(page, AJOUTEE)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Revenir à l’écran par défaut' })).toHaveCount(0);
  });

  test('la période choisie vit dans l’URL et survit au rechargement', async ({ page }) => {
    await page.goto(ECRAN);
    const periode = page.getByRole('group', { name: 'Période affichée' });
    await periode.getByRole('button', { name: 'Mois dernier' }).click();

    await expect(page).toHaveURL(/periode=mois-dernier/u);
    await page.reload();
    await expect(page).toHaveURL(/periode=mois-dernier/u);
    await expect(periode.getByRole('button', { name: 'Mois dernier' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('des chiffres en panne n’emportent pas la coque', async ({ page }) => {
    await page.route('**/api/v1/supervision/activite*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"panne"}' }),
    );

    await page.goto(ECRAN);
    const panne = page.getByRole('alert').filter({ hasText: 'Réessayez' });
    await expect(panne.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
      'la panne des chiffres ne doit pas emporter la barre latérale',
    ).toBeVisible();
  });

  test.fixme('les chiffres disent leur fraîcheur et se mettent en pause en composition : la v2 n’a ni indicateur ni geste de pause (GP-34, GP-35)', async ({
    page,
  }) => {
    await page.goto(ECRAN);
    await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    await composer(page).click();
    await expect(page.getByRole('status').filter({ hasText: 'En pause' })).toBeVisible();
  });
});

test.describe('parité Grand Public, en 390 px', () => {
  test.use({ storageState: admin.etat, viewport: { width: 390, height: 844 }, isMobile: true });

  test('la liste et la saisie tiennent dans l’écran du téléphone', async ({ page }) => {
    await page.goto(`/grand-public?search=${cleListe}`);
    await expect(compteur(page)).toBeVisible();
    await sansDebordementHorizontal(page);

    await page.goto('/grand-public/nouveau');
    const prenom = await champ(page, /^Prénom/u).boundingBox();
    const nom = await champ(page, /^Nom/u).boundingBox();
    expect(nom?.y ?? 0, 'sous 640 px la grille passe en une colonne').toBeGreaterThan(
      prenom?.y ?? 0,
    );
    for (const libelle of ['Enregistrer et ouvrir la fiche', 'Enregistrer et suivant']) {
      await expect(page.getByRole('button', { name: libelle })).toBeVisible();
    }
    await sansDebordementHorizontal(page);
  });
});

test.describe('parité Grand Public, accessibilité', () => {
  test.use({ storageState: admin.etat });

  const ROUTES: readonly { chemin: string; repere: (page: Page) => Locator }[] = [
    {
      chemin: '/grand-public',
      repere: (page) => page.getByRole('columnheader', { name: 'Segment', exact: true }),
    },
    {
      chemin: '/grand-public/nouveau',
      repere: (page) => page.getByRole('heading', { name: 'Nouveau prospect Grand Public' }),
    },
    {
      chemin: '/grand-public/console',
      repere: (page) => page.getByRole('textbox', { name: 'Quel prospect avez-vous appelé ?' }),
    },
    {
      chemin: '/grand-public/rappels',
      repere: (page) => page.getByRole('tab', { name: /^En retard/u }),
    },
    {
      chemin: '/grand-public/statistiques',
      repere: (page) => page.getByRole('button', { name: 'Composer l’écran' }),
    },
  ];

  for (const { chemin, repere } of ROUTES) {
    test(`aucune violation axe sur ${chemin}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(chemin);
      await expect(repere(page)).toBeVisible();
      await page.addStyleTag({
        content: '* { animation: none !important; transition: none !important; }',
      });

      const resultats = await new AxeBuilder({ page }).analyze();
      expect(resultats.violations, `${chemin} : ${JSON.stringify(resultats.violations)}`).toEqual(
        [],
      );
    });
  }

  test('aucune violation axe sur la fiche d’un prospect Grand Public', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`/grand-public/${fiches.complete}`);
    await expect(page.getByText('Rattachements', { exact: true })).toBeVisible();
    await page.addStyleTag({
      content: '* { animation: none !important; transition: none !important; }',
    });

    const resultats = await new AxeBuilder({ page }).analyze();
    expect(resultats.violations, JSON.stringify(resultats.violations)).toEqual([]);
  });
});

test.describe('parité Grand Public, le formulaire public', () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { 'X-Forwarded-For': ADRESSE_PUBLIC },
  });

  test('la page se compose sans compte, avertit que la vérification anti-robot manque', async ({
    page,
  }) => {
    await page.goto(`/demande/${teleconseiller.id}`);

    await expect(
      page.getByRole('alert').filter({ hasText: 'La vérification anti-robot est indisponible.' }),
    ).toBeVisible();
    await expect(page.getByText('Étape 1 sur 2')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Vos coordonnées' })).toBeVisible();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Vérifiez les champs signalés.' }),
    ).toBeVisible();

    await champ(page, /^Nom/u).fill(`Public ${cleFiche}`);
    await champ(page, /^Prénom/u).fill(PRENOM);
    await champ(page, /^Téléphone/u).fill(tel(50));
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Étape 2 sur 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vérifier ma demande' })).toBeVisible();
  });

  test('sans clé anti-robot le serveur refuse, et le sixième envoi tombe sur le limiteur', async ({
    page,
  }) => {
    const chemin = `/api/v1/formulaire-public/${teleconseiller.id}`;
    const corps = { nom: `Limite ${cleFiche}`, prenom: PRENOM, phone: tel(51) };
    const statuts: number[] = [];

    for (let envoi = 0; envoi < 6; envoi += 1) {
      const reponse = await page.request.post(chemin, {
        data: corps,
        headers: { Origin: BASE_URL, 'X-Forwarded-For': ADRESSE_LIMITEUR },
      });
      statuts.push(reponse.status());
    }

    // Sans TURNSTILE_SECRET_KEY et sans mode dégradé, l'écriture publique est
    // fermée : 503 CAPTCHA_INDISPONIBLE, puis 429 au-delà de cinq envois.
    expect(statuts.slice(0, 5), 'aucun envoi ne passe sans vérification').toEqual([
      503, 503, 503, 503, 503,
    ]);
    expect(statuts[5], 'le limiteur d’écriture ferme la porte au sixième envoi').toBe(429);
    expect(await fichesSurLeNumero(tel(51)), 'aucune fiche écrite sans vérification').toBe(0);
  });
});
