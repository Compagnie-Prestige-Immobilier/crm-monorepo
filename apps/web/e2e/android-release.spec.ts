import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request as RequeteReseau,
} from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Publication d'une version Android : `/admin/parametres`, carte
 * « Version Android ». ADM-APK-01 à ADM-APK-18.
 *
 * Ce que le Vitest de `android-release-card.test.tsx` ne peut pas prouver, et
 * qui est le seul objet de ce fichier : le fichier traverse réellement
 * `XMLHttpRequest`, le relais Next en flux (`duplex: 'half'`), le multipart
 * Fastify, puis la lecture du manifeste et du bloc de signature v2/v3 SUR
 * DISQUE. Aucun envoi n'est simulé ici.
 *
 * UN SEUL ONGLET pour tout le fichier : la fenêtre « Version publiée » et la
 * barre d'envoi vivent dans le cache de mutation du navigateur. Une page neuve
 * par test les perdrait, et ADM-APK-02 comme ADM-APK-03 n'auraient plus rien à
 * lire.
 *
 * CHAQUE `versionCode` NE SE PUBLIE QU'UNE FOIS, pour toujours : l'API refuse
 * même celui d'une release RETIRÉE (`app-updates.service.ts`, `releases()` rend
 * aussi les retirées et `assertPublishable` compare au plus haut). Les deux
 * seules fixtures publiables portent 7 et 12 : ce fichier dispose donc de DEUX
 * publications réussies pour toute la vie de la base, et l'ordre ci-dessous est
 * contraint par là.
 */

test.describe.configure({ mode: 'serial' });

const ETAT_ADMIN = 'e2e/.auth/admin.json';
test.use({ storageState: ETAT_ADMIN });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const PARAMETRES = '/admin/parametres';

/** Route dédiée du panel, hors du relais générique : elle envoie en flux. */
const ROUTE_ENVOI = '**/api/app-updates/android';
const CHEMIN_ENVOI = '/api/app-updates/android';
const CHEMIN_RELEASES = '/api/v1/app-updates/android/releases';

/** §6.3 : un toast Sonner n'a aucun rôle, c'est un `<li data-sonner-toast>`. */
const TOAST = '[data-sonner-toast]';
const PIED_DE_FENETRE = '[data-slot="dialog-footer"]';

const DOSSIER_FIXTURES = fileURLToPath(
  new URL('../../api/src/modules/app-updates/fixtures/', import.meta.url),
);
const cheminFixture = (nom: string): string => `${DOSSIER_FIXTURES}${nom}`;

const empreinte = (nom: string): string =>
  createHash('sha256')
    .update(readFileSync(cheminFixture(nom)))
    .digest('hex');

/** `shortHash` de `lib/data/app-updates.ts` : huit premiers, huit derniers. */
const raccourci = (hex: string): string => `${hex.slice(0, 8)}…${hex.slice(-8)}`;

/** `APK_SIGNER_SHA256` posée sur l'API : la clé des APK de fixture (§3.4). */
const SIGNATAIRE = '9434b1f9594e7f5d20bda74d047e40affdc8003f51d89421d4b79456ad7f3909';

const V7 = {
  fichier: 'cpi-go-v7.apk',
  build: 7,
  version: '1.4.2',
} as const;
const V12 = {
  fichier: 'cpi-go-v12.apk',
  build: 12,
  version: '1.9.0',
} as const;

/**
 * `formatFileSize` arrondit AU-DESSUS (`Math.ceil`) : 8 339 octets s'affichent
 * « 9 Ko », et non « 8 Ko » comme l'annonce le plan.
 */
const TAILLE = '9 Ko';

/** Les seuls `versionCode` que ce fichier a le droit de retirer (§4.3.9). */
const MES_BUILDS: readonly number[] = [V7.build, V12.build];

const NOTE = 'E2E-APK note de version';

interface Release {
  readonly versionCode: number;
  readonly versionName: string;
  readonly notes: string | null;
  readonly withdrawnAt: string | null;
}
interface ListeReleases {
  readonly items: Release[];
  readonly minVersionCode: number | null;
}

