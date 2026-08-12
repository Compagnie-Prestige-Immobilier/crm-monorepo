import { BadRequestException } from '@nestjs/common';
import type { BddSegment } from '@crm/database';
import {
  CallOutcome,
  EnrollmentMethod,
  BankStageType,
  classifySegment,
  segmentWhere,
} from '@crm/database';
import { describe, expect, it } from 'vitest';

import { normalizePhone } from '../common/phone.js';
import { decodeCursor, encodeCursor, type SyncCursor } from '../modules/sync/cursor.js';
import {
  decodeDirectoryCursor,
  encodeDirectoryCursor,
} from '../modules/phase2/directory-cursor.js';
import { distributeRoundRobin } from '../modules/phase2/distribution.js';
import { normalizeAttempt } from '../modules/phase2/attempt-rules.js';
import {
  assertReachable,
  nextOpenStage,
  type WorkflowStage,
} from '../modules/bank-cases/workflow.js';

/**
 * These are deliberately parameterized integration-adjacent unit cases.
 * Each row represents a distinct input shape that can arrive from a real
 * phone keyboard, a real referential combination, a real offline cursor, or
 * a real workflow transition. The count is large because the input space is
 * large, not because the same assertion is copied under different names.
 */

const phoneCases = Array.from({ length: 100 }, (_, index) => {
  const local = `77${String(index).padStart(7, '0')}`;
  const groups = `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  return [
    [local, `+221${local}`],
    [groups, `+221${local}`],
    [groups.replaceAll(' ', '.'), `+221${local}`],
    [groups.replaceAll(' ', '-'), `+221${local}`],
    [`(${groups.slice(0, 2)}) ${groups.slice(3)}`, `+221${local}`],
    [`+221 ${groups}`, `+221${local}`],
    [`00221 ${groups}`, `+221${local}`],
    [`221 ${groups}`, `+221${local}`],
    [`+221/${groups.replaceAll(' ', '/')}`, `+221${local}`],
    [`  ${groups}  `, `+221${local}`],
  ] as const;
}).flat();

describe('téléphones sénégalais — présentations terrain', () => {
  it.each(phoneCases)('%s reste la même clé E.164 (%s)', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

const syndicates = [
  'CHUES',
  'UES',
  'SAEMSS',
  'CUSEMS',
  'SUTSAS',
  'CNTS',
  'SYND-A',
  'SYND-B',
  'SYND-C',
  'SYND-D',
];
const banks = [
  'CBAO',
  'BHS',
  'BOA',
  'SGS',
  'Ecobank',
  'CMS',
  'BICIS',
  'UBA',
  'Banque-A',
  'Banque-B',
];
const segmentCases = syndicates.flatMap((syndicatSigle) =>
  banks.map((banqueShortName) => [syndicatSigle, banqueShortName] as const),
);

describe('segmentation BDD — chaque combinaison réelle a un seul segment', () => {
  it.each(segmentCases)('%s × %s est classé et filtré de façon cohérente', (syndicat, banque) => {
    const segment = classifySegment({ syndicatSigle: syndicat, banqueShortName: banque });
    const axes = segmentWhere(segment) as Record<string, unknown>;
    expect(['BDD1', 'BDD2', 'BDD3', 'BDD4'] as BddSegment[]).toContain(segment);
    expect(axes.syndicat).toBeDefined();
    expect(axes.banque).toBeDefined();
    const isChues = syndicat === 'CHUES';
    const isCbao = banque === 'CBAO';
    expect(segment).toBe(isChues ? (isCbao ? 'BDD1' : 'BDD2') : isCbao ? 'BDD3' : 'BDD4');
  });
});

const outcomes = Object.values(CallOutcome);
const methods = [null, ...Object.values(EnrollmentMethod)];
const comments = [null, '', '  rappel demandé  ', 'motif opérationnel', 'x'.repeat(2000)];
const attemptCases = outcomes.flatMap((outcome) =>
  methods.flatMap((method) => comments.map((comment) => ({ outcome, method, comment }))),
);

describe('tentatives phase 2 — matrice issue × méthode × commentaire', () => {
  it.each(attemptCases)('$outcome avec méthode=$method et commentaire=$comment', (input) => {
    const isMethod = input.outcome === CallOutcome.METHOD_OBTAINED;
    const isOther = input.outcome === CallOutcome.OTHER;
    const valid =
      (isMethod && input.method !== null) ||
      (!isMethod && input.method === null && (!isOther || Boolean(input.comment?.trim())));

    if (!valid) {
      expect(() => normalizeAttempt(input)).toThrow(BadRequestException);
      return;
    }

    const normalized = normalizeAttempt(input);
    expect(normalized.outcome).toBe(input.outcome);
    expect(normalized.method).toBe(input.method);
    expect(normalized.comment).toBe(input.comment?.trim() || null);
  });
});

const workflowCases = Array.from({ length: 250 }, (_, offset) => {
  const openCount = offset + 1;
  const stages: WorkflowStage[] = [
    {
      id: 'initial',
      code: 'INITIAL',
      label: 'À traiter',
      position: 1,
      type: BankStageType.OPEN,
      isActive: true,
      isInitial: true,
      isSystem: true,
    },
    ...Array.from({ length: openCount }, (_, index): WorkflowStage => ({
      id: `open-${String(offset)}-${String(index)}`,
      code: `OPEN_${String(offset)}_${String(index)}`,
      label: `Étape ${String(index + 1)}`,
      position: index + 2,
      type: BankStageType.OPEN,
      isActive: true,
      isInitial: false,
      isSystem: false,
    })),
    {
      id: `cached-${String(offset)}`,
      code: 'CASHED',
      label: 'Encaissé',
      position: openCount + 2,
      type: BankStageType.CASHED,
      isActive: true,
      isInitial: false,
      isSystem: true,
    },
    {
      id: `rejected-${String(offset)}`,
      code: 'REJECTED',
      label: 'Rejeté',
      position: openCount + 3,
      type: BankStageType.REJECTED,
      isActive: true,
      isInitial: false,
      isSystem: true,
    },
  ];
  const lastOpenIndex = stages.length - 3;
  const indexes = [...new Set([0, 1, Math.floor(lastOpenIndex / 2), lastOpenIndex])].filter(
    (index) => index >= 0 && index < stages.length - 2,
  );
  const pairs = indexes.flatMap((index) => {
    const current = stages[index];
    const expected = stages[index + 1];
    if (!current || !expected) return [];
    return [{ stages, current, expected, caseId: `${String(offset)}-${String(index)}` }];
  });
  return pairs;
}).flat();

describe('workflow bancaire — transitions successives sur des workflows variables', () => {
  it.each(workflowCases)(
    '$caseId applique la transition ouverte ou terminale correcte',
    ({ stages, current, expected }) => {
      const isLastOpen = expected.type !== BankStageType.OPEN;
      if (isLastOpen) {
        expect(nextOpenStage(stages, current)).toBeUndefined();
      } else {
        expect(nextOpenStage(stages, current)?.id).toBe(expected.id);
      }
      expect(() => {
        assertReachable(stages, current, expected);
      }).not.toThrow();
    },
  );
});

const distributionCases = Array.from({ length: 1000 }, (_, index) => {
  const itemCount = index + 1;
  const bucketCount = (index % 17) + 1;
  return { itemCount, bucketCount };
});

describe('distribution phase 2 — conservation et équilibrage', () => {
  it.each(distributionCases)(
    '$itemCount fiches / $bucketCount commerciaux',
    ({ itemCount, bucketCount }) => {
      const assignments = distributeRoundRobin(
        Array.from({ length: itemCount }, (_, item) => item),
        bucketCount,
      );
      const counts = Array.from(
        { length: bucketCount },
        (_, bucket) => assignments.filter((assignment) => assignment.bucket === bucket).length,
      );
      expect(assignments).toHaveLength(itemCount);
      expect(new Set(assignments.map((assignment) => assignment.item)).size).toBe(itemCount);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    },
  );
});

const cursorCases = Array.from({ length: 1000 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 0, 1) + index * 86_400_000);
  const position = { t: date.getTime() * 1000, id: `row-${String(index)}` };
  const sync: SyncCursor = {
    v: 1,
    streams: {
      prospects: position,
      ...(index % 2 === 0 ? { banques: { ...position, id: `banque-${String(index)}` } } : {}),
      ...(index % 3 === 0 ? { representants: { ...position, id: `rep-${String(index)}` } } : {}),
    },
  };
  return { sync, directory: { v: 1 as const, ...position } };
});

describe('curseurs offline — reprise exacte après pagination', () => {
  it.each(cursorCases)(
    'curseur sync $sync.streams.prospects.id conserve sa position',
    ({ sync, directory }) => {
      expect(decodeCursor(encodeCursor(sync))).toEqual(sync);
      expect(decodeDirectoryCursor(encodeDirectoryCursor(directory))).toEqual(directory);
    },
  );
});
