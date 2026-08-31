import {
  Controller,
  type ExecutionContext,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { seconds, Throttle } from '@nestjs/throttler';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AppUpdatesService } from './app-updates.service.js';
import { AndroidReleaseDto, AndroidReleaseListDto, AppUpdateDto } from './dto.js';

// `@Throttle` fige sa limite au chargement du module, avant que `readEnv` ne
// soit appelable ; `envSchema` valide la même variable au démarrage.
const DOWNLOAD_RATE_LIMIT = Number(process.env.APK_DOWNLOAD_RATE_LIMIT) || 1000;

// Une requête Range est une REPRISE, pas un nouveau départ : au Sénégal une
// flotte NAT partage une IP publique, la compter la jetterait en 429 en pleine
// reprise. On la range dans un compteur dédié et sans plafond (clé `-resume`,
// limite MAX) ; seul un vrai départ, sans `Range`, consomme le quota par IP.
const isResume = (context: ExecutionContext): boolean =>
  context.switchToHttp().getRequest<FastifyRequest>().headers.range !== undefined;

export const downloadThrottle = {
  default: {
    ttl: seconds(3_600),
    limit: (context: ExecutionContext): number =>
      isResume(context) ? Number.MAX_SAFE_INTEGER : DOWNLOAD_RATE_LIMIT,
    generateKey: (context: ExecutionContext, tracker: string, name: string): string =>
      `apk-download-${name}-${tracker}${isResume(context) ? '-resume' : ''}`,
  },
};

@ApiTags('app-updates')
@Controller({ path: 'app-updates', version: '1' })
export class AppUpdatesController {
  constructor(private readonly updates: AppUpdatesService) {}

  @Public()
  @Get('android/current')
  @ApiOperation({
    operationId: 'getAndroidUpdate',
    summary: 'Vérifie la dernière release Android.',
    description:
      '`minVersionCode` est le plus haut `versionCode` marqué obligatoire encore ' +
      'en ligne, ou `null`. `forceUpdate` vaut `versionCode < minVersionCode`.',
  })
  @ApiQuery({ name: 'versionCode', required: true, type: Number })
  @ApiResponse({ status: 200, type: AppUpdateDto })
  current(@Query('versionCode', ParseIntPipe) versionCode: number): Promise<AppUpdateDto> {
    return this.updates.current(versionCode);
  }

  @Public()
  @Throttle(downloadThrottle)
  @Get('android/download')
  @ApiOperation({
    operationId: 'downloadAndroidUpdate',
    summary: 'Télécharge une release Android.',
    description:
      '`v` sert exactement cette version, avec un cache immuable. Sans `v`, la ' +
      'release courante est servie, pour les APK déjà installés qui ignorent ce paramètre.',
  })
  @ApiQuery({ name: 'v', required: false, type: Number })
  @ApiProduces('application/vnd.android.package-archive')
  @ApiResponse({
    status: 200,
    content: {
      'application/vnd.android.package-archive': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 206, description: 'Reprise de téléchargement (en-tête Range).' })
  // `@ApiProduces` impose son type de contenu à toute la route : les erreurs
  // déclarent donc leur `application/json` à la main, `@ApiErrors` ne suffit pas.
  @ApiResponse({
    status: 404,
    description: 'APK_VERSION_WITHDRAWN · la version demandée est retirée ou inconnue.',
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } } },
  })
  @ApiResponse({
    status: 416,
    description: 'Plage demandée hors du fichier.',
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } } },
  })
  @ApiResponse({
    status: 429,
    description: 'Trop de téléchargements depuis cette adresse (APK_DOWNLOAD_RATE_LIMIT).',
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } } },
  })
  download(
    @Res() reply: FastifyReply,
    @Query('v', new ParseIntPipe({ optional: true })) versionCode?: number,
  ): Promise<void> {
    return this.updates.download(reply, versionCode ?? null);
  }

  @Get('android/releases')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'listAndroidReleases',
    summary: 'Historique des releases Android.',
  })
  @ApiErrors({ 401: true, 403: true })
  @ApiResponse({ status: 200, type: AndroidReleaseListDto })
  list(): Promise<AndroidReleaseListDto> {
    return this.updates.list();
  }

  @Post('android')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    operationId: 'uploadAndroidUpdate',
    summary: 'Publie une release Android.',
    description:
      '`versionName` et `versionCode` ne sont PAS envoyés : ils sont lus dans le ' +
      '`AndroidManifest.xml` de l’APK. Les envoyer quand même produit un 400, la ' +
      'validation refusant tout champ inconnu. La publication est refusée si le ' +
      'manifeste est illisible, si le paquet n’est pas `sn.cpi.go`, si le ' +
      '`versionCode` n’est pas STRICTEMENT supérieur au plus haut publié, ou si ' +
      'le certificat signataire diffère de celui du parc. Une release naît NON ' +
      'obligatoire : le plancher se pose ensuite.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        notes: { type: 'string' },
      },
    },
  })
  @ApiErrors({
    400: 'APK_MANIFEST_UNREADABLE · fichier absent, non-APK, trop volumineux, ou manifeste illisible.',
    401: true,
    403: true,
    422:
      'APK_FOREIGN_PACKAGE · le manifeste déclare un autre paquet que `sn.cpi.go`. ' +
      'APK_VERSION_NOT_GREATER · le versionCode lu ne dépasse pas le plus haut publié. ' +
      'APK_UNSIGNED · aucun bloc de signature v2/v3 lisible. ' +
      'APK_SIGNER_MISMATCH · l’APK est signé par une autre clé que celle du parc.',
  })
  @ApiResponse({ status: 201, type: AndroidReleaseDto })
  upload(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AndroidReleaseDto> {
    return this.updates.upload(request, user);
  }

  @Post('android/:versionCode/mandatory')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'markAndroidReleaseMandatory',
    summary: 'Rend une release obligatoire.',
    description:
      'Pose le plancher : tout poste sous ce `versionCode` reçoit `forceUpdate`. ' + 'Idempotent.',
  })
  @ApiParam({ name: 'versionCode', type: Number })
  @ApiErrors({
    401: true,
    403: true,
    404: 'APK_RELEASE_UNKNOWN · aucune release en ligne ne porte ce versionCode.',
  })
  @ApiResponse({ status: 201, type: AndroidReleaseDto })
  setMandatory(
    @Param('versionCode', ParseIntPipe) versionCode: number,
  ): Promise<AndroidReleaseDto> {
    return this.updates.setMandatory(versionCode);
  }

  @Post('android/:versionCode/withdraw')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'withdrawAndroidRelease',
    summary: 'Retire une release de la distribution.',
    description:
      'Le fichier est supprimé et la version cesse d’être téléchargeable. ' +
      'Idempotent sur une release déjà retirée.',
  })
  @ApiParam({ name: 'versionCode', type: Number })
  @ApiErrors({
    401: true,
    403: true,
    404: 'APK_RELEASE_UNKNOWN · aucune release ne porte ce versionCode.',
    409: 'APK_LAST_RELEASE · c’est la seule release en ligne.',
  })
  @ApiResponse({ status: 201, type: AndroidReleaseDto })
  withdraw(
    @Param('versionCode', ParseIntPipe) versionCode: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AndroidReleaseDto> {
    return this.updates.withdraw(versionCode, user);
  }
}
