import { readFile } from 'node:fs/promises';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Lots d'export répartis : CHU-LOT-01, 03 à 09. CHU-LOT-02 vit dans
 * `chues-lots-export.roles.spec.ts`.
 *
 * AUCUN NETTOYAGE N'EST POSSIBLE POUR LES LOTS : l'API n'expose aucune
 * suppression, et le nom du lot est FABRIQUÉ par le web depuis la cible et
 * l'horodatage — aucun préfixe `E2E-CHUES-LOT ` ne peut y être posé. Chaque
 * exécution laisse donc un lot « Représentants, <date> » en base. Il ne porte
 * aucune donnée propre : il ne fait que référencer des représentants
 * existants. Les vingt représentants `E2E-CHUES-LOT Rep 01` à `20`, eux, sont
 * idempotents par téléphone et ne sont recréés qu'une fois.
 */

test.describe.configure({ mode: 'serial' });

test.use({ storageState: 'e2e/.auth/admin.json' });

/** Plage réservée à ce fichier (`E2E.md` §5.2). Le 21ᵉ sert à CHU-LOT-09. */
const telephone = (rang: number) => `+2217810048${String(rang).padStart(2, '0')}`;
const nomRepresentant = (rang: number) => `E2E-CHUES-LOT Rep ${String(rang).padStart(2, '0')}`;

const RESERVE = 20;
const RANG_TARDIF = 21;

/**
 * Trois comptes cochés, deux jours, trois fiches par jour : dix-huit places,
 * six cellules de trois. Un seul téléconseiller ne prouverait pas que le
 * tourniquet tourne, et un seul jour ne prouverait pas qu'il change de page.
 */
const EQUIPE = ['Awa Fixture', 'Fatou Fixture', 'Superviseur Fixture'] as const;
const FICHES_PAR_JOUR = 3;
const JOURS = 2;
const PLACES = EQUIPE.length * FICHES_PAR_JOUR * JOURS;

interface Apercu {
  eligible: number;
  scopeLabel: string;
  places: number;
  retenues: number;
  parTeleconseiller: number;
}

interface Lot {
  id: string;
  name: string;
  itemCount: number;
}

interface Detail extends Lot {
  distribution: { fichesParJour: number; jours: number };
  repartition: {
    teleconseillerId: string;
    teleconseillerName: string;
    jours: { jour: number; fiches: number }[];
  }[];
}

/** Le lot créé par CHU-LOT-05, relu par CHU-LOT-06 à CHU-LOT-09 (`serial`). */
let lot: Lot | null = null;

async function lire<T>(reponse: {
  ok: () => boolean;
  url: () => string;
  status: () => number;
  text: () => Promise<string>;
}): Promise<T> {
  const corps = await reponse.text();
  expect(reponse.ok(), `${reponse.url()} a répondu ${String(reponse.status())} : ${corps}`).toBe(
    true,
  );
  return JSON.parse(corps) as T;
}

/**
 * Les trois comptes cochés doivent exister ET être actifs : l'API refuse le lot
 * entier avec `LOT_EXPORT_TELECONSEILLER_INVALIDE` sinon, et l'échec
 * accuserait l'écran.
 */
async function exigerEquipe(api: APIRequestContext): Promise<void> {
  for (const nom of EQUIPE) {
    const page = await lire<{ items: { fullName: string; isActive: boolean }[] }>(
      await api.get('/api/v1/users', { params: { search: nom, pageSize: '50' } }),
    );
    const compte = page.items.find((item) => item.fullName === nom);
    expect(
      compte,
      `Compte « ${nom} » absent : la base est-elle amorcée (pnpm db:seed) ?`,
    ).toBeDefined();
    expect(
      compte?.isActive,
      `Compte « ${nom} » désactivé : il ne peut plus recevoir de fiches`,
    ).toBe(true);
  }
}

async function representantExistant(
  api: APIRequestContext,
  rang: number,
): Promise<{ id: string } | undefined> {
  const trouve = await lire<{ items: { id: string; phoneE164: string }[] }>(
    await api.get('/api/v1/representants', {
      params: { search: telephone(rang), pageSize: '5' },
    }),
  );
  return trouve.items.find((row) => row.phoneE164 === telephone(rang));
}

