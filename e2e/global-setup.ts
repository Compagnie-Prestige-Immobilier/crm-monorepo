import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { creerComptes } from './comptes';

export const CHEMIN_ROLES = path.join(__dirname, '.roles.json');

export default async function globalSetup(): Promise<void> {
  // Le binaire servi, pas `go run .` : un arbre de travail en cours d'edition
  // rendrait une matrice etrangere au serveur reellement interroge.
  const matrice = execFileSync(path.join(__dirname, '..', 'cpi-go'), ['-roles'], {
    encoding: 'utf8',
  });
  JSON.parse(matrice);
  writeFileSync(CHEMIN_ROLES, matrice);

  await creerComptes();
}
