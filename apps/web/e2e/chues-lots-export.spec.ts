import { readFile } from 'node:fs/promises';

import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Campagnes réparties : CHU-LOT-01, 03 à 09 pour l'administrateur, CHU-LOT-10 à
 * CHU-LOT-21 pour le superviseur. CHU-LOT-02 vit dans
 * `chues-lots-export.roles.spec.ts`.
 *
 * CHU-LOT-03 à CHU-LOT-09 laissent une campagne « Représentants non
 * qualifiés, <date> » en base : leur formulaire ne corrige pas le nom proposé,
 * qu'aucun préfixe ne peut donc porter. Elle ne détient aucune donnée propre,
 * elle ne fait que référencer des représentants existants.
 *
 * Les campagnes de CHU-LOT-10 et suivants, elles, PORTENT le préfixe du fichier
 * et le `beforeAll` retire celles de l'exécution précédente : EB-14 ouvre la
 * saisie du nom, et la suppression existe pour l'administrateur.
 *
 * Les vingt représentants `E2E-CHUES-LOT Rep 01` à `20` sont idempotents par
 * téléphone et ne sont recréés qu'une fois.
 */

test.describe.configure({ mode: 'serial' });

test.use({ storageState: 'e2e/.auth/admin.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

/** Le préfixe du fichier (`E2E.md` §5.5) : réserve de représentants ET campagnes. */
const PREFIXE = 'E2E-CHUES-LOT ';

/** Plage réservée à ce fichier (`E2E.md` §5.2). Le 21ᵉ sert à CHU-LOT-09. */
const telephone = (rang: number) => `+2217810048${String(rang).padStart(2, '0')}`;
const nomRepresentant = (rang: number) => `${PREFIXE}Rep ${String(rang).padStart(2, '0')}`;

const RESERVE = 20;
const RANG_TARDIF = 21;

/** Le 22ᵉ numéro de la plage ne porte aucune fiche : il n'est QUE suggéré. */
const RANG_SUGGERE = 22;
const TELEPHONE_SUGGERE = telephone(RANG_SUGGERE);

const FICHES_PAR_JOUR = 3;
const JOURS = 2;

/** Supervision et direction appellent en plus de leur travail : `capaciteParJour` côté API. */
const capaciteReduite = (fichesParJour: number) => Math.max(1, Math.ceil(fichesParJour / 5));

/**
 * Trois comptes cochés et deux jours. Un seul téléconseiller ne prouverait pas
 * que le tourniquet tourne, un seul jour ne prouverait pas qu'il change de
 * page, et un compte de supervision est le seul qui prouve la capacité réduite.
 */
const EQUIPE = [
  { nom: 'Awa Fixture', capacite: FICHES_PAR_JOUR },
  { nom: 'Fatou Fixture', capacite: FICHES_PAR_JOUR },
  { nom: 'Superviseur Fixture', capacite: capaciteReduite(FICHES_PAR_JOUR) },
] as const;
const PLACES = EQUIPE.reduce((total, membre) => total + membre.capacite, 0) * JOURS;

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

/**
 * Un département à ce fichier, seul lieu de la réserve. Le tirage prend les
 * fiches d'un département par identifiant croissant : dans un département
 * partagé, les fiches d'amorçage passaient devant la réserve, et un appel
 * consigné modifiait des données que d'autres specs lisent.
 */
const DEPARTEMENT_RESERVE = { code: 'E2E_CHUES_LOT', name: `${PREFIXE}Département` };

let departement: { id: string; name: string } | null = null;

async function departementReserve(api: APIRequestContext): Promise<{ id: string; name: string }> {
  const departements = await lire<{ id: string; name: string }[]>(
    await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
  );
  const existant = departements.find((row) => row.name === DEPARTEMENT_RESERVE.name);
  if (existant !== undefined) return existant;
  const regions = await lire<{ id: string }[]>(await api.get('/api/v1/referentiels/regions'));
  const regionId = regions[0]?.id;
  expect(regionId, 'Aucune région dans le référentiel').toBeDefined();
  return lire<{ id: string; name: string }>(
    await api.post('/api/v1/referentiels/departements', {
      data: { ...DEPARTEMENT_RESERVE, regionId },
    }),
  );
}

function leDepartement(): { id: string; name: string } {
  expect(departement, 'Aucun département dans le référentiel').not.toBeNull();
  if (departement === null) throw new Error('département absent');
  return departement;
}

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
  for (const { nom } of EQUIPE) {
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

    departement = await departementReserve(api);
    const departementId = departement.id;

    for (let rang = 1; rang <= RESERVE; rang += 1) {
      const existant = await representantExistant(api, rang);
      if (existant === undefined) {
        await creerRepresentant(api, rang, departementId);
        continue;
      }
      // Une fiche posée par une exécution d'avant le département dédié rejoint la réserve.
      await lire(
        await api.patch(`/api/v1/representants/${existant.id}`, {
          data: { departementId, fullName: nomRepresentant(rang) },
        }),
      );
    }

    // CHU-LOT-09 exige que le 21ᵉ N'EXISTE PAS encore : il doit naître APRÈS le
    // lot. Le retrait est doux et l'index d'unicité du téléphone est partiel,
    // donc le numéro se libère pour l'exécution suivante.
    // Le 22ᵉ non plus : une fiche à ce numéro, née du lancement d'une campagne
    // de contacts recommandés (EB-19), résoudrait la suggestion et la sortirait
    // de la cible de CHU-LOT-21.
    for (const rang of [RANG_TARDIF, RANG_SUGGERE]) {
      const existant = await representantExistant(api, rang);
      if (existant === undefined) continue;
      const retire = await api.delete(`/api/v1/representants/${existant.id}`);
      expect(
        retire.ok(),
        `Le représentant ${nomRepresentant(rang)} d’une exécution précédente n’a pas pu être retiré : ${await retire.text()}`,
      ).toBe(true);
    }

    await retirerLesCampagnes(api);
    await poserUnContactRecommande(api);
  } finally {
    await api.dispose();
  }
});

