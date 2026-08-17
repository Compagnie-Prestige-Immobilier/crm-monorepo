import { describe, expect, it, vi } from 'vitest';

import {
  ALREADY_COMPLETED,
  AttemptRefused,
  bucketOf,
  buildAttemptBatch,
  buildQueue,
  COMMENT_MAX_LENGTH,
  daysSince,
  fetchConsoleQueue,
  nextAfter,
  pushCallAttempt,
  queueLabel,
  sortQueue,
  uuidV7,
  validateAttempt,
  type AttemptInput,
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

  it('donne l’ancienneté en jours, pas une échéance', () => {
    expect(queueLabel(attempted('a', 'CALLBACK', '2026-08-04T12:00:00.000Z'), NOW)).toBe(
      'rappel · 12 j',
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