let contexte: BrowserContext;
let page: Page;

/**
 * L'état réel en base, relu par l'API après le geste navigateur (§4.1).
 * L'API ne remplace jamais un clic ici : elle sert uniquement de témoin.
 */
async function relire(): Promise<ListeReleases> {
  const api = await adminApi();
  try {
    const reponse = await api.get(CHEMIN_RELEASES);
    expect(
      reponse.ok(),
      `${CHEMIN_RELEASES} a répondu ${String(reponse.status())} : ${await reponse.text()}`,
    ).toBe(true);
    return (await reponse.json()) as ListeReleases;
  } finally {
    await api.dispose();
  }
}

async function ouvrirParametres(): Promise<void> {
  const chargement = page.waitForResponse((reponse) =>
    new URL(reponse.url()).pathname.startsWith(CHEMIN_RELEASES),
  );
  await page.goto(PARAMETRES);
  await chargement;
  await expect(page.getByRole('table')).toBeVisible();
}

const publier = () => page.getByRole('button', { name: 'Publier' });
const enCours = () => page.getByRole('button', { name: 'Envoi en cours…' });
const toast = (texte: string) => page.locator(TOAST).filter({ hasText: texte });
const bandeau = (etiquette: string) => page.locator('p').filter({ hasText: etiquette });
const barreDEnvoi = (fichier: string) =>
  page
    .locator(TOAST)
    .filter({ hasText: fichier })
    .filter({ has: page.getByRole('progressbar') });

async function deposer(fichier: string): Promise<void> {
  await page.getByLabel('Choisir un fichier APK').setInputFiles(cheminFixture(fichier));
}

/**
 * Retient l'envoi AVANT le serveur.
 *
 * Un APK de fixture pèse 8 Ko : sans ce retard posé sur le RÉSEAU (légitime,
 * §4.5, contrairement à une attente fixe dans le test), la barre de progression
 * apparaît et disparaît dans le même battement et rien n'est observable.
 */
async function retenirEnvoi(): Promise<{
  liberer: () => Promise<void>;
  abandonner: () => Promise<void>;
}> {
  let ouvrir: () => void = () => undefined;
  const porte = new Promise<void>((resolve) => {
    ouvrir = resolve;
  });

  await page.route(ROUTE_ENVOI, async (route) => {
    await porte;
    await route.continue();
  });

  return {
    liberer: async () => {
      ouvrir();
      await page.unrouteAll({ behavior: 'wait' });
    },
    abandonner: async () => {
      ouvrir();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    },
  };
}

/**
 * Laisse l'envoi atteindre RÉELLEMENT le serveur, puis retient sa réponse :
 * ADM-APK-18 doit prouver qu'une navigation dure ne laisse aucune publication
 * partielle derrière elle, ce qu'un envoi arrêté avant le serveur ne prouve pas.
 */
async function retenirReponse(): Promise<{
  servi: Promise<void>;
  abandonner: () => Promise<void>;
}> {
  let recu: () => void = () => undefined;
  const servi = new Promise<void>((resolve) => {
    recu = resolve;
  });
  let ouvrir: () => void = () => undefined;
  const porte = new Promise<void>((resolve) => {
    ouvrir = resolve;
  });

  await page.route(ROUTE_ENVOI, async (route) => {
    const reponse = await route.fetch();
    recu();
    await porte;
    await route.fulfill({ response: reponse });
  });

  return {
    servi,
    abandonner: async () => {
      ouvrir();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    },
  };
}

test.beforeAll(async ({ browser }) => {
  // `browser.newContext` n'hérite ni de `baseURL`, ni de la locale, ni du
  // fuseau du projet : ils sont recopiés à l'identique de `playwright.config.ts`.
  contexte = await browser.newContext({
    baseURL: WEB_URL,
    storageState: ETAT_ADMIN,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
  });
  page = await contexte.newPage();
});