/**
 * Les campagnes de l'exécution précédente. Le nettoyage se fait ICI et non dans
 * un `afterAll` : celui-ci ne tourne pas après un échec dur, et le reliquat sert
 * au diagnostic.
 */
async function retirerLesCampagnes(api: APIRequestContext): Promise<void> {
  const liste = await lire<{ items: { id: string; name: string }[] }>(
    await api.get('/api/v1/lots-export', { params: { search: PREFIXE, pageSize: '100' } }),
  );
  for (const ancienne of liste.items.filter((row) => row.name.startsWith(PREFIXE))) {
    const retiree = await api.delete(`/api/v1/lots-export/${ancienne.id}`);
    expect(
      retiree.ok(),
      `La campagne « ${ancienne.name} » n’a pas pu être retirée : ${await retiree.text()}`,
    ).toBe(true);
  }
}

/**
 * EB-19 : le volume de démonstration n'offre AUCUN contact recommandé, et
 * CHU-LOT-21 ne pourrait rien compter. Un numéro suggéré par le premier
 * représentant de la réserve lui en donne un, hors de toute donnée partagée.
 *
 * Le numéro suggéré ne doit porter aucune fiche : la suggestion naîtrait
 * résolue, et la cible ne retient que celles qui ne le sont pas.
 */
