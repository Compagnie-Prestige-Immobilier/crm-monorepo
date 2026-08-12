import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { Role } from '@crm/database';

export const ROLES_KEY = 'roles';

/** Restreint une route à un ou plusieurs rôles. Sans décorateur : tout utilisateur authentifié. */
export const Roles = (...roles: Role[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);
