import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { Observable } from 'rxjs';

import { DEMO_MODE_HEADER } from '../../modules/export/demo-marking.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

@Injectable()
export class DemoModeInterceptor implements NestInterceptor {
  constructor(private readonly demo: DemoVisibilityService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() === 'http') {
      const reply = context.switchToHttp().getResponse<FastifyReply>();
      if (!reply.sent) {
        reply.header(DEMO_MODE_HEADER, (await this.demo.enabled()) ? 'true' : 'false');
      }
    }
    return next.handle();
  }
}
