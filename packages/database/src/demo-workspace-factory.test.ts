import { describe, expect, it } from 'vitest';

import { demoId } from './demo-workspace-factory.js';

describe('demoId', () => {
  it('produit un UUID stable par clé', () => {
    expect(demoId('prospect:1')).toBe(demoId('prospect:1'));
    expect(demoId('prospect:1')).not.toBe(demoId('prospect:2'));
    expect(demoId('prospect:1')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
