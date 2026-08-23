import { ImportKind, ImportMode, Projet, ProspectType } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ImportRowError, ImportRunContext, ParsedRow } from './import-adapter.js';
import {
  GRAND_PUBLIC_IMPORT_COLUMNS,
  GRAND_PUBLIC_IMPORT_HEADERS,
  GRAND_PUBLIC_MAX_ROWS,
} from './prospects-grand-public-template.js';
import {
  GrandPublicImportError,
  ProspectsGrandPublicImportAdapter,
  readDureeMois,
  type GrandPublicImportRow,
  type GrandPublicImportRun,
} from './prospects-grand-public.adapter.js';

const H = GRAND_PUBLIC_IMPORT_HEADERS;

interface FakeProspect {
  id?: string;
  phoneE164: string;
  projet: Projet;
  deletedAt: Date | null;
}

interface WrittenProspect {
  projet: Projet;
  nom: string;
  prenom: string;
  phoneE164: string;
  profession: string | null;
  syndicatId: string | null;
  banqueId: string | null;
  representantId: string | null;
  type: ProspectType | null;
  dureeSystemeMois: number | null;
  canalProvenanceId: string | null;
  createdById: string;
}

interface Store {
  prospects: FakeProspect[];
  written: WrittenProspect[];
  journeys: Set<string>;
}

function makeStore(prospects: FakeProspect[] = []): Store {
  const normalized = prospects.map((prospect, index) => ({
    id: prospect.id ?? `p-${String(index + 1)}`,
    ...prospect,
  }));
  return {
    prospects: normalized,
    written: [],
    journeys: new Set(
      normalized
        .filter((prospect) => prospect.projet === Projet.GRAND_PUBLIC)
        .map((prospect) => prospect.id),
    ),
  };
}

function context(
  store: Store,
  over: Partial<Pick<ImportRunContext, 'jobId' | 'mode' | 'requestedById'>> = {},
): ImportRunContext {
  const tx = {
    banque: {
      findMany: () =>
        Promise.resolve([
          { id: 'ban-cbao', shortName: 'CBAO' },
          { id: 'ban-bnde', shortName: 'BNDE' },
        ]),
    },
    syndicat: {
      findMany: () =>
        Promise.resolve([
          { id: 'syn-chues', sigle: 'CHUES' },
          { id: 'syn-sudes', sigle: 'SUDES' },
        ]),
    },
    canalProvenance: {
      findMany: () =>
        Promise.resolve([
          { id: 'canal-tiktok', code: 'TIKTOK', label: 'TikTok' },
          { id: 'canal-bouche', code: 'BOUCHE_A_OREILLE', label: 'Bouche à oreille' },
        ]),
    },
    prospect: {
      // `projet` est honoré alors que l'adaptateur ne le filtre pas : un jour où
      // il le ferait, l'index unique global cesserait d'être respecté et ce
      // faux doit le montrer.
      findMany: (args: { where: { phoneE164: { in: string[] }; projet?: Projet } }) =>
        Promise.resolve(
          store.prospects
            .filter(
              (row) =>
                row.deletedAt === null &&
                args.where.phoneE164.in.includes(row.phoneE164) &&
                (args.where.projet === undefined || args.where.projet === row.projet),
            )
            .map((row) => ({
              id: row.id,
              phoneE164: row.phoneE164,
              projet: row.projet,
              journeys: store.journeys.has(row.id ?? '') ? [{ id: 'journey' }] : [],
            })),
        ),
      createMany: (args: { data: readonly WrittenProspect[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const row of args.data) {
          const taken = store.prospects.some(
            (existing) => existing.deletedAt === null && existing.phoneE164 === row.phoneE164,
          );
          if (taken) continue;
          store.prospects.push({
            id: `p-${String(store.prospects.length + 1)}`,
            phoneE164: row.phoneE164,
            projet: row.projet,
            deletedAt: null,
          });
          store.written.push(row);
          count += 1;
        }
        return Promise.resolve({ count });
      },
    },
    prospectJourney: {
      createMany: (args: { data: readonly { prospectId: string }[] }) => {
        let count = 0;
        for (const row of args.data) {
          if (store.journeys.has(row.prospectId)) continue;
          store.journeys.add(row.prospectId);
          count += 1;
        }
        return Promise.resolve({ count });
      },
    },
  };

  return {
    jobId: over.jobId ?? 'job-gp',
    mode: over.mode ?? ImportMode.APPLY,
    requestedById: over.requestedById ?? 'user-admin',
    tx: tx as unknown as ImportRunContext['tx'],
  };
}

function cells(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    [H.prenom]: 'Aminata',
    [H.nom]: 'Ndiaye',
    [H.phone]: '77 123 45 67',
    [H.profession]: '',
    [H.syndicat]: '',
    [H.banque]: '',
    [H.fonctionnaire]: '',
    [H.dureeSysteme]: '',
    [H.canal]: '',
    ...over,
  };
}

