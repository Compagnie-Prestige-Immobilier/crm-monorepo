import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthClaims } from '../auth/auth.types';
import { OperationsService } from './operations.service';

import {
  createAtelierRequest,
  createOrderRequest,
  orderListQuery,
  pageQuery,
  recordPaymentRequest,
  submitVerificationRequest,
  updateAtelierRequest,
  updateOrderStatusRequest,
  upsertClientRequest,
  upsertInventoryRequest,
  uuid,
} from '../contracts/schemas';

@Controller('operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('ateliers')
  async ateliers(@CurrentUser() user: AuthClaims) {
    return this.operations.listAteliers(user);
  }

  @Post('ateliers')
  async createAtelier(@CurrentUser() user: AuthClaims, @Body() body: unknown) {
    return this.operations.createAtelier(
      user,
      createAtelierRequest.parse(body),
    );
  }

  @Patch('ateliers/:atelierId')
  async updateAtelier(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Body() body: unknown,
  ) {
    return this.operations.updateAtelier(
      user,
      uuid.parse(atelierId),
      updateAtelierRequest.parse(body),
    );
  }

  @Post('ateliers/:atelierId/verification')
  async submitVerification(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Body() body: unknown,
  ) {
    return this.operations.submitForVerification(
      user,
      uuid.parse(atelierId),
      submitVerificationRequest.parse(body),
    );
  }

  @Get('ateliers/:atelierId/contacts')
  async atelierContacts(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const parsed = pageQuery.parse(query);
    return this.operations.listAtelierContacts(user, uuid.parse(atelierId), {
      limit: parsed.limit,
      offset: parsed.offset,
    });
  }

  @Get('ateliers/:atelierId/dashboard')
  async dashboard(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
  ) {
    return this.operations.dashboard(user, uuid.parse(atelierId));
  }

  @Get('ateliers/:atelierId/clients')
  async clients(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.operations.listClients(
      user,
      uuid.parse(atelierId),
      pageQuery.parse(query),
    );
  }

  @Post('ateliers/:atelierId/clients')
  async client(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Body() body: unknown,
  ) {
    return this.operations.upsertClient(
      user,
      uuid.parse(atelierId),
      upsertClientRequest.parse(body),
    );
  }

  /**
   * L'activité de tous les ateliers, sans les données de leurs clients.
   *
   * Déclaré avant `ateliers/:atelierId/...` sans ambiguïté : `orders/shared`
   * est un segment fixe, il ne peut pas être confondu avec un identifiant.
   */
  @Get('orders/shared')
  async sharedOrders(
    @CurrentUser() user: AuthClaims,
    @Query() query: Record<string, string | undefined>,
  ) {
    const value = orderListQuery.parse(query);
    return this.operations.listSharedOrders(user, {
      q: value.q,
      status: value.status,
      limit: value.limit,
      offset: value.offset,
    });
  }

  @Get('ateliers/:atelierId/orders')
  async orders(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const parsed = orderListQuery.parse(query);
    return this.operations.listOrders(user, uuid.parse(atelierId), parsed);
  }

  @Post('ateliers/:atelierId/orders')
  async order(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Body() body: unknown,
  ) {
    return this.operations.createOrder(
      user,
      uuid.parse(atelierId),
      createOrderRequest.parse(body),
    );
  }

  @Patch('ateliers/:atelierId/orders/:orderId/status')
  async orderStatus(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Param('orderId') orderId: string,
    @Body() body: unknown,
  ) {
    const value = updateOrderStatusRequest.parse(body);
    return this.operations.updateOrderStatus(
      user,
      uuid.parse(atelierId),
      uuid.parse(orderId),
      value.status,
    );
  }

  @Post('ateliers/:atelierId/orders/:orderId/payments')
  async payment(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Param('orderId') orderId: string,
    @Body() body: unknown,
  ) {
    return this.operations.recordPayment(
      user,
      uuid.parse(atelierId),
      uuid.parse(orderId),
      recordPaymentRequest.parse(body),
    );
  }

  @Get('ateliers/:atelierId/inventory')
  async inventory(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.operations.listInventory(
      user,
      uuid.parse(atelierId),
      pageQuery.parse(query),
    );
  }

  @Post('ateliers/:atelierId/inventory')
  async upsertInventory(
    @CurrentUser() user: AuthClaims,
    @Param('atelierId') atelierId: string,
    @Body() body: unknown,
  ) {
    return this.operations.upsertInventory(
      user,
      uuid.parse(atelierId),
      upsertInventoryRequest.parse(body),
    );
  }
}
