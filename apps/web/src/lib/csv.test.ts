import { describe, expect, it } from 'vitest';

import { csvCell, csvRows } from '@/lib/csv';

describe('csvCell', () => {
  it('désamorce les débuts de formule', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+33 6 00')).toBe("'+33 6 00");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tDIR')).toBe("'\tDIR");
  });

  it('protège même quand la cellule est aussi mise entre guillemets', () => {
    // Le tableur retire les guillemets AVANT d'évaluer : sans l'apostrophe, la
    // formule partirait quand même.
    expect(csvCell('=HYPERLINK("x";"y")')).toBe('"\'=HYPERLINK(""x"";""y"")"');
  });

  it('échappe le point-virgule, le guillemet et les deux fins de ligne', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell('a\rb')).toBe('"a\rb"');
  });

  it('laisse les nombres tels quels, virgule décimale comprise', () => {
    expect(csvCell(12.5)).toBe('12,5');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(null)).toBe('');
  });

  it('assemble les lignes en CRLF', () => {
    expect(csvRows([['a', 1], ['b']])).toBe('a;1\r\nb');
  });
});
