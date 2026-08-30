import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthClaims } from '../auth/auth.types';
import { AdminService } from './admin.service';
import {
  createPromotionRequest,
  pageQuery,
  reviewModerationRequest,
  uuid,
  verificationDecisionRequest,
} from '../contracts/schemas';

@Controller('admin') @UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  /** Les mises en avant de l'accueil client, actives ou non. */
  @Get('promotions') async promotions(@CurrentUser() user: AuthClaims) { return this.admin.promotions(user); }
  @Post('promotions') async createPromotion(@CurrentUser() user: AuthClaims, @Body() body: unknown) { return this.admin.createPromotion(user, createPromotionRequest.parse(body)); }
  @Post('promotions/:id/archive') async archivePromotion(@CurrentUser() user: AuthClaims, @Param('id') id: string) { return this.admin.archivePromotion(user, uuid.parse(id)); }
  @Get('atelier-verifications') async pending(@CurrentUser() user: AuthClaims) { return this.admin.pendingAteliers(user); }
  // Parsed rather than handed to SQL raw: an empty or mistyped id used to reach
  // Postgres as a uuid comparison against a non-uuid string and come back as a
  // 500, which the back-office showed as "Action refusée ou API indisponible".
  @Post('atelier-verifications/:id/decision') async decide(@CurrentUser() user: AuthClaims, @Param('id') id: string, @Body() body: unknown) { const value = verificationDecisionRequest.parse(body); return this.admin.decideVerification(user,uuid.parse(id),value.approved,value.reason); }
  @Get('reviews') async reviews(@CurrentUser() user: AuthClaims, @Query() query: Record<string, string | undefined>) { const value = pageQuery.parse(query); return this.admin.pendingReviews(user, { limit: value.limit, offset: value.offset }); }
  @Post('reviews/:id/moderation') async moderate(@CurrentUser() user: AuthClaims, @Param('id') id: string, @Body() body: unknown) { const value = reviewModerationRequest.parse(body); return this.admin.moderateReview(user,uuid.parse(id),value.status,value.reason); }
}