async function creerRepresentant(
  api: APIRequestContext,
  rang: number,
  departementId: string,
): Promise<void> {
  const cree = await api.post('/api/v1/representants', {
    data: { fullName: nomRepresentant(rang), phone: telephone(rang), departementId },
  });
  // 409 : le numéro est déjà pris, donc la fiche est là. C'est tout ce qui compte.
  if (cree.status() === 409) return;
  await lire<{ id: string }>(cree);
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const api = await adminApi();
  try {
    await exigerEquipe(api);

    const departements = await lire<{ id: string }[]>(
      await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
    );
    const departementId = departements[0]?.id;
    expect(departementId, 'Aucun département dans le référentiel').toBeDefined();
    if (departementId === undefined) return;

    for (let rang = 1; rang <= RESERVE; rang += 1) {
      if ((await representantExistant(api, rang)) !== undefined) continue;
      await creerRepresentant(api, rang, departementId);
    }

    // CHU-LOT-09 exige que le 21ᵉ N'EXISTE PAS encore : il doit naître APRÈS le
    // lot. Le retrait est doux et l'index d'unicité du téléphone est partiel,
    // donc le numéro se libère pour l'exécution suivante.
    const tardif = await representantExistant(api, RANG_TARDIF);
    if (tardif !== undefined) {
      const retire = await api.delete(`/api/v1/representants/${tardif.id}`);
      expect(
        retire.ok(),
        `Le représentant ${nomRepresentant(RANG_TARDIF)} d’une exécution précédente n’a pas pu être retiré : ${await retire.text()}`,
      ).toBe(true);
    }
  } finally {
    await api.dispose();
  }
});

async function ouvrirDialogue(page: Page): Promise<Locator> {
  await page.goto('/chues/campagnes');
  await page.getByRole('button', { name: 'Nouveau lot' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Nouveau lot d’export' });
  await expect(dialogue).toBeVisible();
  return dialogue;
}

/** « Tout décocher » est un lien ; qu'il soit rendu en bouton ne change rien. */
function commande(dialogue: Locator, nom: string): Locator {
  return dialogue.getByRole('link', { name: nom }).or(dialogue.getByRole('button', { name: nom }));
}

const boutonCreer = (dialogue: Locator): Locator =>
  dialogue.getByRole('button', { name: 'Créer le lot', exact: true });

/**
 * Le champ nombre est visé par son libellé et non par `getByRole('spinbutton')` :
 * le nom accessible est figé par le contrat d'écran, le type de l'`input` ne
 * l'est pas.
 */
async function reglerLaCible(dialogue: Locator): Promise<void> {
  await dialogue.getByRole('radio', { name: 'Représentants (CHUES)' }).check();
  await commande(dialogue, 'Tout décocher').click();
  for (const nom of EQUIPE) await dialogue.getByRole('checkbox', { name: nom }).check();
  await dialogue.getByLabel('Fiches par téléconseiller et par jour').fill(String(FICHES_PAR_JOUR));
}

/**
 * L'aperçu est LU SUR LE RÉSEAU, et sur la réponse qui porte EXACTEMENT la
 * répartition demandée : le champ est temporisé, plusieurs aperçus partent, et
 * lire le premier venu ferait passer un compte calculé pour un autre réglage.
 */
function attendreApercu(page: Page): Promise<Apercu> {
  const reponse = page.waitForResponse((candidate) => {
    if (!candidate.url().includes('/api/v1/lots-export/apercu')) return false;
    if (candidate.request().method() !== 'POST') return false;
    const corps = candidate.request().postDataJSON() as {
      cible?: string;
      distribution?: { teleconseillerIds?: string[]; fichesParJour?: number; jours?: number };
    } | null;
    return (
      corps?.cible === 'REPRESENTANTS' &&
      corps.distribution?.jours === JOURS &&
      corps.distribution.fichesParJour === FICHES_PAR_JOUR &&
      corps.distribution.teleconseillerIds?.length === EQUIPE.length
    );
  });
  return reponse.then(async (recue) => lire<Apercu>(recue));
}

/** Le lot vivant, ou l'aveu que CHU-LOT-05 n'a pas abouti. */
function lotCree(): Lot {
  expect(lot, 'CHU-LOT-05 n’a pas créé de lot : les suivants n’ont rien à ouvrir').not.toBeNull();
  if (lot === null) throw new Error('lot absent');
  return lot;
}

async function ouvrirLeLot(page: Page): Promise<Lot> {
  const cree = lotCree();
  await page.goto(`/chues/campagnes/${cree.id}`);
  await expect(page.getByRole('heading', { name: cree.name, level: 2 })).toBeVisible();
  return cree;
}

/**
 * Les noms du répertoire central d'une archive ZIP.
 *
 * Aucun lecteur d'archive n'est installé dans `@crm/web`, et `apps/web` est en
 * `type: module` : le paquet CommonJS de l'API ne s'y importe pas par un chemin
 * relatif. Le répertoire central se lit en vingt lignes, et il dit la VÉRITÉ de
 * l'archive, là où compter les signatures locales confondrait un fichier avec
 * son descripteur.
 */
function entreesZip(archive: Buffer): string[] {
  let fin = archive.length - 22;
  while (fin >= 0 && archive.readUInt32LE(fin) !== 0x06054b50) fin -= 1;
  expect(fin, 'aucun répertoire central : ce n’est pas une archive ZIP').toBeGreaterThanOrEqual(0);

  const total = archive.readUInt16LE(fin + 10);
  let position = archive.readUInt32LE(fin + 16);
  const noms: string[] = [];
  for (let index = 0; index < total; index += 1) {
    expect(archive.readUInt32LE(position), `entrée centrale ${String(index)} illisible`).toBe(
      0x02014b50,
    );
    const nom = archive.readUInt16LE(position + 28);
    const extra = archive.readUInt16LE(position + 30);
    const commentaire = archive.readUInt16LE(position + 32);
    noms.push(archive.toString('utf8', position + 46, position + 46 + nom));
    position += 46 + nom + extra + commentaire;
  }
  return noms;
}

async function telecharger(page: Page, nomDuBouton: string): Promise<Buffer> {
  const [fichier] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: nomDuBouton }).click(),
  ]);
  const chemin = await fichier.path();
  return readFile(chemin);
}

