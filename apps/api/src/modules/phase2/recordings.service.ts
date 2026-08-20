import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@crm/database';
import type { MultipartFile } from '@fastify/multipart';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { readEnv } from '../../env.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CallRecordingDto } from './dto.js';

const AUDIO_MIMES = new Set(['audio/aac', 'audio/mp4', 'audio/wav', 'audio/x-m4a']);

@Injectable()
export class CallRecordingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async upload(
    user: AuthenticatedUser,
    attemptId: string,
    part: MultipartFile | undefined,
  ): Promise<CallRecordingDto> {
    await this.assertAccess(user, attemptId, true);
    if (!part || !AUDIO_MIMES.has(part.mimetype)) {
      throw new BadRequestException({
        code: 'CALL_RECORDING_INVALID',
        message: 'Le fichier doit être un enregistrement audio.',
      });
    }

    const env = readEnv();
    await mkdir(env.CALL_RECORDING_DIR, { recursive: true });
    const destination = this.path(attemptId);
    try {
      const existing = await stat(destination);
      part.file.resume();
      return { attemptId, bytes: existing.size };
    } catch {}

    const temporary = join(
      env.CALL_RECORDING_DIR,
      `.${basename(attemptId)}.${String(Date.now())}.part`,
    );
    try {
      await pipeline(part.file, createWriteStream(temporary, { flags: 'wx' }));
      if (part.file.truncated) {
        throw new BadRequestException({
          code: 'CALL_RECORDING_TOO_LARGE',
          message: 'L’enregistrement dépasse la taille autorisée.',
        });
      }
      await rename(temporary, destination);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
    return { attemptId, bytes: (await stat(destination)).size };
  }

  async open(user: AuthenticatedUser, attemptId: string) {
    await this.assertAccess(user, attemptId, false);
    const path = this.path(attemptId);
    try {
      const metadata = await stat(path);
      return { stream: createReadStream(path), bytes: metadata.size };
    } catch {
      throw new NotFoundException({
        code: 'CALL_RECORDING_NOT_FOUND',
        message: 'Aucun enregistrement pour cette tentative.',
      });
    }
  }

  private path(attemptId: string): string {
    return join(readEnv().CALL_RECORDING_DIR, `${basename(attemptId)}.m4a`);
  }

  private async assertAccess(
    user: AuthenticatedUser,
    attemptId: string,
    upload: boolean,
  ): Promise<void> {
    const attempt = await this.prisma.callAttempt.findFirst({
      where: { id: attemptId, ...demoScope(await this.demo.enabled()) },
      select: { performedById: true },
    });
    if (!attempt) {
      throw new NotFoundException({
        code: 'CALL_ATTEMPT_NOT_FOUND',
        message: 'Tentative d’appel introuvable.',
      });
    }
    if (attempt.performedById === user.id) return;
    if (!upload && (user.role === Role.ADMIN || user.role === Role.SUPERVISEUR)) return;
    throw new ForbiddenException({
      code: 'CALL_RECORDING_FORBIDDEN',
      message: 'Cet enregistrement ne vous appartient pas.',
    });
  }
}
