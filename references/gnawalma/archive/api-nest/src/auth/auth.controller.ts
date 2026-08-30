import { Body, Controller, Get, Headers, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthClaims } from './auth.types';

import {
  loginRequest,
  refreshRequest,
  registrationRequest,
} from '../contracts/schemas';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') async register(@Body() body: unknown) { return this.auth.register(registrationRequest.parse(body)); }
  @Get('me') @UseGuards(JwtAuthGuard) async me(@CurrentUser() user: AuthClaims) { return this.auth.me(user); }
  @Post('login') @HttpCode(200) async login(@Body() body: unknown, @Headers('user-agent') userAgent: string | undefined, @Ip() ip: string) { const value = loginRequest.parse(body); return this.auth.login(value.identifier, value.pin, { userAgent, ip }); }
  @Post('refresh') @HttpCode(200) async refresh(@Body() body: unknown, @Headers('user-agent') userAgent: string | undefined, @Ip() ip: string) { const value = refreshRequest.parse(body); return this.auth.refresh(value.refreshToken, { userAgent, ip }); }
  @Post('logout') @UseGuards(JwtAuthGuard) @HttpCode(204) async logout(@CurrentUser() user: AuthClaims) { await this.auth.revoke(user.sid, user.sub); }
}
