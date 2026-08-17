import { argon2id, hash, verify } from 'argon2';

// Doivent rester IDENTIQUES à `packages/database/src/seed.ts` : un écart rend le
// mot de passe de l'admin initial invérifiable sur une base fraîchement semée.
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
    return false;
  }
}
