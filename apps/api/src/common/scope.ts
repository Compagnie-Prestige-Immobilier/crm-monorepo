import { ForbiddenException } from '@nestjs/common';
import { Role } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';

export const isAdmin = (user: Pick<AuthenticatedUser, 'role'>): boolean => user.role === Role.ADMIN;

export const ownerScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (isAdmin(user) ? {} : { createdById: user.id });

export function assertOwnership(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  row: { createdById: string },
  message = 'Cette fiche appartient à un autre commercial.',
): void {
  if (isAdmin(user)) return;
  if (row.createdById !== user.id) {
    throw new ForbiddenException({ code: 'NOT_OWNER', message });
  }
}
