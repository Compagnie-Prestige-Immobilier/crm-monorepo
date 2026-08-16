import { describe, expect, it } from 'vitest';

import { DatabaseDumpSection } from '@/components/settings/database-dump-section';

describe('DatabaseDumpSection', () => {
  it('rend la carte pour laisser l’API décider de sa disponibilité', () => {
    expect(DatabaseDumpSection()).not.toBeNull();
  });
});
