import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { BankCaseStagesService } from './bank-case-stages.service.js';
import {
  BankCaseStageDto,
  BankCaseStageListDto,
  CreateBankCaseStageDto,
  IncludeInactiveQueryDto,
  ReorderBankCaseStagesDto,
  SetBankCaseStageActiveDto,
  UpdateBankCaseStageDto,
} from './dto.js';

/**
 * Configuration du workflow bancaire.
 *
 * La LECTURE est ouverte à l'agent Banque & Finance, il lui faut la liste des
 * étapes pour afficher un dossier et proposer la suivante. Toute ÉCRITURE est
 * réservée à l'ADMIN : le workflow est une décision d'organisation, pas un
 * réglage d'agent. Le décorateur de classe pose la règle stricte et seule la
 * lecture l'élargit, si bien qu'une route ajoutée sans décorateur reste
 * fermée.
 */
@ApiTags('bank-case-stages')
@ApiBearerAuth()
@Roles(Role.ADMIN)
// Toute route de ce contrôleur peut refuser pour ces trois raisons : jeton
// absent ou expiré, rôle insuffisant, et entrée refusée par la validation
// globale (`forbidNonWhitelisted` transforme un paramètre mal orthographié en
// 400). Les déclarer ici évite de les oublier route par route, ce qui était le
// cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'bank-case-stages', version: '1' })
export class BankCaseStagesController {
  constructor(private readonly stages: BankCaseStagesService) {}

  @Roles(Role.ADMIN, Role.BANQUE_FINANCE)
  @Get()
  @ApiOperation({
    operationId: 'listBankCaseStages',
    summary: 'Étapes du workflow bancaire, dans l’ordre du flux.',
  })
  @ApiResponse({ status: 200, type: BankCaseStageListDto })
  list(@Query() query: IncludeInactiveQueryDto): Promise<BankCaseStageListDto> {
    return this.stages.list(query.includeInactive ?? false);
  }

  @Post()
  @ApiOperation({
    operationId: 'createBankCaseStage',
    summary: 'Ajoute une étape OUVERTE intermédiaire.',
    description:
      'Le type n’est pas un paramètre : une seconde étape d’encaissement ou de rejet rendrait la règle financière ambiguë. Insérer au milieu décale les étapes suivantes.',
  })
  @ApiResponse({ status: 201, type: BankCaseStageDto })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'BANK_STAGE_CODE_CONFLICT.' })
  create(@Body() body: CreateBankCaseStageDto): Promise<BankCaseStageDto> {
    return this.stages.create(body);
  }

  /** Déclarée avant `:id` : segment littéral, il ne doit pas être pris pour un identifiant. */
  @Post('reorder')
  @ApiOperation({
    operationId: 'reorderBankCaseStages',
    summary: 'Réordonne les étapes ouvertes.',
    description:
      'La liste doit être EXHAUSTIVE (toutes les étapes ouvertes, actives ou non) et commencer par l’étape initiale. Le réordonnancement n’affecte que les transitions FUTURES : l’historique référence les étapes par identifiant et reste lisible tel quel.',
  })
  @ApiResponse({ status: 201, type: BankCaseStageListDto })
  @ApiResponse({
    status: 400,
    type: ApiErrorDto,
    description: 'BANK_STAGE_REORDER_INCOMPLETE ou BANK_STAGE_INITIAL_MUST_BE_FIRST.',
  })
  reorder(@Body() body: ReorderBankCaseStagesDto): Promise<BankCaseStageListDto> {
    return this.stages.reorder(body);
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateBankCaseStage',
    summary: 'Renomme ou recolorie une étape.',
    description:
      'Ni le code, ni le type, ni le drapeau initial : une étape déjà inscrite dans l’historique d’un dossier clos ne doit pas changer de nature rétroactivement.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BankCaseStageDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'BANK_STAGE_NOT_FOUND.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBankCaseStageDto,
  ): Promise<BankCaseStageDto> {
    return this.stages.update(id, body);
  }

  @Post(':id/active')
  @ApiOperation({
    operationId: 'setBankCaseStageActive',
    summary: 'Active ou désactive une étape.',
    description:
      'Refusé sur une étape système, et refusé tant que des dossiers stationnent sur l’étape : ils deviendraient invisibles du flux sans que personne ne soit averti qu’ils existent toujours.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, type: BankCaseStageDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'BANK_STAGE_SYSTEM_IMMUTABLE ou BANK_STAGE_HAS_OPEN_CASES.',
  })
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetBankCaseStageActiveDto,
  ): Promise<BankCaseStageDto> {
    return this.stages.setActive(id, body);
  }
}
