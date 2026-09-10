import { expect, test, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Listes de référence de l'espace Admin : ADM-REF-01 à ADM-REF-12.
 *
 * Une entrée de référentiel ne se SUPPRIME pas (aucune route `DELETE` dans
 * `referentiels.controller.ts`) : chaque exécution porte donc son horodatage
 * (E2E.md §5.1), et rien n'est jamais repris d'une exécution à l'autre.
 *
 * Les entrées partagées — CBAO, CHUES, régions, départements du semis — ne sont
 * ni renommées, ni désactivées, ni déplacées : le tri au clavier n'échange donc
 * que les deux banques de cette exécution, placées côte à côte en fin de liste.
 */

test.use({ storageState: 'v1/.auth/admin.json' });

const RUN = String(Date.now()).slice(-8);

const ABREV_A = `E2EREF${RUN}A`;
const ABREV_B = `E2EREF${RUN}B`;
const NOM_A = `E2E-ADM-REF Banque Témoin ${RUN}`;
const NOM_B = `E2E-ADM-REF Banque Voisine ${RUN}`;
const NOM_DOUBLON = `E2E-ADM-REF Banque Doublon ${RUN}`;

/** Deux rangs consécutifs, propres à l'exécution : le voisin du haut est à nous. */
const ORDRE_A = 9000 + (Number(RUN) % 450) * 2;
const ORDRE_B = ORDRE_A + 1;

interface Onglet {
  nom: string;
  cle: string;
  description?: string;
  creation?: string;
}

const ONGLETS: readonly Onglet[] = [
  { nom: 'Syndicats', cle: 'syndicats', description: 'Appartenance syndicale du prospect.' },
  { nom: 'Départements', cle: 'departements', description: 'Triés par région, puis par nom.' },
  { nom: 'Professions', cle: 'professions', creation: 'Nouvelle profession' },
  { nom: 'Revenus', cle: 'incomeBands', creation: 'Nouvelle tranche' },
  { nom: 'Offres', cle: 'offers', creation: 'Nouvelle offre' },
];

async function ouvrirReferentiels(page: Page): Promise<void> {
  await page.goto('/admin/referentiels');
  await expect(page).toHaveTitle(/Référentiels/);
  await expect(page.getByRole('heading', { name: 'Banques', level: 2 })).toBeVisible();
}

/**
 * Chaque écriture de filtre passe par `router.replace`, donc par un
 * aller-retour RSC : on attend la CONDITION « l'URL porte le critère », jamais
 * un délai fixe.
 */
async function chercher(page: Page, terme: string): Promise<void> {
  await page.getByLabel('Rechercher').fill(terme);
  // `URLSearchParams` encode l'espace en `+`, là où `encodeURIComponent` rend
  // `%20` : c'est la forme réellement écrite dans la barre d'adresse.
  const attendu = new URLSearchParams({ recherche: terme }).toString();
  await page.waitForURL((url) => url.search.includes(attendu));
}

async function remplirBanque(
  page: Page,
  valeurs: { nom: string; abreviation: string; ordre: string },
): Promise<void> {
  const dialogue = page.getByRole('dialog');
  await dialogue.getByLabel('Nom complet').fill(valeurs.nom);
  await dialogue.getByLabel('Abréviation').fill(valeurs.abreviation);
  await dialogue.getByLabel('Ordre d’affichage').fill(valeurs.ordre);
}

/** Les abréviations de cette exécution, dans l'ordre du DOM. */
async function abreviations(page: Page): Promise<string[]> {
  const lignes = await page
    .getByRole('table')
    .getByRole('row')
    .filter({ hasText: `E2EREF${RUN}` })
    .all();
  const valeurs: string[] = [];
  for (const ligne of lignes) {
    valeurs.push(((await ligne.getByRole('cell').first().textContent()) ?? '').trim());
  }
  return valeurs;
}

async function attendreSansErreur(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Chargement impossible' })).toHaveCount(0);
  await expect(page.getByText('Référentiel non chargé.')).toHaveCount(0);
}

/**
 * Un onglet, un test : chaque bascule est un aller-retour RSC, et six dans un
 * même `test` tiennent mal dans le délai imposé. Aucun ne dépend des autres,
 * donc rien ici n'est en série.
 */
test.describe('Onglets', () => {
  test('ADM-REF-01 · onglet Banques, sans paramètre d’URL', async ({ page }) => {
    await ouvrirReferentiels(page);

    await expect(page).not.toHaveURL(/onglet=/);
    await expect(page.getByText('Domiciliation bancaire du prospect.')).toBeVisible();
    await attendreSansErreur(page);
  });

  for (const onglet of ONGLETS) {
    test(`ADM-REF-01 · onglet ${onglet.nom}`, async ({ page }) => {
      await ouvrirReferentiels(page);

      await page.getByRole('tab', { name: onglet.nom }).click();
      await page.waitForURL(new RegExp(`onglet=${onglet.cle}`));

      if (onglet.description === undefined) {
        // Les trois listes ouvertes n'ont ni titre de niveau 2 ni description :
        // leur seul repère est le bouton de création.
        await expect(
          page.getByRole('button', { name: onglet.creation ?? onglet.nom }),
        ).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: onglet.nom, level: 2 })).toBeVisible();
        await expect(page.getByText(onglet.description)).toBeVisible();
      }
      await attendreSansErreur(page);
    });
  }
});

