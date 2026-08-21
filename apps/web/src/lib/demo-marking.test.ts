import { describe, expect, it } from 'vitest';

import {
  DEMO_FILENAME_SUFFIX,
  DEMO_MODE_HEADER,
  isDemoExport,
  withDemoSuffix,
} from '@/lib/demo-marking';

describe('isDemoExport', () => {
  it('ne retient que le `true` explicite', () => {
    expect(isDemoExport(new Headers({ [DEMO_MODE_HEADER]: 'true' }))).toBe(true);
    expect(isDemoExport(new Headers({ [DEMO_MODE_HEADER]: 'TRUE' }))).toBe(true);
    expect(isDemoExport(new Headers({ [DEMO_MODE_HEADER]: 'false' }))).toBe(false);
    expect(isDemoExport(new Headers())).toBe(false);
  });
});

describe('withDemoSuffix', () => {
  it('insère le suffixe AVANT l’extension, pour que le fichier reste ouvrable', () => {
    expect(withDemoSuffix('cpi-prospects-2026-08-13.xlsx', true)).toBe(
      `cpi-prospects-2026-08-13${DEMO_FILENAME_SUFFIX}.xlsx`,
    );
  });

  it('ne touche à rien hors mode démonstration', () => {
    expect(withDemoSuffix('cpi-prospects-2026-08-13.xlsx', false)).toBe(
      'cpi-prospects-2026-08-13.xlsx',
    );
  });

  it('est idempotent : le relais puis le navigateur ne doublent pas le suffixe', () => {
    const once = withDemoSuffix('cpi-dossiers.xlsx', true);
    expect(withDemoSuffix(once, true)).toBe(once);
  });

  it('supporte un nom sans extension', () => {
    expect(withDemoSuffix('export', true)).toBe(`export${DEMO_FILENAME_SUFFIX}`);
  });
});
