import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
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

/** Type MIME attendu par Android pour déclencher l'installateur système. */
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

  /**
   * Publie une release Android.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * L'ORDRE A CHANGÉ, ET C'EST LE CŒUR DE LA CORRECTION
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Avant, la version venait du FORMULAIRE : elle était donc connue avant même
   * d'ouvrir le fichier, et la comparaison avec la release en ligne pouvait se
   * faire en premier. Elle vient désormais du MANIFESTE de l'APK, qui ne se lit
   * qu'une fois les octets sur le disque : un manifeste vit dans le ZIP, et le
   * répertoire central d'un ZIP est écrit à la FIN de l'archive. Rien ne peut
   * donc être décidé sur un flux encore en cours.
   *
   * La séquence est donc : écrire dans un `.part`, lire le manifeste, appliquer
   * les règles, et seulement alors renommer vers le nom définitif. Le `.part`
   * est effacé sur chaque chemin de refus. Un APK refusé ne laisse RIEN dans le
   * répertoire des releases, et surtout jamais un fichier portant le nom
   * définitif d'une version que la base n'annonce pas : `download()` sert le
   * fichier nommé par la base, mais un orphelin de 70 Mo par tentative
   * remplirait le volume en quelques semaines.
   */
  async upload(request: FastifyRequest, actor: AuthenticatedUser): Promise<AppUpdateDto> {
    const file = await request.file();
    if (!file || !file.filename.toLowerCase().endsWith('.apk')) {
      throw new BadRequestException('Un fichier APK est requis.');
    }
    const input = await this.validateFields(this.readFields(file));

    await mkdir(this.directory, { recursive: true });
    // Le nom temporaire ne peut plus porter le versionCode, qui n'est pas
    // encore connu : un UUID suffit, et il garantit que deux publications
    // simultanées n'écrivent pas dans le même fichier.
    const draft = randomUUID();
    const temporaryPath = join(this.directory, `.${draft}.apk.part`);
    const hash = createHash('sha256');
    let fileSize = 0;
    try {
      file.file.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;
        hash.update(chunk);
      });
      await pipeline(file.file, createWriteStream(temporaryPath, { flags: 'wx' }));
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (file.file.truncated) throw new BadRequestException('APK trop volumineux.');
      throw error;
    }

    let identity: ApkIdentity;
    let fileName: string;
    try {
      identity = await readApkIdentity(temporaryPath);
      const current = await this.readRelease();
      assertPublishable(identity, current?.versionCode ?? null);

      fileName = `cpi-go-${String(identity.versionCode)}-${draft}.apk`;
      await rename(temporaryPath, join(this.directory, fileName));
    } catch (error) {
      // `rm` AVANT de relever : sans ce nettoyage, chaque APK refusé (mauvais
      // paquet, version pas assez haute, manifeste illisible) laisserait ses
      // dizaines de mégaoctets sur le volume monté, que rien ne balaie.
      await rm(temporaryPath, { force: true });
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
    return this.toDto(release);
  }

  /**
   * Sert l'APK publié, reprises de téléchargement comprises.
   *
   * L'analyse de l'en-tête `Range` est DÉLÉGUÉE à `@fastify/static` (voir le
   * commentaire d'inscription du greffon dans `app-updates.module.ts`) :
   * `bytes=-500` désigne les 500 derniers octets et non les 500 premiers, et
   * se tromper là-dessus produit un APK corrompu que le contrôle sha256 rejette
   * indéfiniment, tentative après tentative.
   *
   * Le fichier est vérifié AVANT d'être passé au greffon : une release
   * référencée en base mais absente du disque doit rester une 404 en français,
   * telle que l'attend le mobile, et non la 404 générique de Fastify.
   */
  async download(reply: FastifyReply): Promise<void> {
    const release = await this.readRelease();
    if (release === null) throw new NotFoundException('Aucune release disponible.');
    // `basename` : le nom vient de la base, il ne doit jamais pouvoir remonter
    // hors du répertoire des releases.
    const fileName = basename(release.fileName);
    try {
      await stat(join(this.directory, fileName));
    } catch {
      throw new NotFoundException('Le fichier de release est indisponible.');
    }
    // Android ne déclenche son installateur que sur ce type MIME ; celui déduit
    // de l'extension par la bibliothèque écraserait notre en-tête, d'où
    // `contentType: false`.
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

  private readFields(file: MultipartFile): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(file.fields)) {
      if (value && 'value' in value && typeof value.value === 'string') fields[key] = value.value;
    }
    return fields;
  }

  /**
   * Applique RÉELLEMENT `AppUpdateUploadDto` aux champs du formulaire.
   *
   * Le `ValidationPipe` global ne voit jamais ces champs : le corps est un flux
   * multipart, le contrôleur reçoit la requête brute, et Nest ne construit
   * aucun DTO. Les `@MaxLength` du DTO étaient donc purement décoratifs, et
   * l'un d'eux protège `notes`, une valeur renvoyée telle quelle par la route
   * PUBLIQUE `GET android/current` que chaque installation interroge au
   * démarrage : une note de 10 Mo se serait retrouvée dans toutes les réponses.
   *
   * `forbidNonWhitelisted` prend un sens NOUVEAU depuis que le DTO a perdu
   * `versionName` et `versionCode` : un panel resté sur l'ancienne version, qui
   * enverrait encore ces deux champs, reçoit un 400 nommant les champs de trop
   * au lieu de les voir ignorés en silence. C'est le comportement voulu. Un
   * client qui croit encore décider de la version doit l'apprendre, sans quoi
   * il continuerait d'afficher deux formulaires que plus personne ne lit.
   */
  private async validateFields(fields: Record<string, string>): Promise<AppUpdateUploadDto> {
    // Le multipart ne transporte que du texte. La conversion est explicite ici
    // plutôt que confiée à `enableImplicitConversion`, qui transformerait
    // n'importe quelle chaîne en booléen sans jamais laisser `@IsBoolean` voir
    // de valeur invalide.
    if (fields.forceUpdate !== 'true' && fields.forceUpdate !== 'false') {
      throw new BadRequestException('forceUpdate doit valoir true ou false.');
    }
    const input = plainToInstance(AppUpdateUploadDto, {
      ...fields,
      forceUpdate: fields.forceUpdate === 'true',
    });
    const failures = await validate(input, { whitelist: true, forbidNonWhitelisted: true });
    if (failures.length > 0) {
      // Même forme d'erreur que le reste du module : `HttpException` à message
      // simple. Les contraintes violées sont nommées, sans quoi l'administrateur
      // n'a aucun moyen de savoir quel champ il doit corriger.
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
