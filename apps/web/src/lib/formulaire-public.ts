import { browserApiOrigin } from '@/lib/api/config';

/** Le jeton est l'identifiant du compte qui partage : la fiche reçue lui revient. */
export const lienFormulairePublic = (compteId: string): string =>
  `${browserApiOrigin()}/demande/${compteId}`;

export const texteDuMessage = (modele: string, valeurs: Record<string, string>): string =>
  modele.replaceAll(/\{(\w+)\}/gu, (jeton, cle: string) => valeurs[cle] ?? jeton);
