import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import type { MultipartFile } from '@fastify/multipart';
import { Role } from '@crm/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { CallRecordingsService } from './recordings.service.js';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'awa@example.test',
  username: 'awa',
  fullName: 'Awa Sy',
  role: Role.COMMERCIAL,
};

describe('notes vocales des appels', () => {
  let directory: string;
  let service: CallRecordingsService;

  beforeEach(async () => {
    process.env.NODE_ENV ??= 'test';
    process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
    process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
    directory = await mkdtemp(join(tmpdir(), 'crm-call-audio-'));
    process.env.CALL_RECORDING_DIR = directory;
    service = new CallRecordingsService(
      {
        callAttempt: {
          findFirst: () => Promise.resolve({ performedById: user.id }),
        },
      } as unknown as PrismaService,
      fakeDemoVisibility(),
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('conserve les octets et rend le rejeu idempotent', async () => {
    const first = await service.upload(user, 'attempt-1', audio('premier'));
    const replay = await service.upload(user, 'attempt-1', audio('autre'));
    const opened = await service.open(user, 'attempt-1');
    const chunks: Buffer[] = [];
    for await (const chunk of opened.stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }

    expect(first.bytes).toBe(7);
    expect(replay.bytes).toBe(7);
    expect(Buffer.concat(chunks).toString()).toBe('premier');
  });
});

function audio(value: string): MultipartFile {
  const file = Readable.from([Buffer.from(value)]) as MultipartFile['file'];
  file.truncated = false;
  return { file, mimetype: 'audio/mp4' } as MultipartFile;
}
