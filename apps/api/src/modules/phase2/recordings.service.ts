import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Role } from '@crm/database';
import type { MultipartFile } from '@fastify/multipart';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { readEnv } from '../../env.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CallRecordingDto } from './dto.js';

const AUDIO_MIMES = new Set(['audio/mp4', 'audio/x-m4a']);

@Injectable()
export class CallRecordingsService {
  private readonly logger = new Logger(CallRecordingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * Toutes les heures, et non une fois par jour: la duree de conservation est
   * de deux jours, un balayage quotidien la porterait a trois dans le pire cas.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'cpi.recordings.sweep' })
  async sweepScheduled(): Promise<void> {
    try {
      const { expired, orphaned } = await this.sweep();
      if (expired + orphaned > 0) {
        this.logger.log(
          `Notes audio retirees : ${String(expired)} expirees, ${String(orphaned)} orphelines`,
        );
      }
    } catch (error) {
      // Un balayage qui echoue ne doit pas faire tomber l'application: le
      // suivant repassera dans une heure.
      this.logger.warn(`Balayage des notes audio interrompu : ${String(error)}`);
    }
  }

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
    await mkdir(env.CALL_RECORDING_DIR, { recursive: true, mode: 0o700 });
    await chmod(env.CALL_RECORDING_DIR, 0o700);
    const destination = this.path(attemptId);
    try {
      const existing = await stat(destination);
      await chmod(destination, 0o600);
      part.file.resume();
      return { attemptId, bytes: existing.size };
    } catch {}

    const temporary = join(env.CALL_RECORDING_DIR, `.${randomUUID()}.part`);
    try {
      await pipeline(part.file, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
      if (part.file.truncated) {
        throw new BadRequestException({
          code: 'CALL_RECORDING_TOO_LARGE',
          message: 'L’enregistrement dépasse la taille autorisée.',
        });
      }
      if ((await stat(temporary)).size === 0) {
        throw new BadRequestException({
          code: 'CALL_RECORDING_EMPTY',
          message: 'L’enregistrement est vide.',
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
      await chmod(path, 0o600);
      return { stream: createReadStream(path), bytes: metadata.size };
    } catch {
      throw new NotFoundException({
        code: 'CALL_RECORDING_NOT_FOUND',
        message: 'Aucun enregistrement pour cette tentative.',
      });
    }
  }

  /**
   * Deux causes de suppression, et une seule ne suffit pas.
   *
   * L'AGE tient la duree de conservation. L'ORPHELIN rattrape ce que l'age ne
   * voit pas: une purge, une fiche supprimee, une demonstration nettoyee
   * effacent la tentative en base et laissent le fichier. Sans ce second
   * critere, la voix d'un teleconseiller parlant d'un prospect dont la fiche
   * n'existe plus resterait sur le serveur jusqu'a l'expiration.
   *
   * Un balayage, et non un crochet sur chaque point de purge: il repare aussi
   * ce qu'une purge interrompue a laisse derriere elle.
   */
  async sweep(now: Date = new Date()): Promise<{ expired: number; orphaned: number }> {
    const env = readEnv();
    let entries: string[];
    try {
      entries = await readdir(env.CALL_RECORDING_DIR);
    } catch {
      return { expired: 0, orphaned: 0 };
    }

    const limit = now.getTime() - env.CALL_RECORDING_RETENTION_HOURS * 3_600_000;
    const recordings = entries.filter((name) => name.endsWith('.m4a'));
    let expired = 0;
    let orphaned = 0;

    for (const name of recordings) {
      const file = join(env.CALL_RECORDING_DIR, name);
      let age: number;
      try {
        age = (await stat(file)).mtimeMs;
      } catch {
        continue;
      }

      if (age < limit) {
        if (await this.remove(file)) expired += 1;
        continue;
      }

      // LECTURE GLOBALE : le fichier survit a la ligne, donc la question n'est
      // pas « cette tentative m'est-elle visible » mais « existe-t-elle encore ».
      const attemptId = name.slice(0, -'.m4a'.length);
      const attempt = await this.prisma.callAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true },
      });
      if (attempt === null && (await this.remove(file))) orphaned += 1;
    }

    return { expired, orphaned };
  }

  private async remove(file: string): Promise<boolean> {
    try {
      await unlink(file);
      return true;
    } catch {
      return false;
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
