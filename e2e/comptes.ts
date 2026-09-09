import { readdirSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

export const BASE_URL = process.env.E2E_URL ?? 'http://localhost:4000';
export const PORT = new URL(BASE_URL).port || '80';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://localhost:5432/cpi_v2_dev?sslmode=disable';

export const ROLES = [
  'ADMIN',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'SUPERVISEUR',
  'DIRECTION',
  'ACCUEIL',
  'CHARGE_CLIENTELE',
] as const;

export type RoleCompte = (typeof ROLES)[number];

export const MOT_DE_PASSE = 'MotDePasseE2E2026';

const CONDENSAT =
  '$argon2id$v=19$m=19456,t=2,p=1$dI4UOWpqGWphWJ1FU7RSBQ$cOhcigHgQbTGlFfucnddHW60b3KBemABT290kltRnyc';

export interface Compte {
  role: RoleCompte;
  id: string;
  email: string;
  identifiant: string;
  nom: string;
  adresse: string;
  etat: string;
}

/**
 * Un jeu de sept comptes par travailleur Playwright : deux fichiers de
 * parcours qui tournent en même temps ne se partagent ni fiche ouverte, ni
 * rappels, ni disposition. L'index vient de Playwright ; sans `fullyParallel`,
 * il y a au plus un travailleur par fichier de parcours : autant de jeux.
 */
export const INDEX = Number(process.env.TEST_PARALLEL_INDEX ?? '0');
export const NOMBRE_DE_JEUX = readdirSync(__dirname).filter((nom) =>
  nom.endsWith('.spec.ts'),
).length;

// Une adresse par compte : le limiteur de connexion compte 10 tentatives par
// minute et par adresse. Préfixe `e2e.` : `fixture.` appartient au seed.
function comptesDuJeu(index: number): Compte[] {
  return ROLES.map((role, rang) => {
    const cle = role.toLowerCase().replaceAll('_', '-');
    return {
      role,
      id: `e2e-${cle}-${String(index)}`,
      email: `e2e.${cle}.${String(index)}@cpi.sn`,
      identifiant: `e2e.${cle}.${String(index)}`,
      nom: `E2E ${role} ${String(index)}`,
      adresse: `198.51.${String(100 + index)}.${String(10 + rang)}`,
      etat: path.join(__dirname, '.auth', PORT, `${cle}-${String(index)}.json`),
    };
  });
}

export const TOUS_LES_COMPTES: Compte[] = Array.from({ length: NOMBRE_DE_JEUX }, (_, index) =>
  comptesDuJeu(index),
).flat();

export const COMPTES: Compte[] = comptesDuJeu(INDEX);

export function compteDe(role: RoleCompte): Compte {
  const compte = COMPTES.find((candidat) => candidat.role === role);
  if (compte === undefined) throw new Error(`compte fixture manquant : ${role}`);
  return compte;
}

export async function avecBase(travail: (client: Client) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await travail(client);
  } finally {
    await client.end();
  }
}

export async function creerComptes(): Promise<void> {
  await avecBase(async (client) => {
    for (const compte of TOUS_LES_COMPTES) {
      await client.query(
        `INSERT INTO users (id, email, username, "passwordHash", "fullName", role, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6::"Role", now())
         ON CONFLICT (id) DO UPDATE SET
           "passwordHash" = EXCLUDED."passwordHash",
           role = EXCLUDED.role,
           "isActive" = true,
           "deletedAt" = NULL,
           "updatedAt" = now()`,
        [compte.id, compte.email, compte.identifiant, CONDENSAT, compte.nom, compte.role],
      );
    }
  });
}

export async function supprimerComptes(): Promise<void> {
  const identifiants = TOUS_LES_COMPTES.map((compte) => compte.id);
  await avecBase(async (client) => {
    await client.query('DELETE FROM refresh_tokens WHERE "userId" = ANY($1)', [identifiants]);
    await client.query('DELETE FROM users WHERE id = ANY($1)', [identifiants]);
  });
}
