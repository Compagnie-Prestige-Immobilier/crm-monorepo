import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { assertPublishable, readApkIdentity, type ApkIdentity } from './apk-manifest.js';
import type { AppUpdateDto } from './dto.js';
import { AppUpdateUploadDto } from './dto.js';

const SETTING_KEY = 'mobile.android.release';

const APK_CONTENT_TYPE = 'application/vnd.android.package-archive';

type ReleaseRecord = {
  versionName: string;
  versionCode: number;
  forceUpdate: boolean;
  fileName: string;
  fileSize: number;
  sha256: string;
  publishedAt: string;
  notes: string | null;
};

@Injectable()
export class AppUpdatesService {
  private readonly directory = resolve(readEnv().APK_RELEASE_DIR);

  constructor(private readonly prisma: PrismaService) {}

  async current(versionCode: number): Promise<AppUpdateDto> {
    const release = await this.readRelease();
    const available = release !== null && release.versionCode > versionCode;
    if (release === null || !available) {
      return {
        available: false,
        forceUpdate: false,
        versionName: release?.versionName ?? '',
        versionCode: release?.versionCode ?? versionCode,
        fileName: '',
        fileSize: 0,
        sha256: '',
        downloadUrl: '',
        publishedAt: release?.publishedAt ?? '',
        notes: null,
      };
    }
    return this.toDto(release);
  }

  async upload(request: FastifyRequest, actor: AuthenticatedUser): Promise<AppUpdateDto> {
    await mkdir(this.directory, { recursive: true });
    const draft = randomUUID();
    const temporaryPath = join(this.directory, `.${draft}.apk.part`);
    const hash = createHash('sha256');
    let fileSize = 0;
    let file: MultipartFile | null = null;
    const fields: Record<string, string> = {};

    let identity: ApkIdentity;
    let fileName: string;
    let input: AppUpdateUploadDto;
    try {
      for await (const part of request.parts()) {
        if (part.type !== 'file') {
          if (typeof part.value === 'string') fields[part.fieldname] = part.value;
          continue;
        }
        if (!part.filename.toLowerCase().endsWith('.apk')) {
          throw new BadRequestException('Un fichier APK est requis.');
        }
        file = part;
        part.file.on('data', (chunk: Buffer) => {
          fileSize += chunk.length;
          hash.update(chunk);
        });
        await pipeline(part.file, createWriteStream(temporaryPath, { flags: 'wx' }));
      }

      if (file === null) throw new BadRequestException('Un fichier APK est requis.');

      input = await this.validateFields(fields);
      identity = await readApkIdentity(temporaryPath);
      const current = await this.readRelease();
      assertPublishable(identity, current?.versionCode ?? null);

      fileName = `cpi-go-${String(identity.versionCode)}-${draft}.apk`;
      await rename(temporaryPath, join(this.directory, fileName));
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (file?.file.truncated === true) throw new BadRequestException('APK trop volumineux.');
      throw error;
    }

    const release: ReleaseRecord = {
      versionName: identity.versionName,
      versionCode: identity.versionCode,
      forceUpdate: input.forceUpdate,
      fileName,
      fileSize,
      sha256: hash.digest('hex'),
      publishedAt: new Date().toISOString(),
      notes: input.notes?.trim() || null,
    };
    await this.prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: JSON.stringify(release), updatedById: actor.id },
      update: { value: JSON.stringify(release), updatedById: actor.id },
    });
    await this.discardOtherApks(fileName);
    return this.toDto(release);
  }

  /**
   * Une fois la ligne écrite, elle nomme le SEUL APK à garder : tout le reste
   * est la release remplacée, ou le reliquat d'un envoi coupé avant sa ligne.
   */
  private async discardOtherApks(published: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === published || !entry.endsWith('.apk')) continue;
      await rm(join(this.directory, entry), { force: true });
    }
  }

  async download(reply: FastifyReply): Promise<void> {
    const release = await this.readRelease();
    if (release === null) throw new NotFoundException('Aucune release disponible.');
    const fileName = basename(release.fileName);
    try {
      await stat(join(this.directory, fileName));
    } catch {
      throw new NotFoundException('Le fichier de release est indisponible.');
    }
    reply.header('Content-Type', APK_CONTENT_TYPE);
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.sendFile(fileName, this.directory, { contentType: false });
  }

  private async readRelease(): Promise<ReleaseRecord | null> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!setting) return null;
    try {
      const value: unknown = JSON.parse(setting.value);
      if (!value || typeof value !== 'object') return null;
      const record = value as Partial<ReleaseRecord>;
      if (typeof record.fileName !== 'string' || typeof record.versionCode !== 'number')
        return null;
      return record as ReleaseRecord;
    } catch {
      return null;
    }
  }

  private async validateFields(fields: Record<string, string>): Promise<AppUpdateUploadDto> {
    if (fields.forceUpdate !== 'true' && fields.forceUpdate !== 'false') {
      throw new BadRequestException('forceUpdate doit valoir true ou false.');
    }
    const input = plainToInstance(AppUpdateUploadDto, {
      ...fields,
      forceUpdate: fields.forceUpdate === 'true',
    });
    const failures = await validate(input, { whitelist: true, forbidNonWhitelisted: true });
    if (failures.length > 0) {
      const details = failures
        .flatMap((failure) => Object.values(failure.constraints ?? {}))
        .join(' ; ');
      throw new BadRequestException(`Champs de release invalides : ${details}`);
    }
    return input;
  }

  private toDto(release: ReleaseRecord): AppUpdateDto {
    return {
      available: true,
      forceUpdate: release.forceUpdate,
      versionName: release.versionName,
      versionCode: release.versionCode,
      fileName: release.fileName,
      fileSize: release.fileSize,
      sha256: release.sha256,
      downloadUrl: '/api/v1/app-updates/android/download',
      publishedAt: release.publishedAt,
      notes: release.notes,
    };
  }
}
