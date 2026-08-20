import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SuggestionsService } from './suggestions.service.js';
import {
  SuggestionDto,
  SuggestionListDto,
  SuggestionQueryDto,
  UpdateSuggestionStatusDto,
} from './dto.js';

@ApiTags('suggestions')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.COMMERCIAL)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'suggestions', version: '1' })
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION)
  @ApiOperation({
    operationId: 'listSuggestions',
    summary: 'Numéros donnés par des représentants qui ont refusé.',
    description:
      'Un numéro cité par deux représentants apparaît deux fois : c’est l’information, pas un doublon.',
  })
  @ApiResponse({ status: 200, type: SuggestionListDto })
  list(@Query() query: SuggestionQueryDto): Promise<SuggestionListDto> {
    return this.suggestions.list(query);
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSuggestionStatusDto,
  ): Promise<SuggestionDto> {
    return this.suggestions.setStatus(id, body.status);
  }
}
