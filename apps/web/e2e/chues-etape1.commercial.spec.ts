import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Étape 1 du projet CHUES : `/chues/appels-representants`, vu par un
 * TÉLÉCONSEILLER. CHU-ET1-01 à CHU-ET1-13.
 *
 * Les fiches portent le préfixe `E2E-CHUES-ET1 ` et la plage réservée
 * `+221 78 100 41 0x` (§5.2). Le nettoyage est fait EN DÉBUT de parcours
 * (§5.1) : un `afterAll` ne tourne pas après un échec dur, et le reliquat sert
 * au diagnostic.
 */
test.use({ storageState: 'e2e/.auth/commercial.json' });

const PREFIXE = 'E2E-CHUES-ET1 ';

const FICHES = [
  { fullName: `${PREFIXE}Awa Diop`, phone: '+221781004101', relation: 'INCONNU' },
  { fullName: `${PREFIXE}Ousmane Fall`, phone: '+221781004102', relation: 'REFUS' },
  { fullName: `${PREFIXE}Mariama Sow`, phone: '+221781004103', relation: 'INCONNU' },
] as const;

const AWA = FICHES[0];
const OUSMANE = FICHES[1];
const MARIAMA = FICHES[2];

/** La liste des résultats, distinguée du sélecteur des trois étapes de la coque. */
const resultats = (page: Page) =>
  page.getByRole('main').getByRole('list').filter({ hasNotText: 'Convertir un prospect' });

async function attendu<T>(reponse: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    reponse.ok(),
    `${reponse.url()} a répondu ${String(reponse.status())} : ${await reponse.text()}`,
  ).toBe(true);
  return (await reponse.json()) as T;
}

async function chercherRepresentant(
  api: APIRequestContext,
  phone: string,
): Promise<{ id: string; phoneE164: string; relationStatus: string } | undefined> {
  const trouves = await attendu<{
    items: { id: string; phoneE164: string; relationStatus: string }[];
  }>(await api.get('/api/v1/representants', { params: { search: phone, pageSize: '20' } }));
  return trouves.items.find((row) => row.phoneE164 === phone);
}

test.beforeAll(async () => {
  const api = await adminApi();
  try {
    const departements = await attendu<{ id: string }[]>(
      await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
    );
    const departementId = departements[0]?.id;
    expect(departementId, 'aucun département dans le référentiel').toBeDefined();

    for (const fiche of FICHES) {
      const existant = await chercherRepresentant(api, fiche.phone);
      if (existant !== undefined) {
        const suppression = await api.delete(`/api/v1/representants/${existant.id}`, {
          params: { cascade: 'true' },
        });
        expect(
          suppression.ok(),
          `suppression de ${fiche.phone} : ${String(suppression.status())} ${await suppression.text()}`,
        ).toBe(true);
      }

      const cree = await api.post('/api/v1/representants', {
        data: { fullName: fiche.fullName, phone: fiche.phone, departementId },
      });
      const { id } = await attendu<{ id: string }>(cree);

      if (fiche.relation !== 'INCONNU') {
        await attendu<{ id: string }>(
          await api.patch(`/api/v1/representants/${id}`, {
            data: { relationStatus: fiche.relation },
          }),
        );
      }
    }
  } finally {
    await api.dispose();
  }
});

/**
 * Ouvre l'écran et rend le champ de recherche UNE FOIS HYDRATÉ.
 *
 * Le focus est posé par un effet client : l'attendre prouve que React a repris
 * la main. Sans cette attente, une saisie arrivée avant l'hydratation était
 * écrasée par le premier rendu contrôlé, et la liste restait celle du jour.
 */
async function ouvrirEcran(page: Page) {
  await page.goto('/chues/appels-representants');
  const champ = page.getByLabel('Qui avez-vous appelé ?');
  await expect(champ).toBeFocused();
  return champ;
}

/**
 * Ouvre une fiche par son NUMÉRO. La recherche par nom rend aujourd'hui tout
 * l'annuaire dès que le nom porte un chiffre — c'est le défaut que CHU-ET1-02
 * attrape — et la fiche visée sortirait alors de la première page.
 */
async function ouvrirFiche(page: Page, fiche: { fullName: string; phone: string }): Promise<void> {
  const champ = await ouvrirEcran(page);
  await champ.fill(fiche.phone.slice(4));
  await resultats(page).getByRole('button', { name: fiche.fullName, exact: false }).click();
}

