/**
 * Vérifie que l'API NestJS répond AVANT de lancer la suite.
 *
 * Sans ce contrôle, une API éteinte produit une cascade de « expected element
 * to be visible » sur le premier écran, et il faut lire la trace pour
 * comprendre que rien n'était en cause côté navigateur.
 *
 * La CONNEXION n'est pas faite ici : elle a lieu une seule fois dans le projet
 * `setup` (`e2e/auth.setup.ts`), qui range les cookies sur disque. La dédoubler
 * ici consommerait une tentative supplémentaire sur un point d'entrée que
 * l'API limite en débit.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

export default async function globalSetup(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/health/ready`, {
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error(
      `L'API CPI ne répond pas sur ${API_URL}.\n` +
        'Démarrez la pile avant les tests E2E :\n' +
        '  docker compose -f infra/docker/docker-compose.yml up -d\n' +
        '  pnpm --filter @crm/api dev',
    );
  }

  /**
   * Un 429 fait ÉCHOUER la préparation, il ne l'endort plus.
   *
   * Le raisonnement précédent était juste sur un point : un 429 prouve que
   * l'API est vivante, c'est son limiteur qui répond. Il était faux sur la
   * conclusion. Attendre la fenêtre puis rendre la main SANS RIEN REVÉRIFIER
   * laissait partir la suite sur une API qui refuse déjà les requêtes :
   * `auth.setup.ts` n'obtenait pas de session, l'état sauvegardé sur disque
   * était inutilisable, et chaque parcours suivant tournait DÉCONNECTÉ. Les
   * échecs tombaient alors sur des écrans qui n'étaient pour rien dans
   * l'affaire, à des dizaines de lignes de trace de la cause réelle.
   *
   * Une préparation qui ne peut pas garantir sa précondition doit le dire ici,
   * au seul endroit où le message peut encore être lisible.
   */
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after') ?? 'quelques';
    throw new Error(
      `L'API CPI limite déjà le débit sur ${API_URL} (429).\n` +
        `Attendez ${retryAfter} secondes, puis relancez la suite.\n` +
        'Si le 429 revient immédiatement, une autre suite tourne contre la même ' +
        'API, ou un précédent processus n’a pas rendu la main.',
    );
  }

  if (!response.ok) {
    throw new Error(
      `L'API CPI a répondu ${String(response.status)} sur ${API_URL}/health/ready. ` +
        'Vérifiez que la base de données est migrée et amorcée (pnpm db:migrate && pnpm db:seed).',
    );
  }
}