/**
 * Aucune assertion ici (§5.1). Le fichier retire ce QU'IL a publié, et rien
 * d'autre : les releases 6 et 5, posées hors de ce test, restent en ligne.
 */
test.afterAll(async () => {
  const api = await adminApi();
  const reponse = await api.get(CHEMIN_RELEASES);
  if (reponse.ok()) {
    const liste = (await reponse.json()) as ListeReleases;
    for (const release of liste.items) {
      if (MES_BUILDS.includes(release.versionCode) && release.withdrawnAt === null) {
        await api.post(`/api/v1/app-updates/android/${String(release.versionCode)}/withdraw`);
      }
    }
  }
  await api.dispose();
  await contexte.close();
});

test('ADM-APK-11 · un fichier qui n’est pas un APK est refusé sans partir sur le réseau', async () => {
  await ouvrirParametres();

  const envois: string[] = [];
  const espion = (requete: RequeteReseau): void => {
    if (new URL(requete.url()).pathname === CHEMIN_ENVOI) envois.push(requete.url());
  };
  page.on('request', espion);

  await page.getByLabel('Choisir un fichier APK').setInputFiles({
    name: 'E2E-APK-note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('E2E-APK : ceci n’est pas un APK.', 'utf8'),
  });

  await expect(toast('Déposez un fichier .apk.')).toBeVisible();
  // Le fichier n'a pas été retenu : rien à publier, donc rien à envoyer.
  await expect(publier()).toBeDisabled();
  page.off('request', espion);
  expect(
    envois,
    'un fichier non-.apk ne doit jamais atteindre le serveur, qui devrait alors le refuser après transfert',
  ).toEqual([]);
});

test('ADM-APK-09 · un manifeste illisible est refusé, sans version inventée', async () => {
  await ouvrirParametres();
  await deposer('manifeste-illisible.apk');
  await publier().click();

  await expect(toast('Le manifeste de cet APK est illisible')).toBeVisible();
});

test('ADM-APK-08 · un APK d’un autre éditeur est refusé, son paquet nommé', async () => {
  await ouvrirParametres();
  await deposer('autre-editeur-v99.apk');
  await publier().click();

  await expect(toast('et non « sn.cpi.go »')).toBeVisible();
});

/**
 * ADM-APK-07 et ADM-APK-06 passent AVANT toute publication : le serveur lit le
 * manifeste puis compare le `versionCode` AVANT de regarder la signature
 * (`app-updates.service.ts`, `assertPublishable` avant `readApkSignerSha256`).
 * Une fois la 7 publiée, l'APK non signé serait refusé pour sa version, et le
 * refus de signature ne serait plus observable.
 */
test('ADM-APK-07 · un APK sans bloc de signature v2/v3 est refusé', async () => {
  await ouvrirParametres();
  await deposer('cpi-go-v7-non-signe.apk');
  await publier().click();

  await expect(toast('ne porte pas de bloc de signature v2/v3 lisible')).toBeVisible();
});

test('ADM-APK-06 · un APK signé d’une autre clé est refusé et n’entre pas dans l’historique', async () => {
  await ouvrirParametres();
  const avant = (await relire()).items.length;

  await deposer('cpi-go-v12-autre-cle.apk');
  await publier().click();

  await expect(toast('Android refuse une mise à jour signée par une autre clé')).toBeVisible();
  expect(
    (await relire()).items.length,
    'un APK signé d’une autre clé ne doit ajouter aucune ligne à l’historique',
  ).toBe(avant);
});

test('ADM-APK-05 · l’annulation arrête l’envoi et ne publie rien', async () => {
  await ouvrirParametres();
  const avant = (await relire()).items.length;

  const envoi = await retenirEnvoi();
  await deposer(V7.fichier);
  await publier().click();

  const barre = barreDEnvoi(V7.fichier);
  await expect(barre.getByRole('progressbar', { name: `Envoi de ${V7.fichier}` })).toBeVisible();
  await barre.getByRole('button', { name: 'Annuler' }).click();

  await expect(toast('Envoi annulé.')).toBeVisible();
  await expect(barre).toHaveCount(0);
  await envoi.abandonner();

  expect(
    (await relire()).items.length,
    'une annulation visuelle qui publie quand même est le défaut cherché',
  ).toBe(avant);
});

