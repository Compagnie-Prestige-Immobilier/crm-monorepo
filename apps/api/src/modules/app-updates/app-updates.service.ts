import { createHash, randomUUID } from 'node:crypto';
import type { Hash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Multipart, MultipartFile } from '@fastify/multipart';
import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { assertPublishable, readApkIdentity, type ApkIdentity } from './apk-manifest.js';
import { assertExpectedSigner, readApkSignerSha256 } from './apk-signature.js';
import type { AndroidReleaseDto, AndroidReleaseListDto, AppUpdateDto } from './dto.js';
import { AppUpdateUploadDto } from './dto.js';

const APK_CONTENT_TYPE = 'application/vnd.android.package-archive';

const IMMUTABLE_CACHE_MS = 31_536_000_000;

/** Assez pour redescendre d'une release cassée sans garder tout l'historique. */
const RETAINED_RELEASES = 3;

const ReleaseError = {
  WITHDRAWN: 'APK_VERSION_WITHDRAWN',
  UNKNOWN: 'APK_RELEASE_UNKNOWN',
  LAST_RELEASE: 'APK_LAST_RELEASE',
} as const;

export interface ReleaseRow {
  readonly versionCode: number;
  readonly versionName: string;
  readonly fileName: string;
  readonly fileSize: number;
  readonly sha256: string;
  readonly signerSha256: string;
  readonly mandatory: boolean;
  readonly publishedAt: Date;
  readonly publishedById: string | null;
  readonly publishedBy: { readonly fullName: string } | null;
  readonly notes: string | null;
  readonly withdrawnAt: Date | null;
  readonly withdrawnById: string | null;
}

const PUBLISHER = { publishedBy: { select: { fullName: true } } } as const;

/** Le plancher n'est pas stocké : c'est la plus haute obligatoire encore en ligne. */
const minVersionCodeOf = (releases: readonly ReleaseRow[]): number | null =>
  releases.find((release) => release.withdrawnAt === null && release.mandatory)?.versionCode ??
  null;

const downloadUrlOf = (versionCode: number): string =>
  `/api/v1/app-updates/android/download?v=${String(versionCode)}`;

async function saveApk(part: MultipartFile, path: string, hash: Hash): Promise<number> {
  let size = 0;
  part.file.on('data', (chunk: Buffer) => {
    size += chunk.length;
    hash.update(chunk);
  });
  await pipeline(part.file, createWriteStream(path, { flags: 'wx' }));
  return size;
}

interface UploadCollector {
  file: MultipartFile | null;
  fileSize: number;
  readonly fields: Record<string, string>;
}

/**
 * `collector` est un objet mutable et non des `let` réaffectés : si `saveApk`
 * jette au milieu d'un envoi, `collector.file` doit rester posé pour que le
 * `catch` de `upload` sache distinguer un envoi tronqué d'une autre erreur.
 */
async function collectPart(
  part: Multipart,
  temporaryPath: string,
  hash: Hash,
  collector: UploadCollector,
): Promise<void> {
  if (part.type === 'file') {
    assertApk(part);
    collector.file = part;
    collector.fileSize = await saveApk(part, temporaryPath, hash);
    return;
  }
  if (typeof part.value === 'string') collector.fields[part.fieldname] = part.value;
}

function assertApk(part: MultipartFile): void {
  if (!part.filename.toLowerCase().endsWith('.apk')) {
    throw new BadRequestException('Un fichier APK est requis.');
  }
}

function unavailableUpdateDto(
  release: ReleaseRow | null,
  versionCode: number,
  minVersionCode: number | null,
  forceUpdate: boolean,
): AppUpdateDto {
  return {
    available: false,
    forceUpdate,
    versionName: release?.versionName ?? '',
    versionCode: release?.versionCode ?? versionCode,
    fileName: '',
    fileSize: 0,
    sha256: '',
    signerSha256: '',
    downloadUrl: '',
    publishedAt: release?.publishedAt.toISOString() ?? '',
    minVersionCode,
    notes: null,
  };
}

