import { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { HttpException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { Role } from '@crm/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CallRecordingsService } from './recordings.service.js';
import { Phase2Controller } from './phase2.controller.js';

const identity = (id: string, role: Role): AuthenticatedUser => ({
  id,
  email: `${id}@cpi.sn`,
  username: id,
  fullName: `Utilisateur ${id}`,
  role,
});

const awa = identity('awa', Role.COMMERCIAL);
const moussa = identity('moussa', Role.COMMERCIAL);
const directrice = identity('fatou', Role.ADMIN);
const superviseur = identity('ndeye', Role.SUPERVISEUR);

const OWNED = 'attempt-awa';
const FOREIGN = 'attempt-moussa';
const FICTIVE = 'attempt-demo';

interface AttemptRow {
  id: string;
  performedById: string;
}

const ROWS: AttemptRow[] = [
  { id: OWNED, performedById: awa.id },
  { id: FOREIGN, performedById: moussa.id },
  { id: FICTIVE, performedById: awa.id },
];

let parent: string;
let directory: string;

let sweepQueries = 0;

function serviceFor(rows: AttemptRow[] = ROWS): CallRecordingsService {
  const prisma = {
    callAttempt: {
      findFirst: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      // Le balayage cherche l'EXISTENCE, pas la visibilite: un fichier survit a
      // sa ligne, donc la portee demo ne s'applique pas ici.
      findMany: ({ where }: { where: { id: { in: string[] } } }) => {
        sweepQueries += 1;
        return Promise.resolve(
          rows.filter((row) => where.id.in.includes(row.id)).map((row) => ({ id: row.id })),
        );
      },
    },
  } as unknown as PrismaService;
  return new CallRecordingsService(prisma);
}

function audio(
  value: string,
  options: { mimetype?: string; truncated?: boolean } = {},
): MultipartFile {
  const chunks = value === '' ? [] : [Buffer.from(value)];
  const file = Readable.from(chunks) as MultipartFile['file'];
  file.truncated = options.truncated ?? false;
  return { file, mimetype: options.mimetype ?? 'audio/mp4' } as MultipartFile;
}

/** Deux morceaux séparés par un tour de boucle : les écritures se chevauchent vraiment. */
function slowAudio(value: string): MultipartFile {
  const file = Readable.from(
    (async function* () {
      for (const chunk of [value.slice(0, 4), value.slice(4)]) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield Buffer.from(chunk);
      }
    })(),
  ) as MultipartFile['file'];
  file.truncated = false;
  return { file, mimetype: 'audio/mp4' } as MultipartFile;
}

async function bodyOf(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const body = (error as HttpException).getResponse() as { code?: string };
    return body.code ?? '';
  }
  throw new Error('aucune exception levée');
}

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée');
}

beforeEach(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  parent = await mkdtemp(join(tmpdir(), 'crm-call-audio-'));
  directory = join(parent, 'recordings');
  process.env.CALL_RECORDING_DIR = directory;
});

afterEach(async () => {
  await rm(parent, { recursive: true, force: true });
});

const stored = async (): Promise<string[]> =>
  (await readdir(directory).catch(() => [] as string[])).sort();

describe('note vocale, autorisation', () => {
  it('le téléconseiller téléverse sur SA tentative', async () => {
    const result = await serviceFor().upload(awa, OWNED, audio('premier'));

    expect(result).toEqual({ attemptId: OWNED, bytes: 7 });
    expect(await stored()).toEqual([`${OWNED}.m4a`]);
  });

  it('il ne peut pas téléverser sur la tentative d’un collègue', async () => {
    const service = serviceFor();
    const error = await failure(() => service.upload(awa, FOREIGN, audio('premier')));

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'CALL_RECORDING_FORBIDDEN',
    });
    expect(await stored()).toEqual([]);
  });

  it('il ne peut pas écouter la tentative d’un collègue', async () => {
    const service = serviceFor();
    await service.upload(moussa, FOREIGN, audio('premier'));

    const error = await failure(() => service.open(awa, FOREIGN));

    expect(error).toBeInstanceOf(ForbiddenException);
  });

  it('la direction et la supervision écoutent n’importe quelle tentative', async () => {
    const service = serviceFor();
    await service.upload(awa, OWNED, audio('premier'));

    expect(await bodyOf((await service.open(directrice, OWNED)).stream)).toBe('premier');
    expect(await bodyOf((await service.open(superviseur, OWNED)).stream)).toBe('premier');
  });

  it('la direction et la supervision ne téléversent pas à la place du terrain', async () => {
    const service = serviceFor();

    for (const user of [directrice, superviseur]) {
      const error = await failure(() => service.upload(user, OWNED, audio('faux')));
      expect(error, user.role).toBeInstanceOf(ForbiddenException);
    }
    expect(await stored()).toEqual([]);
  });

  it('une tentative inexistante rend 404, jamais 403', async () => {
    const service = serviceFor();

    const posted = await failure(() => service.upload(awa, 'attempt-fantome', audio('premier')));
    const read = await failure(() => service.open(directrice, 'attempt-fantome'));

    expect(posted).toBeInstanceOf(NotFoundException);
    expect(read).toBeInstanceOf(NotFoundException);
    expect((posted as HttpException).getResponse()).toMatchObject({
      code: 'CALL_ATTEMPT_NOT_FOUND',
    });
  });
});

