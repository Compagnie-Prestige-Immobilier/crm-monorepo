import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { readEnv } from '../../env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [JwtModule.register({ global: true, secret: readEnv().JWT_ACCESS_SECRET })],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
