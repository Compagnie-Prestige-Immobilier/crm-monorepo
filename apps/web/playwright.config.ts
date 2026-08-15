import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright : parcours de bout en bout contre une pile VIVANTE.
 *
 * `test:e2e` était déclaré dans `package.json` sans ce fichier : la commande
 * échouait immédiatement, faute de configuration.
 *
 * Ce qui se joue ici ne peut pas être couvert par Vitest : le cookie `httpOnly`
 * traverse un vrai navigateur, et le téléchargement de l'export produit un vrai
 * fichier sur le disque. Un test qui simule `fetch` ne dirait rien de ces deux
 * points.
 *
 * L'API NestJS n'est PAS démarrée ici : elle porte une base de données et des
 * migrations, et la faire tomber en cours de suite laisserait des données à
 * moitié écrites. On la suppose lancée (`pnpm --filter @crm/api dev`) et on
 * échoue avec un message clair si elle manque, voir `e2e/global-setup.ts`.
 */

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // Les parcours partagent un même compte administrateur et une même base :
  // deux tests concurrents qui filtrent et exportent se marcheraient dessus.
  workers: 1,
  fullyParallel: false,
  // Un test vert par hasard après trois tentatives ne prouve rien.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI === undefined ? [['list']] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: WEB_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Une seule connexion pour toute la suite : voir `e2e/auth.setup.ts` pour
    // pourquoi (limiteurs de débit de l'API).
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      /**
       * Les parcours `*.anon.spec.ts` sont explicitement EXCLUS d'ici.
       *
       * Sans cette exclusion ils tourneraient deux fois : une fois dans le
       * projet anonyme, et une fois ici, mais avec la session déjà posée.
       * « Se connecter » n'existe pas sur un panel déjà ouvert : `/connexion`
       * renvoie vers le tableau de bord, et le test échoue en cherchant un
       * champ e-mail que le serveur n'a jamais rendu.
       */
      testIgnore: /\.anon\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
    // Les parcours qui doivent partir d'un navigateur VIERGE : connexion,
    // déconnexion, refus d'identifiants.
    {
      name: 'chromium-anonyme',
      testMatch: /\.anon\.spec\.ts/,
      /**
       * Le navigateur reste VIERGE : aucun `storageState` ici, c'est tout
       * l'objet de ces parcours.
       *
       * La dépendance n'en pose pas moins : elle garantit seulement que le
       * fichier `e2e/.auth/admin.json` EXISTE sur disque quand ce projet
       * démarre. `roles.anon.spec.ts` s'en sert hors navigateur, pour poser sa
       * précondition (le mode démonstration, d'où vient le compte
       * BANQUE_FINANCE) via le relais `/api/v1/*` sans dépenser une connexion
       * de plus sur un point d'entrée limité à dix par minute.
       */
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /**
   * Le serveur Next est démarré si le port est libre, et réutilisé sinon :
   * pendant le développement, on garde son `pnpm dev` ouvert.
   */
  webServer: {
    command: 'pnpm dev',
    url: WEB_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
