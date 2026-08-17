import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { ApiErrorDto } from '../../common/dto/api-error.dto.js';
import { Role } from '@crm/database';

import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { OkDto } from '../../common/dto/ok.dto.js';
import { UsersService } from './users.service.js';
import {
  CreateUserDto,
  ResetPasswordDto,
  SetActiveDto,
  UpdateUserDto,
  UserDto,
  UserListDto,
  UserListQueryDto,
} from './dto.js';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ operationId: 'listUsers', summary: 'Liste paginée des comptes.' })
  @ApiResponse({ status: 200, type: UserListDto })
  list(@Query() query: UserListQueryDto): Promise<UserListDto> {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getUser', summary: 'Détail d’un compte.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: UserDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.users.get(id);
  }

  @Post()
  @ApiOperation({ operationId: 'createUser', summary: 'Crée un commercial ou un administrateur.' })
  @ApiResponse({ status: 201, type: UserDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'E-mail ou nom d’utilisateur déjà pris.',
  })
  create(@Body() body: CreateUserDto): Promise<UserDto> {
    return this.users.create(body);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateUser', summary: 'Modifie un compte.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: UserDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateUserDto): Promise<UserDto> {
    return this.users.update(id, body);
  }

  @Put(':id/active')
  @ApiOperation({
    operationId: 'setUserActive',
    summary: 'Active ou désactive un compte (révoque ses sessions).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: UserDto })
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetActiveDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserDto> {
    return this.users.setActive(id, body, actor.id);
  }

  @Put(':id/password')
  @ApiOperation({
    operationId: 'resetUserPassword',
    summary: 'Réinitialise le mot de passe d’un compte et révoque ses sessions.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkDto })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetPasswordDto,
  ): Promise<OkDto> {
    return this.users.resetPassword(id, body);
  }

  @Delete(':id')
  @ApiOperation({ operationId: 'deleteUser', summary: 'Supprime logiquement un compte.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: OkDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<OkDto> {
    return this.users.remove(id, actor.id);
  }
}