function refusal(result: ParsedRow<GrandPublicImportRow>): ImportRowError {
  if (result.ok) throw new Error('ligne acceptée alors qu’un refus était attendu');
  return result.error;
}

function accepted(result: ParsedRow<GrandPublicImportRow>): GrandPublicImportRow {
  if (!result.ok) throw new Error(`ligne refusée alors qu’elle est valide : ${result.error.code}`);
  return result.row;
}

let store: Store;
let adapter: ProspectsGrandPublicImportAdapter;
let run: GrandPublicImportRun;

beforeEach(async () => {
  store = makeStore();
  adapter = new ProspectsGrandPublicImportAdapter();
  run = await adapter.prepare(context(store));
});

describe('contrat de l’adaptateur Grand Public', () => {
  it('se déclare sur son propre type d’import, à son propre plafond', () => {
    expect(adapter.kind).toBe(ImportKind.PROSPECTS_GRAND_PUBLIC);
    expect(adapter.maxRows).toBe(GRAND_PUBLIC_MAX_ROWS);
  });

  it('lit par en-tête, en ligne 1, jamais par rang', () => {
    expect(adapter.layout.headerRow).toBe(1);
    expect(adapter.layout.sheetPattern.test('Prospects Grand Public')).toBe(true);
    expect(adapter.layout.sheetPattern.test('Instructions')).toBe(false);
    expect(adapter.layout.sheetPattern.test('Listes')).toBe(false);
  });

  it('n’exige que le nom et le téléphone', () => {
    const obligatoires = GRAND_PUBLIC_IMPORT_COLUMNS.filter((column) => column.required).map(
      (column) => column.header,
    );

    expect(obligatoires).toEqual([H.nom, H.phone]);
  });

  it('porte les neuf colonnes du métier, sans intitulé ni synonyme qui se confondent', () => {
    expect(adapter.templateColumns).toBe(GRAND_PUBLIC_IMPORT_COLUMNS);
    expect(adapter.templateColumns).toHaveLength(9);

    const keys = GRAND_PUBLIC_IMPORT_COLUMNS.flatMap((column) =>
      [column.header, ...(column.aliases ?? [])].map((label) =>
        label
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim(),
      ),
    );

    expect(new Set(keys).size).toBe(keys.length);
    for (const column of GRAND_PUBLIC_IMPORT_COLUMNS) {
      expect(column.help.length, column.header).toBeGreaterThan(0);
    }
  });
});

describe('une cellule vide n’est pas une erreur', () => {
  it('accepte une ligne qui ne porte QUE le nom et le téléphone', () => {
    const row = accepted(adapter.parseRow(cells({ [H.prenom]: '' }), 3, run));

    expect(row).toEqual({
      rowNumber: 3,
      nom: 'Ndiaye',
      prenom: '',
      phoneE164: '+221771234567',
      profession: null,
      syndicatId: null,
      banqueId: null,
      type: null,
      dureeSystemeMois: null,
      canalProvenanceId: null,
    });
  });

  it('accepte aussi une ligne dont les colonnes facultatives manquent du fichier', () => {
    const row = accepted(adapter.parseRow({ [H.nom]: 'Fall', [H.phone]: '781112233' }, 4, run));

    expect(row.nom).toBe('Fall');
    expect(row.canalProvenanceId).toBeNull();
    expect(row.type).toBeNull();
  });

  it('résout tout ce qui est renseigné', () => {
    const row = accepted(
      adapter.parseRow(
        cells({
          [H.profession]: 'Couturière',
          [H.syndicat]: ' chues ',
          [H.banque]: 'cbao',
          [H.fonctionnaire]: 'Oui',
          [H.dureeSysteme]: '24 mois',
          [H.canal]: 'tiktok',
        }),
        3,
        run,
      ),
    );

    expect(row).toMatchObject({
      profession: 'Couturière',
      syndicatId: 'syn-chues',
      banqueId: 'ban-cbao',
      type: ProspectType.FONCTIONNAIRE,
      dureeSystemeMois: 24,
      canalProvenanceId: 'canal-tiktok',
    });
  });
});

