import { describe, expect, it } from 'vitest';

import type { ImportColumn, SheetLayout } from './import-adapter.js';
import {
  SHEET_CELL,
  UnreadableWorkbookError,
  isBlankRow,
  projectSheets,
  type RowLike,
  type SheetLike,
  type SheetRow,
} from './xlsx-rows.js';

const column = (header: string): ImportColumn => ({
  header,
  width: 10,
  required: true,
  help: header,
  sample: header,
});

const COLUMNS = [
  column('DATE VISITE'),
  column('HEURE VISITE'),
  column('PRENOM ET NOMS'),
  column('TELEPHONES'),
  column('ENTREPRISE'),
  column('OBJECT VISITE'),
];

const LAYOUT: SheetLayout = { sheetPattern: /BDD VISITES/i, headerRow: 3 };

/** La colonne A du classeur est vide : les en-têtes commencent en B. */
const AUTRES_MOIS = [
  '',
  'N°',
  'DATE VISITE',
  'HEURE VISITE',
  'PRENOM ET NOMS',
  'TELEPHONES',
  'ENTREPRISE',
  'DIRECTION',
  'DESTINATAIRES',
  'OBJECT VISITE',
  'COMMENTAIRES / NOTES',
];

/** Relevé sur l'onglet « 8. BDD VISITES . AOUT 25 » : deux colonnes de plus. */
const AOUT = [
  '',
  'N°',
  'DATE VISITE',
  'HEURE VISITE',
  "HEURE D'APPEL",
  'PRENOM ET NOMS',
  'TELEPHONES',
  'ENTREPRISE',
  'DIRECTION',
  'DESTINATAIRES',
  'OBJECT VISITE',
  "OBJECT D'APPEL",
  'COMMENTAIRES / NOTES',
];

type Cell = string | number;
type NumberedRow = readonly [number, readonly Cell[]];

interface FakeSheet extends SheetLike {
  /** Le lecteur en flux se bloque si un onglet écarté n'est pas vidé. */
  readonly wasDrained: () => boolean;
}

function fakeSheet(name: string, rows: readonly NumberedRow[]): FakeSheet {
  let drained = false;
  return {
    name,
    wasDrained: () => drained,
    [Symbol.asyncIterator]: (): AsyncIterator<RowLike> => {
      let cursor = 0;
      return {
        next: () => {
          const entry = rows[cursor];
          if (entry === undefined) {
            drained = true;
            return Promise.resolve({ done: true, value: undefined });
          }
          cursor += 1;
          const [number, values] = entry;
          return Promise.resolve({
            done: false,
            value: {
              number,
              cellCount: values.length,
              getCell: (index: number) => ({ value: values[index - 1] ?? null }),
            },
          });
        },
      };
    },
  };
}

async function project(sheets: readonly SheetLike[]): Promise<SheetRow[]> {
  const stream: AsyncIterable<SheetLike> = {
    [Symbol.asyncIterator]: () => {
      let cursor = 0;
      return {
        next: () => {
          const sheet = sheets[cursor];
          cursor += 1;
          return Promise.resolve(
            sheet === undefined ? { done: true, value: undefined } : { done: false, value: sheet },
          );
        },
      };
    },
  };

  const collected: SheetRow[] = [];
  for await (const row of projectSheets(stream, COLUMNS, LAYOUT)) collected.push(row);
  return collected;
}

