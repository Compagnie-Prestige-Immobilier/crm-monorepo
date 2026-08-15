import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Les tests d'intégration exigent un Postgres joignable ; ils ont leur
    // propre configuration (`pnpm test:integration`) pour que `pnpm test`
    // reste exécutable sans Docker.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.integration.test.ts'],
    environment: 'node',
    coverage: {
      // `lcov` EST LA RAISON D'ÊTRE DE CETTE SECTION.
      //
      // SonarCloud lit `sonar.javascript.lcov.reportPaths`, qui pointe sur
      // `coverage/lcov.info`. Or le jeu de rapporteurs par défaut de vitest est
      // `['text', 'html', 'clover', 'json']` : lcov n'y figure pas. Le fichier
      // n'était donc jamais écrit, Sonar lisait une couverture de ZÉRO, et le
      // portillon « couverture sur le code neuf » échouait sans que rien
      // n'indique que la mesure elle-même manquait. Un chiffre absent se lit
      // comme un chiffre nul.
      //
      // Les autres sont conservés : `text` pour la console, `html` pour la
      // lecture locale, et `clover`/`json` parce que les retirer casserait un
      // outil qui les lit peut-être sans que ce fichier le sache.
      reporter: ['text', 'html', 'clover', 'json', 'lcov'],
    },
  },
});
