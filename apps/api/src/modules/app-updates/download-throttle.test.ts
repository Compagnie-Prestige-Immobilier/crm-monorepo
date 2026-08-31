import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { downloadThrottle } from './app-updates.controller.js';

const contextWith = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

const { limit, generateKey } = downloadThrottle.default;

describe('rate limit de download resiliente aux reprises', () => {
  it('un vrai depart (sans Range) consomme le quota par IP', () => {
    const context = contextWith({});
    expect(limit(context)).toBe(Number(process.env.APK_DOWNLOAD_RATE_LIMIT) || 1000);
    expect(generateKey(context, '1.2.3.4', 'default')).toBe('apk-download-default-1.2.3.4');
  });

  it('une reprise (Range) est deplafonnee et rangee dans un compteur separe', () => {
    const context = contextWith({ range: 'bytes=1000-' });
    expect(limit(context)).toBe(Number.MAX_SAFE_INTEGER);
    expect(generateKey(context, '1.2.3.4', 'default')).toBe('apk-download-default-1.2.3.4-resume');
  });

  it('la meme IP ne melange pas depart et reprise dans le meme seau', () => {
    const start = generateKey(contextWith({}), '10.0.0.1', 'default');
    const resume = generateKey(contextWith({ range: 'bytes=0-' }), '10.0.0.1', 'default');
    expect(start).not.toBe(resume);
  });
});
