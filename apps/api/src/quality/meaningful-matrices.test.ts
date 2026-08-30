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
import { normalizeAttempt } from '../modules/phase2/attempt-rules.js';
import {
  assertReachable,
  nextOpenStage,
  type WorkflowStage,
} from '../modules/bank-cases/workflow.js';

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

describe('téléphones sénégalais, présentations terrain', () => {
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
const expectedSegments: Record<string, BddSegment> = {
  'true:true': 'BDD1',
  'true:false': 'BDD2',
  'false:true': 'BDD3',
  'false:false': 'BDD4',
};

describe('segmentation BDD, chaque combinaison réelle a un seul segment', () => {
  it.each(segmentCases)('%s × %s est classé et filtré de façon cohérente', (syndicat, banque) => {
    // Les deux axes sont toujours fournis ici : le segment ne peut pas etre nul.
    const segment = classifySegment({ syndicatSigle: syndicat, banqueShortName: banque });
    if (segment === null) throw new Error('les deux axes sont fournis : un segment est attendu');
    const axes = segmentWhere(segment) as Record<string, unknown>;
    expect(['BDD1', 'BDD2', 'BDD3', 'BDD4'] as BddSegment[]).toContain(segment);
    expect(axes.syndicat).toBeDefined();
    expect(axes.banque).toBeDefined();
    const isChues = syndicat === 'CHUES';
    const isCbao = banque === 'CBAO';
    expect(segment).toBe(expectedSegments[`${String(isChues)}:${String(isCbao)}`]);
  });
});

const outcomes = Object.values(CallOutcome);
const methods = [null, ...Object.values(EnrollmentMethod)];
const comments = [null, '', '  rappel demandé  ', 'motif opérationnel', 'x'.repeat(2000)];
// La prise de rendez-vous exige sa date : sans elle, la matrice ne mesurerait
// plus le croisement issue × méthode × commentaire mais ce seul manque.
const APPEL = '2026-08-18T10:00:00.000Z';
const RENDEZ_VOUS = '2026-08-25T09:00:00.000Z';
const attemptCases = outcomes.flatMap((outcome) =>
  methods.flatMap((method) =>
    comments.map((comment) => ({
      outcome,
      method,
      comment,
      ...(method === EnrollmentMethod.APPOINTMENT
        ? { rendezVousAt: RENDEZ_VOUS, clientCreatedAt: APPEL }
        : {}),
    })),
  ),
);

describe('tentatives phase 2, matrice issue × méthode × commentaire', () => {
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

describe('workflow bancaire, transitions successives sur des workflows variables', () => {
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

describe('curseurs offline, reprise exacte après pagination', () => {
  it.each(cursorCases)(
    'curseur sync $sync.streams.prospects.id conserve sa position',
    ({ sync, directory }) => {
      expect(decodeCursor(encodeCursor(sync))).toEqual(sync);
      expect(decodeDirectoryCursor(encodeDirectoryCursor(directory))).toEqual(directory);
    },
  );
});
