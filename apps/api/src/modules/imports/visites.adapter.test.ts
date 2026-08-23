import {
  ImportKind,
  ImportMode,
  VISITE_DESTINATAIRES,
  VISITE_DIRECTIONS,
  VISITE_ENTREPRISES,
  VISITE_OBJETS,
} from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import { visiteInstant } from '../visites/visites.service.js';
import type { ImportRowError, ImportRunContext, ParsedRow } from './import-adapter.js';
import {
  VISITE_IMPORT_HEADERS,
  VisiteImportError,
  VisitesImportAdapter,
  readSheetDate,
  readSheetTime,
  type VisiteImportRow,
  type VisiteImportRun,
} from './visites.adapter.js';
import { SHEET_CELL } from './xlsx-rows.js';

const H = VISITE_IMPORT_HEADERS;

interface StoredVisite {
  reference: string;
  visitedAt: Date;
  timeKnown: boolean;
  visitorName: string;
  entrepriseId: string;
}

interface Store {
  visites: StoredVisite[];
  referentielsEcrits: string[];
}

const idOf = (prefix: string, code: string): string => `${prefix}:${code}`;

function fakeContext(store: Store, mode: ImportMode = ImportMode.DRY_RUN): ImportRunContext {
  const list = (
    seeds: readonly { code: string; label: string }[],
    prefix: string,
  ): { findMany: () => Promise<{ id: string; code: string; label: string }[]> } => ({
    findMany: () =>
      Promise.resolve(
        seeds.map((seed) => ({ id: idOf(prefix, seed.code), code: seed.code, label: seed.label })),
      ),
  });

  const refuseEcriture = (table: string) => (): never => {
    store.referentielsEcrits.push(table);
    throw new Error(`${table}: l’import n’a pas à créer d’entrée de référentiel.`);
  };

  const tx = {
    visiteEntreprise: { ...list(VISITE_ENTREPRISES, 'ent'), create: refuseEcriture('entreprise') },
    visiteDirection: { ...list(VISITE_DIRECTIONS, 'dir'), create: refuseEcriture('direction') },
    visiteDestinataire: {
      ...list(VISITE_DESTINATAIRES, 'des'),
      create: refuseEcriture('destinataire'),
    },
    visiteObjet: { ...list(VISITE_OBJETS, 'obj'), create: refuseEcriture('objet') },
    visite: {
      findMany: (args: {
        where: { visitedAt: { in: Date[] }; entrepriseId: { in: string[] } };
      }) => {
        const instants = new Set(args.where.visitedAt.in.map((date) => date.getTime()));
        const entreprises = new Set(args.where.entrepriseId.in);
        return Promise.resolve(
          store.visites.filter(
            (row) => instants.has(row.visitedAt.getTime()) && entreprises.has(row.entrepriseId),
          ),
        );
      },
      findFirst: (args: { where: { reference: { startsWith: string } } }) => {
        const kept = store.visites
          .map((row) => row.reference)
          .filter((reference) => reference.startsWith(args.where.reference.startsWith))
          .sort();
        const last = kept.at(-1);
        return Promise.resolve(last === undefined ? null : { reference: last });
      },
      createMany: ({ data }: { data: StoredVisite[] }) => {
        const taken = new Set(store.visites.map((row) => row.reference));
        let count = 0;
        for (const row of data) {
          if (taken.has(row.reference)) continue;
          taken.add(row.reference);
          store.visites.push(row);
          count += 1;
        }
        return Promise.resolve({ count });
      },
    },
  };

  return {
    jobId: 'travail-1',
    mode,
    requestedById: 'admin-1',
    tx: tx as unknown as ImportRunContext['tx'],
  };
}

function cells(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    [SHEET_CELL]: '1. BDD VISITES . JANVIER 26',
    [H.date]: '46028',
    [H.heure]: '11H08',
    [H.nom]: 'MOUHAMED FALL',
    [H.telephone]: '78 454 44 66',
    [H.entreprise]: 'CPI',
    [H.direction]: 'COMMERCIALE',
    [H.destinataire]: 'MME. NDOYE (RESP. COMM.)',
    [H.objet]: 'SUIVI DE DOSSIER',
    [H.commentaire]: 'Reçu par MME NDOYE',
    ...over,
  };
}

