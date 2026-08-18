import { ConflictException } from '@nestjs/common';

import { DEMO_MODE_STATE_UNKNOWN, type DemoVisibilityService } from './demo-visibility.service.js';

export const fakeDemoVisibility = (enabled: boolean | 'unknown' = false): DemoVisibilityService =>
  ({
    enabled: () => Promise.resolve(enabled === true),
    enabledForWrite: () =>
      enabled === 'unknown'
        ? Promise.reject(new ConflictException({ code: DEMO_MODE_STATE_UNKNOWN }))
        : Promise.resolve(enabled),
    state: () => Promise.resolve(enabled === 'unknown' ? 'unknown' : enabled ? 'on' : 'off'),
    invalidate: () => undefined,
  }) as unknown as DemoVisibilityService;
