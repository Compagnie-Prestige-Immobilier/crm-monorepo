import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthClaims } from '../auth/auth.types';
import { uuid, mediaKind } from '../contracts/schemas';
import { MediaService } from './media.service';

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * Téléverse le logo, la couverture ou une réalisation d'un atelier.
   *
   * `logo_url`, `cover_url` et le portfolio existaient en base sans que rien ne
   * puisse les écrire : toute fiche créée depuis l'application ouvrait sur un
   * cadre gris, et les seules images du produit venaient du jeu de démo.
   */
  @Post('operations/ateliers/:atelierId/media')
  @UseGuards(JwtAuthGuard)
  async upload(
    @Param('atelierId') atelierId: string,
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthClaims,
  ) {
    const file = await request.file();
    if (!file) throw new BadRequestException('A file part is required');

    const kind = mediaKind.parse(
      typeof file.fields.kind === 'object' &&
        file.fields.kind !== null &&
        'value' in file.fields.kind
        ? (file.fields.kind as { value: unknown }).value
        : undefined,
    );

    const bytes = await file.toBuffer();
    // `file.truncated` est le seul signal que la limite de `@fastify/multipart`
    // a coupé le flux : sans lui, un envoi trop gros serait enregistré amputé
    // et illisible plutôt que refusé.
    if (file.file.truncated) {
      throw new BadRequestException('Image exceeds the 4 MB limit');
    }

    return this.media.store(
      user,
      uuid.parse(atelierId),
      kind,
      file.mimetype,
      bytes,
    );
  }

  /**
   * Sert un média. Public : c'est le contenu de la fiche publique.
   *
   * Servi par ce contrôleur plutôt que par un plugin de fichiers statiques —
   * l'identifiant est un uuid validé et le chemin sur disque vient de la base,
   * donc il n'existe aucun chemin fourni par l'appelant à traverser.
   */
  @Get('media/:mediaId')
  async serve(@Param('mediaId') mediaId: string, @Res() reply: FastifyReply) {
    const media = await this.media.read(uuid.parse(mediaId));
    return reply
      .header('Content-Type', media.contentType)
      .header('Cache-Control', 'public, max-age=86400, immutable')
      .header('ETag', media.etag)
      .send(media.bytes);
  }
}
