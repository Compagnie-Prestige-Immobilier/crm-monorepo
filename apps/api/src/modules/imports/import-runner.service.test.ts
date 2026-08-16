import { ImportKind, ImportMode, ImportStatus } from '@crm/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { IMPORT_COLUMNS } from '../representants/import-template.js';
import type { ChunkOutcome, ImportAdapter, ParsedRow } from './import-adapter.js';
import { ImportRunnerService } from './import-runner.service.js';
import { DEPARTEMENT_DAKAR, fakeJob, FakeImportPrisma } from './fake-import-prisma.js';
import { RepresentantsImportAdapter } from './representants.adapter.js';
import type { ImportRowReader, SheetRow, SheetSource } from './xlsx-rows.js';

/**
 * Le moteur, exercé SANS disque et SANS PostgreSQL.
 *
 * Les quatre propriétés éprouvées ici sont celles qui ne se voient pas en
 * recette, parce qu'elles ne surviennent qu'au mauvais moment : la reprise après
 * un redéploiement, le bail perdu au milieu d'une tranche, et le refus d'un
 * classeur démesuré avant qu'il n'ait été lu.
 */

const HEADERS = IMPORT_COLUMNS.map((column) => column.header);

/** Une ligne de classeur, indexée par en-tête comme le fait le lecteur réel. */
const sheetRow = (rowNumber: number, values: readonly string[]): SheetRow => ({
  rowNumber,
  cells: Object.fromEntries(HEADERS.map((header, index) => [header, values[index] ?? ''])),
});

/** N lignes valides, numérotées à partir de la première ligne de données. */
const validRows = (count: number): SheetRow[] =>
  Array.from({ length: count }, (_, index) =>
    sheetRow(3 + index, [
      `Représentant ${String(index + 1)}`,
      `77 123 45 ${String(60 + index).padStart(2, '0')}`,
      'Dakar',
      '',
      '',
    ]),
  );

/**
 * Source de lignes EN MÉMOIRE.
 *
 * Elle compte les lignes réellement TIRÉES, et c'est ce compteur qui permet
 * d'affirmer qu'un refus au plafond n'a lu aucune ligne — une assertion sur le
 * seul état final du travail ne distinguerait pas « refusé sans lire » de
 * « refusé après avoir tout lu », qui est précisément le défaut corrigé.
 */
class FakeRowReader implements ImportRowReader {
  pulled = 0;
  closed = 0;

  constructor(
    private readonly rows: readonly SheetRow[],
    private readonly declaredDataRows: number | null = null,
  ) {}

  open(): Promise<SheetSource> {
    return Promise.resolve({
      declaredDataRows: this.declaredDataRows,
      rows: () => this.iterate(),
      close: () => {
        this.closed += 1;
        return Promise.resolve();
      },
    });
  }

  private async *iterate(): AsyncIterable<SheetRow> {
    for (const row of this.rows) {
      this.pulled += 1;
      // Une pause réelle entre deux lignes : le lecteur de production tire
      // chaque ligne d'un flux, et un moteur qui supposerait la lecture
      // synchrone passerait ici sans qu'on le voie.
      await Promise.resolve();
      yield row;
    }
  }
}

/** Un adaptateur minuscule, pour éprouver le joint lui-même et un petit plafond. */
class TinyAdapter implements ImportAdapter<{ rowNumber: number }> {
  readonly kind = ImportKind.REPRESENTANTS;
  readonly templateColumns = IMPORT_COLUMNS;
  prepared = 0;
  written: number[] = [];

  constructor(readonly maxRows: number) {}

  parseRow(_cells: Record<string, string>, rowNumber: number): ParsedRow<{ rowNumber: number }> {
    return { ok: true, row: { rowNumber } };
  }

  prepare(): Promise<void> {
    this.prepared += 1;
    return Promise.resolve();
  }

  writeChunk(rows: readonly { rowNumber: number }[]): Promise<ChunkOutcome> {
    this.written.push(...rows.map((row) => row.rowNumber));
    return Promise.resolve({ created: rows.length, skipped: 0, errors: [] });
  }
}

/**
 * Le moteur, câblé à la main.
 *
 * La liste d'adaptateurs est typée `unknown` ici et non `ImportAdapter<TRow>` :
 * deux adaptateurs de lignes DIFFÉRENTES cohabitent dans le même tableau, ce
 * qui est exactement ce que le module fait en production, où la liste est
 * fournie par un jeton.
 */
