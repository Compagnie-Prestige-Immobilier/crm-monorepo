import { browserApiOrigin } from '@/lib/api/config';

/**
 * Le jeton est propre au compte et régénérable. Il portait l'identifiant du
 * compte, et le lien ne se révoquait alors qu'en fermant le compte.
 */
export const lienFormulairePublic = (jeton: string): string =>
  `${browserApiOrigin()}/demande/${jeton}`;

export const texteDuMessage = (modele: string, valeurs: Record<string, string>): string =>
  modele.replaceAll(/\{(\w+)\}/gu, (jeton, cle: string) => valeurs[cle] ?? jeton);