const unknownRelease = (versionCode: number): NotFoundException =>
  new NotFoundException({
    code: ReleaseError.UNKNOWN,
    message: `Aucune release en ligne ne porte le versionCode ${String(versionCode)}.`,
  });

@Injectable()
export class AppUpdatesService {
  private readonly env = readEnv();
  private readonly directory = resolve(this.env.APK_RELEASE_DIR);

  constructor(private readonly prisma: PrismaService) {}

  async current(versionCode: number): Promise<AppUpdateDto> {
    const live = (await this.releases()).filter((release) => release.withdrawnAt === null);
    const release = live[0] ?? null;
    const minVersionCode = minVersionCodeOf(live);
    const forceUpdate = minVersionCode !== null && versionCode < minVersionCode;

    if (release === null || release.versionCode <= versionCode) {
      return unavailableUpdateDto(release, versionCode, minVersionCode, forceUpdate);
    }

    return {
      available: true,
      forceUpdate,
      versionName: release.versionName,
      versionCode: release.versionCode,
      fileName: release.fileName,
      fileSize: release.fileSize,
      sha256: release.sha256,
      signerSha256: release.signerSha256,
      downloadUrl: downloadUrlOf(release.versionCode),
      publishedAt: release.publishedAt.toISOString(),
      minVersionCode,
      notes: release.notes,
    };
  }

  async list(): Promise<AndroidReleaseListDto> {
    const releases = await this.releases();
    return {
      items: releases.map((release) => this.toDto(release)),
      minVersionCode: minVersionCodeOf(releases),
    };
  }

  async upload(request: FastifyRequest, actor: AuthenticatedUser): Promise<AndroidReleaseDto> {
    await mkdir(this.directory, { recursive: true });
    const draft = randomUUID();
    const temporaryPath = join(this.directory, `.${draft}.apk.part`);
    const hash = createHash('sha256');
    const collector: UploadCollector = { file: null, fileSize: 0, fields: {} };

    let identity: ApkIdentity;
    let signerSha256: string;
    let fileName: string;
    let input: AppUpdateUploadDto;
    try {
      for await (const part of request.parts()) {
        await collectPart(part, temporaryPath, hash, collector);
      }

      if (collector.file === null) throw new BadRequestException('Un fichier APK est requis.');

      input = await this.validateFields(collector.fields);
      identity = await readApkIdentity(temporaryPath);
      const published = await this.releases();
      assertPublishable(identity, published[0]?.versionCode ?? null);

      signerSha256 = await readApkSignerSha256(temporaryPath);
      assertExpectedSigner(signerSha256, this.expectedSigner(published));

      fileName = `cpi-go-${String(identity.versionCode)}-${draft}.apk`;
      await rename(temporaryPath, join(this.directory, fileName));
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (collector.file?.file.truncated === true) {
        throw new BadRequestException('APK trop volumineux.');
      }
      throw error;
    }

    const created = await this.prisma.androidRelease.create({
      data: {
        versionCode: identity.versionCode,
        versionName: identity.versionName,
        fileName,
        fileSize: collector.fileSize,
        sha256: hash.digest('hex'),
        signerSha256,
        publishedById: actor.id,
        notes: input.notes?.trim() || null,
      },
      include: PUBLISHER,
    });
    await this.discardStaleApks();
    return this.toDto(created);
  }

  async setMandatory(versionCode: number): Promise<AndroidReleaseDto> {
    const release = (await this.releases()).find(
      (candidate) => candidate.versionCode === versionCode,
    );
    if (!release || release.withdrawnAt !== null) throw unknownRelease(versionCode);

    return this.toDto(
      await this.prisma.androidRelease.update({
        where: { versionCode },
        data: { mandatory: true },
        include: PUBLISHER,
      }),
    );
  }

