import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

import { readEnv } from '../../env.js';

@Injectable()
export class DbDumpEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (readEnv().DB_DUMP_ENABLED) return true;
    throw new NotFoundException({
      code: 'DATABASE_DUMP_DISABLED',
      message: 'L’export intégral n’est pas activé sur ce déploiement.',
    });
  }
}
