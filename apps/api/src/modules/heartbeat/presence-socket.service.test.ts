import { EventEmitter } from 'node:events';

import { JwtService } from '@nestjs/jwt';
import type { WebSocket } from 'ws';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { HeartbeatService } from './heartbeat.service.js';
import { PresenceSocketService } from './presence-socket.service.js';

const ACCESS_SECRET = 'presence-access-secret-40-characters-long';
const NOW = Date.UTC(2026, 8, 3, 9, 0, 0);

beforeAll(() => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
  process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET ??= 'presence-refresh-secret-40-characters-long';
});

class FakeSocket extends EventEmitter {
  readonly sent: string[] = [];
  readonly closures: number[] = [];

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(code: number): void {
    this.closures.push(code);
    this.emit('close');
  }
}

type Account = { isActive: boolean; deletedAt: Date | null } | null;

const opened: FakeSocket[] = [];

afterEach(() => {
  for (const socket of opened) socket.emit('close');
  opened.length = 0;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const signed = (payload: Record<string, unknown>, secret = ACCESS_SECRET): string =>
  new JwtService({}).sign({ sub: 'usr-1', typ: 'access', ...payload }, { secret });

const bearer = (payload: Record<string, unknown> = {}): string => `Bearer ${signed(payload)}`;

const connect = (
  authorization: string | undefined,
  account: Account = { isActive: true, deletedAt: null },
): {
  socket: FakeSocket;
  recordActivity: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
} => {
  const findUnique = vi.fn().mockResolvedValue(account);
  const recordActivity = vi.fn().mockResolvedValue(undefined);
  const socket = new FakeSocket();
  opened.push(socket);

  new PresenceSocketService(
    new JwtService({}),
    { user: { findUnique } } as unknown as PrismaService,
    { recordActivity } as unknown as HeartbeatService,
  ).connect(socket as unknown as WebSocket, authorization === undefined ? {} : { authorization });

  return { socket, recordActivity, findUnique };
};

// `connect()` authentifie en tâche de fond : sans ce tour de boucle, on
// mesurerait un état que le service n'a pas encore atteint.
const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

const jetonsRefuses: [string, string | undefined][] = [
  ['aucun en-tête', undefined],
  ['un en-tête qui n’annonce pas un Bearer', signed({})],
  ['un Bearer sans jeton', 'Bearer '],
  ['un jeton illisible', 'Bearer pas-un-jeton'],
  [
    'un jeton signé ailleurs',
    `Bearer ${signed({}, 'autre-secret-de-quarante-caracteres-au-moins')}`,
  ],
  ['un jeton de rafraîchissement', bearer({ typ: 'refresh' })],
  ['un jeton de l’espace de démonstration', bearer({ workspace: 'demo' })],
];

const comptesRefuses: [string, Account][] = [
  ['un compte désactivé', { isActive: false, deletedAt: null }],
  ['un compte supprimé', { isActive: true, deletedAt: new Date('2026-08-01T00:00:00.000Z') }],
  ['un compte disparu', null],
];

describe('qui peut ouvrir une session de présence', () => {
  it.each(jetonsRefuses)('refuse %s', async (_libelle, authorization) => {
    const { socket, recordActivity } = connect(authorization);
    await settle();

    expect(socket.closures).toEqual([1008]);
    expect(socket.sent).toEqual([]);
    expect(recordActivity).not.toHaveBeenCalled();
  });

  it.each(comptesRefuses)('refuse %s', async (_libelle, account) => {
    const { socket, recordActivity } = connect(bearer(), account);
    await settle();

    expect(socket.closures).toEqual([1008]);
    expect(recordActivity).not.toHaveBeenCalled();
  });

  it('ouvre la session et compte la présence dès la connexion', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { socket, recordActivity, findUnique } = connect(bearer());
    await settle();

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'usr-1' } }));
    expect(recordActivity.mock.calls).toEqual([['usr-1', new Date(NOW)]]);
    expect(socket.sent).toEqual(['ready']);
    expect(socket.closures).toEqual([]);
  });
});

describe('ce que la session retient du temps passé', () => {
  it('ne retient qu’un battement toutes les dix secondes', async () => {
    let maintenant = NOW;
    vi.spyOn(Date, 'now').mockImplementation(() => maintenant);
    const { socket, recordActivity } = connect(bearer());
    await settle();

    maintenant = NOW + 9_000;
    socket.emit('message', Buffer.from('beat'));
    await settle();

    expect(recordActivity).toHaveBeenCalledTimes(1);

    maintenant = NOW + 10_000;
    socket.emit('message', Buffer.from('beat'));
    await settle();

    expect(recordActivity).toHaveBeenCalledTimes(2);
    expect(recordActivity.mock.calls[1]).toEqual(['usr-1', new Date(NOW + 10_000)]);
  });

  it('ignore un message qui n’est pas un battement', async () => {
    let maintenant = NOW;
    vi.spyOn(Date, 'now').mockImplementation(() => maintenant);
    const { socket, recordActivity } = connect(bearer());
    await settle();

    maintenant = NOW + 60_000;
    socket.emit('message', Buffer.from('ping'));
    await settle();

    expect(recordActivity).toHaveBeenCalledTimes(1);
  });

  it('ferme la session au bout de quinze minutes', async () => {
    vi.useFakeTimers();
    const { socket } = connect(bearer());

    await vi.advanceTimersByTimeAsync(15 * 60_000);

    expect(socket.closures).toEqual([1000]);
  });

  // Une écriture de présence qui remonte jusqu'à la boucle d'événements arrête
  // le processus : la synchronisation mobile tomberait avec lui.
  it('survit à une base injoignable', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ isActive: true, deletedAt: null }) },
      $executeRaw: vi.fn().mockRejectedValue(new Error('base injoignable')),
    } as unknown as PrismaService;
    const socket = new FakeSocket();
    opened.push(socket);
    let maintenant = NOW;
    const authorization = bearer();
    vi.spyOn(Date, 'now').mockImplementation(() => maintenant);

    new PresenceSocketService(new JwtService({}), prisma, new HeartbeatService(prisma)).connect(
      socket as unknown as WebSocket,
      { authorization },
    );
    await settle();

    maintenant = NOW + 10_000;
    socket.emit('message', Buffer.from('beat'));
    await settle();

    expect(socket.closures).toEqual([]);
    expect(socket.sent).toEqual(['ready']);
  });

  it('n’arme plus rien une fois la session fermée', async () => {
    vi.useFakeTimers();
    const { socket } = connect(bearer());
    expect(vi.getTimerCount()).toBe(1);

    socket.emit('close');

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(socket.closures).toEqual([]);
  });
});