describe('ce qui fait refuser une ligne', () => {
  it('refuse un nom absent', () => {
    const error = refusal(adapter.parseRow(cells({ [H.nom]: '   ' }), 3, run));

    expect(error.code).toBe(GrandPublicImportError.NOM_ABSENT);
    expect(error.column).toBe(H.nom);
    expect(error.rowNumber).toBe(3);
  });

  it('refuse un téléphone absent, et le dit autrement qu’un téléphone illisible', () => {
    const absent = refusal(adapter.parseRow(cells({ [H.phone]: '' }), 3, run));
    const illisible = refusal(adapter.parseRow(cells({ [H.phone]: 'à rappeler' }), 4, run));

    expect(absent.code).toBe(GrandPublicImportError.TELEPHONE_ILLISIBLE);
    expect(absent.message).toMatch(/obligatoire/);
    expect(illisible.code).toBe(GrandPublicImportError.TELEPHONE_ILLISIBLE);
    expect(illisible.message).toContain('à rappeler');
  });

  it.each([
    [H.banque, 'Ecobank', GrandPublicImportError.BANQUE_INCONNUE, 'CBAO'],
    [H.syndicat, 'SAES', GrandPublicImportError.SYNDICAT_INCONNU, 'CHUES'],
    [H.canal, 'Pigeon voyageur', GrandPublicImportError.CANAL_INCONNU, 'TikTok'],
  ])(
    'refuse « %s » rempli hors référentiel, en nommant les valeurs admises',
    (column, valeur, code, admise) => {
      const error = refusal(adapter.parseRow(cells({ [column]: valeur }), 3, run));

      expect(error.code).toBe(code);
      expect(error.column).toBe(column);
      expect(error.message).toContain(valeur);
      expect(error.message).toContain(admise);
      expect(error.message).toMatch(/cellule vide/);
    },
  );

  it('refuse une durée qui n’est pas un entier de mois', () => {
    for (const raw of ['2 ans', '0', 'douze', '-3', '1000']) {
      const error = refusal(adapter.parseRow(cells({ [H.dureeSysteme]: raw }), 3, run));
      expect(error.code, raw).toBe(GrandPublicImportError.DUREE_ILLISIBLE);
      expect(error.column, raw).toBe(H.dureeSysteme);
    }
  });

  it('refuse une case « Fonctionnaire » qui ne se lit ni oui ni non', () => {
    const error = refusal(adapter.parseRow(cells({ [H.fonctionnaire]: 'peut-être' }), 3, run));

    expect(error.code).toBe(GrandPublicImportError.FONCTIONNAIRE_ILLISIBLE);
    expect(error.column).toBe(H.fonctionnaire);
  });
});

describe('« Fonctionnaire » et le type se composent sans jamais se deviner', () => {
  it.each(['oui', 'OUI', 'O', 'x', '1', 'vrai'])(
    '« %s » range la fiche en FONCTIONNAIRE',
    (raw) => {
      expect(accepted(adapter.parseRow(cells({ [H.fonctionnaire]: raw }), 3, run)).type).toBe(
        ProspectType.FONCTIONNAIRE,
      );
    },
  );

  // « Non » dit ce que la personne n'est pas, pas ce qu'elle est : le fichier ne
  // choisit pas entre secteur privé, informel et diaspora.
  it.each(['non', 'NON', 'n', '0', 'faux'])('« %s » laisse le type VIDE', (raw) => {
    expect(accepted(adapter.parseRow(cells({ [H.fonctionnaire]: raw }), 3, run)).type).toBeNull();
  });

  it('une case vide laisse le type vide, sans refus', () => {
    expect(accepted(adapter.parseRow(cells({ [H.fonctionnaire]: '' }), 3, run)).type).toBeNull();
  });
});

