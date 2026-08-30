import { expect, request, test, type Locator, type Page } from '@playwright/test';

/**
 * Dialogue d'impression du registre, ACC-IMP-01 à ACC-IMP-07 (E2E.md §7.3.2).
 *
 * `window.print()` en Chromium headless n'ouvre aucune boîte et ne déclenche
 * pas `afterprint` : rien ici n'attend l'événement d'impression. On vérifie le
 * DOM et les media queries (E2E.md §8, Q-14).
 *
 * Le registre n'a aucune route de suppression : la visite de précondition porte
 * un `RUN` horodaté (§5.1) et reste en base.
 */

test.use({ storageState: 'e2e/.auth/accueil.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const RUN = String(Date.now()).slice(-8);
const PREFIXE = `E2E-ACC-IMP-${RUN}`;
const NOM = `${PREFIXE} Awa Diop`;
const NOTE = `${PREFIXE} note interne`;
const VUE_FILTREE = `/accueil?search=${PREFIXE}&periode=tout`;

/** `LIGNES_PAR_PAGE_PAPIER` d'`impression-dialog.tsx`. */
const LIGNES_PAR_PAGE_PAPIER = 45;

interface Referentiel {
  id: string;
  label: string;
}

function exige<T>(valeur: T | undefined, quoi: string): T {
  if (valeur === undefined) throw new Error(`${quoi} — la base est-elle amorcée ?`);
  return valeur;
}

/**
 * Précondition posée par l'API : aucun écran du périmètre ne fabrique la ligne
 * que ce fichier imprime, et la saisie est l'objet de `accueil-registre`.
 */
test.beforeAll(async () => {
  const api = await request.newContext({
    baseURL: WEB_URL,
    storageState: 'e2e/.auth/accueil.json',
  });
  try {
    const reponse = await api.get('/api/v1/visites/referentiels');
    expect(
      reponse.ok(),
      `${reponse.url()} a répondu ${String(reponse.status())} : ${await reponse.text()}`,
    ).toBe(true);
    const bundle = (await reponse.json()) as {
      entreprises: Referentiel[];
      objets: Referentiel[];
    };

    const creation = await api.post('/api/v1/visites', {
      data: {
        date: new Date().toISOString().slice(0, 10),
        time: '09:30',
        visitorName: NOM,
        phone: '78 454 44 66',
        entrepriseId: exige(
          bundle.entreprises.find((item) => item.label === 'CPI'),
          'Entreprise CPI absente du registre',
        ).id,
        objetId: exige(
          bundle.objets.find((item) => item.label === 'SUIVI DE DOSSIER'),
          'Objet SUIVI DE DOSSIER absent du registre',
        ).id,
        comment: NOTE,
      },
    });
    expect(
      creation.ok(),
      `POST /api/v1/visites a répondu ${String(creation.status())} : ${await creation.text()}`,
    ).toBe(true);
  } finally {
    await api.dispose();
  }
});

function ligne(page: Page): Locator {
  return page.getByRole('table').getByRole('row').filter({ hasText: NOM });
}

async function ouvrirDialogue(page: Page): Promise<Locator> {
  await page.goto(VUE_FILTREE);
  await expect(ligne(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
  const dialogue = page.getByRole('dialog', { name: 'Préparer l’impression' });
  await expect(dialogue).toBeVisible();
  return dialogue;
}

test('ACC-IMP-01 le dialogue s’ouvre et annonce la portée', async ({ page }) => {
  await page.goto(VUE_FILTREE);
  await expect(ligne(page)).toHaveCount(1);
  const affichees = await ligne(page).count();

  await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
  const dialogue = page.getByRole('dialog', { name: 'Préparer l’impression' });

  await expect(dialogue).toBeVisible();
  await expect(
    dialogue.getByText('Les filtres et la période affichés seront conservés.', { exact: true }),
  ).toBeVisible();

  await expect(dialogue.getByRole('group')).toHaveCount(3);
  for (const legende of ['Quoi imprimer', 'Orientation', 'Colonnes']) {
    await expect(dialogue.getByRole('group', { name: legende, exact: true })).toHaveCount(1);
  }

  const quoi = dialogue.getByRole('group', { name: 'Quoi imprimer', exact: true });
  const pageAffichee = quoi.getByRole('radio', { name: /^La page affichée/u });
  await expect(pageAffichee).toBeChecked();
  // Le décompte de la portée est la ligne secondaire de l'option : la lire par
  // le nom accessible la rattache à SON option, les deux portées annonçant le
  // même chiffre quand le filtre tient sur une page.
  await expect(pageAffichee).toHaveAccessibleName(
    `La page affichée ${String(affichees)} visites, environ ${String(Math.max(1, Math.ceil(affichees / LIGNES_PAR_PAGE_PAPIER)))} pages`,
  );
});

test('ACC-IMP-02 les deux colonnes d’identité ne peuvent pas être décochées', async ({ page }) => {
  const dialogue = await ouvrirDialogue(page);
  const colonnes = dialogue.getByRole('group', { name: 'Colonnes', exact: true });

  for (const verrouillee of ['DATE VISITE', 'PRENOM ET NOMS']) {
    const boite = colonnes.getByRole('checkbox', { name: verrouillee, exact: true });
    await expect(
      boite,
      `${verrouillee} identifie la feuille : elle ne se décoche pas`,
    ).toBeDisabled();
    await expect(boite).toBeChecked();
  }

  for (const libre of [
    'N° REGISTRE',
    'HEURE VISITE',
    'TELEPHONES',
    'ENTREPRISE',
    'DIRECTION',
    'DESTINATAIRES',
    'OBJET VISITE',
    'COMMENTAIRES / NOTES',
  ]) {
    const boite = colonnes.getByRole('checkbox', { name: libre, exact: true });
    await boite.uncheck();
    await expect(boite, `${libre} doit pouvoir être retirée de la feuille`).not.toBeChecked();
  }
});

test('ACC-IMP-03 décocher une colonne la retire de la feuille', async ({ page }) => {
  const dialogue = await ouvrirDialogue(page);
  await dialogue
    .getByRole('group', { name: 'Colonnes', exact: true })
    .getByRole('checkbox', { name: 'COMMENTAIRES / NOTES', exact: true })
    .uncheck();
  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialogue).toHaveCount(0);

  const celluleNom = ligne(page).getByRole('cell').filter({ hasText: NOM });
  const celluleNote = ligne(page).getByRole('cell').filter({ hasText: NOTE });

  await page.emulateMedia({ media: 'print' });
  await expect(celluleNote).toBeHidden();
  await expect(celluleNom).toBeVisible();

  await page.emulateMedia({ media: 'screen' });
  await expect(celluleNote).toBeVisible();
  await expect(celluleNom).toBeVisible();
});

test('ACC-IMP-04 l’orientation choisie est écrite dans la règle @page', async ({ page }) => {
  const dialogue = await ouvrirDialogue(page);
  const regle = page.locator('style[media="print"]');
  await expect(regle).toHaveCount(1);

  // L'extraction de texte de Playwright saute le contenu des `<style>` :
  // `toContainText` y lit une chaîne vide. On relit `textContent`.
  const regleEcrite = async (): Promise<string> => (await regle.textContent()) ?? '';

  const orientation = dialogue.getByRole('group', { name: 'Orientation', exact: true });
  await orientation.getByRole('radio', { name: /^Portrait/u }).check();
  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(regleEcrite).toContain('size: portrait');

  await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
  const rouvert = page.getByRole('dialog', { name: 'Préparer l’impression' });
  await rouvert
    .getByRole('group', { name: 'Orientation', exact: true })
    .getByRole('radio', { name: /^Paysage/u })
    .check();
  await rouvert.getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(regleEcrite).toContain('size: landscape');
});

test('ACC-IMP-05 l’écran d’impression masque ce qui n’est pas le registre', async ({ page }) => {
  await page.goto(VUE_FILTREE);
  await expect(ligne(page)).toHaveCount(1);

  const outillage = {
    'Ajouter une visite': page.getByRole('button', { name: 'Ajouter une visite' }),
    'Rechercher dans le registre': page.getByRole('region', {
      name: 'Rechercher dans le registre',
    }),
    Visites: page.getByRole('navigation', { name: 'Visites' }),
    CORRIGER: page.getByRole('columnheader', { name: 'CORRIGER', exact: true }),
  };

  for (const [quoi, cible] of Object.entries(outillage)) {
    await expect(cible, `${quoi} doit exister à l’écran avant d’être masqué au papier`).toBeVisible();
  }

  await page.emulateMedia({ media: 'print' });

  for (const [quoi, cible] of Object.entries(outillage)) {
    await expect(cible, `${quoi} ne doit pas sortir sur la feuille`).toBeHidden();
  }
  await expect(page.getByRole('table')).toBeVisible();

  await page.emulateMedia({ media: 'screen' });
});
