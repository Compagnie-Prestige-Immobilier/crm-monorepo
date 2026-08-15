import { argon2id, hash, verify } from 'argon2';

/**
 * Paramètres argon2id du système.
 *
 * ILS DOIVENT ÊTRE IDENTIQUES à ceux de `packages/database/src/seed.ts`.
 * Un écart ne casse pas le hachage : il rend le mot de passe de l'admin initial
 * INVÉRIFIABLE, et l'unique compte capable d'en créer d'autres devient
 * inaccessible sur une base fraîchement semée.
 *
 * 19 456 Kio / 2 passes / 1 voie est le profil « second recommended option »
 * de la RFC 9106, celui qui vise les environnements à mémoire contrainte,
 * un conteneur d'API partagé, précisément.
 */
export const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const hashPassword = (password: string): Promise<string> => hash(password, ARGON2_OPTIONS);

export async function verifyPassword(digest: string, password: string): Promise<boolean> {
  try {
    return await verify(digest, password);
  } catch {
    // Un condensat corrompu ou d'un autre algorithme fait lever argon2. Le
    // traiter comme « mot de passe faux » évite un 500 sur une ligne abîmée.
    return false;
  }
}
