import {
  ImportKind,
  ImportMode,
  VISITE_DESTINATAIRES,
  VISITE_DIRECTIONS,
  VISITE_ENTREPRISES,
  VISITE_OBJETS,
  VisiteImportChangeKind,
} from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import { visiteInstant } from '../visites/visites.service.js';
import type { ImportRunContext, ParsedRow } from './import-adapter.js';
import { VisiteImportError } from './visites-referentiels.js';
import {
  VisitesRegistreAdapter,
  readRegistreDate,
  readRegistreTime,
  type VisiteRegistreRow,
  type VisiteRegistreRun,
} from './visites-registre.adapter.js';
import { VISITES_REGISTRE_HEADERS } from './visites-registre.template.js';
import { SHEET_CELL } from './xlsx-rows.js';

const H = VISITES_REGISTRE_HEADERS;

interface StoredVisite {
  id: string;
  reference: string;
  visitedAt: Date;
  timeKnown: boolean;
  visitorName: string;
  phone: string | null;
  phoneE164: string | null;
  entrepriseId: string;
  objetId: string;
  directionId: string | null;
  destinataireId: string | null;
  comment: string | null;
}

interface StoredChange {
  id: string;
  importJobId: string;
  sheet: string;
  rowNumber: number;
  kind: VisiteImportChangeKind;
  reference: string | null;
  visiteId: string | null;
  label: string;
  fields: unknown;
  rowHash: string | null;
  selected: boolean;
}

interface Store {
  visites: StoredVisite[];
  changes: StoredChange[];
  audits: { action: string; entityId: string }[];
}

const idOf = (prefix: string, code: string): string => `${prefix}:${code}`;

