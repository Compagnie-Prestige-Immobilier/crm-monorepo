import { EnrollmentMethod, ImportKind, ImportMode, Phase2Status } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ImportRowError, ParsedRow } from './import-adapter.js';
import {
  FAKE_OTHER_REPRESENTANT_PHONE,
  FAKE_REPRESENTANT_PHONE,
  createFakeImportStore,
  fakeExistingProspect,
  fakeImportContext,
  type FakeProspectsImportStore,
} from './fake-prospects-import.js';
import { ProspectsImportAdapter, referentialKey } from './prospects-import.adapter.js';
import type { ProspectImportRow, ProspectImportRun } from './prospects-import.adapter.js';
import { ProspectImportError } from './prospects-import.errors.js';
import { ENROLLMENT_METHOD_LABELS } from '../prospects/phase2-labels.js';
import {
  ENROLLMENT_METHOD_TOKENS,
  PROSPECTS_IMPORT_COLUMNS,
  PROSPECT_IMPORT_HEADERS,
} from './prospects-import-template.js';

const H = PROSPECT_IMPORT_HEADERS;

function cells(over: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    [H.nom]: 'Ndiaye',
    [H.prenom]: 'Aminata',
    [H.phone]: '77 123 45 67',
    [H.representantPhone]: FAKE_REPRESENTANT_PHONE,
    [H.banque]: 'CBAO',
    [H.syndicat]: 'CHUES',
    [H.enrollmentMethod]: '',
    ...over,
  };
}

function refusal(result: ParsedRow<ProspectImportRow>): ImportRowError {
  if (result.ok) throw new Error('ligne acceptée alors qu’un refus était attendu');
  return result.error;
}

function accepted(result: ParsedRow<ProspectImportRow>): ProspectImportRow {
  if (!result.ok) throw new Error(`ligne refusée alors qu’elle est valide : ${result.error.code}`);
  return result.row;
}

let store: FakeProspectsImportStore;
let adapter: ProspectsImportAdapter;
let run: ProspectImportRun;

beforeEach(async () => {
  store = createFakeImportStore();
  adapter = new ProspectsImportAdapter();
  run = await adapter.prepare(fakeImportContext(store));
});

describe('contrat de l’adaptateur', () => {
  it('se déclare sur le bon type d’import et au bon plafond', () => {
    expect(adapter.kind).toBe(ImportKind.PROSPECTS);
    expect(adapter.maxRows).toBe(150_000);
  });

  it('expose sept colonnes, aux en-têtes distincts et tous échantillonnés', () => {
    expect(adapter.templateColumns).toBe(PROSPECTS_IMPORT_COLUMNS);
    expect(adapter.templateColumns).toHaveLength(7);

    const headers = adapter.templateColumns.map((column) => column.header);
    expect(new Set(headers).size).toBe(headers.length);
    for (const column of adapter.templateColumns) {
      expect(column.help.length).toBeGreaterThan(0);
      expect(column.sample.length).toBeGreaterThan(0);
    }
  });

  it('sépare le nom du prénom, sans jamais demander un nom complet', () => {
    const headers = adapter.templateColumns.map((column) => column.header);
    expect(headers).toContain('Nom');
    expect(headers).toContain('Prénom');
    expect(headers.some((header) => header.toLowerCase().includes('complet'))).toBe(false);
  });
});

