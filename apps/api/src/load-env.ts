import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Importé pour son effet de bord, AVANT que le moindre module ne lise
// process.env. ConfigModule de Nest intervient trop tard : readEnv() est
// appelé pendant le bootstrap, et le fichier .env vit à la racine du monorepo,
// pas dans apps/api.
const candidates = [
  process.env.ENV_FILE,
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
].filter((path): path is string => Boolean(path));

for (const path of candidates) {
  if (!existsSync(path)) continue;
  process.loadEnvFile(path);
  break;
}