async function poserUnContactRecommande(api: APIRequestContext): Promise<void> {
  const suggestions = await lire<{
    items: { id: string; suggestedPhoneE164: string; resolvedRepresentantId: string | null }[];
  }>(
    await api.get('/api/v1/suggestions', {
      params: { status: 'A_APPELER', pageSize: '100' },
    }),
  );
  const deja = suggestions.items.find(
    (row) => row.suggestedPhoneE164 === TELEPHONE_SUGGERE && row.resolvedRepresentantId === null,
  );
  if (deja !== undefined) return;

  const source = await representantExistant(api, 1);
  expect(source, `${nomRepresentant(1)} absent : la réserve n’a pas été posée`).toBeDefined();
  if (source === undefined) return;

  await lire(
    await api.post('/api/v1/rep-campaigns/attempts', {
      data: {
        id: crypto.randomUUID(),
        representantId: source.id,
        outcome: 'REFUSED',
        clientCreatedAt: new Date().toISOString(),
        suggestedPhone: TELEPHONE_SUGGERE,
        suggestedName: `${PREFIXE}contact recommandé`,
      },
    }),
  );
}

async function ouvrirDialogue(page: Page): Promise<Locator> {
  await page.goto('/chues/campagnes');
  await page.getByRole('button', { name: 'Nouvelle campagne' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Nouvelle campagne' });
  await expect(dialogue).toBeVisible();
  return dialogue;
}

/** « Tout décocher » est un lien ; qu'il soit rendu en bouton ne change rien. */
function commande(dialogue: Locator, nom: string): Locator {
  return dialogue.getByRole('link', { name: nom }).or(dialogue.getByRole('button', { name: nom }));
}

const boutonCreer = (dialogue: Locator): Locator =>
  dialogue.getByRole('button', { name: 'Créer la campagne', exact: true });

/**
 * Le champ nombre est visé par son libellé et non par `getByRole('spinbutton')` :
 * le nom accessible est figé par le contrat d'écran, le type de l'`input` ne
 * l'est pas.
 */
async function reglerLaCible(dialogue: Locator): Promise<void> {
  await dialogue.getByRole('radio', { name: 'Représentants (CHUES)' }).check();
  await commande(dialogue, 'Tout décocher').click();
  for (const { nom } of EQUIPE) await dialogue.getByRole('checkbox', { name: nom }).check();
  await dialogue.getByLabel('Fiches par jour, à défaut d’objectif').fill(String(FICHES_PAR_JOUR));
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

  await expect(page).toHaveTitle('Campagnes · CPI GO');
  // Les campagnes sont un onglet du tableau de bord : le titre de l'écran est celui du pilotage.
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Campagnes' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page.getByText(
      'Une campagne répartit des fiches entre les téléconseillers et suit leur traitement.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouvelle campagne' })).toBeVisible();

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
    'vivier trop court : le `beforeAll` n’a pas posé sa réserve',
  ).toBeGreaterThanOrEqual(PLACES);
  expect(apercu.places, 'deux capacités pleines et une réduite, sur deux jours').toBe(PLACES);
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

test('CHU-LOT-05 · la création fige les places de la répartition et le détail rend le tourniquet', async ({
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

  for (const { nom, capacite } of EQUIPE) {
    const ligne = tableau
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: nom }) });
    for (let jour = 1; jour <= JOURS; jour += 1) {
      const cellule = ligne.getByRole('cell').filter({
        has: page.getByRole('button', { name: `Programme de ${nom}, jour ${String(jour)}` }),
      });
      await expect(cellule, `${nom}, jour ${String(jour)}`).toContainText(String(capacite));
    }
  }
});

test('CHU-LOT-06 · le programme d’un téléconseiller est un vrai PDF, nommé', async ({ page }) => {
  await ouvrirLeLot(page);

  const [fichier] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: `Programme de ${EQUIPE[0].nom}, jour 1` }).click(),
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

    await creerRepresentant(api, RANG_TARDIF, leDepartement().id);

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

/**
 * EB-14 à EB-19 : la campagne que règle un superviseur. CHU-LOT-10 à CHU-LOT-21.
 *
 * Le nom se SAISIT désormais et la suppression existe : ces campagnes portent le
 * préfixe du fichier, et le `beforeAll` retire celles de l'exécution précédente.
 * Elles visent le PREMIER département du référentiel, le seul où vive la réserve
 * `E2E-CHUES-LOT Rep` : l'appel consigné par CHU-LOT-16 ne touche donc aucune
 * fiche appartenant à une autre spec.
 *
 * Les onze parcours s'enchaînent sur une seule campagne, dans l'ordre où ils
 * sont écrits : le fichier est en `serial`.
 */

