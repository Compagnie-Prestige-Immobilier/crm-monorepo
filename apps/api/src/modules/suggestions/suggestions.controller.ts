import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { PARCOURS_ROLES, Roles } from '../../common/decorators/roles.decorator.js';
import { SuggestionsService } from './suggestions.service.js';
import {
  SuggestionDto,
  SuggestionListDto,
  SuggestionQueryDto,
  UpdateSuggestionStatusDto,
} from './dto.js';

@ApiTags('suggestions')
@ApiBearerAuth()
// L'encadrement tranche les numéros suggérés comme le téléconseiller : en
// lecture seule, il ne pouvait ni les accepter ni les écarter.
@Roles(...PARCOURS_ROLES)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'suggestions', version: '1' })
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get()
  @ApiOperation({
    operationId: 'listSuggestions',
    summary: 'Numéros donnés par des représentants qui ont refusé.',
    description:
      'Un numéro cité par deux représentants apparaît deux fois : c’est l’information, pas un doublon.',
  })
  @ApiResponse({ status: 200, type: SuggestionListDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuggestionQueryDto,
  ): Promise<SuggestionListDto> {
    return this.suggestions.list(user, query);
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateSuggestionStatus',
    summary: 'Marque un numéro suggéré comme appelé ou abandonné.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: SuggestionDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'SUGGESTION_NOT_FOUND.' })
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSuggestionStatusDto,
  ): Promise<SuggestionDto> {
    return this.suggestions.setStatus(user, id, body.status);
  }
}
