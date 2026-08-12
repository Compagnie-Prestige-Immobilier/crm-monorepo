/**
 * Remplaçant de `server-only` sous Vitest — voir `vitest.config.ts`.
 *
 * Le vrai paquet lève à l'import hors condition `react-server`, ce qui rendrait
 * tout module marqué « serveur uniquement » impossible à charger dans un test.
 */
export {};