const NOM_CREATION = `${PREFIXE}campagne du superviseur`;
const NOM_RENOMME = `${PREFIXE}campagne renommée`;

/** EB-17 : l'objectif explicite prime sur la capacité déduite du rôle. */
const OBJECTIF_AWA = 4;
const OBJECTIF_AWA_CORRIGE = 5;

/**
 * Un seul jour : la répartition tient dans une page de fiches, et chaque compte
 * reçoit exactement sa capacité. Awa 4 par objectif, Fatou 3 par défaut,
 * Superviseur Fixture 1 par capacité réduite.
 */
const JOURS_SUP = 1;
const FICHES_AWA = OBJECTIF_AWA;
const FICHES_FATOU = FICHES_PAR_JOUR;
const FICHES_SUPERVISEUR = capaciteReduite(FICHES_PAR_JOUR);
const FICHES_SUP = FICHES_AWA + FICHES_FATOU + FICHES_SUPERVISEUR;

const [AWA, FATOU, SUPERVISEUR] = EQUIPE.map((membre) => membre.nom) as [string, string, string];

interface Fiche {
  position: number;
  ficheId: string | null;
  fullName: string;
  teleconseillerName: string;
  etat: 'NON_TRAITEE' | 'TRAITEE' | 'A_RAPPELER';
}

let campagne: Lot | null = null;
let ficheTraitee: Fiche | null = null;

function laCampagne(): Lot {
  expect(
    campagne,
    'CHU-LOT-10 n’a pas créé de campagne : les suivants n’ont rien à ouvrir',
  ).not.toBeNull();
  if (campagne === null) throw new Error('campagne absente');
  return campagne;
}

async function ouvrirLaCampagne(page: Page): Promise<Lot> {
  const cree = laCampagne();
  await page.goto(`/chues/campagnes/${cree.id}`);
  await expect(page.getByRole('heading', { name: cree.name, level: 2 })).toBeVisible();
  return cree;
}

const carteFiches = (page: Page): Locator =>
  page.getByRole('table', { name: 'Fiches de la campagne' });

const cartePerformance = (page: Page): Locator =>
  page.getByRole('table', { name: 'Performance de la campagne' });

function lignePerformance(page: Page, nom: string): Locator {
  return cartePerformance(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: nom, exact: true }) });
}

