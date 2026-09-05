import { describe, expect, it, vi } from 'vitest';

import { fakeWorkspace } from '../../workspaces/fake-workspace.js';
import { LiveService } from './live.service.js';

describe('LiveService', () => {
  it('livre un sujet aux abonnés du même espace seulement', () => {
    const live = new LiveService(fakeWorkspace());
    const onPublic = vi.fn();
    const onDemo = vi.fn();
    live.subscribe('public', onPublic);
    live.subscribe('demo', onDemo);

    live.emit('notifications');

    expect(onPublic).toHaveBeenCalledWith('notifications');
    expect(onDemo).not.toHaveBeenCalled();
  });

  it('se désabonne', () => {
    const live = new LiveService(fakeWorkspace());
    const listener = vi.fn();
    const unsubscribe = live.subscribe('public', listener);

    unsubscribe();
    live.emit('imports');

    expect(listener).not.toHaveBeenCalled();
  });
});