test('ADM-APK-01 · publication réussie de cpi-go-v7.apk', async () => {
  await ouvrirParametres();
  await deposer(V7.fichier);

  await expect(page.getByText(`${V7.fichier} · ${TAILLE}`)).toBeVisible();

  const envoi = await retenirEnvoi();
  await publier().click();

  await expect(
    barreDEnvoi(V7.fichier).getByRole('progressbar', { name: `Envoi de ${V7.fichier}` }),
    'sans barre de progression, l’administrateur ne sait pas si l’envoi est parti',
  ).toBeVisible();
  await expect(enCours()).toBeDisabled();
  await envoi.liberer();

  await expect(toast(`CPI GO ${V7.version} publiée.`)).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Version publiée')).toBeVisible();
});

test('ADM-APK-02 · la fenêtre dit ce que le serveur a lu dans le fichier', async () => {
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toBeVisible();
  await expect(
    fenetre.getByText(
      'Voici ce que le serveur a lu dans le fichier. Rien n’a été saisi à la main.',
    ),
  ).toBeVisible();

  await expect(fenetre.getByRole('term')).toHaveText([
    'Version',
    'Build',
    'Taille',
    'Empreinte',
    'Signataire',
  ]);

  // Chaque valeur est celle du FICHIER, recalculée ici : une valeur saisie côté
  // client, ou reprise du nom du fichier, ne correspondrait pas.
  await expect(fenetre.getByRole('definition')).toHaveText([
    V7.version,
    String(V7.build),
    TAILLE,
    raccourci(empreinte(V7.fichier)),
    raccourci(SIGNATAIRE),
  ]);

  for (const valeur of await fenetre.getByRole('definition').allTextContents()) {
    expect(valeur.trim(), 'aucune valeur lue dans l’APK ne doit être vide ni « — »').not.toBe('');
    expect(valeur.trim()).not.toBe('—');
  }
});

test('ADM-APK-03 · publier et rendre obligatoire sont deux gestes', async () => {
  const fenetre = page.getByRole('dialog');
  await expect(
    fenetre.getByText(
      'Les téléphones en dessous de cette version devront l’installer pour continuer.',
    ),
    'l’encart est une proposition, pas un fait accompli',
  ).toBeVisible();

  // Le plancher est encore celui d'AVANT cette publication : publier n'a rien
  // rendu obligatoire.
  await expect(bandeau('Plancher obligatoire :')).toHaveText('Plancher obligatoire : build 6');

  await fenetre.getByRole('button', { name: 'Rendre obligatoire' }).click();

  await expect(toast(`CPI GO ${V7.version} est maintenant obligatoire.`)).toBeVisible();
  await expect(
    fenetre.getByText('Cette version est déjà une mise à jour obligatoire.'),
  ).toBeVisible();
  await expect(bandeau('Plancher obligatoire :')).toHaveText(
    `Plancher obligatoire : build ${String(V7.build)}`,
  );

  // `DialogContent` rend AUSSI une croix nommée « Fermer » : sans le pied de
  // fenêtre, le sélecteur en trouve deux et viole le mode strict.
  await fenetre.locator(PIED_DE_FENETRE).getByRole('button', { name: 'Fermer' }).click();
  await expect(fenetre).toHaveCount(0);
});

test('ADM-APK-15 · l’historique porte ses huit colonnes et garde les versions retirées', async () => {
  await ouvrirParametres();
  const tableau = page.getByRole('table');

  await expect(tableau.getByRole('columnheader')).toHaveText([
    'Build',
    'Version',
    'Publiée le',
    'Par',
    'Taille',
    'Obligatoire',
    'État',
    'Actions',
  ]);

  const ligne = tableau.getByRole('row').filter({ hasText: V7.version });
  await expect(ligne.getByRole('cell')).toHaveText([
    String(V7.build),
    V7.version,
    /^\d{2} [\p{L}.]+ \d{4} à \d{2}:\d{2}$/u,
    'Administrateur CPI',
    TAILLE,
    'Mise à jour obligatoire',
    'En ligne',
    'Retirer',
  ]);

  await expect(
    tableau.getByRole('row').filter({ hasText: 'Retirée' }).first(),
    'une version retirée reste listée : elle n’est plus distribuée, mais sa trace demeure',
  ).toBeVisible();
});

