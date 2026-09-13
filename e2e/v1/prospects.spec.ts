import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

/**
 * Parcours de référence : session établie → filtrage du tableau → export Excel.
 *
 * La connexion elle-même est jouée par `auth.setup.ts` et vérifiée en propre
 * dans `auth.anon.spec.ts`. Ici on part d'une session déjà posée pour ne pas
 * consommer le quota de connexion de l'API à chaque test.
 *
 * Les deux étapes couvertes ont un mode de défaillance que seul un vrai
 * navigateur révèle :
 *  - les filtres vivent dans l'URL et doivent survivre à un rechargement ;
 *  - l'export est un téléchargement binaire, pas une réponse JSON.
 */

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function readMagic(path: string): Promise<number[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path, { start: 0, end: 3 })) {
    chunks.push(chunk as Buffer);
  }
  return Array.from(Buffer.concat(chunks));
}

test('le jeton de session reste hors de portée du JavaScript de la page', async ({ page }) => {
  await page.goto('/chues/statistiques');
  // Le titre vient de la barre supérieure (`navTitle`) : pour un ADMIN,
  // `/chues/statistiques` s'intitule « Tableau de bord » depuis la fusion des
  // deux écrans de chiffres. « Chiffres » ne subsiste que dans le renvoi
  // `/chues/tableau-de-bord`.
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();

  // C'est toute la raison d'être des cookies httpOnly et du relais `/api/v1/*` :
  // une XSS ne doit pas pouvoir repartir avec la base de prospects.
  const scriptVisible = await page.evaluate(() => document.cookie);
  expect(scriptVisible).not.toContain('cpi_at');
  expect(scriptVisible).not.toContain('cpi_rt');

  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'cpi_at')?.httpOnly).toBe(true);
  expect(cookies.find((cookie) => cookie.name === 'cpi_rt')?.httpOnly).toBe(true);
});