describe('lecture du canal et de la durée', () => {
  it('reconnaît un canal par son libellé comme par son code, accents indifférents', () => {
    const parLibelle = accepted(adapter.parseRow(cells({ [H.canal]: 'Bouche a oreille' }), 3, run));
    const parCode = accepted(adapter.parseRow(cells({ [H.canal]: 'BOUCHE_A_OREILLE' }), 4, run));

    expect(parLibelle.canalProvenanceId).toBe('canal-bouche');
    expect(parCode.canalProvenanceId).toBe('canal-bouche');
  });

  it('lit une durée avec ou sans le mot « mois »', () => {
    expect(readDureeMois('24')).toBe(24);
    expect(readDureeMois('24 mois')).toBe(24);
    expect(readDureeMois('300')).toBe(300);
    expect(readDureeMois('301')).toBeNull();
    expect(readDureeMois('2 ans')).toBeNull();
  });

  it('borne la profession à 120 caractères plutôt que de refuser la ligne', () => {
    const row = accepted(adapter.parseRow(cells({ [H.profession]: 'a'.repeat(400) }), 3, run));

    expect(row.profession).toHaveLength(120);
  });
});

describe('écriture d’une tranche', () => {
  const rowOf = (rowNumber: number, phoneE164: string): GrandPublicImportRow => ({
    rowNumber,
    nom: 'Ndiaye',
    prenom: 'Aminata',
    phoneE164,
    profession: null,
    syndicatId: null,
    banqueId: null,
    type: null,
    dureeSystemeMois: null,
    canalProvenanceId: null,
  });

  it('écrit une fiche Grand Public sans représentant et hors démonstration', async () => {
    const outcome = await adapter.writeChunk([rowOf(3, '+221771234567')], context(store), run);

    expect(outcome).toMatchObject({ created: 1, skipped: 0 });
    expect(outcome.errors).toEqual([]);
    expect(store.written[0]).toMatchObject({
      projet: Projet.GRAND_PUBLIC,
      representantId: null,
      createdById: 'user-admin',
    });
  });

  it('refuse le second exemplaire d’un numéro répété dans le fichier, et nomme la première ligne', async () => {
    const outcome = await adapter.writeChunk(
      [rowOf(3, '+221771234567'), rowOf(9, '+221771234567')],
      context(store),
      run,
    );

    expect(outcome.created).toBe(1);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]?.code).toBe(GrandPublicImportError.DOUBLON_DANS_LE_FICHIER);
    expect(outcome.errors[0]?.rowNumber).toBe(9);
    expect(outcome.errors[0]?.message).toContain('3');
  });

  it('ajoute un parcours à une fiche CHUES et refuse le doublon Grand Public', async () => {
    store = makeStore([
      { phoneE164: '+221771234567', projet: Projet.CHUES, deletedAt: null },
      { phoneE164: '+221781112233', projet: Projet.GRAND_PUBLIC, deletedAt: null },
    ]);
    run = await adapter.prepare(context(store));

    const outcome = await adapter.writeChunk(
      [rowOf(3, '+221771234567'), rowOf(4, '+221781112233')],
      context(store),
      run,
    );

    expect(outcome.created).toBe(1);
    expect(outcome.errors.map((error) => error.code)).toEqual([
      GrandPublicImportError.DEJA_EN_BASE,
    ]);
  });

  it('ne voit pas un numéro porté par une fiche supprimée', async () => {
    store = makeStore([
      { phoneE164: '+221771234567', projet: Projet.CHUES, deletedAt: new Date() },
    ]);
    run = await adapter.prepare(context(store));

    const outcome = await adapter.writeChunk([rowOf(3, '+221771234567')], context(store), run);

    expect(outcome.created).toBe(1);
    expect(outcome.errors).toEqual([]);
  });

  it('la simulation compte ce qui serait créé, et n’écrit rien', async () => {
    const outcome = await adapter.writeChunk(
      [rowOf(3, '+221771234567'), rowOf(4, '+221781112233')],
      context(store, { mode: ImportMode.DRY_RUN }),
      run,
    );

    expect(outcome).toMatchObject({ created: 2, skipped: 0 });
    expect(store.written).toEqual([]);
  });

  it('repart d’un fichier vierge à chaque préparation, pour qu’une reprise ne fabrique pas de doublons', async () => {
    await adapter.writeChunk([rowOf(3, '+221771234567')], context(store), run);
    store = makeStore();
    run = await adapter.prepare(context(store));

    const outcome = await adapter.writeChunk([rowOf(3, '+221771234567')], context(store), run);

    expect(outcome.created).toBe(1);
    expect(outcome.errors).toEqual([]);
  });
});
