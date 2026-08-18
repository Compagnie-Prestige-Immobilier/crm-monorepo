import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';
import { CallOutcomeReasonsService } from './call-outcome-reasons.service.js';
import {
  CallOutcomeReasonDto,
  CallOutcomeReasonListDto,
  CreateCallOutcomeReasonDto,
  FieldVocabularyQueryDto,
  SetCallOutcomeReasonActiveDto,
  UpdateCallOutcomeReasonDto,
} from './dto.js';

@ApiTags('call-outcome-reasons')
@ApiBearerAuth()
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'call-outcome-reasons', version: '1' })
export class CallOutcomeReasonsController {
  constructor(private readonly reasons: CallOutcomeReasonsService) {}

  @Roles(...ANY_AUTHENTICATED)
  @Get()
  @ApiOperation({
    operationId: 'listCallOutcomeReasons',
    summary: 'Vocabulaire d’issues qu’un client de terrain sait émettre.',
    description:
      'Restreint aux motifs actifs dont `minPayloadVersion` ne dépasse pas la version déclarée. Un motif que l’appelant ne saurait pas émettre ne lui est jamais proposé : sa remontée finirait en PAYLOAD_SCHEMA_MISMATCH, qui ne se rejoue pas.',
  })
  @ApiResponse({ status: 200, type: CallOutcomeReasonListDto })
  list(@Query() query: FieldVocabularyQueryDto): Promise<CallOutcomeReasonListDto> {
    return this.reasons.listForField(query.payloadVersion);
  }

  @Roles(Role.ADMIN)
  @Get('administration')
  @ApiOperation({
    operationId: 'listAllCallOutcomeReasons',
    summary: 'Tous les motifs, actifs ou non, toutes versions de charge utile.',
  })
  @ApiResponse({ status: 200, type: CallOutcomeReasonListDto })
  listAll(): Promise<CallOutcomeReasonListDto> {
    return this.reasons.listAll();
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({
    operationId: 'createCallOutcomeReason',
    summary: 'Ajoute un motif d’issue.',
    description:
      'L’effet est choisi à la création et n’est plus modifiable : l’historique le référence. Le motif naît en version de charge utile 2, donc invisible du parc tant que l’application n’a pas été renouvelée.',
  })
  @ApiResponse({ status: 201, type: CallOutcomeReasonDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description:
      'OUTCOME_REASON_CODE_CONFLICT, OUTCOME_REASON_LABEL_CONFLICT ou OUTCOME_REASON_CALLBACK_NOT_ALLOWED.',
  })
  create(@Body() body: CreateCallOutcomeReasonDto): Promise<CallOutcomeReasonDto> {
    return this.reasons.create(body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({
    operationId: 'updateCallOutcomeReason',
    summary: 'Renomme, recolorie ou réordonne un motif.',
    description:
      'Ni le code, ni l’effet, ni la version de charge utile. Sur un motif système, les règles de saisie non plus : elles sont compilées dans l’application de terrain.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: CallOutcomeReasonDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'OUTCOME_REASON_NOT_FOUND.' })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'OUTCOME_REASON_SYSTEM_IMMUTABLE ou OUTCOME_REASON_LABEL_CONFLICT.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCallOutcomeReasonDto,
  ): Promise<CallOutcomeReasonDto> {
    return this.reasons.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Post(':id/active')
  @ApiOperation({
    operationId: 'setCallOutcomeReasonActive',
    summary: 'Active ou retire un motif des listes.',
    description:
      'Jamais de suppression : les tentatives déjà remontées référencent le code. Refusé sur un motif système, que les téléphones en place proposent encore.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: CallOutcomeReasonDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'OUTCOME_REASON_SYSTEM_IMMUTABLE.',
  })
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetCallOutcomeReasonActiveDto,
  ): Promise<CallOutcomeReasonDto> {
    return this.reasons.setActive(id, body);
  }
}