describe('analyse d’une ligne', () => {
  it('accepte une ligne complète et résout les trois clés étrangères', () => {
    const row = accepted(adapter.parseRow(cells(), 3, run));

    expect(row).toMatchObject({
      rowNumber: 3,
      nom: 'Ndiaye',
      prenom: 'Aminata',
      phoneE164: '+221771234567',
      representantId: 'rep-1',
      banqueId: 'ban-cbao',
      syndicatId: 'syn-chues',
      enrollmentMethod: null,
    });
  });

  it('exige le nom et le prénom, chacun dans sa colonne', () => {
    const sansNom = refusal(adapter.parseRow(cells({ [H.nom]: '   ' }), 3, run));
    expect(sansNom.code).toBe(ProspectImportError.NOM_REQUIRED);
    expect(sansNom.column).toBe(H.nom);

    const sansPrenom = refusal(adapter.parseRow(cells({ [H.prenom]: '' }), 4, run));
    expect(sansPrenom.code).toBe(ProspectImportError.PRENOM_REQUIRED);
    expect(sansPrenom.column).toBe(H.prenom);
  });

  it('refuse un téléphone inexploitable', () => {
    const error = refusal(adapter.parseRow(cells({ [H.phone]: 'à demander' }), 3, run));

    expect(error.code).toBe(ProspectImportError.PHONE_INVALID);
    expect(error.column).toBe(H.phone);
    expect(error.rowNumber).toBe(3);
  });

  it('accepte toutes les présentations du même abonné', async () => {
    const local = accepted(adapter.parseRow(cells({ [H.phone]: '77 123 45 67' }), 3, run));
    const other = new ProspectsImportAdapter();
    const runOther = await other.prepare(fakeImportContext(store));

    const international = accepted(
      other.parseRow(cells({ [H.phone]: '00221771234567' }), 3, runOther),
    );
    expect(international.phoneE164).toBe(local.phoneE164);
  });

  it('refuse un représentant qui n’existe pas, et dit qu’il faut le créer d’abord', () => {
    const error = refusal(
      adapter.parseRow(cells({ [H.representantPhone]: '+221700000000' }), 3, run),
    );

    expect(error.code).toBe(ProspectImportError.REPRESENTANT_UNKNOWN);
    expect(error.column).toBe(H.representantPhone);
    expect(error.message).toContain('+221700000000');
  });

  it('refuse un syndicat inconnu en nommant la colonne et les valeurs admises', () => {
    const error = refusal(adapter.parseRow(cells({ [H.syndicat]: 'CHUE' }), 3, run));

    expect(error.code).toBe(ProspectImportError.SYNDICAT_UNKNOWN);
    expect(error.column).toBe(H.syndicat);
    expect(error.message).toContain('CHUES');
    expect(error.message).toContain('SUDES');
  });

  it('ne rapproche PAS un libellé voisin, parce que le segment BDD en dépend', async () => {
    for (const proche of ['CBAO Attijari', 'CBA', 'CBAOO', 'C.B.A.O.']) {
      const parser = new ProspectsImportAdapter();
      const runParser = await parser.prepare(fakeImportContext(store));
      expect(refusal(parser.parseRow(cells({ [H.banque]: proche }), 3, runParser)).code).toBe(
        ProspectImportError.BANQUE_UNKNOWN,
      );
    }
  });

  it('tolère la casse et les espaces, qui sont invisibles à l’écran', () => {
    const row = accepted(
      adapter.parseRow(cells({ [H.banque]: '  cbao ', [H.syndicat]: 'Chues  ' }), 3, run),
    );

    expect(row.banqueId).toBe('ban-cbao');
    expect(row.syndicatId).toBe('syn-chues');
  });

  it('la clé de rapprochement n’efface que la casse et les espaces', () => {
    expect(referentialKey('  cbao  ')).toBe('CBAO');
    expect(referentialKey('Banque   Atlantique')).toBe('BANQUE ATLANTIQUE');
    expect(referentialKey('B.N.D.E.')).not.toBe('BNDE');
    expect(referentialKey('SÉNÉGAL')).toBe('SÉNÉGAL');
  });
});

