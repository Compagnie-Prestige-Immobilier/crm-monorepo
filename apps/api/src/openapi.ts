import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';

/**
 * Génération hors ligne du document OpenAPI.
 *
 * DEUX PRÉCAUTIONS, ET L'ORDRE COMPTE.
 *
 * 1. Les valeurs d'environnement sont posées AVANT le premier import de
 *    `bootstrap.js`. Un `import` statique serait hissé au-dessus de ces
 *    affectations : `env.ts` serait évalué en premier et lèverait sur les
 *    secrets manquants avant que la moindre ligne de ce fichier ne s'exécute.
 *    D'où l'import dynamique, plus bas.
 *
 * 2. `OPENAPI_GENERATION=1` désarme la connexion Prisma. Avec Prisma 7 et
 *    `@prisma/adapter-pg`, le pool pg est créé dès l'instanciation du client :
 *    sans cette variable, générer le contrat exigerait un PostgreSQL joignable
 *    et la commande resterait bloquée dès que Docker est arrêté. Le document
 *    produit ne dépend d'aucune donnée : il n'y a aucune raison d'exiger une
 *    base.
 */
process.env.OPENAPI_GENERATION = '1';
process.env.NODE_ENV ??= 'development';
process.env.API_DOCS_ENABLED = 'true';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'openapi-generation-access-secret-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'openapi-generation-refresh-secret-32-chars';
process.env.LOG_LEVEL ??= 'silent';

const { buildOpenApiDocument, createApiApp } = await import('./bootstrap.js');

const app = await createApiApp();
await app.init();
const document = buildOpenApiDocument(app);
await writeFile(new URL('../openapi.json', import.meta.url), JSON.stringify(document, null, 2));
await app.close();