test('CHU-ET1-01 l’écran ouvre sur la recherche, focalisée, et ne choisit personne', async ({
  page,
}) => {
  await page.goto('/chues/appels-representants');

  const champ = page.getByLabel('Qui avez-vous appelé ?');
  await expect(champ).toBeVisible();
  await expect(champ).toHaveAttribute('placeholder', 'Chercher un représentant : nom ou numéro');
  await expect(champ).toBeFocused();

  await expect(page.getByText('Choisissez qui vous venez d’appeler.')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Copier' })).toHaveCount(0);
  await expect(page.getByText('Étape 1 sur 2')).toHaveCount(0);
});

test('CHU-ET1-02 la recherche par nom resserre la liste', async ({ page }) => {
  const champ = await ouvrirEcran(page);
  await champ.fill(`${PREFIXE}Awa`);

  const lignes = resultats(page).getByRole('listitem');
  await expect(lignes).toHaveCount(1);
  await expect(lignes).toContainText(AWA.fullName);
  await expect(lignes).toContainText('+221 78 100 41 01');
});

test('CHU-ET1-03 la recherche par numéro trouve la même fiche que la recherche par nom', async ({
  page,
}) => {
  const champ = await ouvrirEcran(page);

  await champ.fill('781004101');
  await expect(resultats(page).getByRole('listitem')).toHaveCount(1);
  await expect(resultats(page).getByRole('listitem')).toContainText(AWA.fullName);

  await champ.fill('');
  await champ.fill('78 100 41 01');
  await expect(
    resultats(page).getByRole('listitem'),
    'la recherche doit comparer les seuls chiffres, pas la chaîne brute',
  ).toHaveCount(1);
  await expect(resultats(page).getByRole('listitem')).toContainText(AWA.fullName);
});

test('CHU-ET1-04 une recherche sans résultat le dit', async ({ page }) => {
  const champ = await ouvrirEcran(page);
  await champ.fill('E2E-CHUES-ET1-INTROUVABLE-ZZZ');

  await expect(page.getByText('Aucun résultat. Vérifiez le nom ou le numéro.')).toBeVisible();
  await expect(resultats(page).getByRole('listitem')).toHaveCount(0);
});

/**
 * Les scénarios qui se suivent SUR LA MÊME DONNÉE : CHU-ET1-09 laisse la fiche
 * d'Awa en `AMBASSADEUR`, et CHU-ET1-10 éprouve la garde que ce statut arme.
 * Les quatre scénarios de recherche ci-dessus ne touchent à rien et restent
 * hors du groupe : sinon un rouge de recherche empêcherait de savoir ce que
 * valent les neuf autres.
 */
test.describe('qualification', () => {
  test.describe.configure({ mode: 'serial' });

  test('CHU-ET1-05 ouvrir une fiche montre le numéro en grand et sépare les deux étapes', async ({
    page,
  }) => {
    await ouvrirFiche(page, AWA);

    await expect(page.getByRole('heading', { level: 2, name: AWA.fullName })).toBeVisible();
    await expect(page.getByText('+221 78 100 41 01')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copier' })).toBeVisible();
    await expect(
      page.getByText('Étape 1 sur 2 · Comment s’est passé l’appel ?', { exact: true }),
    ).toBeVisible();

    for (const choix of ['Joignable', 'À rappeler', 'Injoignable']) {
      await expect(page.getByRole('button', { name: choix, exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  test('CHU-ET1-06 tant qu’il manque une réponse, « Continuer » est verrouillé et dit ce qui manque', async ({
    page,
  }) => {
    await ouvrirFiche(page, AWA);

    const continuer = page.getByRole('button', { name: 'Continuer', exact: true });

    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Choisissez d’abord le résultat')).toBeVisible();

    await page.getByRole('button', { name: 'Joignable', exact: true }).click();
    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Dites s’il est représentant CPI CHUES')).toBeVisible();

    await page
      .getByRole('group')
      .filter({ hasText: 'Est-il représentant CPI CHUES ?' })
      .getByRole('button', { name: 'Oui', exact: true })
      .click();
    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Dites s’il a WhatsApp sur ce numéro')).toBeVisible();

    await page
      .getByRole('group')
      .filter({ hasText: 'A-t-il WhatsApp sur ce numéro ?' })
      .getByRole('button', { name: 'Non', exact: true })
      .click();
    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Écrivez le numéro WhatsApp')).toBeVisible();

    const champWhatsapp = page.getByLabel('Numéro WhatsApp');
    await expect(champWhatsapp).toBeVisible();
    await champWhatsapp.fill('77 123 45 67');
    await expect(continuer).toBeEnabled();
  });

  test('CHU-ET1-07 « À rappeler » exige une échéance et l’écrit dans le récapitulatif', async ({
    page,
  }) => {
    await ouvrirFiche(page, AWA);

    const continuer = page.getByRole('button', { name: 'Continuer', exact: true });
    await page.getByRole('button', { name: 'À rappeler', exact: true }).click();

    await expect(page.getByRole('group').filter({ hasText: 'Quand rappeler ?' })).toBeVisible();
    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Choisissez quand rappeler')).toBeVisible();

    await page.getByRole('button', { name: 'Dans 1 h', exact: true }).click();
    await expect(continuer).toBeEnabled();

    await continuer.click();

    const recap = page.locator('dl').filter({ hasText: 'Personne appelée' });
    await expect(recap.getByText('Rappel', { exact: true })).toBeVisible();
    await expect(
      recap.getByText(/^(aujourd’hui|demain|le \d{2}\/\d{2}) à \d{2}:\d{2}$/),
      'l’échéance doit être reportée dans le récapitulatif',
    ).toBeVisible();
  });

  test('CHU-ET1-08 « Choisir une date » propose un jour puis ses demi-heures', async ({ page }) => {
    await ouvrirFiche(page, AWA);
    await page.getByRole('button', { name: 'À rappeler', exact: true }).click();
    await page.getByRole('button', { name: 'Choisir une date', exact: true }).click();

    const jour = page.getByLabel('Quel jour ?');
    await expect(jour, 'une date passée ne doit pas être proposable').toHaveAttribute(
      'min',
      new Date().toISOString().slice(0, 10),
    );
    await jour.fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

    await expect(page.getByText('À quelle heure ?')).toBeVisible();
    const heures = page.getByRole('button', { name: /^\d{2} h \d{2}$/ });
    expect(await heures.count(), 'aucune demi-heure proposée pour demain').toBeGreaterThan(0);

    await heures.first().click();
    await expect(page.getByRole('button', { name: 'Choisir une date', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^(aujourd’hui|demain|le \d{2}\/\d{2}) à \d{2}:\d{2}$/ }),
    ).toBeVisible();
  });

  test('CHU-ET1-09 l’enregistrement consigne une seule tentative et revient à la liste', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      const chemin = new URL(requete.url()).pathname;
      if (requete.method() === 'POST' && chemin === '/api/v1/rep-campaigns/attempts') {
        envois.push(chemin);
      }
    });

    await ouvrirFiche(page, AWA);

    await page.getByRole('button', { name: 'Joignable', exact: true }).click();
    await page
      .getByRole('group')
      .filter({ hasText: 'Est-il représentant CPI CHUES ?' })
      .getByRole('button', { name: 'Oui', exact: true })
      .click();
    await page
      .getByRole('group')
      .filter({ hasText: 'A-t-il WhatsApp sur ce numéro ?' })
      .getByRole('button', { name: 'Oui', exact: true })
      .click();
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();

    await page.getByLabel('Commentaire').fill(`${PREFIXE}appel consigné par le parcours`);
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: `Appel enregistré pour ${AWA.fullName}.` }),
    ).toHaveText(`Appel enregistré pour ${AWA.fullName}.`);
    await expect(page.getByLabel('Qui avez-vous appelé ?')).toBeVisible();

    await expect(page.locator('li[data-sonner-toast]')).toContainText(
      `Appel enregistré pour ${AWA.fullName}.`,
    );

    expect(
      envois.length,
      'une seule tentative doit partir : les réponses ne s’envoient pas au fil de l’eau',
    ).toBe(1);

    const api = await adminApi();
    try {
      const fiche = await chercherRepresentant(api, AWA.phone);
      expect(fiche?.relationStatus, 'le statut de relation doit être posé par la tentative').toBe(
        'AMBASSADEUR',
      );
    } finally {
      await api.dispose();
    }
  });

  test('CHU-ET1-10 une relation déjà tranchée demande confirmation avant tout', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      const chemin = new URL(requete.url()).pathname;
      if (requete.method() === 'POST' && chemin === '/api/v1/rep-campaigns/attempts') {
        envois.push(chemin);
      }
    });

    await ouvrirFiche(page, AWA);

    const boite = page.getByRole('dialog');
    await expect(boite.getByRole('heading')).toHaveText(
      'Cette personne a déjà accepté d’être représentant CPI CHUES.',
    );
    await expect(boite).toContainText('Voulez-vous quand même consigner un nouvel appel ?');

    // Ni le nom, ni le numéro, ni la première question ne sont lisibles derrière.
    await expect(page.getByRole('heading', { level: 2, name: AWA.fullName })).toHaveCount(0);
    await expect(page.getByText('+221 78 100 41 01')).toHaveCount(0);
    await expect(page.getByText('Comment s’est passé l’appel ?')).toHaveCount(0);

    await boite.getByRole('button', { name: 'Revenir à la liste', exact: true }).click();
    await expect(page.getByLabel('Qui avez-vous appelé ?')).toBeVisible();
    expect(envois, 'revenir à la liste n’écrit rien').toEqual([]);

    await ouvrirFiche(page, AWA);
    await page.getByRole('dialog').getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(
      page.getByText('Étape 1 sur 2 · Comment s’est passé l’appel ?', { exact: true }),
    ).toBeVisible();
  });

  test('CHU-ET1-11 le même dialogue pour un refus déjà enregistré', async ({ page }) => {
    await ouvrirFiche(page, OUSMANE);

    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(
      'Cette personne a déjà refusé.',
    );
  });

  test('CHU-ET1-12 un refus permet de proposer quelqu’un d’autre, et le numéro devient obligatoire dès qu’on commence', async ({
    page,
  }) => {
    await ouvrirFiche(page, MARIAMA);

    const continuer = page.getByRole('button', { name: 'Continuer', exact: true });
    await page.getByRole('button', { name: 'Joignable', exact: true }).click();
    await page
      .getByRole('group')
      .filter({ hasText: 'Est-il représentant CPI CHUES ?' })
      .getByRole('button', { name: 'Non', exact: true })
      .click();

    const suggestion = page
      .getByRole('group')
      .filter({ hasText: 'Il propose quelqu’un d’autre ? (facultatif)' });
    await expect(suggestion).toBeVisible();
    await expect(suggestion.getByLabel('Son numéro')).toBeVisible();
    await expect(suggestion.getByLabel('Son nom et prénom')).toBeVisible();
    await expect(suggestion.getByLabel('Sa remarque')).toBeVisible();
    await expect(
      continuer,
      'la suggestion est facultative tant que les trois champs sont vides',
    ).toBeEnabled();

    await suggestion.getByLabel('Son nom et prénom').fill(`${PREFIXE}Personne proposée`);
    await expect(continuer).toBeDisabled();
    await expect(page.getByText('Écrivez le numéro de la personne proposée')).toBeVisible();

    await suggestion.getByLabel('Son numéro').fill('77 123 45 68');
    await expect(continuer).toBeEnabled();
  });

  test('CHU-ET1-13 les raccourcis clavier documentés font ce qu’ils annoncent', async ({
    page,
  }) => {
    await ouvrirFiche(page, MARIAMA);

    await page.getByText('Carte clavier').click();
    const carte = page.locator('dl').filter({ hasText: 'Copier le numéro' });
    await expect(carte.locator('dt')).toHaveText(['C', 'E', 'Échap']);
    await expect(carte.locator('dd')).toHaveText([
      'Copier le numéro',
      'Corriger la fiche',
      'Revenir en arrière',
    ]);

    await page.keyboard.press('e');
    const correction = page.getByRole('dialog').filter({ hasText: 'Modifier le représentant' });
    await expect(correction).toBeVisible();
    await correction.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(correction).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(
      page.getByLabel('Qui avez-vous appelé ?'),
      '« Échap » sur l’étape 1 revient à la liste',
    ).toBeVisible();

    await ouvrirFiche(page, MARIAMA);
    await page.getByRole('button', { name: 'Injoignable', exact: true }).click();
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.getByText('Étape 2 sur 2 · Quelque chose à ajouter ?')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(
      page.getByText('Étape 1 sur 2 · Comment s’est passé l’appel ?', { exact: true }),
      '« Échap » depuis l’étape 2 revient à l’étape 1, pas à la liste',
    ).toBeVisible();
    await expect(page.getByLabel('Qui avez-vous appelé ?')).toHaveCount(0);
  });
});