/** Les listes déroulantes du panel sont des boutons ; leurs options vivent dans un portail. */
async function choisir(page: Page, champ: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: champ, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function fichesDeLaCampagne(id: string): Promise<Fiche[]> {
  const api = await adminApi();
  try {
    const page = await lire<{ items: Fiche[] }>(
      await api.get(`/api/v1/lots-export/${id}/fiches`, { params: { pageSize: '100' } }),
    );
    return page.items;
  } finally {
    await api.dispose();
  }
}

test.describe('campagne réglée par un superviseur', () => {
  test.use({ storageState: 'e2e/.auth/superviseur.json' });

  test('CHU-LOT-10 · le nom proposé suit les critères, et c’est le nom corrigé qui ouvre le détail', async ({
    page,
  }) => {
    const departement = leDepartement();

    await page.goto('/chues/campagnes');
    await page.getByRole('button', { name: 'Nouvelle campagne' }).click();
    const dialogue = page.getByRole('dialog', { name: 'Nouvelle campagne' });
    await expect(dialogue).toBeVisible();

    await dialogue.getByRole('radio', { name: 'Représentants (CHUES)' }).check();
    await choisir(page, 'Département', departement.name);
    await commande(dialogue, 'Tout décocher').click();
    for (const { nom } of EQUIPE) await dialogue.getByRole('checkbox', { name: nom }).check();
    await dialogue
      .getByRole('spinbutton', { name: `Objectif quotidien de ${AWA}` })
      .fill(String(OBJECTIF_AWA));

    // EB-14 : le nom est PROPOSÉ d'après la cible et le lieu, puis daté. Sans
    // cette lecture, rien ne distinguerait un champ pré-rempli d'un champ vide.
    const champNom = dialogue.getByLabel('Nom de la campagne');
    const propose = await champNom.inputValue();
    const attendu = `Représentants non qualifiés, département de ${departement.name}, `;
    expect(propose.slice(0, attendu.length), 'le nom proposé ne suit pas les critères').toBe(
      attendu,
    );
    expect(propose.length, 'le nom proposé ne porte pas de date').toBeGreaterThan(attendu.length);

    await champNom.fill(NOM_CREATION);

    const attendreLApercu = page.waitForResponse((candidate) => {
      if (!candidate.url().includes('/api/v1/lots-export/apercu')) return false;
      if (candidate.request().method() !== 'POST') return false;
      const corps = candidate.request().postDataJSON() as {
        cible?: string;
        distribution?: {
          jours?: number;
          fichesParJour?: number;
          objectifs?: { fichesParJour: number }[];
        };
      } | null;
      return (
        corps?.cible === 'REPRESENTANTS' &&
        corps.distribution?.jours === JOURS_SUP &&
        corps.distribution.fichesParJour === FICHES_PAR_JOUR &&
        corps.distribution.objectifs?.length === 1 &&
        corps.distribution.objectifs[0]?.fichesParJour === OBJECTIF_AWA
      );
    });
    await dialogue.getByLabel('Fiches par jour, à défaut d’objectif').fill(String(FICHES_PAR_JOUR));
    await attendreLApercu;

    const creation = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith('/api/v1/lots-export') && candidate.request().method() === 'POST',
    );
    await dialogue.getByRole('button', { name: 'Créer la campagne', exact: true }).click();

    const reponse = await creation;
    const corps = await reponse.text();
    expect(reponse.status(), corps).toBe(201);
    const cree = JSON.parse(corps) as Lot;
    expect(cree.name, 'le nom corrigé n’est pas celui qui part au serveur').toBe(NOM_CREATION);
    expect(
      cree.itemCount,
      'l’objectif saisi n’a pas compté dans les places : 4 + 3 + 1 sur un jour',
    ).toBe(FICHES_SUP);
    campagne = cree;

    await page.waitForURL(`**/chues/campagnes/${cree.id}`);
    await expect(page.getByRole('heading', { name: NOM_CREATION, level: 2 })).toBeVisible();
  });

  test('CHU-LOT-11 · un superviseur ne peut supprimer aucune campagne', async ({ page }) => {
    const cree = await ouvrirLaCampagne(page);

    await expect(
      page.getByRole('button', { name: `Supprimer ${cree.name}` }),
      'le détail ouvre la suppression à qui n’y a pas droit',
    ).toHaveCount(0);

    await page.goto('/chues/campagnes');
    await page.getByLabel('Rechercher une campagne').fill(cree.name);
    // La campagne est bien LÀ : sans cette ligne, l'absence de bouton ne dirait
    // que l'absence de liste.
    await expect(page.getByRole('link', { name: cree.name, exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Supprimer / }),
      'la liste ouvre la suppression à qui n’y a pas droit',
    ).toHaveCount(0);
  });

  test('CHU-LOT-12 · le renommage depuis le détail survit à un rechargement', async ({ page }) => {
    const cree = await ouvrirLaCampagne(page);

    await page.getByRole('button', { name: 'Renommer la campagne' }).click();
    await page.getByLabel('Nom de la campagne').fill(NOM_RENOMME);

    const renommage = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith(`/api/v1/lots-export/${cree.id}`) &&
        candidate.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Enregistrer le nom' }).click();
    expect((await renommage).status()).toBe(200);

    await expect(page.getByRole('heading', { name: NOM_RENOMME, level: 2 })).toBeVisible();

    // Le rechargement relit le serveur : sans lui, l'écran ne montrerait que sa
    // propre saisie.
    await page.reload();
    await expect(page.getByRole('heading', { name: NOM_RENOMME, level: 2 })).toBeVisible();
    campagne = { ...cree, name: NOM_RENOMME };
  });

  test('CHU-LOT-13 · l’objectif saisi à la création se relit dans « Objectif par jour »', async ({
    page,
  }) => {
    await ouvrirLaCampagne(page);

    await expect(
      cartePerformance(page).getByRole('columnheader', { name: 'Objectif par jour' }),
    ).toBeVisible();
    await expect(
      lignePerformance(page, AWA).getByRole('spinbutton', {
        name: `Objectif quotidien de ${AWA}`,
      }),
      'l’objectif saisi à la création ne se relit pas',
    ).toHaveValue(String(OBJECTIF_AWA));
    await expect(
      lignePerformance(page, AWA),
      'l’objectif n’a pas commandé la part d’Awa dans la répartition',
    ).toContainText(`0 sur ${String(FICHES_AWA)}`);
  });

  test('CHU-LOT-14 · l’objectif se corrige depuis le détail et survit à un rechargement', async ({
    page,
  }) => {
    const cree = await ouvrirLaCampagne(page);

    const champ = lignePerformance(page, AWA).getByRole('spinbutton', {
      name: `Objectif quotidien de ${AWA}`,
    });
    const reglage = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith(`/api/v1/lots-export/${cree.id}`) &&
        candidate.request().method() === 'PATCH',
    );
    await champ.fill(String(OBJECTIF_AWA_CORRIGE));
    // Le champ n'enregistre qu'en perdant le focus : le laisser rempli sans le
    // quitter n'envoie rien.
    await champ.blur();
    expect((await reglage).status()).toBe(200);

    await page.reload();
    await expect(
      lignePerformance(page, AWA).getByRole('spinbutton', {
        name: `Objectif quotidien de ${AWA}`,
      }),
    ).toHaveValue(String(OBJECTIF_AWA_CORRIGE));
  });

  test('CHU-LOT-15 · le filtre par téléconseiller ne rend que les fiches de l’intéressé', async ({
    page,
  }) => {
    await ouvrirLaCampagne(page);

    const tableau = carteFiches(page);
    await expect(tableau.getByRole('rowheader')).toHaveCount(FICHES_SUP);

    await choisir(page, 'Téléconseiller', AWA);
    await expect(
      tableau.getByRole('rowheader'),
      `${AWA} a ${String(FICHES_AWA)} fiches`,
    ).toHaveCount(FICHES_AWA);
    await expect(
      tableau.getByRole('cell', { name: AWA, exact: true }),
      'toutes les lignes rendues doivent être les siennes',
    ).toHaveCount(FICHES_AWA);
    await expect(tableau.getByRole('cell', { name: FATOU, exact: true })).toHaveCount(0);
  });

  test('CHU-LOT-16 · une fiche appelée passe à « Traitée », et le filtre par état la retrouve', async ({
    page,
  }) => {
    const cree = laCampagne();
    const fiches = await fichesDeLaCampagne(cree.id);
    // Le département de la réserve loge aussi des fiches d'amorçage : l'appel
    // ne se consigne que sur une fiche de ce fichier.
    const cible = fiches.find(
      (fiche) =>
        fiche.teleconseillerName === AWA &&
        fiche.etat === 'NON_TRAITEE' &&
        fiche.fullName.startsWith(PREFIXE),
    );
    expect(cible, `aucune fiche de la réserve non traitée confiée à ${AWA}`).toBeDefined();
    if (cible === undefined) return;

    // L'appel se consigne SOUS LE COMPTE D'AWA : la fiche est la sienne, et la
    // performance ne compte que les appels de l'attributaire.
    const awa = await request.newContext({
      baseURL: WEB_URL,
      storageState: 'e2e/.auth/commercial.json',
    });
    try {
      await lire(
        await awa.post('/api/v1/rep-campaigns/attempts', {
          data: {
            id: crypto.randomUUID(),
            representantId: cible.ficheId,
            outcome: 'REACHED',
            clientCreatedAt: new Date().toISOString(),
          },
        }),
      );
    } finally {
      await awa.dispose();
    }
    ficheTraitee = cible;

    await ouvrirLaCampagne(page);
    const tableau = carteFiches(page);

    await choisir(page, 'État', 'Traitée');
    await expect(tableau.getByRole('rowheader')).toHaveCount(1);
    await expect(
      tableau.getByRole('rowheader', { name: cible.fullName, exact: true }),
    ).toBeVisible();

    await choisir(page, 'État', 'Non traitée');
    await expect(tableau.getByRole('rowheader')).toHaveCount(FICHES_SUP - 1);
    await expect(
      tableau.getByRole('rowheader', { name: cible.fullName, exact: true }),
      'une fiche appelée reste comptée comme non traitée',
    ).toHaveCount(0);
  });

  test('CHU-LOT-17 · une fiche traitée ne se coche pas', async ({ page }) => {
    expect(ficheTraitee, 'CHU-LOT-16 n’a consigné aucun appel').not.toBeNull();
    if (ficheTraitee === null) return;
    await ouvrirLaCampagne(page);

    const tableau = carteFiches(page);
    await expect(
      tableau.getByRole('checkbox', { name: `Attribuer la fiche de ${ficheTraitee.fullName}` }),
      'une fiche appelée se déplacerait, et son travail passerait au compteur d’un autre',
    ).toBeDisabled();

    const encoreAFaire = (await fichesDeLaCampagne(laCampagne().id)).find(
      (fiche) => fiche.etat === 'NON_TRAITEE',
    );
    expect(
      encoreAFaire,
      'plus une seule fiche non traitée : le refus ne prouverait rien',
    ).toBeDefined();
    if (encoreAFaire === undefined) return;
    await expect(
      tableau.getByRole('checkbox', { name: `Attribuer la fiche de ${encoreAFaire.fullName}` }),
    ).toBeEnabled();
  });

  test('CHU-LOT-18 · les fiches cochées passent à un autre compte, et « Réaffectations » l’inscrit', async ({
    page,
  }) => {
    await ouvrirLaCampagne(page);
    const tableau = carteFiches(page);

    await choisir(page, 'Téléconseiller', FATOU);
    await expect(tableau.getByRole('rowheader')).toHaveCount(FICHES_FATOU);
    const rendues = await tableau.getByRole('rowheader').allInnerTexts();

    await tableau
      .getByRole('checkbox', { name: 'Cocher toutes les fiches non traitées de la page' })
      .check();
    await choisir(page, 'Attribuer les fiches à', SUPERVISEUR);

    const envoi = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith(`/api/v1/lots-export/${laCampagne().id}/reaffectation`) &&
        candidate.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Attribuer', exact: true }).click();
    expect((await envoi).status()).toBe(200);

    // Le filtre n'a pas bougé : ce qui reste sous le nom du cédant est ce qu'il
    // n'a pas rendu.
    await expect(page.getByText('Aucune fiche ne correspond à ces filtres.')).toBeVisible();

    await choisir(page, 'Téléconseiller', SUPERVISEUR);
    await expect(tableau.getByRole('rowheader')).toHaveCount(FICHES_SUPERVISEUR + FICHES_FATOU);
    for (const nom of rendues) {
      await expect(
        tableau.getByRole('rowheader', { name: nom, exact: true }),
        `« ${nom} » n’a pas changé de téléconseiller`,
      ).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: 'Réaffectations', level: 3 })).toBeVisible();
    await expect(
      page.getByText(`${String(FICHES_FATOU)} fiches de ${FATOU} vers ${SUPERVISEUR}`),
      'le mouvement ne laisse aucune trace lisible',
    ).toBeVisible();
  });

  test('CHU-LOT-19 · un téléconseiller retiré rend ses fiches au reste de l’équipe', async ({
    page,
  }) => {
    await ouvrirLaCampagne(page);

    const avant = FICHES_SUPERVISEUR + FICHES_FATOU;
    await expect(lignePerformance(page, SUPERVISEUR)).toContainText(`0 sur ${String(avant)}`);
    await expect(lignePerformance(page, AWA)).toContainText(`1 sur ${String(FICHES_AWA)}`);

    await page.getByRole('button', { name: `Retirer ${SUPERVISEUR} de la campagne` }).click();
    const dialogue = page.getByRole('dialog', { name: `Retirer ${SUPERVISEUR} ?` });
    const retrait = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith(`/api/v1/lots-export/${laCampagne().id}/retrait`) &&
        candidate.request().method() === 'POST',
    );
    await dialogue.getByRole('button', { name: 'Retirer', exact: true }).click();
    expect((await retrait).status()).toBe(200);

    await expect(
      cartePerformance(page).getByRole('rowheader', { name: SUPERVISEUR, exact: true }),
      'un compte sans fiche reste affiché comme s’il travaillait encore',
    ).toHaveCount(0);

    // Les quatre fiches rendues repartent selon les objectifs en vigueur :
    // Awa 5, Fatou 3, donc deux et deux.
    await expect(lignePerformance(page, AWA)).toContainText(`1 sur ${String(FICHES_AWA + 2)}`);
    await expect(lignePerformance(page, FATOU)).toContainText('0 sur 2');
  });

  test('CHU-LOT-20 · la cible « Représentants injoignables » compte ce que le serveur compte', async ({
    page,
  }) => {
    const apercu = await apercuDeLaCible(
      page,
      'Représentants injoignables',
      'REPRESENTANTS_INJOIGNABLES',
    );

    expect(
      apercu.eligible,
      'aucun représentant injoignable en base : la cible ne peut rien prouver ici',
    ).toBeGreaterThan(0);
    expect(apercu.scopeLabel).toBe('Représentants injoignables');
  });

  test('CHU-LOT-21 · la cible « Contacts recommandés » compte ce que le serveur compte', async ({
    page,
  }) => {
    const apercu = await apercuDeLaCible(page, 'Contacts recommandés', 'CONTACTS_RECOMMANDES');

    expect(
      apercu.eligible,
      'aucun contact recommandé en attente : le `beforeAll` n’a pas posé le sien',
    ).toBeGreaterThan(0);
    expect(apercu.scopeLabel).toBe('Contacts recommandés');
  });
});

