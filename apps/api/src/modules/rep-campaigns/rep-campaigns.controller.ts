import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PARCOURS_ROLES, Roles } from '../../common/decorators/roles.decorator.js';
import { RepCampaignsService } from './rep-campaigns.service.js';
import { CreateRepCallAttemptDto, RepCallAttemptResultDto } from './dto.js';

@ApiTags('rep-campaigns')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'rep-campaigns', version: '1' })
export class RepCampaignsController {
  constructor(private readonly campaigns: RepCampaignsService) {}

  @Post('attempts')
  @Roles(...PARCOURS_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'recordRepCallAttempt', summary: 'Enregistre un appel passé à un représentant.' })
  @ApiResponse({ status: 200, type: RepCallAttemptResultDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  recordAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRepCallAttemptDto,
  ): Promise<RepCallAttemptResultDto> {
    return this.campaigns.recordAttempt(user, body);
  }
}
