import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Charge le `.env` de la RACINE du dépôt.
 *
 * Next ne lit que `apps/web/.env*`, alors que le README n'installe qu'un seul
 * fichier, à la racine, partagé avec l'API. Sans ce chargement,
 * `API_INTERNAL_URL` est absent du processus Next et `serverApiOrigin()` lève :
 * la connexion répondait 502 « Le serveur CPI est injoignable » sur une pile
 * pourtant saine. Symptôme constaté en local avant ce correctif.
 *
 * `process.loadEnvFile` n'écrase PAS une variable déjà définie : en production
 * l'environnement réel du conteneur reste prioritaire, et ce fichier ne sert
 * qu'à combler les trous en développement. Absence du fichier = cas normal en
 * CI et en image Docker, donc silencieux.
 */
const rootEnvFile = path.join(workspaceRoot, '.env');
if (existsSync(rootEnvFile)) {
  try {
    process.loadEnvFile(rootEnvFile);
  } catch {
    // Fichier illisible ou malformé : ne jamais empêcher le démarrage pour ça.
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
