import { describe, expect, it, vi } from 'vitest';

import {
  ALREADY_COMPLETED,
  AttemptRefused,
  bucketOf,
  buildAttemptBatch,
  buildQueue,
  callbackSlots,
  COMMENT_MAX_LENGTH,
  daysSince,
  fetchCallbacks,
  fetchConsoleQueue,
  formatCallbackAt,
  formatDelay,
  nextAfter,
  pushCallAttempt,
  queueLabel,
  schedulesOf,
  sortCallbacks,
  sortQueue,
  undatedCallbacks,
  uuidV7,
  validateAttempt,
  type AttemptInput,
  type Callback,
} from '@/lib/data/console';
import type { CallOutcome, Phase2Status, ProspectRow } from '@/lib/types';

const NOW = Date.parse('2026-08-16T12:00:00.000Z');

type QueryCall = [string, { params: { query: Record<string, unknown> } }];

function prospect(over: Partial<ProspectRow> & { id: string }): ProspectRow {
  return {
    nom: 'Diallo',
    prenom: 'Mamadou',
    phoneE164: '+221771234567',
    rev: 1,
    statut: 'NOUVEAU',
    banqueId: 'b-1',
    banqueName: 'CBAO',
    syndicatId: 's-1',
    syndicatSigle: 'SUDES',
    representantId: 'r-1',
    representantName: 'Aminata Ndiaye',
    representantPhoneE164: '+221770000000',
    departementId: 'd-1',
    departementName: 'Dakar',
    ownedByCommercialId: 'u-1',
    ownedByCommercialName: 'Fatou Sow',
    projet: 'CHUES',
    type: null,
    profession: null,
    professionId: null,
    professionIsTeaching: null,
    incomeBandId: null,
    incomeBandLabel: null,
    paymentMode: null,
    journeys: [],
    dureeSystemeMois: null,
    canalProvenanceId: null,
    canalProvenanceLabel: null,
    segment: 'BDD1',
    phase2Status: 'PENDING',
    enrollmentMethod: null,
    enrollmentCapturedById: null,
    enrollmentCapturedByName: null,
    enrollmentCapturedAt: null,
    lastOutcome: null,
    lastComment: null,
    lastAttemptAt: null,
    origin: null,
    originLabel: null,
    clientCreatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

const attempted = (
  id: string,
  outcome: CallOutcome,
  at: string,
  phase2Status: Phase2Status = 'PENDING',
): ProspectRow => prospect({ id, lastOutcome: outcome, lastAttemptAt: at, phase2Status });

describe('sortQueue', () => {
  it('met les jamais appelées en tête, puis rappels, puis injoignables, puis le reste', () => {
    const queue = sortQueue([
      attempted('other', 'OTHER', '2026-08-01T00:00:00.000Z'),
      attempted('nrp', 'UNREACHABLE', '2026-08-01T00:00:00.000Z'),
      prospect({ id: 'neuf' }),
      attempted('rappel', 'CALLBACK', '2026-08-01T00:00:00.000Z'),
    ]);

    expect(queue.map((row) => row.id)).toEqual(['neuf', 'rappel', 'nrp', 'other']);
  });

  it('sert le plus ancien d’abord dans un même groupe', () => {
    const queue = sortQueue([
      attempted('recent', 'CALLBACK', '2026-08-10T00:00:00.000Z'),
      attempted('ancien', 'CALLBACK', '2026-07-01T00:00:00.000Z'),
      attempted('median', 'CALLBACK', '2026-08-01T00:00:00.000Z'),
    ]);

    expect(queue.map((row) => row.id)).toEqual(['ancien', 'median', 'recent']);
  });

  it('rejette en fin de file toute fiche déjà close, quel que soit son dernier appel', () => {
    const queue = sortQueue([
      attempted('close', 'METHOD_OBTAINED', '2026-08-01T00:00:00.000Z', 'METHOD_OBTAINED'),
      prospect({ id: 'neuf' }),
      attempted('refus', 'REFUSED', '2026-01-01T00:00:00.000Z', 'REFUSED'),
    ]);

    expect(queue.map((row) => row.id)).toEqual(['neuf', 'refus', 'close']);
  });

  it('départage par identifiant, pour que deux chargements donnent le même ordre', () => {
    const first = sortQueue([prospect({ id: 'b' }), prospect({ id: 'a' })]);
    const second = sortQueue([prospect({ id: 'a' }), prospect({ id: 'b' })]);

    expect(first.map((row) => row.id)).toEqual(['a', 'b']);
    expect(second.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('ne modifie pas la liste reçue', () => {
    const input = [prospect({ id: 'b' }), prospect({ id: 'a' })];
    sortQueue(input);
    expect(input.map((row) => row.id)).toEqual(['b', 'a']);
  });
});

describe('bucketOf', () => {
  it('classe une fiche close avant de regarder son dernier appel', () => {
    expect(bucketOf(attempted('x', 'CALLBACK', '2026-08-01T00:00:00.000Z', 'REFUSED'))).toBe(
      'closed',
    );
  });

  it('range les issues sans groupe dédié dans « déjà tentées »', () => {
    expect(bucketOf(attempted('x', 'OTHER', '2026-08-01T00:00:00.000Z'))).toBe('other');
  });
});

describe('buildQueue', () => {
  it('compte les fiches restantes hors closes', () => {
    const queue = buildQueue([
      prospect({ id: 'a' }),
      attempted('b', 'CALLBACK', '2026-08-01T00:00:00.000Z'),
      attempted('c', 'REFUSED', '2026-08-01T00:00:00.000Z', 'REFUSED'),
    ]);

    expect(queue.pendingCount).toBe(2);
    expect(queue.counts.never).toBe(1);
    expect(queue.counts.callback).toBe(1);
    expect(queue.counts.closed).toBe(1);
  });
});

describe('nextAfter', () => {
  const items = [prospect({ id: 'a' }), prospect({ id: 'b' }), prospect({ id: 'c' })];

  it('donne la fiche suivante', () => {
    expect(nextAfter(items, 'b')).toBe('c');
  });

  it('recule sur la dernière, faute de suivante', () => {
    expect(nextAfter(items, 'c')).toBe('b');
  });

  it('rend null quand la file ne contient que la fiche envoyée', () => {
    expect(nextAfter([prospect({ id: 'a' })], 'a')).toBeNull();
  });
});

describe('queueLabel', () => {
  it('nomme une fiche jamais appelée sans inventer d’ancienneté', () => {
    expect(queueLabel(prospect({ id: 'a' }), NOW)).toBe('jamais appelé');
  });

  it('donne l’ancienneté en jours quand aucune échéance n’a été promise', () => {
    expect(queueLabel(attempted('a', 'CALLBACK', '2026-08-04T12:00:00.000Z'), NOW)).toBe(
      'rappel sans échéance · 12 j',
    );
    expect(queueLabel(attempted('a', 'UNREACHABLE', '2026-08-13T12:00:00.000Z'), NOW)).toBe(
      'injoignable · 3 j',
    );
  });

  it('nomme l’état d’une fiche close', () => {
    expect(queueLabel(attempted('a', 'REFUSED', '2026-08-01T00:00:00.000Z', 'REFUSED'), NOW)).toBe(
      'refus',
    );
  });
});

describe('daysSince', () => {
  it('ne descend pas sous zéro sur un horodatage futur', () => {
    expect(daysSince('2026-09-01T00:00:00.000Z', NOW)).toBe(0);
  });

  it('rend null sur une date illisible', () => {
    expect(daysSince('pas une date', NOW)).toBeNull();
    expect(daysSince(null, NOW)).toBeNull();
  });
});

describe('validateAttempt', () => {
  it('exige une méthode sur METHOD_OBTAINED', () => {
    expect(validateAttempt({ outcome: 'METHOD_OBTAINED', method: null, comment: '' })).toMatch(
      /méthode obtenue/i,
    );
  });

  it('refuse une méthode sur toute autre issue', () => {
    expect(validateAttempt({ outcome: 'CALLBACK', method: 'PLATFORM', comment: '' })).toMatch(
      /Méthode obtenue/,
    );
  });

  it('exige un commentaire non vide sur OTHER', () => {
    expect(validateAttempt({ outcome: 'OTHER', method: null, comment: '   ' })).toMatch(/Autre/);
  });

  it('borne le commentaire à 2000 caractères', () => {
    const comment = 'a'.repeat(COMMENT_MAX_LENGTH + 1);
    expect(validateAttempt({ outcome: 'CALLBACK', method: null, comment })).toMatch(/dépasse/);
    expect(
      validateAttempt({ outcome: 'CALLBACK', method: null, comment: comment.slice(1) }),
    ).toBeNull();
  });

  it('laisse passer les combinaisons admises', () => {
    expect(
      validateAttempt({ outcome: 'METHOD_OBTAINED', method: 'PHYSICAL', comment: '' }),
    ).toBeNull();
    expect(validateAttempt({ outcome: 'UNREACHABLE', method: null, comment: '' })).toBeNull();
    expect(validateAttempt({ outcome: 'OTHER', method: null, comment: 'ligne coupée' })).toBeNull();
  });
});

describe('uuidV7', () => {
  it('produit un identifiant de version 7 et de variante RFC', () => {
    const id = uuidV7(NOW, () => 0.5);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it('porte l’horodatage en tête, ce qui garde les clés ordonnées', () => {
    const early = uuidV7(NOW, () => 0.5);
    const late = uuidV7(NOW + 60_000, () => 0.5);
    expect(early < late).toBe(true);
  });
});

describe('buildAttemptBatch', () => {
  const input: AttemptInput = {
    prospectId: 'p-1',
    draft: { outcome: 'METHOD_OBTAINED', method: 'PLATFORM', comment: '  ' },
    attemptId: 'a-1',
    batchId: 'b-1',
    at: '2026-08-16T12:00:00.000Z',
  };

  it('envoie une seule opération call_attempt, en création', () => {
    const batch = buildAttemptBatch(input);

    expect(batch.clientBatchId).toBe('b-1');
    expect(batch.payloadVersion).toBe(1);
    expect(batch.operations).toHaveLength(1);
    expect(batch.operations[0]).toMatchObject({
      opId: 'a-1',
      seq: 0,
      entity: 'call_attempt',
      op: 'create',
      entityId: 'a-1',
    });
  });

  it('omet un commentaire vide plutôt que d’envoyer une chaîne blanche', () => {
    expect(buildAttemptBatch(input).operations[0]?.data).not.toHaveProperty('comment');
  });

  it('omet la méthode quand l’issue n’en porte pas', () => {
    const batch = buildAttemptBatch({
      ...input,
      draft: { outcome: 'CALLBACK', method: null, comment: 'rappeler lundi' },
    });

    expect(batch.operations[0]?.data).not.toHaveProperty('method');
    expect(batch.operations[0]?.data?.comment).toBe('rappeler lundi');
  });
});

function fakeSyncClient(result: {
  status: string;
  errorCode?: string | null;
  error?: string | null;
}) {
  const calls: { header: unknown; body: unknown }[] = [];
  const client = {
    POST: (_path: string, init: { params: { header: unknown }; body: unknown }) => {
      calls.push({ header: init.params.header, body: init.body });
      return Promise.resolve({
        data: {
          batchId: 'b-1',
          serverTime: '2026-08-16T12:00:00.000Z',
          results: [
            {
              opId: 'a-1',
              status: result.status,
              entityId: 'a-1',
              rev: 2,
              serverUpdatedAt: '2026-08-16T12:00:00.000Z',
              errorCode: result.errorCode ?? null,
              error: result.error ?? null,
            },
          ],
          nextCursor: null,
        },
        response: new Response(),
      });
    },
  };
  return { client, calls };
}

const INPUT: AttemptInput = {
  prospectId: 'p-1',
  draft: { outcome: 'UNREACHABLE', method: null, comment: '' },
  attemptId: 'a-1',
  batchId: 'b-1',
  at: '2026-08-16T12:00:00.000Z',
};

describe('pushCallAttempt', () => {
  it('répète la clé de lot dans l’en-tête d’idempotence', async () => {
    const fake = fakeSyncClient({ status: 'applied' });

    await pushCallAttempt(INPUT, fake.client as never);

    expect(fake.calls[0]?.header).toEqual({ 'Idempotency-Key': 'b-1' });
  });

  it('accepte un rejeu : la tentative était déjà enregistrée', async () => {
    const fake = fakeSyncClient({ status: 'duplicate' });
    await expect(pushCallAttempt(INPUT, fake.client as never)).resolves.toBeUndefined();
  });

  it('lève le refus du serveur, que le lot renvoie en 200', async () => {
    const fake = fakeSyncClient({
      status: 'conflict',
      errorCode: ALREADY_COMPLETED,
      error: 'La fiche est déjà close.',
    });

    await expect(pushCallAttempt(INPUT, fake.client as never)).rejects.toThrow(AttemptRefused);
    await expect(pushCallAttempt(INPUT, fake.client as never)).rejects.toMatchObject({
      code: ALREADY_COMPLETED,
      message: 'La fiche est déjà close.',
    });
  });
});

describe('fetchConsoleQueue', () => {
  it('n’envoie aucun filtre de campagne quand aucune n’est choisie', async () => {
    const get = vi.fn().mockResolvedValue({
      data: { items: [], meta: { total: 0, page: 1, pageSize: 200, pageCount: 1 } },
      response: new Response(),
    });

    await fetchConsoleQueue(null, { GET: get } as never);

    const [, init] = get.mock.calls[0] as QueryCall;
    expect(init.params.query).not.toHaveProperty('campaignId');
  });

  it('restreint la file à la campagne choisie', async () => {
    const get = vi.fn().mockResolvedValue({
      data: { items: [], meta: { total: 3, page: 1, pageSize: 200, pageCount: 1 } },
      response: new Response(),
    });

    const page = await fetchConsoleQueue('c-1', { GET: get } as never);

    const [, init] = get.mock.calls[0] as QueryCall;
    expect(init.params.query.campaignId).toBe('c-1');
    expect(page.total).toBe(3);
  });
});

const THURSDAY = Date.parse('2026-08-13T10:00:00.000Z');

describe('callbackSlots', () => {
  it('propose six échéances, calculées sur l’horloge de Dakar', () => {
    expect(callbackSlots(THURSDAY)).toEqual([
      { key: '1', label: 'Dans 1 h', at: '2026-08-13T11:00:00.000Z' },
      { key: '2', label: 'Cet après-midi (15 h)', at: '2026-08-13T15:00:00.000Z' },
      { key: '3', label: 'Demain 9 h', at: '2026-08-14T09:00:00.000Z' },
      { key: '4', label: 'Demain 15 h', at: '2026-08-14T15:00:00.000Z' },
      { key: '5', label: 'Lundi 9 h', at: '2026-08-17T09:00:00.000Z' },
      { key: '6', label: 'Dans 3 jours', at: '2026-08-16T09:00:00.000Z' },
    ]);
  });

  it('retire une proposition déjà passée et renumérote les chiffres', () => {
    const slots = callbackSlots(Date.parse('2026-08-13T16:00:00.000Z'));

    expect(slots.map((slot) => slot.label)).not.toContain('Cet après-midi (15 h)');
    expect(slots.map((slot) => slot.key)).toEqual(['1', '2', '3', '4', '5']);
    expect(slots[0]).toEqual({ key: '1', label: 'Dans 1 h', at: '2026-08-13T17:00:00.000Z' });
  });

  it('ne propose pas deux fois la même heure', () => {
    const sunday = callbackSlots(Date.parse('2026-08-16T12:00:00.000Z'));

    expect(sunday.filter((slot) => slot.at === '2026-08-17T09:00:00.000Z')).toHaveLength(1);
    expect(sunday.map((slot) => slot.label)).not.toContain('Lundi 9 h');
  });
});

describe('formatCallbackAt', () => {
  it('nomme le jour tant qu’il se compte, puis donne la date', () => {
    expect(formatCallbackAt('2026-08-16T15:00:00.000Z', NOW)).toBe('aujourd’hui à 15:00');
    expect(formatCallbackAt('2026-08-17T09:00:00.000Z', NOW)).toBe('demain à 09:00');
    expect(formatCallbackAt('2026-08-19T09:30:00.000Z', NOW)).toBe('le 19/08 à 09:30');
  });
});

describe('formatDelay', () => {
  it('choisit l’unité que le lecteur attend', () => {
    expect(formatDelay(90_000)).toBe('1 min');
    expect(formatDelay(7_200_000)).toBe('2 h');
    expect(formatDelay(3 * 86_400_000)).toBe('3 j');
  });
});

function callback(over: Partial<Callback> & { id: string }): Callback {
  return {
    prospectId: `p-${over.id}`,
    shortCode: 'AB12CD',
    phoneE164: '+221771234567',
    scheduledAt: '2026-08-16T15:00:00.000Z',
    comment: null,
    assignedToId: 'u-1',
    assignedToName: 'Fatou Sow',
    campaignId: null,
    taskId: null,
    overdue: false,
    ...over,
  };
}

describe('sortCallbacks', () => {
  it('met les retards en tête, du plus ancien au plus récent', () => {
    const sorted = sortCallbacks([
      callback({ id: 'a-venir', scheduledAt: '2026-08-16T18:00:00.000Z' }),
      callback({ id: 'retard-recent', scheduledAt: '2026-08-16T11:00:00.000Z', overdue: true }),
      callback({ id: 'retard-ancien', scheduledAt: '2026-08-15T09:00:00.000Z', overdue: true }),
    ]);

    expect(sorted.map((row) => row.id)).toEqual(['retard-ancien', 'retard-recent', 'a-venir']);
  });
});

describe('schedulesOf', () => {
  it('garde une échéance par prospect, la plus urgente', () => {
    const schedules = schedulesOf([
      callback({ id: 'tard', prospectId: 'p-1', scheduledAt: '2026-08-18T09:00:00.000Z' }),
      callback({
        id: 'tot',
        prospectId: 'p-1',
        scheduledAt: '2026-08-16T09:00:00.000Z',
        overdue: true,
      }),
    ]);

    expect(schedules.get('p-1')).toBe('2026-08-16T09:00:00.000Z');
  });
});

describe('file d’appel et échéances', () => {
  const RETARD = attempted('retard', 'CALLBACK', '2026-08-01T00:00:00.000Z');
  const A_VENIR = attempted('a-venir', 'CALLBACK', '2026-08-01T00:00:00.000Z');
  const SANS_DATE = attempted('sans-date', 'CALLBACK', '2026-07-01T00:00:00.000Z');
  const schedules = new Map([
    ['retard', '2026-08-16T09:00:00.000Z'],
    ['a-venir', '2026-08-17T09:00:00.000Z'],
  ]);

  it('sert le rappel dont l’heure est passée avant tout le reste', () => {
    const queue = sortQueue([prospect({ id: 'neuf' }), A_VENIR, RETARD], schedules, NOW);

    expect(queue.map((row) => row.id)).toEqual(['retard', 'neuf', 'a-venir']);
  });

  it('remonte une échéance proche, pas encore atteinte', () => {
    expect(bucketOf(RETARD, schedules, NOW)).toBe('due');
    expect(bucketOf(A_VENIR, new Map([['a-venir', '2026-08-16T12:30:00.000Z']]), NOW)).toBe('due');
    expect(bucketOf(A_VENIR, schedules, NOW)).toBe('callback');
  });

  it('laisse une fiche « à rappeler » sans échéance à sa place d’avant', () => {
    const recente = attempted('sans-date', 'CALLBACK', '2026-08-10T00:00:00.000Z');
    const queue = sortQueue(
      [attempted('a-venir', 'CALLBACK', '2026-07-01T00:00:00.000Z'), recente],
      schedules,
      NOW,
    );

    expect(queue.map((row) => row.id)).toEqual(['sans-date', 'a-venir']);
    expect(queueLabel(SANS_DATE, NOW, schedules)).toBe('rappel sans échéance · 46 j');
    expect(undatedCallbacks([RETARD, A_VENIR, SANS_DATE], schedules)).toBe(1);
  });

  it('dit le retard en clair, et l’heure promise sinon', () => {
    expect(queueLabel(RETARD, NOW, schedules)).toBe('rappel en retard de 3 h');
    expect(queueLabel(A_VENIR, NOW, schedules)).toBe('rappel demain à 09:00');
  });

  it('compte les rappels dus à part', () => {
    const queue = buildQueue([prospect({ id: 'neuf' }), A_VENIR, RETARD], schedules, NOW);

    expect(queue.counts.due).toBe(1);
    expect(queue.counts.callback).toBe(1);
  });
});

describe('fetchCallbacks', () => {
  const answer = () => ({
    data: { items: [], serverTime: '2026-08-16T12:00:00.000Z' },
    response: new Response(),
  });

  it('n’envoie aucun téléconseiller quand la file est celle de l’appelant', async () => {
    const get = vi.fn().mockResolvedValue(answer());

    await fetchCallbacks('overdue', null, { GET: get } as never);

    const [, init] = get.mock.calls[0] as QueryCall;
    expect(init.params.query.scope).toBe('overdue');
    expect(init.params.query).not.toHaveProperty('assignedToId');
  });

  it('restreint la file au téléconseiller choisi', async () => {
    const get = vi.fn().mockResolvedValue(answer());

    await fetchCallbacks('week', 'u-2', { GET: get } as never);

    const [, init] = get.mock.calls[0] as QueryCall;
    expect(init.params.query.assignedToId).toBe('u-2');
  });
});

describe('échéance de rappel dans le lot', () => {
  const base: AttemptInput = {
    prospectId: 'p-1',
    draft: { outcome: 'CALLBACK', method: null, comment: '', callbackAt: null },
    attemptId: 'a-1',
    batchId: 'b-1',
    at: '2026-08-16T12:00:00.000Z',
  };

  it('joint l’échéance choisie à la tentative', () => {
    const batch = buildAttemptBatch({
      ...base,
      draft: { ...base.draft, callbackAt: '2026-08-17T09:00:00.000Z' },
    });

    expect(batch.operations[0]?.data?.callbackAt).toBe('2026-08-17T09:00:00.000Z');
  });

  it('n’envoie aucune date quand aucune n’a été choisie', () => {
    expect(buildAttemptBatch(base).operations[0]?.data).not.toHaveProperty('callbackAt');
    expect(
      buildAttemptBatch({
        ...base,
        draft: { outcome: 'UNREACHABLE', method: null, comment: '' },
      }).operations[0]?.data,
    ).not.toHaveProperty('callbackAt');
  });

  it('refuse une date sur une autre issue, comme le fera le serveur', () => {
    expect(
      validateAttempt(
        {
          outcome: 'UNREACHABLE',
          method: null,
          comment: '',
          callbackAt: '2026-08-17T09:00:00.000Z',
        },
        NOW,
      ),
    ).toMatch(/À rappeler/);
  });

  it('refuse une échéance déjà passée', () => {
    expect(
      validateAttempt(
        {
          outcome: 'CALLBACK',
          method: null,
          comment: '',
          callbackAt: '2026-08-16T11:00:00.000Z',
        },
        NOW,
      ),
    ).toMatch(/à venir/);
    expect(
      validateAttempt(
        {
          outcome: 'CALLBACK',
          method: null,
          comment: '',
          callbackAt: '2026-08-16T15:00:00.000Z',
        },
        NOW,
      ),
    ).toBeNull();
  });
});