test('ADM-APK-10 · un versionCode qui ne dépasse pas la release en ligne est refusé', async () => {
  await ouvrirParametres();
  await deposer(V7.fichier);
  await publier().click();

  await expect(toast('Une publication doit être STRICTEMENT supérieure')).toBeVisible();
});

test('ADM-APK-14 · le plancher obligatoire redescend après un retrait', async () => {
  await ouvrirParametres();
  await expect(bandeau('Plancher obligatoire :')).toHaveText(
    `Plancher obligatoire : build ${String(V7.build)}`,
  );

  const ligne = page.getByRole('table').getByRole('row').filter({ hasText: V7.version });
  await ligne.getByRole('button', { name: 'Retirer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Retirer' }).click();

  await expect(toast(`CPI GO ${V7.version} retirée.`)).toBeVisible();
  await expect(
    bandeau('Plancher obligatoire :'),
    'un plancher resté sur une version retirée bloque le parc sur un APK qui n’est plus téléchargeable',
  ).toHaveText('Plancher obligatoire : build 6');
});

/**
 * ADM-APK-04. La 12 est publiée ICI, et non dans ADM-APK-17 : il ne reste que
 * deux publications possibles pour toute la vie de la base, et un envoi qui
 * survit à la navigation est P1 quand la note de version est P3. La note est
 * saisie au passage ; ADM-APK-17 la relit.
 */
test('ADM-APK-04 · l’envoi ne bloque pas la navigation et se termine ailleurs', async () => {
  await ouvrirParametres();
  const envoi = await retenirEnvoi();

  await deposer(V12.fichier);
  await page.getByLabel('Notes de version (facultatif)').fill(NOTE);
  await publier().click();

  await expect(barreDEnvoi(V12.fichier).getByRole('progressbar')).toBeVisible();
  await expect(enCours()).toBeDisabled();
  await expect(
    page.getByText('L’envoi continue en bas de l’écran, même si vous changez de page.'),
  ).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Utilisateurs', exact: true })
    .click();
  await page.waitForURL(/\/admin\/commerciaux$/);

  await expect(
    barreDEnvoi(V12.fichier),
    'la barre doit survivre au départ de l’écran des paramètres',
  ).toBeVisible();

  await envoi.liberer();

  await expect(toast(`CPI GO ${V12.version} publiée.`)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/commerciaux$/);

  const fenetre = page.getByRole('dialog');
  await expect(fenetre.getByText('Version publiée')).toBeVisible();
  // `DialogContent` rend AUSSI une croix nommée « Fermer » : sans le pied de
  // fenêtre, le sélecteur en trouve deux et viole le mode strict.
  await fenetre.locator(PIED_DE_FENETRE).getByRole('button', { name: 'Fermer' }).click();
  await expect(fenetre).toHaveCount(0);
});

test('ADM-APK-17 · la note de version est enregistrée et le champ tient son plafond', async () => {
  const publiee = (await relire()).items.find((release) => release.versionCode === V12.build);
  expect(publiee?.notes, 'la note saisie à la publication ne doit pas se perdre').toBe(NOTE);

  await ouvrirParametres();
  const champ = page.getByLabel('Notes de version (facultatif)');
  await champ.fill('N'.repeat(2_100));

  await expect(
    champ,
    'le champ doit tronquer à 2 000 caractères, sinon l’API rejette la publication entière',
  ).toHaveValue('N'.repeat(2_000));
});

