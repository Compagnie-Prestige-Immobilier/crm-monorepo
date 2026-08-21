import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@crm/database';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { DemoService } from './demo.service.js';
import { DemoWorkspaceStatusDto } from './dto.js';

@ApiTags('demo')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/demo', version: '1' })
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get()
  @ApiOperation({ operationId: 'getDemoWorkspaceStatus', summary: 'État du workspace démo.' })
  @ApiResponse({ status: 200, type: DemoWorkspaceStatusDto })
  status(): Promise<DemoWorkspaceStatusDto> {
    return this.demo.status();
  }

  @Post('reset')
  @HttpCode(200)
  @ApiOperation({ operationId: 'resetDemoWorkspace', summary: 'Réinitialise le workspace démo.' })
  @ApiResponse({ status: 200, type: DemoWorkspaceStatusDto })
  reset(): Promise<DemoWorkspaceStatusDto> {
    return this.demo.reset();
  }
}