describe('projection des onglets d’un classeur tenu à la main', () => {
  it('ne retient que les onglets visés, et vide les autres jusqu’au bout', async () => {
    const liste = fakeSheet('LISTE DEROULANT', [
      [3, ['', 'ENTREPRISES']],
      [4, ['', 'CPI']],
    ]);
    const visites = fakeSheet('1. BDD VISITES . JANVIER 26', [
      [3, AUTRES_MOIS],
      [
        4,
        [
          '',
          1,
          '2026-01-06',
          '11H08',
          'MOUHAMED FALL',
          '78 454 44 66',
          'CPI',
          '',
          '',
          'SUIVI DE DOSSIER',
        ],
      ],
    ]);
    const stats = fakeSheet('1. STATISTIQUES . JANVIER 26', [
      [3, AUTRES_MOIS],
      [4, ['', 1, '2026-01-06', '11H08', 'JAMAIS LU', '', 'CPI', '', '', 'SUIVI DE DOSSIER']],
    ]);

    const rows = await project([liste, visites, stats]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowNumber).toBe(4);
    expect(rows[0]?.cells['PRENOM ET NOMS']).toBe('MOUHAMED FALL');
    expect(liste.wasDrained()).toBe(true);
    expect(stats.wasDrained()).toBe(true);
  });

  it('nomme l’onglet d’où vient chaque ligne, car douze onglets ont une ligne 27', async () => {
    const janvier = fakeSheet('1. BDD VISITES . JANVIER 26', [
      [3, AUTRES_MOIS],
      [27, ['', 24, '2026-01-06', '', 'MOUHAMED FALL', '', 'CPI', '', '', 'SUIVI DE DOSSIER']],
    ]);
    const fevrier = fakeSheet('2. BDD VISITES . FEVRIER 26', [
      [3, AUTRES_MOIS],
      [27, ['', 24, '2026-02-03', '', 'AMADOU LO', '', 'CPI', '', '', 'SUIVI DE DOSSIER']],
    ]);

    const rows = await project([janvier, fevrier]);

    expect(rows.map((row) => row.rowNumber)).toEqual([27, 27]);
    expect(rows.map((row) => row.cells[SHEET_CELL])).toEqual([
      '1. BDD VISITES . JANVIER 26',
      '2. BDD VISITES . FEVRIER 26',
    ]);
  });

  it('retrouve les colonnes ONGLET PAR ONGLET, quand un mois en compte deux de plus', async () => {
    const juillet = fakeSheet('7. BDD VISITES . JUILLET 25', [
      [3, AUTRES_MOIS],
      [
        4,
        [
          '',
          1,
          '2025-07-01',
          '11H15',
          'AMADOU LO',
          '78 234 17 07',
          'CPI',
          'GENERALE',
          '',
          'SUIVI DE DOSSIER',
        ],
      ],
    ]);
    const aout = fakeSheet('8. BDD VISITES . AOUT 25', [
      [3, AOUT],
      [
        4,
        [
          '',
          1,
          '2025-08-01',
          '17H02',
          '',
          'MAMADOU LAFIS DIENG',
          '775056269',
          'SANTARGILE',
          'COMMERCIALE',
          'MME. NDOYE (RESP. COMM.)',
          'SUIVI DE DOSSIER',
          '',
          'Reçu par Mme Ndoye',
        ],
      ],
    ]);

    const rows = await project([juillet, aout]);

    expect(rows.map((row) => row.cells['PRENOM ET NOMS'])).toEqual([
      'AMADOU LO',
      'MAMADOU LAFIS DIENG',
    ]);
    expect(rows.map((row) => row.cells.ENTREPRISE)).toEqual(['CPI', 'SANTARGILE']);
    expect(rows.map((row) => row.cells.TELEPHONES)).toEqual(['78 234 17 07', '775056269']);
    expect(rows.map((row) => row.cells['OBJECT VISITE'])).toEqual([
      'SUIVI DE DOSSIER',
      'SUIVI DE DOSSIER',
    ]);
  });

  it('tient pour vide une ligne dont seul le N° pré-imprimé est rempli', async () => {
    const janvier = fakeSheet('1. BDD VISITES . JANVIER 26', [
      [3, AUTRES_MOIS],
      [4, ['', 1, '2026-01-06', '', 'MOUHAMED FALL', '', 'CPI', '', '', 'SUIVI DE DOSSIER']],
      [5, ['', 2]],
    ]);

    const rows = await project([janvier]);

    expect(rows).toHaveLength(2);
    expect(isBlankRow(rows[0]?.cells ?? {})).toBe(false);
    expect(isBlankRow(rows[1]?.cells ?? {})).toBe(true);
  });

  it('refuse le classeur plutôt que d’importer un onglet amputé d’une colonne', async () => {
    const ampute = fakeSheet('1. BDD VISITES . JANVIER 26', [
      [
        3,
        ['', 'N°', 'DATE VISITE', 'HEURE VISITE', 'PRENOM ET NOMS', 'TELEPHONES', 'OBJECT VISITE'],
      ],
      [4, ['', 1, '2026-01-06', '', 'MOUHAMED FALL', '', 'SUIVI DE DOSSIER']],
    ]);

    await expect(project([ampute])).rejects.toThrow(UnreadableWorkbookError);
    await expect(project([ampute])).rejects.toThrow(/ENTREPRISE/);
  });

  it('refuse un onglet visé qui n’a pas de ligne d’en-tête', async () => {
    const sansEntete = fakeSheet('1. BDD VISITES . JANVIER 26', [
      [4, ['', 1, '2026-01-06', '', 'MOUHAMED FALL', '', 'CPI', '', '', 'SUIVI DE DOSSIER']],
    ]);

    await expect(project([sansEntete])).rejects.toThrow(/ligne 3/);
  });

  it('refuse un classeur dont AUCUN onglet ne porte de données, plutôt que d’annoncer zéro ligne', async () => {
    const listes = fakeSheet('Listes', [[1, ['Banques']]]);
    const instructions = fakeSheet('Instructions', [[1, ['Colonne']]]);

    await expect(project([listes, instructions])).rejects.toThrow(UnreadableWorkbookError);
    await expect(project([listes, instructions])).rejects.toThrow(/Instructions/);
  });
});

