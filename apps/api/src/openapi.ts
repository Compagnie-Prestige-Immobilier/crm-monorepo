import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';

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
