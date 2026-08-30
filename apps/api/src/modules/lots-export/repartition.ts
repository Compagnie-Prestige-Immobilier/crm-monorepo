export interface Affectation {
  readonly assigneeId: string;
  readonly day: number;
}

/**
 * Tourniquet : la fiche k va au k-ième téléconseiller dans l'ordre reçu, et la
 * journée avance quand l'équipe entière a servi sa part. Les fiches au delà du
 * plafond n'entrent pas dans le lot.
 */
export function repartir(
  nombreDeFiches: number,
  teleconseillerIds: readonly string[],
  fichesParJour: number,
  jours: number,
): Affectation[] {
  const equipe = teleconseillerIds.length;
  if (equipe === 0 || fichesParJour < 1 || jours < 1) return [];

  const parJour = equipe * fichesParJour;
  const retenues = Math.min(nombreDeFiches, parJour * jours);

  const affectations: Affectation[] = [];
  for (let rang = 0; rang < retenues; rang += 1) {
    const assigneeId = teleconseillerIds[rang % equipe];
    if (assigneeId === undefined) throw new Error('Téléconseiller absent de la répartition');
    affectations.push({ assigneeId, day: 1 + Math.floor(rang / parJour) });
  }
  return affectations;
}
