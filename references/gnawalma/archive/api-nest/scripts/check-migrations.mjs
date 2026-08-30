import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve('migrations');
const files = readdirSync(directory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
if (files.length === 0) throw new Error('No ordered SQL migrations found.');
for (const file of files) {
  const sql = readFileSync(resolve(directory, file), 'utf8').trim();
  if (!sql.startsWith('BEGIN;') || !sql.endsWith('COMMIT;')) {
    throw new Error(`${file} must use an explicit BEGIN/COMMIT transaction.`);
  }
}
console.log(`Validated ${files.length} migration file(s).`);