test('CHU-LOT-01 · la route rend la liste des lots, et dit à quoi elle sert', async ({ page }) => {
  await page.goto('/chues/campagnes');

  await expect(page.getByRole('heading', { name: 'Lots d’export', level: 1 })).toBeVisible();
  await expect(page.getByText(/fige une sélection de fiches à une date donnée/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouveau lot' })).toBeVisible();

  // L'ancien écran de campagne, dont la migration doit ne rien laisser.
  await expect(page.getByText('Distribuer les appels aux téléconseillers')).toHaveCount(0);
  await expect(page.getByText('Répartition en tourniquet')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lancer la campagne' })).toHaveCount(0);
});

test('CHU-LOT-03 · le dialogue annonce la répartition avant de créer, et l’annonce vient du serveur', async ({
  page,
}) => {
  const dialogue = await ouvrirDialogue(page);
  await reglerLaCible(dialogue);

  const attendu = attendreApercu(page);
  await dialogue.getByLabel('Nombre de jours').fill(String(JOURS));
  const apercu = await attendu;

  expect(
    apercu.eligible,
    'moins de dix-huit représentants en base : le `beforeAll` n’a pas posé sa réserve',
  ).toBeGreaterThanOrEqual(PLACES);
  expect(apercu.places, '3 téléconseillers × 3 fiches × 2 jours').toBe(PLACES);
  expect(apercu.retenues, 'le vivier dépasse les places : la répartition les remplit toutes').toBe(
    PLACES,
  );

  // Le texte affiché est comparé à la réponse : un compte estimé côté
  // navigateur divergerait du tirage réel sans que rien ne le dise. L'`output`
  // de l'aperçu porte le rôle `status`.
  const annonce = dialogue.getByRole('status');
  await expect(annonce).toContainText('seront réparties');
  await expect(annonce).toContainText(String(apercu.retenues));
});

test('CHU-LOT-04 · sans téléconseiller coché, la création est refusée et dite', async ({
  page,
}) => {
  const dialogue = await ouvrirDialogue(page);
  await dialogue.getByRole('radio', { name: 'Représentants (CHUES)' }).check();

  await commande(dialogue, 'Tout décocher').click();

  await expect(dialogue.getByText('Cochez au moins un téléconseiller.')).toBeVisible();
  await expect(
    boutonCreer(dialogue),
    'un lot sans destinataire n’a personne à qui donner ses fiches',
  ).toBeDisabled();

  // Et le bouton revient dès que l'équipe revient : le refus est un état, pas
  // une impasse.
  await commande(dialogue, 'Tout cocher').click();
  await expect(boutonCreer(dialogue)).toBeEnabled();
});

test('CHU-LOT-05 · la création fige dix-huit fiches et le détail rend le tourniquet', async ({
  page,
}) => {
  const dialogue = await ouvrirDialogue(page);
  await reglerLaCible(dialogue);

  const attendu = attendreApercu(page);
  await dialogue.getByLabel('Nombre de jours').fill(String(JOURS));
  await attendu;

  const creation = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith('/api/v1/lots-export') && candidate.request().method() === 'POST',
  );
  await boutonCreer(dialogue).click();

  const reponse = await creation;
  const corps = await reponse.text();
  expect(reponse.status(), corps).toBe(201);
  const cree = JSON.parse(corps) as Lot;
  expect(cree.itemCount, 'le lot est plafonné aux places de la répartition').toBe(PLACES);
  expect(cree.name, 'le nom est fabriqué par le web, jamais saisi').toMatch(/^Représentants/);
  lot = cree;

  await page.waitForURL(`**/chues/campagnes/${cree.id}`);
  await expect(page.getByRole('heading', { name: cree.name, level: 2 })).toBeVisible();

  const tableau = page.getByRole('table', { name: 'Programmes d’appel' });
  await expect(tableau.getByRole('rowheader')).toHaveCount(EQUIPE.length);
  for (let jour = 1; jour <= JOURS; jour += 1) {
    await expect(tableau.getByRole('columnheader', { name: `Jour ${String(jour)}` })).toBeVisible();
  }

  for (const nom of EQUIPE) {
    const ligne = tableau
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: nom }) });
    for (let jour = 1; jour <= JOURS; jour += 1) {
      const cellule = ligne.getByRole('cell').filter({
        has: page.getByRole('button', { name: `Programme de ${nom}, jour ${String(jour)}` }),
      });
      await expect(cellule, `${nom}, jour ${String(jour)}`).toContainText(String(FICHES_PAR_JOUR));
    }
  }
});

