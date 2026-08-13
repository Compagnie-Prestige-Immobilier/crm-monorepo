import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { AppUpdateDto, AppUpdateUploadDto } from './dto.js';

const SETTING_KEY = 'mobile.android.release';

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
    const file = await request.file();
    if (!file || !file.filename.toLowerCase().endsWith('.apk')) {
      throw new BadRequestException('Un fichier APK est requis.');
    }
    const fields = this.readFields(file);
    const input: AppUpdateUploadDto = {
      versionName: fields.versionName ?? '',
      versionCode: Number(fields.versionCode),
      forceUpdate: fields.forceUpdate === 'true',
      ...(fields.notes === undefined ? {} : { notes: fields.notes }),
    };
    if (!input.versionName || !Number.isInteger(input.versionCode) || input.versionCode < 1) {
      throw new BadRequestException('versionName et versionCode sont invalides.');
    }
    if (fields.forceUpdate !== 'true' && fields.forceUpdate !== 'false') {
      throw new BadRequestException('forceUpdate doit valoir true ou false.');
    }
    const current = await this.readRelease();
    if (current !== null && input.versionCode <= current.versionCode) {
      throw new BadRequestException(
        `La version Android doit être supérieure à ${String(current.versionCode)}.`,
      );
    }

    await mkdir(this.directory, { recursive: true });
    const fileName = `cpi-go-${String(input.versionCode)}-${randomUUID()}.apk`;
    const temporaryPath = join(this.directory, `.${fileName}.part`);
    const targetPath = join(this.directory, fileName);
    const hash = createHash('sha256');
    let fileSize = 0;
    try {
      file.file.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;
        hash.update(chunk);
      });
      await pipeline(file.file, createWriteStream(temporaryPath, { flags: 'wx' }));
      await rename(temporaryPath, targetPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (file.file.truncated) throw new BadRequestException('APK trop volumineux.');
      throw error;
    }

    const release: ReleaseRecord = {
      versionName: input.versionName,
      versionCode: input.versionCode,
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
    return this.toDto(release);
  }

  async download(
    reply: {
      code(statusCode: number): {
        header(name: string, value: string): unknown;
        send(body: unknown): unknown;
      };
      header(name: string, value: string): unknown;
      send(body: unknown): unknown;
    },
    rangeHeader?: string,
  ): Promise<void> {
    const release = await this.readRelease();
    if (release === null) throw new NotFoundException('Aucune release disponible.');
    const path = join(this.directory, basename(release.fileName));
    try {
      const details = await stat(path);
      const range = parseRange(rangeHeader, details.size);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Type', 'application/vnd.android.package-archive');
      reply.header('Content-Length', String(range ? range.end - range.start + 1 : details.size));
      reply.header('Content-Disposition', `attachment; filename="${basename(release.fileName)}"`);
      if (range) {
        reply.header(
          'Content-Range',
          `bytes ${String(range.start)}-${String(range.end)}/${String(details.size)}`,
        );
        reply.code(206).send(createReadStream(path, { start: range.start, end: range.end }));
      } else {
        reply.send(createReadStream(path));
      }
    } catch {
      throw new NotFoundException('Le fichier de release est indisponible.');
    }
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

  private readFields(file: MultipartFile): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(file.fields)) {
      if (value && 'value' in value && typeof value.value === 'string') fields[key] = value.value;
    }
    return fields;
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

function parseRange(
  value: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!value?.startsWith('bytes=')) return null;
  const [rawStart, rawEnd] = value.slice('bytes='.length).split('-', 2);
  const start = Number(rawStart);
  const requestedEnd = rawEnd === undefined || rawEnd === '' ? size - 1 : Number(rawEnd);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  )
    return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}