test('filtrage du tableau puis export xlsx', async ({ page }) => {
  await page.goto('/chues/prospects');
  await expect(page.getByRole('table')).toBeVisible();

  /**
   * Visé par son NOM accessible, pas par `[aria-live].first()`.
   *
   * Le `Toaster` de Sonner monte sa propre région `aria-live="polite"`, montée
   * plus haut dans le DOM par le fournisseur global. `.first()` tombait donc
   * sur une région vide et attendait dix secondes un texte qui n'y serait
   * jamais apparu.
   */
  const countLine = page.getByRole('status').filter({ hasText: 'Prospects affichés' });
  await expect(countLine).toBeVisible();
  await expect(countLine).not.toHaveText('');

  // ─── Filtrage ────────────────────────────────────────────────────────────
  // DÉPLIÉ, pas basculé : `AdvancedPanel` mémorise son état dans
  // `localStorage`, et l'état de session l'emporte d'une exécution à l'autre.
  const avances = page.getByRole('button', { name: 'Filtres avancés' });
  if ((await avances.getAttribute('aria-expanded')) !== 'true') await avances.click();
  await expect(avances).toHaveAttribute('aria-expanded', 'true');

  // Le rôle `combobox` est indispensable : l'en-tête de tri de la colonne
  // porte AUSSI le nom accessible « Statut », mais comme `button`. Viser le
  // bouton triait la colonne au lieu d'ouvrir le filtre.
  await page.getByRole('combobox', { name: 'Statut Tous les statuts' }).click();
  await page.getByRole('option', { name: 'Nouveau', exact: true }).click();

  // L'URL EST l'état : sans cela le lien n'est pas partageable, et l'export ne
  // peut pas s'aligner sur ce qui est affiché.
  await expect(page).toHaveURL(/statut=NOUVEAU/);
  await expect(countLine).not.toHaveText('');
  const filtered = (await countLine.textContent())?.trim() ?? '';
  expect(filtered.length).toBeGreaterThan(0);

  // Un rechargement complet restitue exactement le même écran.
  await page.reload();
  await expect(page).toHaveURL(/statut=NOUVEAU/);
  await expect(page.getByRole('status').filter({ hasText: 'Prospects affichés' })).toHaveText(
    filtered,
  );

  // ─── Export ──────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Exporter la vue filtrée/ }).click(),
  ]);

  // Nom daté et extension .xlsx : c'est ce qui décide si le système propose
  // Excel ou ouvre le fichier dans le navigateur.
  expect(download.suggestedFilename()).toMatch(/^cpi-prospects-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const path = await download.path();
  const { size } = await stat(path);
  expect(size).toBeGreaterThan(1_000);

  // Et c'est un VRAI classeur, pas un JSON d'erreur renommé : un 502 relayé
  // tel quel passerait toutes les assertions précédentes sauf celle-ci.
  expect(await readMagic(path)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('chaque écran du panel se charge sans état d’erreur', async ({ page }) => {
  /**
   * Balayage large : chaque écran rend son contenu, jamais l'état d'erreur ni
   * un squelette permanent.
   *
   * Le troisième élément nomme un repère PROPRE à l'écran, pour les routes
   * dont le titre de niveau 1 est celui de leur parent : `navTitle` le dérive
   * de la route, si bien que `/chues/dossiers/abc` affiche « Dossiers
   * bancaires ». Sans ce repère, le balayage se satisferait d'une coquille
   * montée par le layout au-dessus d'une page qui n'a rien rendu.
   *
   * Les adresses sont celles des QUATRE COQUES. Les anciennes racines ne sont
   * plus que les renvois de `app/moved-routes.ts` : elles balayaient la page
   * d'arrivée sous le titre d'avant le découpage.
   */
  for (const [path, heading, marker] of [
    ['/chues', 'Projet CHUES', 'Trois étapes, dans l’ordre'],
    ['/chues/prospects', 'Prospects', null],
    ['/chues/prospects/nouveau', 'Ajouter un prospect', 'Enregistrer ce prospect'],
    // `ConsoleView` a été vidé : ni file d'appels ni carte clavier, un titre de
    // page et un lien vers l'annuaire.
    ['/chues/console', 'Convertir un prospect', 'Ouvrir l’annuaire'],
    // `RepScript` s'ouvre désormais sur un ANNUAIRE cherchable ; la carte
    // clavier n'apparaît qu'une fois un représentant choisi.
    [
      '/chues/appels-representants',
      'Qualifier un représentant',
      'Choisissez qui vous venez d’appeler.',
    ],
    ['/chues/rappels', 'Rappels', 'En retard'],
    ['/chues/suggestions', 'Contacts recommandés', 'Numéros donnés par un représentant'],
    ['/chues/campagnes', 'Lots d’export', 'Fiches figées pour Excel, impression ou terrain.'],
    /**
     * L'écran des campagnes de représentants a été SUPPRIMÉ, mais son adresse
     * n'est pas devenue une 404 : le segment dynamique `chues/campagnes/[id]`
     * la capte avec `id = "representants"`, l'API refuse l'identifiant et
     * `LotExportDetailView` rend « Ce lot n’a pas pu être chargé. ». Même
     * défaut que le lien mort de la console vers `/grand-public/prospects`.
     * Ce qui est écrit ici est ce que l'écran rend AUJOURD'HUI, pas un contrat.
     */
    ['/chues/campagnes/representants', 'Lots d’export', 'Ce lot n’a pas pu être chargé.'],
    ['/chues/dossiers', 'Dossiers bancaires', null],
    ['/chues/dossiers/nouveau', 'Nouveau dossier', null],
    ['/chues/dossiers/export', 'Exporter les dossiers', null],
    ['/chues/dossiers/etapes', 'Étapes des dossiers', null],
    ['/chues/demandes-clients', 'Créations de client à valider', null],
    ['/chues/representants', 'Représentants', null],
    ['/chues/representants/import', 'Importer des représentants', 'Partir du modèle'],
    ['/admin/commerciaux', 'Utilisateurs', null],
    ['/chues/supervision', 'Équipes', null],
    ['/admin/referentiels', 'Listes de référence', null],
    ['/admin/imports', 'Importer un fichier Excel', 'Déposer un classeur'],
    ['/admin/parametres', 'Paramètres', null],
    // `/notifications` renvoie l'ADMIN sur le composeur.
    ['/admin/notifications', 'Envoyer une notification', null],
    /**
     * EN DERNIER, et à dessein : `/chues/statistiques` lit
     * `GET /v1/supervision/activite`, dont la requête SQL porte une virgule de
     * trop (`analytics/supervision.service.ts`, ligne 259) et répond 500. Les
     * autres jeux répondent, la page garde donc des données et rend l'échec
     * carte par carte, en `QueryErrorInline` : aucun titre d'erreur, rien que
     * ce balayage puisse voir. Si la panne s'étend et emporte la page entière,
     * c'est ici qu'elle rougira — et seulement après les vingt-deux autres.
     */
    ['/chues/statistiques', 'Tableau de bord', 'Composer l’écran'],
  ] as const) {
    await page.goto(path);
    // `/chues/campagnes` porte DEUX titres de niveau 1 identiques : celui de la
    // barre supérieure et celui de `LotsExportView`. Le mode strict refuse les
    // deux : on vise celui de la page.
    const portee = path === '/chues/campagnes' ? page.getByRole('main') : page;
    await expect(portee.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    if (marker !== null) {
      await expect(page.getByText(marker).first()).toBeVisible();
    }

    /**
     * On vise les titres de `QueryErrorState`, pas `getByRole('alert')` tout
     * court : en développement, Next injecte lui-même un élément `alert`
     * portant le titre du document, et le `Toaster` de Sonner monte une région
     * vide. Compter les `alert` revenait à échouer sur du décor.
     *
     * La liste est celle de `components/query-error-state.tsx` : « Erreur
     * serveur » y manquait, et c'est précisément le titre qu'un 500 rend. Un
     * balayage qui ne le nomme pas ne peut pas attraper la panne qu'il cherche.
     */
    await expect(
      page.getByRole('heading', {
        name: /Serveur injoignable|Chargement impossible|Erreur serveur|Requête refusée|Introuvable|Configuration incomplète|Accès refusé/,
      }),
      `${path} rend un état d’erreur`,
    ).toHaveCount(0);
  }
});
