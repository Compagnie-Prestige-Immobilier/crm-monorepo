import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * `e2e/` est joué par Playwright (`pnpm test:e2e`) contre une pile vivante.
 * L'y laisser ferait démarrer un navigateur pendant `pnpm test`.
 */
const exclude = ['**/node_modules/**', '**/.next/**', 'e2e/**'];

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX projets, parce que deux environnements irréconciliables.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La suite historique est faite de fonctions pures, de Route Handlers et de
 * modules de données : elle tourne sous `node`, et doit continuer de le faire.
 * `node` ne fournit AUCUN DOM ; monter un composant React y échoue dès
 * `document`. Résultat : jusqu'ici, aucun écran du panel n'était éprouvable, et
 * les correctifs d'interface partaient sans filet.
 *
 * Basculer TOUTE la suite sous `jsdom` serait le choix paresseux, et le mauvais :
 * jsdom construit un document entier par fichier de test, ce qui alourdirait
 * inutilement les ~470 tests qui n'en ont aucun besoin, et il installe des
 * globales (`window`, `localStorage`) qui masqueraient un module serveur touchant
 * par erreur au navigateur.
 *
 * On sépare donc par EXTENSION, qui dit déjà ce que le test éprouve :
 *  - `.test.ts`  → `node`, la suite existante, inchangée ;
 *  - `.test.tsx` → `jsdom`, les tests de rendu.
 *
 * La règle est mécanique, donc impossible à oublier : écrire du JSX dans un test
 * impose l'extension `.tsx`, qui impose le bon environnement.
 */
export default defineConfig({
  /**
   * `tsconfig.json` déclare `jsx: 'preserve'`, parce que c'est le compilateur de
   * Next qui transforme le JSX en production. Vite lit ce réglage et, obéissant,
   * ne transforme rien : le JSX d'un test arrive tel quel dans l'analyseur, qui
   * échoue sur « Unexpected JSX expression ».
   *
   * On force donc la transformation automatique ICI, pour les tests seulement.
   * `tsconfig.json` n'est pas touché : le pipeline de build reste celui de Next.
   */
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  test: {
    /**
     * `lcov` EST LA RAISON D'ÊTRE DE CE BLOC.
     *
     * SonarCloud lit `sonar.javascript.lcov.reportPaths`, qui pointe sur
     * `coverage/lcov.info`. Le jeu de rapporteurs par défaut de vitest est
     * `['text', 'html', 'clover', 'json']` : lcov n'y figure pas. Le fichier
     * n'était donc jamais écrit, Sonar lisait une couverture de ZÉRO, et le
     * portillon échouait sans que rien n'indique que la mesure manquait.
     *
     * La couverture se déclare au niveau RACINE et non dans chaque projet :
     * les deux projets, `node` et `dom`, couvrent le même `src/`, et deux
     * rapports séparés se remplaceraient l'un l'autre dans le même dossier.
     * Déclarée ici, elle agrège les deux en un seul `lcov.info`.
     */
    coverage: {
      reporter: ['text', 'html', 'clover', 'json', 'lcov'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          exclude,
          environment: 'node',
          restoreMocks: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['src/**/*.test.tsx'],
          exclude,
          environment: 'jsdom',
          setupFiles: [path.join(here, 'src/test/setup-dom.ts')],
          restoreMocks: true,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
      /**
       * `server-only` lève à l'import dès qu'il n'est pas résolu via la
       * condition `react-server`, c'est précisément son rôle. Sous Vitest,
       * cela rendrait `src/lib/api/server.ts` et les Route Handlers
       * intestables. On le neutralise ici, et nulle part ailleurs : la
       * protection reste entière pour le build Next.
       */
      'server-only': path.join(here, 'src/test/server-only-stub.ts'),
    },
  },
});
