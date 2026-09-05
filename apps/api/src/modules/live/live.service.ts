import { EventEmitter } from 'node:events';

import { Injectable } from '@nestjs/common';

import { WorkspaceContext, type Workspace } from '../../workspaces/workspace.js';

/** Miroir de `LIVE_TOPIC_KEYS` côté web. */
export type LiveTopic = 'notifications' | 'imports' | 'db-dump' | 'referentiels' | 'app-updates';

/**
 * Bus « quelque chose a changé » vers les panels ouverts. Un seul processus
 * API : un EventEmitter suffit. Une deuxième réplique remplacerait `emit` et
 * `subscribe` par `PUBLISH`/`SUBSCRIBE` Redis sur `cpi:live`, sans rien
 * changer aux appelants.
 */
@Injectable()
export class LiveService {
  private readonly bus = new EventEmitter();

  constructor(private readonly workspace: WorkspaceContext) {
    this.bus.setMaxListeners(0);
  }

  emit(topic: LiveTopic): void {
    this.bus.emit(this.workspace.current(), topic);
  }

  subscribe(workspace: Workspace, listener: (topic: LiveTopic) => void): () => void {
    this.bus.on(workspace, listener);
    return () => {
      this.bus.off(workspace, listener);
    };
  }
}
