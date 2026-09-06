import { Body, Controller, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { seconds, Throttle } from '@nestjs/throttler';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { DemandePubliqueDto } from './dto.js';
import { FormulairePublicService } from './formulaire-public.service.js';

@ApiTags('formulaire-public')
@ApiErrors({ 400: true, 404: true, 429: true, 503: true })
@Controller({ path: 'formulaire-public', version: '1' })
export class FormulairePublicController {
  constructor(private readonly demandes: FormulairePublicService) {}

  /**
   * La SEULE route d'écriture ouverte sans compte. Elle ne lit rien : ni
   * recherche par numéro, ni pré-remplissage, ni existence d'une fiche.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post(':jeton')
  @ApiOperation({
    operationId: 'envoyerDemandePublique',
    summary: 'Reçoit une demande envoyée depuis le formulaire public.',
    description:
      'Le jeton est le compte qui a partagé le lien : il devient auteur de la fiche et reçoit l’avis.',
  })
  @ApiParam({ name: 'jeton', format: 'uuid' })
  @ApiResponse({ status: 201, type: OkDto })
  /**
   * `ip` sert la vérification Cloudflare et vaut celle du visiteur seulement
   * derrière `API_TRUST_PROXY_HEADERS=true`, comme le compteur du throttler.
   */
  envoyer(
    @Param('jeton', ParseUUIDPipe) jeton: string,
    @Body() demande: DemandePubliqueDto,
    @Ip() ip: string,
  ): Promise<OkDto> {
    return this.demandes.recevoir(jeton, demande, ip);
  }
}
