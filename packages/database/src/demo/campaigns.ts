import type { CallOutcome, CallTaskStatus, EnrollmentMethod } from '@prisma/client';

import type { DemoCallAttempt, DemoCallTask, DemoCampaign } from './types.js';

interface AttemptSpec {
  outcome: CallOutcome;
  method: EnrollmentMethod | null;
  comment: string | null;
  daysAgo: number;
  performedByKey: string | null;
}

interface TaskSpec {
  prospectKey: string;
  status: CallTaskStatus;
  attempts: AttemptSpec[];
}

function done(prospectKey: string, attempts: AttemptSpec[]): TaskSpec {
  return { prospectKey, status: 'DONE', attempts };
}

function open(prospectKey: string, attempts: AttemptSpec[]): TaskSpec {
  return { prospectKey, status: 'OPEN', attempts };
}

function obtained(
  method: EnrollmentMethod,
  daysAgo: number,
  performedByKey: string | null = null,
): AttemptSpec {
  return { outcome: 'METHOD_OBTAINED', method, comment: null, daysAgo, performedByKey };
}

function attempt(
  outcome: CallOutcome,
  daysAgo: number,
  comment: string | null = null,
): AttemptSpec {
  return { outcome, method: null, comment, daysAgo, performedByKey: null };
}

function distribute(
  campaignKey: string,
  commerciauxKeys: string[],
  specs: TaskSpec[],
): DemoCallTask[] {
  return specs.map((spec, index) => {
    const assignedToKey = commerciauxKeys[index % commerciauxKeys.length] ?? 'awa';
    const taskKey = `${campaignKey}-t${String(index + 1).padStart(2, '0')}`;
    const isActive = spec.status === 'OPEN';

    const attempts: DemoCallAttempt[] = spec.attempts.map((one, attemptIndex) => ({
      key: `${taskKey}-a${String(attemptIndex + 1)}`,
      prospectKey: spec.prospectKey,
      performedByKey: one.performedByKey ?? assignedToKey,
      outcome: one.outcome,
      method: one.method,
      comment: one.comment,
      daysAgo: one.daysAgo,
    }));

    const last = attempts.at(-1);

    return {
      key: taskKey,
      prospectKey: spec.prospectKey,
      assignedToKey,
      position: Math.floor(index / commerciauxKeys.length) + 1,
      status: spec.status,
      isActive,
      completedDaysAgo: isActive ? null : (last?.daysAgo ?? null),
      attempts,
    };
  });
}

const CLOSED_CAMPAIGN_KEY = 'camp-janvier';

const CLOSED_TASKS: TaskSpec[] = [
  done('p001', [obtained('PLATFORM', 36)]),
  done('p003', [obtained('PHYSICAL', 34)]),
  done('p005', [obtained('PLATFORM', 32)]),
  done('p008', [obtained('PHYSICAL', 30)]),
  done('p010', [obtained('PLATFORM', 28)]),
  done('p013', [obtained('VOICE_OR_ELECTRONIC_MESSAGING', 26)]),
  done('p015', [obtained('PLATFORM', 24)]),
  done('p044', [
    attempt('CALLBACK', 38, 'En réunion, rappeler après 17h.'),
    obtained('PLATFORM', 35),
  ]),
  done('p046', [attempt('CALLBACK', 34), obtained('PHYSICAL', 31)]),
  done('p067', [obtained('PLATFORM', 38)]),
  done('p006', [attempt('REFUSED', 33)]),
  done('p020', [
    attempt('OTHER', 35, 'Numéro attribué à un tiers qui transmet ; à recontacter autrement.'),
    attempt('REFUSED', 31),
  ]),
  done('p048', [attempt('REFUSED', 29)]),
  done('p074', [attempt('REFUSED', 27)]),
  done('p106', [attempt('REFUSED', 25)]),
  done('p012', [attempt('WRONG_NUMBER', 33)]),
  done('p055', [attempt('WRONG_NUMBER', 30)]),
  done('p080', [attempt('WRONG_NUMBER', 28)]),
  done('p002', [attempt('UNREACHABLE', 37), attempt('UNREACHABLE', 26)]),
  done('p004', [attempt('UNREACHABLE', 24)]),
  done('p043', [attempt('UNREACHABLE', 22)]),
  done('p047', [attempt('UNREACHABLE', 33), attempt('UNREACHABLE', 20)]),
  done('p068', [attempt('UNREACHABLE', 19)]),
  done('p069', [attempt('UNREACHABLE', 18)]),
];

const ACTIVE_CAMPAIGN_KEY = 'camp-relance-bdd1';

const ACTIVE_TASKS: TaskSpec[] = [
  done('p033', [obtained('PLATFORM', 10)]),
  done('p035', [obtained('PHYSICAL', 9)]),
  done('p038', [obtained('VOICE_OR_ELECTRONIC_MESSAGING', 7)]),
  done('p040', [obtained('PLATFORM', 5, 'moussa')]),
  done('p042', [attempt('REFUSED', 8)]),
  done('p037', [attempt('WRONG_NUMBER', 6)]),
  open('p002', [attempt('UNREACHABLE', 4)]),
  open('p004', [attempt('CALLBACK', 3, 'Rappeler samedi matin.')]),
  open('p007', [attempt('OTHER', 2, 'Le prospect demande à voir un commercial en agence.')]),
  open('p009', [attempt('UNREACHABLE', 2)]),
  open('p011', [attempt('CALLBACK', 1, 'Occupé, rappel convenu en fin de semaine.')]),
  open('p014', []),
  open('p016', []),
  open('p018', []),
  open('p021', []),
  open('p023', []),
  open('p025', []),
  open('p027', []),
];

const CLOSED_COMMERCIAUX = ['awa', 'moussa', 'fatou', 'ibrahima'];
const ACTIVE_COMMERCIAUX = ['awa', 'moussa', 'fatou'];

export const DEMO_CAMPAIGNS: DemoCampaign[] = [
  {
    key: CLOSED_CAMPAIGN_KEY,
    name: 'Campagne janvier : toutes bases',
    scope: 'ALL',
    seed: 'demo-janvier-toutes-bases',
    status: 'CLOSED',
    createdByKey: 'admin',
    daysAgo: 40,
    closedDaysAgo: 15,
    commerciauxKeys: CLOSED_COMMERCIAUX,
    tasks: distribute(CLOSED_CAMPAIGN_KEY, CLOSED_COMMERCIAUX, CLOSED_TASKS),
  },
  {
    key: ACTIVE_CAMPAIGN_KEY,
    name: 'Relance CHUES / CBAO',
    scope: 'BDD1',
    seed: 'demo-relance-bdd1',
    status: 'ACTIVE',
    createdByKey: 'admin',
    daysAgo: 12,
    closedDaysAgo: null,
    commerciauxKeys: ACTIVE_COMMERCIAUX,
    tasks: distribute(ACTIVE_CAMPAIGN_KEY, ACTIVE_COMMERCIAUX, ACTIVE_TASKS),
  },
];