describe('note vocale, le fichier', () => {
  it('réserve le répertoire et le fichier au compte du serveur', async () => {
    await serviceFor().upload(awa, OWNED, audio('premier'));

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(directory, `${OWNED}.m4a`))).mode & 0o777).toBe(0o600);
  });

  it('refuse un dépôt sans fichier', async () => {
    expect(await codeOf(() => serviceFor().upload(awa, OWNED, undefined))).toBe(
      'CALL_RECORDING_INVALID',
    );
    expect(await stored()).toEqual([]);
  });

  it('refuse un type non audio', async () => {
    const service = serviceFor();

    for (const mimetype of ['text/plain', 'application/pdf', 'video/mp4', 'audio']) {
      expect(
        await codeOf(() => service.upload(awa, OWNED, audio('premier', { mimetype }))),
        mimetype,
      ).toBe('CALL_RECORDING_INVALID');
    }
    expect(await stored()).toEqual([]);
  });

  it('refuse un conteneur que la lecture MP4 ne peut pas annoncer fidèlement', async () => {
    for (const mimetype of ['audio/aac', 'audio/wav']) {
      expect(
        await codeOf(() => serviceFor().upload(awa, OWNED, audio('premier', { mimetype }))),
        mimetype,
      ).toBe('CALL_RECORDING_INVALID');
    }
    expect(await stored()).toEqual([]);
  });

  it('accepte les conteneurs que le terrain produit', async () => {
    for (const mimetype of ['audio/mp4', 'audio/x-m4a']) {
      await rm(directory, { recursive: true, force: true });
      expect(
        (await serviceFor().upload(awa, OWNED, audio('premier', { mimetype }))).bytes,
        mimetype,
      ).toBe(7);
    }
  });

  it('refuse un fichier vide et ne laisse rien sur le disque', async () => {
    const error = await failure(() => serviceFor().upload(awa, OWNED, audio('')));

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as HttpException).getResponse()).toMatchObject({ code: 'CALL_RECORDING_EMPTY' });
    expect(await stored()).toEqual([]);
  });

  it('un dépôt vide ne condamne pas la tentative', async () => {
    const service = serviceFor();
    await failure(() => service.upload(awa, OWNED, audio('')));

    expect((await service.upload(awa, OWNED, audio('premier'))).bytes).toBe(7);
    expect(await bodyOf((await service.open(awa, OWNED)).stream)).toBe('premier');
  });

  it('le dépassement du plafond ne laisse ni fichier ni reliquat', async () => {
    expect(
      await codeOf(() => serviceFor().upload(awa, OWNED, audio('tronqué', { truncated: true }))),
    ).toBe('CALL_RECORDING_TOO_LARGE');
    expect(await stored()).toEqual([]);
  });

  it('un second dépôt garde le premier enregistrement et draine le flux rejoué', async () => {
    const service = serviceFor();
    const first = await service.upload(awa, OWNED, audio('premier'));
    const replayed = audio('remplacement');
    const replay = await service.upload(awa, OWNED, replayed);

    expect(first.bytes).toBe(7);
    expect(replay.bytes).toBe(7);
    expect(await stored()).toEqual([`${OWNED}.m4a`]);
    expect(await bodyOf((await service.open(awa, OWNED)).stream)).toBe('premier');
    expect(replayed.file.readableEnded).toBe(true);
  });

  it('une écoute sans fichier rend un 404 propre', async () => {
    expect(await codeOf(() => serviceFor().open(awa, OWNED))).toBe('CALL_RECORDING_NOT_FOUND');
  });

  it('deux dépôts concurrents laissent un seul fichier lisible', async () => {
    const service = serviceFor();
    // Horloge figée : deux dépôts de la même milliseconde ne doivent pas se
    // disputer un nom de fichier intermédiaire.
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const [left, right] = await Promise.all([
      service.upload(awa, OWNED, slowAudio('gauche-1')),
      service.upload(awa, OWNED, slowAudio('droite-2')),
    ]);
    clock.mockRestore();

    expect(await stored()).toEqual([`${OWNED}.m4a`]);
    expect(left.bytes).toBe(8);
    expect(right.bytes).toBe(8);
    expect(['gauche-1', 'droite-2']).toContain(
      await bodyOf((await service.open(awa, OWNED)).stream),
    );
  });

  it('un identifiant qui remonte l’arborescence reste dans le répertoire', async () => {
    const rows: AttemptRow[] = [
      { id: '../evasion', performedById: awa.id },
      { id: '/etc/passwd', performedById: awa.id },
    ];
    const service = serviceFor(rows);

    await service.upload(awa, '../evasion', audio('premier'));
    await service.upload(awa, '/etc/passwd', audio('deuxième'));

    expect(await stored()).toEqual(['evasion.m4a', 'passwd.m4a']);
    expect((await readdir(parent)).sort()).toEqual(['recordings']);
  });

  it('l’écoute ne sort pas non plus du répertoire', async () => {
    const rows: AttemptRow[] = [{ id: '../secret', performedById: awa.id }];
    await writeFile(join(parent, 'secret.m4a'), 'hors périmètre');

    expect(await codeOf(() => serviceFor(rows).open(awa, '../secret'))).toBe(
      'CALL_RECORDING_NOT_FOUND',
    );
  });
});