const REFERENTIEL_LABEL = new Map<string, string>([
  ...VISITE_ENTREPRISES.map((r) => [idOf('ent', r.code), r.label] as const),
  ...VISITE_DIRECTIONS.map((r) => [idOf('dir', r.code), r.label] as const),
  ...VISITE_DESTINATAIRES.map((r) => [idOf('des', r.code), r.label] as const),
  ...VISITE_OBJETS.map((r) => [idOf('obj', r.code), r.label] as const),
]);

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

  const tx = {
    visiteEntreprise: list(VISITE_ENTREPRISES, 'ent'),
    visiteDirection: list(VISITE_DIRECTIONS, 'dir'),
    visiteDestinataire: list(VISITE_DESTINATAIRES, 'des'),
    visiteObjet: list(VISITE_OBJETS, 'obj'),
    visite: {
      findMany: (args: { where: { reference?: { in: string[] }; id?: { in: string[] } } }) => {
        if (args.where.reference) {
          const wanted = new Set(args.where.reference.in);
          return Promise.resolve(
            store.visites.filter((row) => wanted.has(row.reference)).map(toVisitePayload),
          );
        }
        const wanted = new Set(args.where.id?.in ?? []);
        return Promise.resolve(
          store.visites.filter((row) => wanted.has(row.id)).map(toVisitePayload),
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
      update: ({ where, data }: { where: { id: string }; data: Partial<StoredVisite> }) => {
        const row = store.visites.find((visite) => visite.id === where.id);
        if (!row) throw new Error('visite introuvable');
        Object.assign(row, data);
        return Promise.resolve(toVisitePayload(row));
      },
    },
    visiteImportChange: {
      upsert: (args: {
        where: {
          importJobId_sheet_rowNumber: { importJobId: string; sheet: string; rowNumber: number };
        };
        create: Omit<StoredChange, 'selected'> & { selected?: boolean };
        update: Partial<StoredChange>;
      }) => {
        const key = args.where.importJobId_sheet_rowNumber;
        const found = store.changes.find(
          (c) =>
            c.importJobId === key.importJobId &&
            c.sheet === key.sheet &&
            c.rowNumber === key.rowNumber,
        );
        if (found) {
          Object.assign(found, args.update);
          return Promise.resolve(found);
        }
        const created = { selected: true, ...args.create };
        store.changes.push(created);
        return Promise.resolve(created);
      },
      findMany: (args: {
        where: { importJobId: string; OR: { sheet: string; rowNumber: number }[] };
      }) => {
        const pairs = new Set(args.where.OR.map((o) => `${o.sheet} ${String(o.rowNumber)}`));
        return Promise.resolve(
          store.changes.filter(
            (c) =>
              c.importJobId === args.where.importJobId &&
              pairs.has(`${c.sheet} ${String(c.rowNumber)}`),
          ),
        );
      },
      count: (args: { where: { importJobId: string } }) =>
        Promise.resolve(
          store.changes.filter((c) => c.importJobId === args.where.importJobId).length,
        ),
    },
    auditLog: {
      create: ({ data }: { data: { action: string; entityId: string } }) => {
        store.audits.push({ action: data.action, entityId: data.entityId });
        return Promise.resolve(data);
      },
    },
  };

  function toVisitePayload(row: StoredVisite) {
    return {
      ...row,
      entreprise: { id: row.entrepriseId, label: REFERENTIEL_LABEL.get(row.entrepriseId) ?? '' },
      objet: { id: row.objetId, label: REFERENTIEL_LABEL.get(row.objetId) ?? '' },
      direction: row.directionId
        ? { id: row.directionId, label: REFERENTIEL_LABEL.get(row.directionId) ?? '' }
        : null,
      destinataire: row.destinataireId
        ? { id: row.destinataireId, label: REFERENTIEL_LABEL.get(row.destinataireId) ?? '' }
        : null,
    };
  }

  return {
    jobId: 'job-1',
    mode,
    requestedById: 'admin-1',
    tx: tx as unknown as ImportRunContext['tx'],
  };
}

function cells(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    [SHEET_CELL]: 'Registre',
    [H.numero]: '',
    [H.date]: '06/01/2026',
    [H.heure]: '11:08',
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

function accepted(result: ParsedRow<VisiteRegistreRow>): VisiteRegistreRow {
  if (!result.ok) throw new Error(`ligne refusée à tort : ${result.error.code}`);
  return result.row;
}

let store: Store;
let adapter: VisitesRegistreAdapter;
let run: VisiteRegistreRun;

beforeEach(async () => {
  store = { visites: [], changes: [], audits: [] };
  adapter = new VisitesRegistreAdapter();
  run = await adapter.prepare(fakeContext(store));
});

describe('contrat de l’adaptateur', () => {
  it('se déclare sur le type d’import que la route accepte', () => {
    expect(adapter.kind).toBe(ImportKind.VISITES_REGISTRE);
  });

  it('lit l’onglet « Registre », en-tête en ligne 1', () => {
    expect(adapter.layout.headerRow).toBe(1);
    expect(adapter.layout.sheetPattern.test('Registre')).toBe(true);
    expect(adapter.layout.sheetPattern.test('8. BDD VISITES . AOUT 25')).toBe(false);
  });

  it('N° REGISTRE est facultatif : vide, la ligne est une création', () => {
    const numero = adapter.templateColumns.find((c) => c.header === H.numero);
    expect(numero?.required).toBe(false);
  });
});

describe('lecture de la date et de l’heure du registre', () => {
  it('lit une date au rang Excel comme au format ISO', () => {
    expect(readRegistreDate('46028')).toBe('2026-01-06');
  });

  it('lit une date retapée à la française', () => {
    expect(readRegistreDate('06/01/2026')).toBe('2026-01-06');
  });

  it('refuse un mois supérieur à 12 plutôt que de deviner', () => {
    expect(readRegistreDate('13/13/2026')).toBeNull();
  });

  it('lit une heure normale', () => {
    expect(readRegistreTime('14:30')).toBe('14:30');
    expect(readRegistreTime('11H08')).toBe('11:08');
  });

  it('lit une fraction de journée avant de déléguer', () => {
    expect(readRegistreTime('0.604166666666667')).toBe('14:30');
  });
});

describe('parseRow', () => {
  it('une ligne sans numéro est une création', () => {
    const row = accepted(adapter.parseRow(cells(), 2, run));
    expect(row.reference).toBeNull();
  });

  it('une ligne avec numéro le porte', () => {
    const row = accepted(adapter.parseRow(cells({ [H.numero]: 'V-2026-000001' }), 2, run));
    expect(row.reference).toBe('V-2026-000001');
  });

  it('accepte l’alias OBJECT VISITE', () => {
    const row = accepted(adapter.parseRow(cells(), 2, run));
    expect(row.objet.label).toBe('SUIVI DE DOSSIER');
  });
});

describe('writeChunk en DRY_RUN', () => {
  it('une ligne sans numéro produit une différence CREATE', async () => {
    const ctx = fakeContext(store, ImportMode.DRY_RUN);
    const row = accepted(adapter.parseRow(cells(), 2, run));
    const outcome = await adapter.writeChunk([row], ctx);

    expect(outcome.created).toBe(1);
    expect(outcome.skipped).toBe(0);
    expect(store.changes).toHaveLength(1);
    expect(store.changes[0]?.kind).toBe(VisiteImportChangeKind.CREATE);
  });

  it('un numéro inconnu est refusé, aucune création', async () => {
    const ctx = fakeContext(store, ImportMode.DRY_RUN);
    const row = accepted(adapter.parseRow(cells({ [H.numero]: 'V-2026-999999' }), 2, run));
    const outcome = await adapter.writeChunk([row], ctx);

    expect(outcome.created).toBe(0);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]?.code).toBe(VisiteImportError.REGISTRE_NUMERO_INCONNU);
    expect(store.changes).toHaveLength(0);
  });

  it('un contenu identique ne produit aucune différence', async () => {
    store.visites.push({
      id: 'v-1',
      reference: 'V-2026-000001',
      visitedAt: visiteInstant('2026-01-06', '11:08'),
      timeKnown: true,
      visitorName: 'MOUHAMED FALL',
      phone: '78 454 44 66',
      phoneE164: '+221784544466',
      entrepriseId: idOf('ent', 'CPI'),
      objetId: idOf('obj', 'SUIVI_DOSSIER'),
      directionId: idOf('dir', 'COMMERCIALE'),
      destinataireId: idOf('des', 'NDOYE'),
      comment: 'Reçu par MME NDOYE',
    });

    const ctx = fakeContext(store, ImportMode.DRY_RUN);
    const row = accepted(adapter.parseRow(cells({ [H.numero]: 'V-2026-000001' }), 2, run));
    const outcome = await adapter.writeChunk([row], ctx);

    expect(outcome.updated).toBe(0);
    expect(outcome.skipped).toBe(1);
    expect(store.changes).toHaveLength(0);
  });
});

