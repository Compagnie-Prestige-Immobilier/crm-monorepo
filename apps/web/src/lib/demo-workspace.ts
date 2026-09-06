import 'server-only';

/**
 * Fermé par défaut, comme côté API : un panel qui propose une bascule que le
 * serveur refuse ne montre qu'une erreur.
 */
export function demoWorkspaceEnabled(): boolean {
  return process.env.DEMO_WORKSPACE_ENABLED === 'true';
}
