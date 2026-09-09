import type { EtapeBanque } from '@/lib/data/bank-cases';

const parPosition = (a: EtapeBanque, b: EtapeBanque): number =>
  a.position - b.position || a.id.localeCompare(b.id);

export function etapesOuvertes(etapes: readonly EtapeBanque[]): EtapeBanque[] {
  return etapes.filter((etape) => etape.type === 'OPEN').sort(parPosition);
}

export function etapesTerminales(etapes: readonly EtapeBanque[]): EtapeBanque[] {
  return etapes.filter((etape) => etape.type !== 'OPEN').sort(parPosition);
}

export function etapeInitiale(etapes: readonly EtapeBanque[]): EtapeBanque | undefined {
  return etapes.find((etape) => etape.isInitial);
}

export function etapeDeType(
  etapes: readonly EtapeBanque[],
  type: EtapeBanque['type'],
): EtapeBanque | undefined {
  return etapes.find((etape) => etape.type === type);
}

export type ActionPrincipale =
  | { genre: 'avancer'; cible: EtapeBanque }
  | { genre: 'encaisser'; cible: EtapeBanque }
  | { genre: 'aucune'; raison: string };

export function actionPrincipale(
  etapes: readonly EtapeBanque[],
  courante: EtapeBanque,
): ActionPrincipale {
  if (courante.type !== 'OPEN') return { genre: 'aucune', raison: 'Dossier clos.' };

  const suivante = etapesOuvertes(etapes)
    .filter((etape) => etape.isActive)
    .find((etape) => etape.position > courante.position);
  if (suivante !== undefined) return { genre: 'avancer', cible: suivante };

  const encaissement = etapeDeType(etapes, 'CASHED');
  if (encaissement !== undefined && encaissement.isActive) {
    return { genre: 'encaisser', cible: encaissement };
  }

  return {
    genre: 'aucune',
    raison: 'Aucune étape suivante active. Complétez le flux de traitement.',
  };
}

export const LIBELLES_TYPE_ETAPE: Record<EtapeBanque['type'], string> = {
  OPEN: 'En cours',
  CASHED: 'Encaissement',
  REJECTED: 'Rejet',
};

export type VarianteBadge =
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info';

export function varianteCouleur(couleur: string): VarianteBadge {
  if (couleur === 'success') return 'success';
  if (couleur === 'warning' || couleur === 'accent') return 'warning';
  if (couleur === 'destructive' || couleur === 'danger') return 'destructive';
  if (couleur === 'info') return 'info';
  if (couleur === 'primary') return 'default';
  return 'secondary';
}