function refusal(result: ParsedRow<VisiteImportRow>): ImportRowError {
  if (result.ok) throw new Error('ligne acceptée alors qu’un refus était attendu');
  return result.error;
}

function accepted(result: ParsedRow<VisiteImportRow>): VisiteImportRow {
  if (!result.ok) throw new Error(`ligne refusée à tort : ${result.error.code}`);
  return result.row;
}

let store: Store;
let adapter: VisitesImportAdapter;
let run: VisiteImportRun;

beforeEach(async () => {
  store = { visites: [], referentielsEcrits: [] };
  adapter = new VisitesImportAdapter();
  run = await adapter.prepare(fakeContext(store));
});

describe('contrat de l’adaptateur', () => {
  it('se déclare sur le type d’import que la route accepte', () => {
    expect(adapter.kind).toBe(ImportKind.VISITES);
  });

  it('lit les onglets « BDD VISITES », en-tête en ligne 3', () => {
    expect(adapter.layout.headerRow).toBe(3);
    expect(adapter.layout.sheetPattern.test('8. BDD VISITES . AOUT 25')).toBe(true);
    expect(adapter.layout.sheetPattern.test('8. STATISTIQUES . AOUT 25')).toBe(false);
  });

  it('ne reprend pas le N° du classeur, qui repart à 1 chaque mois', () => {
    const headers = adapter.templateColumns.map((column) => column.header);
    expect(headers).not.toContain('N°');
    expect(new Set(headers).size).toBe(headers.length);
  });
});

describe('lecture d’une date et d’une heure', () => {
  it('lit une date au rang Excel comme au format ISO', () => {
    expect(readSheetDate('46028')).toBe('2026-01-06');
    expect(readSheetDate('2026-01-06T00:00:00.000Z')).toBe('2026-01-06');
  });

  it('refuse ce qui n’est pas une date plutôt que d’inventer un jour', () => {
    expect(readSheetDate('CPI')).toBeNull();
    expect(readSheetDate('')).toBeNull();
    expect(readSheetDate('12')).toBeNull();
  });

  it('rattrape les heures telles que l’accueil les écrit', () => {
    expect(readSheetTime('11H08')).toBe('11:08');
    expect(readSheetTime('11h45')).toBe('11:45');
    expect(readSheetTime('12H')).toBe('12:00');
    expect(readSheetTime('8h30')).toBe('08:30');
  });

  it('ne devine pas une heure ambiguë', () => {
    expect(readSheetTime('17H5')).toBeNull();
    expect(readSheetTime('25H00')).toBeNull();
    expect(readSheetTime('11H70')).toBeNull();
  });
});

