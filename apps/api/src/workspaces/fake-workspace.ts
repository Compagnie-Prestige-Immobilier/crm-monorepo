import type { WorkspaceContext } from './workspace.js';

export const fakeWorkspace = (demo = false): WorkspaceContext =>
  ({
    enter: () => undefined,
    current: () => (demo ? 'demo' : 'public'),
  }) as WorkspaceContext;