const runnerOn = (
  prisma: FakeImportPrisma,
  reader: ImportRowReader,
  adapters: readonly unknown[],
): ImportRunnerService =>
  new ImportRunnerService(
    prisma as unknown as PrismaService,
    adapters as unknown as readonly ImportAdapter<unknown>[],
    reader,
  );

const NOW = new Date('2026-08-16T10:00:00.000Z');

describe('moteur d’import', () => {
  let prisma: FakeImportPrisma;
  let adapter: RepresentantsImportAdapter;

  beforeEach(() => {
    // Tranches de deux lignes : le découpage devient observable sur des jeux
    // minuscules, et les invariants éprouvés sont exactement ceux de la
    // production, qui n'en diffère que par le chiffre.
    process.env.IMPORTS_CHUNK_SIZE = '2';
    prisma = new FakeImportPrisma();
    adapter = new RepresentantsImportAdapter();
  });

  afterEach(() => {
    delete process.env.IMPORTS_CHUNK_SIZE;
  });

  it('écrit toutes les lignes valides, une transaction par tranche', async () => {
    prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
    const reader = new FakeRowReader(validRows(5));

    const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

    expect(outcome).toEqual({ result: 'succeeded', created: 5, processed: 5 });
    expect(prisma.representants).toHaveLength(5);
    // Cinq lignes en tranches de deux : trois transactions, jamais une seule
    // transaction géante.
    expect(prisma.transactions).toBe(3);

    const job = prisma.jobs[0];
    expect(job?.status).toBe(ImportStatus.succeeded);
    expect(job?.processedRows).toBe(5);
    expect(job?.createdRows).toBe(5);
    expect(job?.totalRows).toBe(5);
    expect(job?.finishedAt).not.toBeNull();
  });

  it('écrit isDemo à faux EN TOUTES LETTRES, sans consulter le mode démonstration', async () => {
    // Le moteur tourne dans une tâche planifiée, hors de portée de
    // `DemoReadOnlyGuard` : une ligne fictive écrite ici ne serait ni lisible,
    // ni exportable, ni supprimable.
    prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));

    await runnerOn(prisma, new FakeRowReader(validRows(1)), [adapter]).run('job-1', NOW);

    expect(prisma.representants.map((row) => row.isDemo)).toEqual([false]);
  });

  it('en simulation, ne crée RIEN et annonce ce qui serait créé', async () => {
    prisma.jobs.push(fakeJob({ mode: ImportMode.DRY_RUN }));

    const outcome = await runnerOn(prisma, new FakeRowReader(validRows(3)), [adapter]).run(
      'job-1',
      NOW,
    );

    expect(outcome).toEqual({ result: 'succeeded', created: 3, processed: 3 });
    expect(prisma.representants).toHaveLength(0);
    expect(prisma.jobs[0]?.createdRows).toBe(3);
  });

  describe('reprise d’un travail mort', () => {
    /**
     * LA PROPRIÉTÉ CENTRALE DE LA REPRISE.
     *
     * `processedRows` est avancé DANS la transaction de la tranche : il n'existe
     * donc aucun instant où des lignes sont écrites sans être comptées. Une
     * reprise saute exactement ce qui a été compté, et ne recrée rien.
     */
    it('ne recrée AUCUNE des lignes déjà comptées', async () => {
      prisma.jobs.push(
        fakeJob({
          status: ImportStatus.running,
          mode: ImportMode.APPLY,
          processedRows: 2,
          createdRows: 2,
          claimToken: 'jeton-du-mort',
          // Bail largement expiré : le travailleur précédent est mort avec son
          // conteneur, au milieu du classeur.
          claimedAt: new Date(NOW.getTime() - 30 * 60_000),
          startedAt: new Date(NOW.getTime() - 31 * 60_000),
        }),
      );

      const rows = validRows(5);
      const reader = new FakeRowReader(rows);
      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'succeeded', created: 5, processed: 5 });

      // TROIS fiches écrites, pas cinq : les deux premières lignes du fichier
      // n'ont même pas été analysées.
      expect(prisma.representants).toHaveLength(3);
      const ecrits = prisma.representants.map((row) => row.phoneE164);
      expect(ecrits).not.toContain('+221771234560');
      expect(ecrits).not.toContain('+221771234561');
      expect(ecrits).toContain('+221771234562');

      // Les compteurs REPARTENT de ce que la base portait : un écran qui
      // afficherait « 3 créés » après une reprise mentirait sur le total.
      expect(prisma.jobs[0]?.createdRows).toBe(5);
      expect(prisma.jobs[0]?.processedRows).toBe(5);
    });

    it('ne touche pas à un travail dont le bail court encore', async () => {
      prisma.jobs.push(
        fakeJob({
          status: ImportStatus.running,
          claimToken: 'jeton-vivant',
          claimedAt: new Date(NOW.getTime() - 60_000),
        }),
      );

      const reader = new FakeRowReader(validRows(4));
      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'busy' });
      expect(reader.pulled).toBe(0);
      expect(prisma.representants).toHaveLength(0);
      expect(prisma.jobs[0]?.claimToken).toBe('jeton-vivant');
    });
  });

  describe('plafond de lignes', () => {
    /**
     * LE REFUS QUI NE COÛTE RIEN.
     *
     * Le nombre de lignes annoncé par l'en-tête de la feuille est lu avant
     * qu'une seule cellule ne le soit : un classeur de deux millions de lignes
     * est écarté pour le prix de l'ouverture du fichier. C'est exactement ce qui
     * manquait à l'import synchrone, où le contrôle arrivait APRÈS la
     * matérialisation, donc après la mort du conteneur.
     */
    it('refuse dès l’en-tête, SANS lire une seule ligne', async () => {
      prisma.jobs.push(fakeJob({}));
      const reader = new FakeRowReader(validRows(3), 50_001);

      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'failed', code: 'IMPORT_TOO_MANY_ROWS' });
      expect(reader.pulled).toBe(0);
      expect(reader.closed).toBe(1);
      expect(prisma.jobs[0]?.status).toBe(ImportStatus.failed);
      expect(prisma.jobs[0]?.failureCode).toBe('IMPORT_TOO_MANY_ROWS');
    });

    it('accepte un classeur exactement au plafond', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      const reader = new FakeRowReader(validRows(3), 50_000);

      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome.result).toBe('succeeded');
    });

    /**
     * ET LE REFUS QUI EST UNE VRAIE BORNE.
     *
     * L'élément `<dimension>` est facultatif dans le format : la plupart des
     * tableurs tiers ne l'écrivent pas. Sans ce second contrôle, le premier
     * serait une politesse qu'il suffirait de réenregistrer le fichier pour
     * contourner.
     */
    it('refuse à la première ligne au-delà du plafond, même sans en-tête déclaré', async () => {
      prisma.jobs.push(fakeJob({}));
      const petit = new TinyAdapter(3);
      const reader = new FakeRowReader(validRows(10), null);

      const outcome = await runnerOn(prisma, reader, [petit]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'failed', code: 'IMPORT_TOO_MANY_ROWS' });
      // Le refus tombe à la QUATRIÈME ligne, pas à la dixième : le reste du
      // classeur n'est jamais lu.
      expect(reader.pulled).toBe(4);
    });
  });

  describe('jeton de fencing', () => {
    /**
     * UN TRAVAILLEUR QUI A PERDU SON BAIL N'ÉCRIT RIEN.
     *
     * Le scénario : le premier travailleur se fige plus longtemps que le bail,
     * un second le reprend légitimement, puis le premier se réveille au milieu
     * d'une tranche. Sans jeton, il écrirait ses lignes par-dessus celles du
     * second et ferait reculer `processedRows`.
     *
     * L'écriture du compteur porte le jeton et vit DANS la transaction de la
     * tranche : elle touche zéro ligne, on lève, PostgreSQL annule — les lignes
     * de l'adaptateur partent avec.
     */
    it('la tranche est ANNULÉE, pas seulement ignorée', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));

      prisma.onBeforeTransaction = (index) => {
        // Au seuil de la DEUXIÈME tranche, un autre travailleur reprend le bail.
        if (index === 2) {
          const job = prisma.jobs[0];
          if (job) job.claimToken = 'jeton-du-repreneur';
        }
      };

      const outcome = await runnerOn(prisma, new FakeRowReader(validRows(5)), [adapter]).run(
        'job-1',
        NOW,
      );

      expect(outcome).toEqual({ result: 'lost' });

      // DEUX fiches, celles de la première tranche. Les deux de la tranche
      // perdue n'existent nulle part, et les deux dernières lignes n'ont jamais
      // été lues.
      expect(prisma.representants).toHaveLength(2);
      expect(prisma.committedChunks).toBe(1);

      // Et le travail reste au repreneur : le mort n'a rien écrasé.
      expect(prisma.jobs[0]?.claimToken).toBe('jeton-du-repreneur');
      expect(prisma.jobs[0]?.createdRows).toBe(2);
      expect(prisma.jobs[0]?.status).not.toBe(ImportStatus.succeeded);
    });

    it('l’état final ne s’écrit pas non plus sans le jeton', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));

      // Une seule tranche, donc la perte se joue sur l'écriture de clôture.
      prisma.onBeforeTransaction = (index) => {
        if (index === 1) {
          const job = prisma.jobs[0];
          if (job) job.claimToken = 'jeton-du-repreneur';
        }
      };

      const outcome = await runnerOn(prisma, new FakeRowReader(validRows(1)), [adapter]).run(
        'job-1',
        NOW,
      );

      expect(outcome).toEqual({ result: 'lost' });
      expect(prisma.representants).toHaveLength(0);
      expect(prisma.jobs[0]?.status).not.toBe(ImportStatus.succeeded);
      expect(prisma.jobs[0]?.finishedAt).toBeNull();
    });
  });

  describe('doublons et refus', () => {
    it('rejette la SECONDE occurrence d’un numéro, à travers les tranches', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      const rows = [
        sheetRow(3, ['Fatou Ndiaye', '77 123 45 60', 'Dakar', '', '']),
        sheetRow(4, ['Awa Fall', '77 123 45 61', 'Dakar', '', '']),
        // Même abonné que la ligne 3, écrit autrement, et DANS UNE AUTRE
        // TRANCHE : c'est ce cas-là qu'une détection tranche par tranche
        // manquerait.
        sheetRow(5, ['F. Ndiaye', '+221 77 123 45 60', 'Dakar', '', '']),
      ];

      await runnerOn(prisma, new FakeRowReader(rows), [adapter]).run('job-1', NOW);

      expect(prisma.representants).toHaveLength(2);
      const job = prisma.jobs[0];
      expect(job?.skippedRows).toBe(1);
      const report = job?.report as { errors: { code: string; rowNumber: number }[] };
      expect(report.errors).toContainEqual(
        expect.objectContaining({ code: 'DUPLICATE_IN_FILE', rowNumber: 5 }),
      );
    });

    it('rejette un numéro déjà présent en base', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      prisma.representants.push({
        id: 'rep-existant',
        fullName: 'Déjà là',
        phoneE164: '+221771234560',
        departementId: DEPARTEMENT_DAKAR.id,
        iefId: null,
        notes: null,
        createdById: 'com-1',
        clientCreatedAt: NOW,
        deletedAt: null,
        isDemo: false,
      });

      await runnerOn(prisma, new FakeRowReader(validRows(2)), [adapter]).run('job-1', NOW);

      expect(prisma.representants).toHaveLength(2);
      expect(prisma.jobs[0]?.skippedRows).toBe(1);
      expect(prisma.jobs[0]?.createdRows).toBe(1);
    });

    it('compte les lignes refusées à l’analyse sans arrêter l’import', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      const rows = [
        sheetRow(3, ['Fatou Ndiaye', 'pas un numéro', 'Dakar', '', '']),
        sheetRow(4, ['A', '77 123 45 61', 'Dakar', '', '']),
        sheetRow(5, ['Awa Fall', '77 123 45 62', 'Département inventé', '', '']),
        sheetRow(6, ['Moussa Sy', '77 123 45 63', 'Dakar', '', '']),
      ];

      await runnerOn(prisma, new FakeRowReader(rows), [adapter]).run('job-1', NOW);

      const job = prisma.jobs[0];
      expect(job?.status).toBe(ImportStatus.succeeded);
      expect(job?.errorRows).toBe(3);
      expect(job?.createdRows).toBe(1);
      // Les lignes fausses sont COMPTÉES comme traitées : sans cela, une reprise
      // les rejouerait indéfiniment.
      expect(job?.processedRows).toBe(4);
    });
  });

  it('échoue proprement quand aucun adaptateur ne connaît l’entité', async () => {
    prisma.jobs.push(fakeJob({}));

    const outcome = await runnerOn(prisma, new FakeRowReader(validRows(1)), []).run('job-1', NOW);

    expect(outcome).toEqual({ result: 'failed', code: 'IMPORT_ADAPTER_MISSING' });
    expect(prisma.jobs[0]?.status).toBe(ImportStatus.failed);
  });

  it('ne fait rien d’un travail qui n’existe pas', async () => {
    const outcome = await runnerOn(prisma, new FakeRowReader([]), [adapter]).run('absent', NOW);
    expect(outcome).toEqual({ result: 'skipped', reason: 'IMPORT_JOB_ABSENT' });
  });
});