describe('analyse d’une ligne', () => {
  it('accepte une ligne complète et résout les quatre référentiels', () => {
    const row = accepted(adapter.parseRow(cells(), 12, run));

    expect(row.date).toBe('2026-01-06');
    expect(row.time).toBe('11:08');
    expect(row.entrepriseId).toBe(idOf('ent', 'CPI'));
    expect(row.directionId).toBe(idOf('dir', 'COMMERCIALE'));
    expect(row.destinataireId).toBe(idOf('des', 'NDOYE'));
    expect(row.objetId).toBe(idOf('obj', 'SUIVI_DOSSIER'));
    expect(row.phoneE164).toBe('+221784544466');
    expect(row.sheet).toBe('1. BDD VISITES . JANVIER 26');
  });

  it('laisse vides la direction et le destinataire, facultatifs au registre', () => {
    const row = accepted(
      adapter.parseRow(cells({ [H.direction]: '', [H.destinataire]: '' }), 12, run),
    );

    expect(row.directionId).toBeNull();
    expect(row.destinataireId).toBeNull();
  });

  it('garde le numéro tel quel quand il n’est pas normalisable', () => {
    const row = accepted(adapter.parseRow(cells({ [H.telephone]: '7723663' }), 12, run));

    expect(row.phone).toBe('7723663');
    expect(row.phoneE164).toBeNull();
  });

  it('nomme l’onglet dans le refus, car douze onglets ont une ligne 27', () => {
    const error = refusal(adapter.parseRow(cells({ [H.date]: '' }), 27, run));

    expect(error.rowNumber).toBe(27);
    expect(error.code).toBe(VisiteImportError.DATE_ABSENTE);
    expect(error.message).toContain('1. BDD VISITES . JANVIER 26');
  });

  it('refuse une ligne sans nom de visiteur', () => {
    expect(refusal(adapter.parseRow(cells({ [H.nom]: '' }), 12, run)).code).toBe(
      VisiteImportError.NOM_ABSENT,
    );
  });

  it('refuse une heure illisible plutôt que de poser minuit', () => {
    const error = refusal(adapter.parseRow(cells({ [H.heure]: '17H5' }), 12, run));

    expect(error.code).toBe(VisiteImportError.HEURE_ILLISIBLE);
    expect(error.message).toContain('17H5');
  });

  it('accepte une visite dont l’heure n’a pas été relevée', () => {
    expect(accepted(adapter.parseRow(cells({ [H.heure]: '' }), 12, run)).time).toBeNull();
  });
});

describe('valeur absente d’un référentiel', () => {
  it('refuse la ligne avec la valeur exacte, sans créer d’entrée', () => {
    const error = refusal(adapter.parseRow(cells({ [H.entreprise]: 'BOULANGERIE JAMM' }), 12, run));

    expect(error.code).toBe(VisiteImportError.ENTREPRISE_INCONNUE);
    expect(error.message).toContain('BOULANGERIE JAMM');
    expect(store.referentielsEcrits).toEqual([]);
  });

  it('refuse une entreprise vide, obligatoire au registre', () => {
    expect(refusal(adapter.parseRow(cells({ [H.entreprise]: '' }), 12, run)).code).toBe(
      VisiteImportError.ENTREPRISE_INCONNUE,
    );
  });

  it('refuse un objet de visite vide, obligatoire au registre', () => {
    expect(refusal(adapter.parseRow(cells({ [H.objet]: '' }), 12, run)).code).toBe(
      VisiteImportError.OBJET_INCONNU,
    );
  });

  it('reconnaît le libellé tronqué que porte la liste déroulante du classeur', () => {
    const row = accepted(
      adapter.parseRow(cells({ [H.objet]: 'ACHAT PRODUITS SANTARGILE ET/OU MAK' }), 12, run),
    );

    expect(row.objetId).toBe(idOf('obj', 'ACHAT_PRODUITS'));
  });

  it('tolère la casse et les espaces en trop', () => {
    const row = accepted(
      adapter.parseRow(cells({ [H.entreprise]: '  make-up   addiction ' }), 12, run),
    );

    expect(row.entrepriseId).toBe(idOf('ent', 'MAKE_UP_ADDICTION'));
  });
});

describe('décalage de colonnes', () => {
  it('nomme un numéro de téléphone trouvé sous ENTREPRISE', () => {
    const error = refusal(adapter.parseRow(cells({ [H.entreprise]: '77 505 62 69' }), 12, run));

    expect(error.code).toBe(VisiteImportError.COLONNES_DECALEES);
    expect(error.message).toContain('téléphone');
  });

  it('nomme la liste à laquelle la valeur appartient vraiment', () => {
    const error = refusal(adapter.parseRow(cells({ [H.entreprise]: 'GENERALE' }), 12, run));

    expect(error.code).toBe(VisiteImportError.COLONNES_DECALEES);
    expect(error.message).toContain('directions');
  });

  it('nomme un destinataire trouvé sous OBJECT VISITE', () => {
    const error = refusal(adapter.parseRow(cells({ [H.objet]: 'MME. SY (AG)' }), 12, run));

    expect(error.code).toBe(VisiteImportError.COLONNES_DECALEES);
    expect(error.message).toContain('destinataires');
  });
});

