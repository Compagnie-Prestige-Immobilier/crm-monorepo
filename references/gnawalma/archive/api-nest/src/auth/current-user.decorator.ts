import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthClaims } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthClaims => {
    const request = context.switchToHttp().getRequest<{ user: AuthClaims }>();
    return request.user;
  },
);