describe('méthode d’enrôlement', () => {
  it('laisse la fiche en attente quand la colonne est vide', () => {
    expect(accepted(adapter.parseRow(cells(), 3, run)).enrollmentMethod).toBeNull();
  });

  it('accepte les quatre jetons admis', async () => {
    for (const token of [
      EnrollmentMethod.APPOINTMENT,
      EnrollmentMethod.PLATFORM,
      EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING,
      EnrollmentMethod.WHATSAPP,
    ]) {
      const parser = new ProspectsImportAdapter();
      const runParser = await parser.prepare(fakeImportContext(store));
      const row = accepted(parser.parseRow(cells({ [H.enrollmentMethod]: token }), 3, runParser));
      expect(row.enrollmentMethod).toBe(token);
    }
  });

  it('refuse un jeton inconnu en listant les valeurs admises', () => {
    const error = refusal(adapter.parseRow(cells({ [H.enrollmentMethod]: 'TÉLÉPHONE' }), 3, run));

    expect(error.code).toBe(ProspectImportError.ENROLLMENT_METHOD_UNKNOWN);
    expect(error.column).toBe(H.enrollmentMethod);
    expect(error.message).toContain('Plateforme en ligne');
    expect(error.message).toContain('RDV CPI');
  });

  // EB-24 retire « Physique » : un classeur ancien qui le porte encore est
  // refusé ligne à ligne, pas rangé en silence sous une autre méthode.
  it('refuse la méthode retirée « Physique »', () => {
    const error = refusal(adapter.parseRow(cells({ [H.enrollmentMethod]: 'Physique' }), 3, run));

    expect(error.code).toBe(ProspectImportError.ENROLLMENT_METHOD_UNKNOWN);
  });

  it('accepte le LIBELLÉ français, celui du modèle et celui de l’export', () => {
    const row = accepted(
      adapter.parseRow(cells({ [H.enrollmentMethod]: 'Plateforme en ligne' }), 3, run),
    );

    expect(row.enrollmentMethod).toBe(EnrollmentMethod.PLATFORM);
  });

  it('tolère la casse et les accents sur le libellé', () => {
    const row = accepted(
      adapter.parseRow(cells({ [H.enrollmentMethod]: 'plateforme en ligne' }), 3, run),
    );

    expect(row.enrollmentMethod).toBe(EnrollmentMethod.PLATFORM);
  });

  // Le modèle propose le libellé, l'export l'écrit : les deux doivent tomber
  // sur la même valeur, sans quoi l'aller-retour échoue sur cette colonne.
  it('reprend telle quelle la valeur proposée par le modèle', () => {
    for (const proposee of ENROLLMENT_METHOD_TOKENS) {
      const row = accepted(adapter.parseRow(cells({ [H.enrollmentMethod]: proposee }), 3, run));
      expect(row.enrollmentMethod).not.toBeNull();
      expect(ENROLLMENT_METHOD_LABELS[row.enrollmentMethod as EnrollmentMethod]).toBe(proposee);
    }
  });
});

describe('modèle de la colonne « Méthode d’enrôlement »', () => {
  it('propose les libellés français, jamais les jetons techniques', () => {
    expect(ENROLLMENT_METHOD_TOKENS).toEqual([
      'RDV CPI',
      'Plateforme en ligne',
      'Mail',
      'WhatsApp',
    ]);

    const colonne = PROSPECTS_IMPORT_COLUMNS.find((column) => column.header === H.enrollmentMethod);
    expect(colonne?.sample).toBe('Plateforme en ligne');
    expect(colonne?.help).not.toContain('VOICE_OR_ELECTRONIC_MESSAGING');
  });
});

