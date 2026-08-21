import { WorkspaceContext } from './workspace.js';

/**
 * Un contexte d'espace de travail figé, pour les tests.
 *
 * Une vraie instance et non un objet litteral : `WorkspaceContext` porte un
 * `AsyncLocalStorage` prive, qu'aucun litteral ne peut imiter. On entre dans
 * l'espace voulu, c'est tout.
 */
export const fakeWorkspace = (demo = false): WorkspaceContext => {
  const context = new WorkspaceContext();
  context.enter(demo ? 'demo' : 'public');
  return context;
};
