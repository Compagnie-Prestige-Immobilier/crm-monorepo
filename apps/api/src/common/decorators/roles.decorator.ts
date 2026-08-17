import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import { Role } from '@crm/database';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);

export const ANY_AUTHENTICATED = [Role.ADMIN, Role.COMMERCIAL, Role.BANQUE_FINANCE] as const;