/**
 * Ouvre le dialogue sur une cible et rend l'aperçu LU SUR LE RÉSEAU, après
 * avoir vérifié que l'écran affiche bien ce nombre-là. Un compte estimé côté
 * navigateur divergerait du tirage réel sans que rien ne le dise.
 */
async function apercuDeLaCible(page: Page, titre: string, cible: string): Promise<Apercu> {
  await page.goto('/chues/campagnes');
  await page.getByRole('button', { name: 'Nouvelle campagne' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Nouvelle campagne' });
  await expect(dialogue).toBeVisible();

  const attendu = page.waitForResponse((candidate) => {
    if (!candidate.url().includes('/api/v1/lots-export/apercu')) return false;
    if (candidate.request().method() !== 'POST') return false;
    return (candidate.request().postDataJSON() as { cible?: string } | null)?.cible === cible;
  });
  // Le libellé accessible du bouton radio porte AUSSI le texte d'aide de la
  // cible : `exact` ne trouverait rien.
  await dialogue.getByRole('radio', { name: titre }).check();
  const apercu = await lire<Apercu>(await attendu);

  const annonce = dialogue.getByRole('status');
  await expect(annonce).toContainText(`${String(apercu.eligible)} fiche`);
  await expect(annonce).toContainText('disponible');
  return apercu;
}
