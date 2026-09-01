export interface Affectation {
  readonly assigneeId: string;
  readonly day: number;
}

export interface MembreRepartition {
  readonly assigneeId: string;
  readonly fichesParJour: number;
}

export function capaciteParJour(role: string, fichesParJour: number): number {
  return role === 'COMMERCIAL' ? fichesParJour : Math.max(1, Math.ceil(fichesParJour / 5));
}

/**
 * Tourniquet pondéré : chacun reçoit une fiche par tour jusqu'à sa capacité,
 * puis la journée change quand toutes les capacités sont consommées.
 */
export function repartir(
  nombreDeFiches: number,
  membres: readonly MembreRepartition[],
  jours: number,
): Affectation[] {
  if (membres.length === 0 || jours < 1) return [];
  const tours = Math.max(...membres.map((membre) => membre.fichesParJour));
  const ordreDuJour = Array.from({ length: tours }, (_, tour) =>
    membres.filter((membre) => tour < membre.fichesParJour),
  ).flat();

  return Array.from({ length: jours }, (_, index) =>
    ordreDuJour.map((membre) => ({ assigneeId: membre.assigneeId, day: index + 1 })),
  )
    .flat()
    .slice(0, nombreDeFiches);
}
