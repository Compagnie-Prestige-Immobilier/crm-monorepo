import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