describe('note vocale, entêtes de lecture', () => {
  function controller(service: CallRecordingsService): Phase2Controller {
    return new Phase2Controller(undefined as never, service);
  }

  it('annonce le type, la longueur et un cache privé', async () => {
    const service = serviceFor();
    await service.upload(awa, OWNED, audio('premier'));

    const headers: Record<string, string> = {};
    let sent: unknown;
    const reply = {
      header: (name: string, value: string) => {
        headers[name] = value;
      },
      send: (payload: unknown) => {
        sent = payload;
      },
    } as unknown as FastifyReply;

    await controller(service).downloadRecording(awa, OWNED, reply);

    expect(headers['Content-Type']).toBe('audio/mp4');
    expect(headers['Content-Length']).toBe('7');
    expect(headers['Cache-Control']).toMatch(/(^|,\s*)private(\s*,|$)/);
    expect(headers['Cache-Control']).not.toMatch(/public|s-maxage/);
    expect(await bodyOf(sent as NodeJS.ReadableStream)).toBe('premier');
  });

  it('applique le plafond de taille de la note vocale à la requête', async () => {
    process.env.CALL_RECORDING_MAX_SIZE_BYTES = '31337';
    const service = serviceFor();
    let limits: unknown;
    const request = {
      file: (options: { limits: unknown }) => {
        limits = options.limits;
        return Promise.resolve(audio('premier'));
      },
    } as unknown as FastifyRequest;

    try {
      const result = await controller(service).uploadRecording(awa, OWNED, request);
      expect(result).toEqual({ attemptId: OWNED, bytes: 7 });
      expect(limits).toEqual({ fileSize: 31_337, files: 1 });
    } finally {
      delete process.env.CALL_RECORDING_MAX_SIZE_BYTES;
    }
  });
});

describe('note vocale, balayage', () => {
  /** Pose un fichier a l'age voulu, en heures. */
  async function poser(nom: string, ageHeures: number): Promise<string> {
    await mkdir(directory, { recursive: true });
    const chemin = join(directory, nom);
    await writeFile(chemin, 'audio');
    const quand = new Date(Date.now() - ageHeures * 3_600_000);
    await utimes(chemin, quand, quand);
    return chemin;
  }

  it('retire une note passee la duree de conservation', async () => {
    await poser(`${OWNED}.m4a`, 49);

    const bilan = await serviceFor().sweep();

    expect(bilan.expired).toBe(1);
    expect(await stored()).toEqual([]);
  });

  it('garde une note recente dont la tentative existe encore', async () => {
    await poser(`${OWNED}.m4a`, 2);

    const bilan = await serviceFor().sweep();

    expect(bilan).toEqual({ expired: 0, orphaned: 0 });
    expect(await stored()).toEqual([`${OWNED}.m4a`]);
  });

  it('retire une note ORPHELINE, meme recente', async () => {
    // Une purge, une fiche supprimee ou une demonstration nettoyee effacent la
    // tentative et laissent le fichier. Sans ce critere, la voix resterait sur
    // le serveur jusqu'a l'expiration, sans rien pour la relier a personne.
    await poser('0198a000-0000-7000-8000-00000000dead.m4a', 1);

    const bilan = await serviceFor().sweep();

    expect(bilan.orphaned).toBe(1);
    expect(await stored()).toEqual([]);
  });

  it('ne touche pas a ce qui n’est pas une note audio', async () => {
    await poser('journal.txt', 200);

    await serviceFor().sweep();

    expect(await stored()).toEqual(['journal.txt']);
  });

  it('interroge la base UNE fois pour tout le repertoire', async () => {
    const vivants: AttemptRow[] = [];
    for (let index = 0; index < 200; index += 1) {
      const id = `attempt-${String(index).padStart(3, '0')}`;
      await poser(`${id}.m4a`, 1);
      if (index % 2 === 0) vivants.push({ id, performedById: awa.id });
    }

    sweepQueries = 0;
    const bilan = await serviceFor(vivants).sweep();

    expect(sweepQueries).toBe(1);
    expect(bilan.orphaned).toBe(100);
    expect(await stored()).toHaveLength(100);
  });

  it('ne rompt pas quand le repertoire n’existe pas encore', async () => {
    await expect(serviceFor().sweep()).resolves.toEqual({ expired: 0, orphaned: 0 });
  });
});
