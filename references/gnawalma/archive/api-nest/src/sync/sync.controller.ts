import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthClaims } from '../auth/auth.types';
import { SyncService } from './sync.service';

import { syncPushRequest, uuid } from '../contracts/schemas';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('ateliers/:atelierId/pull')
  async pull(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.sync.pull(
      user,
      uuid.parse(atelierId),
      uuid.parse(query.deviceId),
      Math.max(Number(query.after ?? 0), 0),
      Math.min(Math.max(Number(query.limit ?? 100), 1), 500),
    );
  }

  @Post('ateliers/:atelierId/push')
  async push(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Body() body: unknown,
  ) {
    const value = syncPushRequest.parse(body);
    return this.sync.push(
      user,
      uuid.parse(atelierId),
      value.deviceId,
      value.operations,
    );
  }
}
