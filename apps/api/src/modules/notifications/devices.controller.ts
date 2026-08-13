import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { DevicesService } from './devices.service.js';
import { DeviceTokenDto, RegisterDeviceDto, UnregisterDeviceDto } from './dto.js';

/**
 * Appareils.
 *
 * AUCUN `@Roles` : tout utilisateur authentifié enregistre son propre
 * téléphone. Le cloisonnement ne se joue pas au rôle mais à l'identité — le
 * service écrit `userId` depuis le jeton, jamais depuis le corps de la requête.
 */
@ApiTags('devices')
@ApiBearerAuth()
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post('register')
  @ApiOperation({
    operationId: 'registerDevice',
    summary: 'Enregistre ou rafraîchit le jeton FCM de l’appareil courant.',
    description:
      'Un jeton déjà connu d’un AUTRE compte lui est DÉTACHÉ, jamais dupliqué : les téléphones se prêtent, et l’ancien propriétaire ne doit plus rien recevoir sur un appareil qui n’est plus le sien.',
  })
  @ApiResponse({ status: 201, type: DeviceTokenDto })
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterDeviceDto,
  ): Promise<DeviceTokenDto> {
    return this.devices.register(user, body);
  }

  @Post('unregister')
  @ApiOperation({
    operationId: 'unregisterDevice',
    summary: 'Révoque le jeton à la déconnexion.',
    description:
      'Toujours `ok`, y compris sur un jeton inconnu : une déconnexion ne doit jamais échouer côté client.',
  })
  @ApiResponse({ status: 201, type: OkDto })
  unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UnregisterDeviceDto,
  ): Promise<OkDto> {
    return this.devices.unregister(user, body);
  }
}