  async withdraw(versionCode: number, actor: AuthenticatedUser): Promise<AndroidReleaseDto> {
    const releases = await this.releases();
    const release = releases.find((candidate) => candidate.versionCode === versionCode);
    if (!release) throw unknownRelease(versionCode);
    if (release.withdrawnAt !== null) return this.toDto(release);

    if (releases.filter((candidate) => candidate.withdrawnAt === null).length <= 1) {
      throw new ConflictException({
        code: ReleaseError.LAST_RELEASE,
        message:
          'C’est la seule release en ligne : la retirer laisserait le parc sans ' +
          'aucun APK à télécharger. Publiez la version qui la remplace, puis retirez celle-ci.',
      });
    }

    const withdrawn = await this.prisma.androidRelease.update({
      where: { versionCode },
      data: { withdrawnAt: new Date(), withdrawnById: actor.id },
      include: PUBLISHER,
    });
    await rm(join(this.directory, basename(release.fileName)), { force: true });
    return this.toDto(withdrawn);
  }

  async download(reply: FastifyReply, versionCode: number | null): Promise<void> {
    const live = (await this.releases()).filter((release) => release.withdrawnAt === null);
    const release =
      versionCode === null
        ? live[0]
        : live.find((candidate) => candidate.versionCode === versionCode);

    if (release === undefined) {
      if (versionCode === null) throw new NotFoundException('Aucune release disponible.');
      throw new NotFoundException({
        code: ReleaseError.WITHDRAWN,
        message: `La version ${String(versionCode)} n’est plus distribuée.`,
      });
    }

    const fileName = basename(release.fileName);
    try {
      await stat(join(this.directory, fileName));
    } catch {
      throw new NotFoundException('Le fichier de release est indisponible.');
    }

    reply.header('Content-Type', APK_CONTENT_TYPE);
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.sendFile(fileName, this.directory, {
      contentType: false,
      // Seule la forme versionnée est immuable : `?v=` absent sert la release
      // courante, qui change à chaque publication.
      ...(versionCode === null
        ? {}
        : { cacheControl: true, immutable: true, maxAge: IMMUTABLE_CACHE_MS }),
    });
  }

  private releases(): Promise<ReleaseRow[]> {
    return this.prisma.androidRelease.findMany({
      orderBy: { versionCode: 'desc' },
      include: PUBLISHER,
    });
  }

  private expectedSigner(published: readonly ReleaseRow[]): string {
    if (this.env.APK_SIGNER_SHA256 !== '') return this.env.APK_SIGNER_SHA256;
    return published.find((release) => release.signerSha256 !== '')?.signerSha256 ?? '';
  }

  /**
   * Les trois dernières releases en ligne nomment les SEULS APK à garder : tout
   * le reste est remplacé, retiré, ou le reliquat d'un envoi coupé avant sa ligne.
   */
  private async discardStaleApks(): Promise<void> {
    const kept = new Set(
      (await this.releases())
        .filter((release) => release.withdrawnAt === null)
        .slice(0, RETAINED_RELEASES)
        .map((release) => basename(release.fileName)),
    );

    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (kept.has(entry) || !entry.endsWith('.apk')) continue;
      await rm(join(this.directory, entry), { force: true });
    }
  }

  private async validateFields(fields: Record<string, string>): Promise<AppUpdateUploadDto> {
    const input = plainToInstance(AppUpdateUploadDto, fields);
    const failures = await validate(input, { whitelist: true, forbidNonWhitelisted: true });
    if (failures.length > 0) {
      const details = failures
        .flatMap((failure) => Object.values(failure.constraints ?? {}))
        .join(' ; ');
      throw new BadRequestException(`Champs de release invalides : ${details}`);
    }
    return input;
  }

  private toDto(release: ReleaseRow): AndroidReleaseDto {
    return {
      versionCode: release.versionCode,
      versionName: release.versionName,
      fileName: release.fileName,
      fileSize: release.fileSize,
      sha256: release.sha256,
      signerSha256: release.signerSha256,
      mandatory: release.mandatory,
      publishedAt: release.publishedAt.toISOString(),
      publishedById: release.publishedById,
      publishedByName: release.publishedBy?.fullName ?? null,
      notes: release.notes,
      withdrawnAt: release.withdrawnAt?.toISOString() ?? null,
      withdrawnById: release.withdrawnById,
    };
  }
}
