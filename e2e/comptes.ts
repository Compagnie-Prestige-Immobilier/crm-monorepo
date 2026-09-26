import { readdirSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

export const BASE_URL = process.env.E2E_URL ?? 'http://localhost:4000';
export const PORT = new URL(BASE_URL).port || '80';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://localhost:5432/cpi_v2_dev?sslmode=disable';

// Ces comptes ont un mot de passe connu de quiconque lit ce dépôt : une
// exécution qui viserait par erreur une base ou un serveur distant les y créerait.
const HOTES_AUTORISES = new Set(['localhost', '127.0.0.1']);
if (!HOTES_AUTORISES.has(new URL(DATABASE_URL).hostname)) {
  throw new Error(
    `DATABASE_URL doit pointer vers localhost ou 127.0.0.1 pour les outils e2e, reçu : ${DATABASE_URL}`,
  );
}
if (!HOTES_AUTORISES.has(new URL(BASE_URL).hostname)) {
  throw new Error(
    `E2E_URL doit pointer vers localhost ou 127.0.0.1 pour les outils e2e, reçu : ${BASE_URL}`,
  );
}

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

export async function avecBase(
  travail: (client: Client) => Promise<void>,
  url: string = DATABASE_URL,
): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await travail(client);
  } finally {
    await client.end();
  }
}

export async function creerComptes(): Promise<void> {
  await supprimerComptes({ garderLesActuels: true });
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

/**
 * Supprimer un fichier de parcours réduit le nombre de jeux : les comptes des
 * index désormais hors liste survivaient à toutes les suites suivantes et
 * saturaient les sélecteurs d'équipe, bornés à cinquante comptes. La purge
 * vise donc le préfixe `e2e-`, pas la seule liste du moment.
 */
export async function supprimerComptes({ garderLesActuels = false } = {}): Promise<void> {
  const identifiants = TOUS_LES_COMPTES.map((compte) => compte.id);
  await avecBase(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query('CREATE TEMP TABLE e2e_users (id text PRIMARY KEY) ON COMMIT DROP');
      await client.query(
        `INSERT INTO e2e_users (id)
         SELECT id FROM users WHERE id LIKE 'e2e-%' AND ($2 = false OR NOT (id = ANY($1::text[])))`,
        [identifiants, garderLesActuels],
      );
      await client.query(`
        DO $cleanup$
        DECLARE
          contrainte record;
          supprimees integer;
          total integer;
        BEGIN
          LOOP
            total := 0;
            FOR contrainte IN
              SELECT DISTINCT kcu.table_name, kcu.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON kcu.constraint_name = tc.constraint_name
               AND kcu.constraint_schema = tc.constraint_schema
              JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
               AND ccu.constraint_schema = tc.constraint_schema
              JOIN information_schema.referential_constraints rc
                ON rc.constraint_name = tc.constraint_name
               AND rc.constraint_schema = tc.constraint_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND ccu.table_schema = 'public'
                AND ccu.table_name = 'users'
                AND rc.delete_rule = 'RESTRICT'
                AND kcu.table_name <> 'users'
            LOOP
              BEGIN
                EXECUTE format(
                  'DELETE FROM public.%I WHERE %I IN (SELECT id FROM e2e_users)',
                  contrainte.table_name,
                  contrainte.column_name
                );
                GET DIAGNOSTICS supprimees = ROW_COUNT;
                total := total + supprimees;
              EXCEPTION WHEN foreign_key_violation THEN
                NULL;
              END;
            END LOOP;
            EXIT WHEN total = 0;
          END LOOP;
        END
        $cleanup$;
      `);
      await client.query('DELETE FROM users WHERE id IN (SELECT id FROM e2e_users)');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
