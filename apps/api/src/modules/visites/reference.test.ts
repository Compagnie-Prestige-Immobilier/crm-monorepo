import { describe, expect, it } from 'vitest';

import { formatVisiteReference, nextVisiteSequence, visiteReferencePrefix } from './reference.js';

describe('référence du registre', () => {
  it('se lit à l’oral : préfixe, année, rang sur six chiffres', () => {
    expect(formatVisiteReference(2026, 412)).toBe('V-2026-000412');
    expect(formatVisiteReference(2026, 1)).toBe('V-2026-000001');
    expect(visiteReferencePrefix(2026)).toBe('V-2026-');
  });

  it('refuse un rang hors bornes plutôt que de rendre une référence tronquée', () => {
    expect(() => formatVisiteReference(2026, 0)).toThrow(RangeError);
    expect(() => formatVisiteReference(2026, 1_000_000)).toThrow(RangeError);
  });

  it('repart à 1 sur une année neuve, et reprend la suite sur l’année en cours', () => {
    expect(nextVisiteSequence(null, 2026)).toBe(1);
    expect(nextVisiteSequence('V-2025-000765', 2026)).toBe(1);
    expect(nextVisiteSequence('V-2026-000411', 2026)).toBe(412);
  });

  it('ne se laisse pas égarer par une référence illisible', () => {
    expect(nextVisiteSequence('V-2026-41', 2026)).toBe(1);
    expect(nextVisiteSequence('n’importe quoi', 2026)).toBe(1);
  });

  it('le tri lexicographique des références suit leur rang, sur toute la plage', () => {
    const references = [1, 9, 10, 99, 100, 999_999].map((rank) =>
      formatVisiteReference(2026, rank),
    );
    expect([...references].sort()).toEqual(references);
  });
});
