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

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

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
   * Un 429 prouve que l'API est VIVANTE, c'est son limiteur de débit qui
   * répond, pas un serveur absent. Le traiter comme une panne faisait échouer
   * la suite entière alors que la seule chose à faire est d'attendre la
   * fenêtre suivante.
   */
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after') ?? '5');
    await new Promise((resolve) =>
      setTimeout(resolve, (Number.isFinite(retryAfter) ? retryAfter : 5) * 1_000),
    );
    return;
  }

  if (!response.ok) {
    throw new Error(
      `L'API CPI a répondu ${String(response.status)} sur ${API_URL}/health/ready. ` +
        'Vérifiez que la base de données est migrée et amorcée (pnpm db:migrate && pnpm db:seed).',
    );
  }
}