describe('déduplication', () => {
  const ligne = (over: Partial<Record<string, string>>, rowNumber: number): VisiteImportRow =>
    accepted(adapter.parseRow(cells(over), rowNumber, run));

  it('écarte la même visite vue deux fois dans le même lot', async () => {
    const outcome = await adapter.writeChunk(
      [ligne({}, 12), ligne({}, 13)],
      fakeContext(store),
      run,
    );

    expect(outcome.created).toBe(1);
    expect(outcome.skipped).toBe(1);
    expect(outcome.errors[0]?.code).toBe(VisiteImportError.DOUBLON_DANS_LE_FICHIER);
    expect(outcome.errors[0]?.message).toContain('12');
  });

  it('écarte un doublon vu dans un lot ultérieur, et depuis un autre onglet', async () => {
    const ctx = fakeContext(store);
    await adapter.writeChunk([ligne({}, 63)], ctx, run);

    const decembre = ligne({ [SHEET_CELL]: '12. BDD VISITES . DECEMBRE 25' }, 8);
    const outcome = await adapter.writeChunk([decembre], ctx, run);

    expect(outcome.created).toBe(0);
    expect(outcome.skipped).toBe(1);
    expect(outcome.errors[0]?.message).toContain('1. BDD VISITES . JANVIER 26');
  });

  it('ne confond pas deux visiteurs différents au même instant', async () => {
    const outcome = await adapter.writeChunk(
      [ligne({}, 12), ligne({ [H.nom]: 'AMADOU LO' }, 13)],
      fakeContext(store),
      run,
    );

    expect(outcome.created).toBe(2);
    expect(outcome.skipped).toBe(0);
  });

  it('ne confond pas la même personne reçue à deux heures différentes', async () => {
    const outcome = await adapter.writeChunk(
      [ligne({}, 12), ligne({ [H.heure]: '16H15' }, 13)],
      fakeContext(store),
      run,
    );

    expect(outcome.created).toBe(2);
  });

  it('écarte une visite déjà portée au registre', async () => {
    const ctx = fakeContext(store, ImportMode.APPLY);
    await adapter.writeChunk([ligne({}, 12)], ctx, run);

    const rejoue = new VisitesImportAdapter();
    const runRejoue = await rejoue.prepare(ctx);
    const outcome = await rejoue.writeChunk(
      [accepted(rejoue.parseRow(cells(), 12, runRejoue))],
      fakeContext(store, ImportMode.APPLY),
      runRejoue,
    );

    expect(outcome.created).toBe(0);
    expect(outcome.skipped).toBe(1);
    expect(outcome.errors[0]?.code).toBe(VisiteImportError.DEJA_AU_REGISTRE);
    expect(store.visites).toHaveLength(1);
  });
});

describe('écriture', () => {
  it('ne touche à rien en simulation', async () => {
    const outcome = await adapter.writeChunk(
      [accepted(adapter.parseRow(cells(), 12, run))],
      fakeContext(store, ImportMode.DRY_RUN),
      run,
    );

    expect(outcome.created).toBe(1);
    expect(store.visites).toEqual([]);
  });

  it('reprend la suite après le dernier rang déjà pris pour l’année', async () => {
    store.visites.push({
      reference: 'V-2026-000411',
      visitedAt: visiteInstant('2026-01-05', undefined),
      timeKnown: false,
      visitorName: 'AUTRE PERSONNE',
      entrepriseId: idOf('ent', 'CPI'),
    });

    await adapter.writeChunk(
      [accepted(adapter.parseRow(cells(), 12, run))],
      fakeContext(store, ImportMode.APPLY),
      run,
    );

    expect(store.visites.at(-1)?.reference).toBe('V-2026-000412');
  });

  it('pose l’instant de la visite, et retient que l’heure était connue', async () => {
    await adapter.writeChunk(
      [accepted(adapter.parseRow(cells(), 12, run))],
      fakeContext(store, ImportMode.APPLY),
      run,
    );

    expect(store.visites[0]?.visitedAt).toEqual(visiteInstant('2026-01-06', '11:08'));
    expect(store.visites[0]?.timeKnown).toBe(true);
  });
});