test('ADM-APK-13 · le retrait dit ce qu’il fait, et la version reste listée', async () => {
  await ouvrirParametres();
  const tableau = page.getByRole('table');
  const ligne = tableau.getByRole('row').filter({ hasText: V12.version });

  await ligne.getByRole('button', { name: 'Retirer' }).click();

  const fenetre = page.getByRole('dialog');
  await expect(fenetre.getByText(`Retirer CPI GO ${V12.version} ?`)).toBeVisible();
  await expect(
    fenetre.getByText(
      'Le retrait arrête la distribution de cette version et abaisse le plancher. Il ne désinstalle rien sur les téléphones qui l’ont déjà.',
    ),
  ).toBeVisible();
  await expect(
    fenetre.getByText(`Build ${String(V12.build)} · Signataire ${raccourci(SIGNATAIRE)}`),
  ).toBeVisible();

  await fenetre.getByRole('button', { name: 'Retirer' }).click();

  await expect(toast(`CPI GO ${V12.version} retirée.`)).toBeVisible();
  await expect(ligne.getByRole('cell').nth(6)).toHaveText('Retirée');
  await expect(
    ligne.getByRole('button'),
    'une version retirée ne se rend plus obligatoire et ne se retire plus',
  ).toHaveCount(0);
});

/**
 * ADM-APK-18. Playwright accepte automatiquement les dialogues `beforeunload` :
 * `page.goto` détruit le document, et avec lui le cache de mutation qui porte la
 * barre. La barre NE SURVIT PAS à une navigation dure, contrairement à ce
 * qu'annonce le plan ; ce qui se prouve, et qui est le vrai enjeu, c'est
 * qu'aucune publication partielle n'atteint le serveur — d'où la réponse
 * retenue APRÈS que le corps entier l'a atteint.
 *
 * Placé après la chaîne des publications : ce fichier ne dispose que de deux
 * `versionCode` publiables, et un échec en mode `serial` sauterait tout ce qui
 * suit.
 */
test('ADM-APK-18 · une navigation dure ne laisse aucune publication partielle', async () => {
  await ouvrirParametres();
  const avant = (await relire()).items.length;

  const envoi = await retenirReponse();
  await deposer(V7.fichier);
  await publier().click();

  await expect(barreDEnvoi(V7.fichier).getByRole('progressbar')).toBeVisible();
  // Le corps complet a atteint le serveur : ce qui suit se joue APRÈS lecture.
  await envoi.servi;

  await page.goto('/');
  await envoi.abandonner();

  await expect(page.locator(TOAST).filter({ hasText: V7.fichier })).toHaveCount(0);
  expect(
    (await relire()).items.length,
    'une navigation dure ne doit laisser aucune ligne de plus dans l’historique',
  ).toBe(avant);
});

/**
 * ADM-APK-16. Le plan attend le repli « L’historique des versions Android n’a
 * pas pu être lu. » : `apiErrorText` ne le rend JAMAIS sur un 500, qui prend la
 * branche `Erreur serveur (<statut>). Réessayez.`. L'assertion porte sur ce qui
 * s'affiche réellement ; l'écart est rapporté.
 */
test('ADM-APK-16 · un historique en panne ne fait pas tomber l’écran des paramètres', async () => {
  await page.route('**/api/v1/app-updates/android/releases', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Panne simulée.' }),
    });
  });
  await page.goto(PARAMETRES);

  const panne = page.getByRole('alert').filter({ hasText: 'Erreur serveur' });
  await expect(panne.getByRole('heading', { level: 2, name: 'Erreur serveur' })).toBeVisible();
  await expect(panne).toContainText('Erreur serveur (500). Réessayez.');
  await expect(panne.getByRole('button', { name: 'Réessayer' })).toBeVisible();

  // Le reste de l'écran tient : la panne d'un bloc n'emporte pas les autres.
  await expect(page.getByText('Le jeu est reconstruit par la factory')).toBeVisible();
  await expect(
    page.getByText('Sélection par domaine. La suppression est définitive.'),
  ).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  await page.unrouteAll({ behavior: 'wait' });
});