/** Le modèle Grand Public : en-tête en ligne 1, exemple en ligne 2, données en 3. */
const MODELE_LAYOUT: SheetLayout = { sheetPattern: /prospect/i, headerRow: 1 };

const MODELE_COLUMNS: readonly ImportColumn[] = [
  { ...column('Nom'), required: true },
  { ...column('Téléphone'), required: true, aliases: ['Numéro'] },
  { ...column('Canal de provenance'), required: false, aliases: ['Canal', 'Source'] },
];

async function projectModele(sheets: readonly SheetLike[]): Promise<SheetRow[]> {
  const stream: AsyncIterable<SheetLike> = {
    [Symbol.asyncIterator]: () => {
      let cursor = 0;
      return {
        next: () => {
          const sheet = sheets[cursor];
          cursor += 1;
          return Promise.resolve(
            sheet === undefined ? { done: true, value: undefined } : { done: false, value: sheet },
          );
        },
      };
    },
  };

  const collected: SheetRow[] = [];
  for await (const row of projectSheets(stream, MODELE_COLUMNS, MODELE_LAYOUT)) collected.push(row);
  return collected;
}

describe('projection d’un modèle engendré, en-tête en ligne 1', () => {
  it('saute la ligne d’exemple et commence en ligne 3', async () => {
    const feuille = fakeSheet('Prospects Grand Public', [
      [1, ['Nom', 'Téléphone', 'Canal de provenance']],
      [2, ['Ndiaye', '77 123 45 67', 'TikTok']],
      [3, ['Fall', '78 111 22 33', 'Bouche à oreille']],
    ]);

    const rows = await projectModele([feuille]);

    expect(rows.map((row) => row.rowNumber)).toEqual([3]);
    expect(rows[0]?.cells.Nom).toBe('Fall');
  });

  it('retrouve une colonne sous un synonyme, et malgré un ordre bousculé', async () => {
    const feuille = fakeSheet('Prospects', [
      [1, ['Source', 'Commentaire libre', 'Numéro', 'Nom']],
      [3, ['TikTok', 'sans objet', '78 111 22 33', 'Fall']],
    ]);

    const rows = await projectModele([feuille]);

    expect(rows[0]?.cells.Nom).toBe('Fall');
    expect(rows[0]?.cells['Téléphone']).toBe('78 111 22 33');
    expect(rows[0]?.cells['Canal de provenance']).toBe('TikTok');
  });

  it('lit vide une colonne FACULTATIVE absente du fichier, sans refuser le classeur', async () => {
    const feuille = fakeSheet('Prospects', [
      [1, ['Nom', 'Téléphone']],
      [3, ['Fall', '78 111 22 33']],
    ]);

    const rows = await projectModele([feuille]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.cells['Canal de provenance']).toBe('');
  });

  it('mais refuse le classeur quand c’est une colonne OBLIGATOIRE qui manque', async () => {
    const feuille = fakeSheet('Prospects', [
      [1, ['Nom', 'Canal de provenance']],
      [3, ['Fall', 'TikTok']],
    ]);

    await expect(projectModele([feuille])).rejects.toThrow(/Téléphone/);
  });
});