test.describe('Listes de référence', () => {
  test.describe.configure({ mode: 'serial' });

  test('ADM-REF-03 · formulaire vide', async ({ page }) => {
    await ouvrirReferentiels(page);

    const envois: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'POST' && requete.url().includes('/api/v1/referentiels/banques')) {
        envois.push(requete.url());
      }
    });

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();

    const dialogue = page.getByRole('dialog');
    await expect(dialogue.getByText('Le nom est obligatoire.', { exact: true })).toBeVisible();
    await expect(
      dialogue.getByText("L'abréviation est obligatoire.", { exact: true }),
    ).toBeVisible();
    expect(envois, 'un formulaire refusé ne doit rien envoyer').toEqual([]);
  });

  test('ADM-REF-02 · création d’une banque', async ({ page }) => {
    await ouvrirReferentiels(page);

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    await remplirBanque(page, { nom: NOM_A, abreviation: ABREV_A, ordre: String(ORDRE_A) });
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText(`${ABREV_A} ajoutée.`)).toBeVisible();

    // Sans rechargement : c'est l'invalidation du cache qui est éprouvée ici.
    const creee = page.getByRole('table').getByRole('row').filter({ hasText: ABREV_A });
    await expect(creee).toHaveCount(1);
    await expect(creee).toContainText(NOM_A);
    await expect(creee.getByRole('cell').nth(3)).toHaveText(String(ORDRE_A));
    await expect(page.getByRole('table').getByRole('row').last()).toContainText('E2EREF');
  });

  test('ADM-REF-04 · doublon d’abréviation', async ({ page }) => {
    await ouvrirReferentiels(page);

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    await remplirBanque(page, {
      nom: NOM_DOUBLON,
      abreviation: ABREV_A,
      ordre: String(ORDRE_A),
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Cette valeur existe déjà.')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: ABREV_A })).toHaveCount(
      1,
    );
    await expect(
      page.getByRole('table').getByRole('row').filter({ hasText: NOM_DOUBLON }),
    ).toHaveCount(0);
  });

  test('ADM-REF-09 · recherche dans l’URL', async ({ page }) => {
    await ouvrirReferentiels(page);
    await chercher(page, ABREV_A);

    const lignes = page.getByRole('table').getByRole('row');
    await expect(lignes.filter({ hasText: ABREV_A })).toHaveCount(1);
    await expect(lignes.filter({ hasNotText: ABREV_A })).toHaveCount(1);

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`recherche=${ABREV_A}`));
    await expect(page.getByLabel('Rechercher')).toHaveValue(ABREV_A);
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: ABREV_A })).toHaveCount(
      1,
    );
  });

  test('ADM-REF-10 · recherche insensible aux accents', async ({ page }) => {
    await ouvrirReferentiels(page);
    await chercher(page, `temoin ${RUN}`);

    const lignes = page.getByRole('table').getByRole('row');
    await expect(lignes.filter({ hasText: NOM_A })).toHaveCount(1);
    await expect(lignes.filter({ hasNotText: NOM_A })).toHaveCount(1);
  });

  test('ADM-REF-11 · changer d’onglet vide la recherche', async ({ page }) => {
    await ouvrirReferentiels(page);
    await chercher(page, ABREV_A);

    await page.getByRole('tab', { name: 'Syndicats' }).click();
    await page.waitForURL(/onglet=syndicats/);
    await expect(page).not.toHaveURL(/recherche=/);
    await expect(page.getByLabel('Rechercher')).toHaveValue('');
  });

  test('ADM-REF-06 · tri au clavier', async ({ page }) => {
    await ouvrirReferentiels(page);

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    await remplirBanque(page, { nom: NOM_B, abreviation: ABREV_B, ordre: String(ORDRE_B) });
    await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(`${ABREV_B} ajoutée.`)).toBeVisible();

    await chercher(page, `E2EREF${RUN}`);
    await expect.poll(async () => abreviations(page)).toEqual([ABREV_A, ABREV_B]);

    const monter = page.getByRole('button', { name: `Monter ${ABREV_B}` });
    await monter.focus();
    await expect(monter).toBeFocused();
    await page.keyboard.press('Enter');

    await expect.poll(async () => abreviations(page)).toEqual([ABREV_B, ABREV_A]);

    await page.reload();
    await expect(page.getByLabel('Rechercher')).toHaveValue(`E2EREF${RUN}`);
    await expect.poll(async () => abreviations(page)).toEqual([ABREV_B, ABREV_A]);
  });

  test('ADM-REF-07 · désactivation avec décompte', async ({ page }) => {
    await ouvrirReferentiels(page);
    await chercher(page, ABREV_A);

    await page.getByRole('button', { name: `Désactiver ${ABREV_A}` }).click();

    const dialogue = page.getByRole('dialog');
    await expect(
      dialogue.getByRole('heading', { name: `Désactiver « ${ABREV_A} » ?` }),
    ).toBeVisible();
    await expect(dialogue).toContainText(
      'Retirée des listes de saisie. Reste disponible en filtre et en export.',
    );
    await expect(dialogue).toContainText('0 prospect référence cette banque.');

    await dialogue.getByRole('button', { name: 'Désactiver' }).click();
    await expect(page.getByText(`${ABREV_A} désactivée.`)).toBeVisible();

    // Elle reste ici, réactivable, avec sa marque de retrait.
    const ligne = page.getByRole('table').getByRole('row').filter({ hasText: ABREV_A });
    await expect(ligne).toHaveCount(1);
    await expect(ligne).toContainText('Retirée');
    await expect(page.getByRole('button', { name: `Réactiver ${ABREV_A}` })).toBeVisible();

    // Ce que l'écran ne montre pas : les listes de saisie du terrain, servies
    // par le référentiel ACTIF, ne la proposent plus.
    const api = await adminApi();
    try {
      const actives = (await (await api.get('/api/v1/referentiels/banques')).json()) as {
        shortName: string;
      }[];
      expect(actives.map((row) => row.shortName)).not.toContain(ABREV_A);

      const toutes = (await (
        await api.get('/api/v1/referentiels/banques', { params: { activeOnly: 'false' } })
      ).json()) as { shortName: string }[];
      expect(toutes.map((row) => row.shortName)).toContain(ABREV_A);
    } finally {
      await api.dispose();
    }
  });

  test('ADM-REF-12 · largeur 375 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await ouvrirReferentiels(page);

    await page.getByRole('tab', { name: 'Offres' }).click();
    await page.waitForURL(/onglet=offers/);
    await expect(page.getByRole('button', { name: 'Nouvelle offre' })).toBeVisible();

    await page.getByRole('tab', { name: 'Banques' }).click();
    await page.getByRole('button', { name: 'Nouvelle banque' }).click();

    const enregistrer = page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' });
    await expect(enregistrer).toBeVisible();
    const cadre = await enregistrer.boundingBox();
    expect(cadre, 'le bouton d’enregistrement doit être mesurable').not.toBeNull();
    expect((cadre?.x ?? 0) + (cadre?.width ?? 0)).toBeLessThanOrEqual(375);
    expect((cadre?.y ?? 0) + (cadre?.height ?? 0)).toBeLessThanOrEqual(812);

    await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
  });

  /** En DERNIER de la série : rien ne le suit, son échec n'emporte personne. */
  test('ADM-REF-05 · ordre invalide', async ({ page }) => {
    await ouvrirReferentiels(page);

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    // Nom et abréviation DÉJÀ pris : si la borne d'ordre cédait, le serveur
    // refuserait quand même, et aucune entrée indestructible ne naîtrait ici.
    const dialogue = page.getByRole('dialog');
    await dialogue.getByLabel('Nom complet').fill(NOM_A);
    await dialogue.getByLabel('Abréviation').fill(ABREV_A);

    await dialogue.getByLabel('Ordre d’affichage').fill('-1');
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      dialogue.getByText("L'ordre ne peut pas être négatif.", { exact: true }),
    ).toBeVisible();

    // `fill` refuse une valeur non numérique sur un champ `type="number"` : la
    // saisie passe donc par le clavier, comme celle d'un administrateur.
    await dialogue.getByLabel('Ordre d’affichage').clear();
    await dialogue.getByLabel('Ordre d’affichage').pressSequentially('abc');
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      dialogue.getByText("L'ordre est un nombre entier.", { exact: true }),
    ).toBeVisible();
  });
});

/*
 * ADM-REF-08 (décompte indisponible) n'est PAS écrit ici.
 *
 * Le décompte n'est pas lu par le navigateur : `admin/referentiels/page.tsx`
 * précharge `queryKeys.referentielUsage` côté serveur et le déshydrate dans la
 * page. Un `page.route` sur `/api/v1/analytics/by-*` n'atteint donc jamais
 * l'appel qui alimente la boîte, et un échec de refetch conserve la donnée
 * déjà hydratée. Observé : la boîte affiche « 36 prospects référencent cette
 * banque. » alors que les trois routes d'analytique répondent 500 au
 * navigateur. Prérequis à trancher par le mainteneur central.
 */
