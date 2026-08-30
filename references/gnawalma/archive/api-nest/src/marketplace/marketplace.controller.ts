import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthClaims } from '../auth/auth.types';
import { MarketplaceService } from './marketplace.service';
import {
  atelierProfileQuery,
  createContactRequest,
  confirmContactRequest,
  createReviewRequest,
  marketplaceSearchQuery,
  pageQuery,
  rankingQuery,
  uuid,
} from '../contracts/schemas';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}
  /**
   * Parsed with the schema `openapi.json` publishes, not by hand.
   *
   * The pagination knobs used to go through `Math.min(Math.max(Number(x)…))`,
   * and `Number('abc')` is `NaN`: every comparison against it is false, so the
   * clamp returned `NaN`, which reached Postgres as `LIMIT NaN` and came back
   * as a 500. One malformed query string from any caller crashed the search
   * endpoint. The schema coerces, bounds and defaults in one place, and it is
   * the same object the published contract is generated from.
   */
  @Get('ateliers') async search(@Query() query: Record<string, string | undefined>) {
    const value = marketplaceSearchQuery.parse(query);
    return this.marketplace.search({
      latitude: value.latitude,
      longitude: value.longitude,
      query: value.q,
      region: value.region,
      specialty: value.specialty,
      radiusMeters: value.radius,
      limit: value.limit,
      offset: value.offset,
    });
  }
  // Every `:id` below is parsed before it reaches SQL. Without this a
  // mistyped or stale identifier reached Postgres as a uuid comparison against
  // a non-uuid string, which raises 22P02 and surfaced to the app as a 500
  // "Le service rencontre un problème temporaire" — telling the user to wait
  // and retry an operation that could never succeed. The operations module has
  // always parsed its path parameters; marketplace and admin did not.
  /**
   * Le classement (§2.4). Public : c'est un argument de choix avant de
   * contacter, pas une donnee de compte.
   */
  @Get('ranking') async ranking(@Query() query: Record<string, string | undefined>) {
    const value = rankingQuery.parse(query);
    return this.marketplace.ranking({
      latitude: value.latitude,
      longitude: value.longitude,
      radiusMeters: value.radius,
      limit: value.limit,
      offset: value.offset,
    });
  }
  /** Les mises en avant de l'accueil client. Public, comme la recherche. */
  @Get('promotions') async promotions() {
    return this.marketplace.promotions();
  }
  @Get('ateliers/:id') async profile(@Param('id') id: string, @Query() query: Record<string, string | undefined>) {
    const origin = atelierProfileQuery.parse(query);
    return this.marketplace.profile(
      uuid.parse(id),
      origin.latitude == null || origin.longitude == null
        ? undefined
        : { latitude: origin.latitude, longitude: origin.longitude },
    );
  }
  @Get('contacts') @UseGuards(JwtAuthGuard) async contacts(@Query() query: Record<string, string | undefined>, @CurrentUser() user: AuthClaims) {
    const value = pageQuery.parse(query);
    return this.marketplace.listContacts(user, { limit: value.limit, offset: value.offset });
  }
  // The bodies below are validated with the published schemas too. They were
  // re-declared inline here, so the contract and the server were two separate
  // statements of the same rule — exactly the drift `schemas.ts` exists to end.
  @Post('ateliers/:id/contacts') @UseGuards(JwtAuthGuard) async contact(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthClaims) {
    const value = createContactRequest.parse(body);
    return this.marketplace.createContact(uuid.parse(id), user, value.channel);
  }
  @Post('contacts/:id/confirm') @UseGuards(JwtAuthGuard) async confirm(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthClaims) {
    const value = confirmContactRequest.parse(body);
    return this.marketplace.confirmContact(uuid.parse(id), user, value.status);
  }
  @Post('reviews') @UseGuards(JwtAuthGuard) async review(@Body() body: unknown, @CurrentUser() user: AuthClaims) {
    const value = createReviewRequest.parse(body);
    return this.marketplace.createReview({ ...value, authorAccountId: user.sub });
  }
}