describe('apply, après une revue', () => {
  async function simulate(row: Record<string, string>, rowNumber = 2): Promise<VisiteRegistreRow> {
    const ctx = fakeContext(store, ImportMode.DRY_RUN);
    const parsed = accepted(adapter.parseRow(cells(row), rowNumber, run));
    await adapter.writeChunk([parsed], ctx);
    return parsed;
  }

  it('une correction cochée met à jour la visite et trace une fois', async () => {
    store.visites.push({
      id: 'v-1',
      reference: 'V-2026-000001',
      visitedAt: visiteInstant('2026-01-06', '11:08'),
      timeKnown: true,
      visitorName: 'MOUHAMED FALL',
      phone: '78 454 44 66',
      phoneE164: '+221784544466',
      entrepriseId: idOf('ent', 'CPI'),
      objetId: idOf('obj', 'SUIVI_DOSSIER'),
      directionId: idOf('dir', 'COMMERCIALE'),
      destinataireId: idOf('des', 'NDOYE'),
      comment: null,
    });

    const row = await simulate({ [H.numero]: 'V-2026-000001', [H.commentaire]: 'Corrigé' });
    expect(store.changes).toHaveLength(1);

    const ctx = fakeContext(store, ImportMode.APPLY);
    const outcome = await adapter.writeChunk([row], ctx);

    expect(outcome.updated).toBe(1);
    expect(store.visites[0]?.comment).toBe('Corrigé');
    expect(store.audits).toHaveLength(1);
  });

  it('la même revue en simulation n’écrit rien sur la visite', async () => {
    store.visites.push({
      id: 'v-1',
      reference: 'V-2026-000001',
      visitedAt: visiteInstant('2026-01-06', '11:08'),
      timeKnown: true,
      visitorName: 'MOUHAMED FALL',
      phone: '78 454 44 66',
      phoneE164: '+221784544466',
      entrepriseId: idOf('ent', 'CPI'),
      objetId: idOf('obj', 'SUIVI_DOSSIER'),
      directionId: idOf('dir', 'COMMERCIALE'),
      destinataireId: idOf('des', 'NDOYE'),
      comment: null,
    });

    await simulate({ [H.numero]: 'V-2026-000001', [H.commentaire]: 'Corrigé' });
    expect(store.visites[0]?.comment).toBeNull();
  });

  it('une ligne décochée est ignorée à l’application', async () => {
    store.visites.push({
      id: 'v-1',
      reference: 'V-2026-000001',
      visitedAt: visiteInstant('2026-01-06', '11:08'),
      timeKnown: true,
      visitorName: 'MOUHAMED FALL',
      phone: '78 454 44 66',
      phoneE164: '+221784544466',
      entrepriseId: idOf('ent', 'CPI'),
      objetId: idOf('obj', 'SUIVI_DOSSIER'),
      directionId: idOf('dir', 'COMMERCIALE'),
      destinataireId: idOf('des', 'NDOYE'),
      comment: null,
    });

    const row = await simulate({ [H.numero]: 'V-2026-000001', [H.commentaire]: 'Corrigé' });
    const change = store.changes[0];
    if (change) change.selected = false;

    const ctx = fakeContext(store, ImportMode.APPLY);
    const outcome = await adapter.writeChunk([row], ctx);

    expect(outcome.updated).toBe(0);
    expect(outcome.skipped).toBe(1);
    expect(store.visites[0]?.comment).toBeNull();
  });

  it('une empreinte différente refuse cette ligne, sans bloquer les autres', async () => {
    store.visites.push(
      {
        id: 'v-1',
        reference: 'V-2026-000001',
        visitedAt: visiteInstant('2026-01-06', '11:08'),
        timeKnown: true,
        visitorName: 'MOUHAMED FALL',
        phone: '78 454 44 66',
        phoneE164: '+221784544466',
        entrepriseId: idOf('ent', 'CPI'),
        objetId: idOf('obj', 'SUIVI_DOSSIER'),
        directionId: idOf('dir', 'COMMERCIALE'),
        destinataireId: idOf('des', 'NDOYE'),
        comment: null,
      },
      {
        id: 'v-2',
        reference: 'V-2026-000002',
        visitedAt: visiteInstant('2026-01-07', '09:00'),
        timeKnown: true,
        visitorName: 'AWA SY',
        phone: null,
        phoneE164: null,
        entrepriseId: idOf('ent', 'CPI'),
        objetId: idOf('obj', 'SUIVI_DOSSIER'),
        directionId: null,
        destinataireId: null,
        comment: null,
      },
    );

    const row1 = await simulate({ [H.numero]: 'V-2026-000001', [H.commentaire]: 'Corrigé' }, 2);
    const row2 = await simulate(
      {
        [H.numero]: 'V-2026-000002',
        [H.nom]: 'AWA SY',
        [H.date]: '07/01/2026',
        [H.heure]: '09:00',
        [H.commentaire]: 'Aussi corrigé',
      },
      3,
    );

    // Correction faite au comptoir APRÈS la revue de la ligne 1.
    const stale = store.visites.find((v) => v.id === 'v-1');
    if (stale) stale.visitorName = 'MOUHAMED FALL CORRIGÉ AU COMPTOIR';

    const ctx = fakeContext(store, ImportMode.APPLY);
    const outcome = await adapter.writeChunk([row1, row2], ctx);

    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]?.code).toBe(VisiteImportError.REGISTRE_MODIFIEE_DEPUIS);
    expect(outcome.updated).toBe(1);
    expect(store.visites.find((v) => v.id === 'v-2')?.comment).toBe('Aussi corrigé');
  });
});

describe('prepare appelé deux fois', () => {
  it('rend deux états indépendants', async () => {
    const ctx = fakeContext(store);
    const first = await adapter.prepare(ctx);
    const second = await adapter.prepare(ctx);
    expect(first).not.toBe(second);
  });
});