describe('doublon interne au fichier', () => {
  it('garde la première occurrence et refuse la seconde en la renvoyant à sa ligne', async () => {
    const ctx = fakeImportContext(store);
    const premiere = accepted(adapter.parseRow(cells({ [H.phone]: '77 123 45 67' }), 3, run));
    const seconde = accepted(adapter.parseRow(cells({ [H.phone]: '+221 77 123 45 67' }), 41, run));

    const outcome = await adapter.writeChunk([premiere, seconde], ctx, run);

    expect(outcome.created).toBe(1);
    const error = outcome.errors[0];
    expect(error?.code).toBe(ProspectImportError.DUPLICATE_IN_FILE);
    expect(error?.rowNumber).toBe(41);
    expect(error?.message).toContain('3');
    expect(store.prospects).toHaveLength(1);
  });

  it('se souvient d’une tranche à l’autre du même travail', async () => {
    const ctx = fakeImportContext(store);
    await adapter.writeChunk([accepted(adapter.parseRow(cells(), 3, run))], ctx, run);

    const outcome = await adapter.writeChunk(
      [accepted(adapter.parseRow(cells(), 900, run))],
      ctx,
      run,
    );

    expect(outcome.errors[0]?.code).toBe(ProspectImportError.DUPLICATE_IN_FILE);
    expect(outcome.errors[0]?.message).toContain('3');
  });

  it('ne confond PAS deux imports concurrents servis par la même instance', async () => {
    const autreStore = createFakeImportStore();
    const autre = fakeImportContext(autreStore, { jobId: 'job-2' });
    const runAutre = await adapter.prepare(autre);

    await adapter.writeChunk(
      [accepted(adapter.parseRow(cells(), 3, run))],
      fakeImportContext(store),
      run,
    );
    const outcome = await adapter.writeChunk(
      [accepted(adapter.parseRow(cells(), 3, runAutre))],
      autre,
      runAutre,
    );

    expect(outcome.created).toBe(1);
    expect(outcome.errors).toHaveLength(0);
  });

  it('juge une ligne du lot A avec les référentiels de A, même si B a préparé entre-temps', async () => {
    const autreStore = createFakeImportStore({
      banques: [{ id: 'ban-eco', shortName: 'ECOBANK', isActive: true, sortOrder: 10 }],
    });
    await adapter.prepare(fakeImportContext(autreStore, { jobId: 'job-2' }));

    expect(accepted(adapter.parseRow(cells(), 3, run)).banqueId).toBe('ban-cbao');
  });

  it('signale d’abord la vraie faute d’une ligne, pas le doublon', () => {
    expect(adapter.parseRow(cells(), 3, run).ok).toBe(true);

    const error = refusal(adapter.parseRow(cells({ [H.banque]: 'INCONNUE' }), 4, run));
    expect(error.code).toBe(ProspectImportError.BANQUE_UNKNOWN);
  });

  it('oublie le fichier précédent quand le même travail est repris', async () => {
    const ctx = fakeImportContext(store);
    await adapter.writeChunk([accepted(adapter.parseRow(cells(), 3, run))], ctx, run);

    const reprise = await adapter.prepare(ctx);
    store.prospects.length = 0;

    const outcome = await adapter.writeChunk(
      [accepted(adapter.parseRow(cells(), 3, reprise))],
      ctx,
      reprise,
    );
    expect(outcome.created).toBe(1);
    expect(outcome.errors).toHaveLength(0);
  });
});