test('CHU-LOT-06 · le programme d’un téléconseiller est un vrai PDF, nommé', async ({ page }) => {
  await ouvrirLeLot(page);

  const [fichier] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: `Programme de ${EQUIPE[0]}, jour 1` }).click(),
  ]);

  expect(fichier.suggestedFilename()).toMatch(/^programme-.*jour-1\.pdf$/);
  const pdf = await readFile(await fichier.path());
  // Un JSON d'erreur relayé sous l'extension `.pdf` passerait la taille et le nom.
  expect(pdf.subarray(0, 4).toString('latin1'), 'ce n’est pas un PDF').toBe('%PDF');
  expect(
    pdf.byteLength,
    'un PDF de trois lignes numérotées pèse plus que deux kilo-octets',
  ).toBeGreaterThan(2_000);
});

test('CHU-LOT-07 · l’archive porte un programme par téléconseiller et par jour', async ({
  page,
}) => {
  await ouvrirLeLot(page);

  const archive = await telecharger(page, 'Tous les programmes (ZIP)');
  const entrees = entreesZip(archive);

  expect(
    entrees.filter((nom) => nom.toLowerCase().endsWith('.pdf')),
    `3 téléconseillers × 2 jours ; archive reçue : ${entrees.join(', ')}`,
  ).toHaveLength(EQUIPE.length * JOURS);
});

test('CHU-LOT-08 · le classeur du lot est un vrai classeur', async ({ page }) => {
  await ouvrirLeLot(page);

  const [fichier, reponse] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForResponse((candidate) => candidate.url().includes('/export.xlsx')),
    page.getByRole('button', { name: 'Classeur Excel' }).click(),
  ]);

  expect(reponse.headers()['content-type']).toContain('spreadsheetml.sheet');
  const classeur = await readFile(await fichier.path());
  expect([...classeur.subarray(0, 4)], 'ce n’est pas une archive ZIP, donc pas un xlsx').toEqual([
    0x50, 0x4b, 0x03, 0x04,
  ]);
  expect(classeur.byteLength).toBeGreaterThan(1_000);
});

test('CHU-LOT-09 · le lot est figé : un représentant créé après lui n’y entre pas', async () => {
  const cree = lotCree();
  const api = await adminApi();
  try {
    const detail = await lire<Detail>(await api.get(`/api/v1/lots-export/${cree.id}`));
    const corpsApercu = {
      name: 'Contrôle de gel',
      cible: 'REPRESENTANTS',
      representants: {},
      distribution: {
        teleconseillerIds: detail.repartition.map((ligne) => ligne.teleconseillerId),
        fichesParJour: FICHES_PAR_JOUR,
        // Trois jours : les places doivent dépasser le vivier, sinon le
        // plafond masquerait toute variation de celui-ci.
        jours: JOURS + 1,
      },
    };

    const avant = await lire<Apercu>(
      await api.post('/api/v1/lots-export/apercu', { data: corpsApercu }),
    );

    const departements = await lire<{ id: string }[]>(
      await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
    );
    const departementId = departements[0]?.id;
    expect(departementId).toBeDefined();
    if (departementId === undefined) return;
    await creerRepresentant(api, RANG_TARDIF, departementId);

    const apres = await lire<Apercu>(
      await api.post('/api/v1/lots-export/apercu', { data: corpsApercu }),
    );
    expect(
      apres.eligible,
      'le vivier n’a pas bougé : le 21ᵉ représentant n’a pas été créé, et le gel n’est pas éprouvé',
    ).toBe(avant.eligible + 1);

    const relu = await lire<Detail>(await api.get(`/api/v1/lots-export/${cree.id}`));
    expect(relu.itemCount, 'le lot est recalculé à chaque lecture').toBe(PLACES);
    const total = relu.repartition
      .flatMap((ligne) => ligne.jours)
      .reduce((somme, jour) => somme + jour.fiches, 0);
    expect(total, 'la répartition ne couvre plus les fiches figées').toBe(PLACES);
  } finally {
    await api.dispose();
  }
});
