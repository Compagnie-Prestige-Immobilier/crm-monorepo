import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@crm/database';
import type { Workspace } from '../../workspaces/workspace.js';

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly fullName: string;
  readonly role: Role;
  readonly workspace?: Workspace;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new Error('CurrentUser utilisé sur une route non authentifiée');
    }
    return request.user;
  },
);