describe('écriture d’une tranche', () => {
  it('crée une fiche identique à celle de la saisie ordinaire', async () => {
    const ctx = fakeImportContext(store);
    const row = accepted(adapter.parseRow(cells(), 3, run));

    const outcome = await adapter.writeChunk([row], ctx, run);

    expect(outcome).toMatchObject({ created: 1, skipped: 0 });
    expect(outcome.errors).toHaveLength(0);

    const written = store.prospects[0];
    expect(written).toBeDefined();
    expect(written).toMatchObject({
      nom: 'Ndiaye',
      prenom: 'Aminata',
      phoneE164: '+221771234567',
      banqueId: 'ban-cbao',
      syndicatId: 'syn-chues',
      representantId: 'rep-1',
      createdById: 'user-admin',
      phase2Status: Phase2Status.PENDING,
      enrollmentMethod: null,
      enrollmentCapturedAt: null,
      enrollmentCapturedById: null,
    });
  });

  it('satisfait le CHECK de phase 2 quand la méthode est fournie', async () => {
    const ctx = fakeImportContext(store);
    const row = accepted(
      adapter.parseRow(cells({ [H.enrollmentMethod]: EnrollmentMethod.WHATSAPP }), 3, run),
    );

    await adapter.writeChunk([row], ctx, run);

    expect(store.prospects[0]).toMatchObject({
      phase2Status: Phase2Status.METHOD_OBTAINED,
      enrollmentMethod: EnrollmentMethod.WHATSAPP,
      enrollmentCapturedById: 'user-admin',
    });
    expect(store.prospects[0]?.enrollmentCapturedAt).toBeInstanceOf(Date);
  });

  it('refuse une fiche déjà en base sous le MÊME représentant', async () => {
    store.prospects.push(
      fakeExistingProspect({
        id: 'pro-1',
        phoneE164: '+221771234567',
        representantId: 'rep-1',
      }),
    );
    const ctx = fakeImportContext(store);
    const row = accepted(adapter.parseRow(cells(), 3, run));

    const outcome = await adapter.writeChunk([row], ctx, run);

    expect(outcome.created).toBe(0);
    expect(outcome.errors[0]?.code).toBe(ProspectImportError.DUPLICATE_IN_DATABASE);
    expect(store.prospects).toHaveLength(1);
  });

  it('signale une fiche déjà rattachée à un AUTRE représentant, sans la déplacer', async () => {
    store.prospects.push(
      fakeExistingProspect({
        id: 'pro-1',
        phoneE164: '+221771234567',
        representantId: 'rep-2',
      }),
    );
    const ctx = fakeImportContext(store);
    const row = accepted(adapter.parseRow(cells(), 3, run));

    const outcome = await adapter.writeChunk([row], ctx, run);

    expect(outcome.created).toBe(0);
    const error = outcome.errors[0];
    expect(error?.code).toBe(ProspectImportError.ATTACHED_TO_OTHER_REPRESENTANT);
    expect(error?.column).toBe(H.representantPhone);
    expect(error?.rowNumber).toBe(3);
    expect(store.prospects).toHaveLength(1);
    expect(store.prospects[0]?.representantId).toBe('rep-2');
  });

  it('compte en `skipped`, et non en erreur, ce que l’index unique écarte', async () => {
    store.racingPhones.push('+221771234567');
    const ctx = fakeImportContext(store);
    const row = accepted(adapter.parseRow(cells(), 3, run));

    const outcome = await adapter.writeChunk([row], ctx, run);

    expect(outcome).toMatchObject({ created: 0, skipped: 1 });
    expect(outcome.errors).toHaveLength(0);
  });

  it('n’écrit RIEN en simulation, et annonce ce qui serait écrit', async () => {
    const ctx = fakeImportContext(store, { mode: ImportMode.DRY_RUN });
    const row = accepted(adapter.parseRow(cells(), 3, run));

    const outcome = await adapter.writeChunk([row], ctx, run);

    expect(outcome).toMatchObject({ created: 1, skipped: 0 });
    expect(store.prospects).toHaveLength(0);
  });

  it('ne touche pas à la base sur une tranche vide', async () => {
    const outcome = await adapter.writeChunk([], fakeImportContext(store), run);

    expect(outcome).toEqual({ created: 0, skipped: 0, errors: [] });
  });
});

describe('enchaînement', () => {
  it('refuse un référentiel dont deux entrées se confondent', async () => {
    const ambigu = createFakeImportStore({
      banques: [
        { id: 'ban-a', shortName: 'CBAO', isActive: true, sortOrder: 10 },
        { id: 'ban-b', shortName: 'cbao ', isActive: true, sortOrder: 20 },
      ],
    });

    await expect(new ProspectsImportAdapter().prepare(fakeImportContext(ambigu))).rejects.toThrow(
      'deux entrées qui se confondent',
    );
  });
});

describe('déduplication contre le représentant, plusieurs lignes', () => {
  it('trie une tranche mixte : créée, déjà là, ailleurs', async () => {
    store.prospects.push(
      fakeExistingProspect({ id: 'pro-1', phoneE164: '+221771111111', representantId: 'rep-1' }),
      fakeExistingProspect({ id: 'pro-2', phoneE164: '+221772222222', representantId: 'rep-2' }),
    );
    const ctx = fakeImportContext(store);

    const rows = [
      accepted(adapter.parseRow(cells({ [H.phone]: '+221773333333' }), 3, run)),
      accepted(adapter.parseRow(cells({ [H.phone]: '+221771111111' }), 4, run)),
      accepted(
        adapter.parseRow(
          cells({ [H.phone]: '+221772222222', [H.representantPhone]: FAKE_REPRESENTANT_PHONE }),
          5,
          run,
        ),
      ),
    ];

    const outcome = await adapter.writeChunk(rows, ctx, run);

    expect(outcome.created).toBe(1);
    expect(outcome.errors.map((error) => error.code)).toEqual([
      ProspectImportError.DUPLICATE_IN_DATABASE,
      ProspectImportError.ATTACHED_TO_OTHER_REPRESENTANT,
    ]);
    expect(FAKE_OTHER_REPRESENTANT_PHONE).toBeTruthy();
  });
});
