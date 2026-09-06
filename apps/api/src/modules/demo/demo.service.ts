import { ForbiddenException, Injectable } from '@nestjs/common';
import { DEMO_SEED_SETTING, DEMO_SEED_VERSION, DemoWorkspaceFactory } from '@crm/database';

import { readEnv } from '../../env.js';
import { PrismaClients } from '../../prisma/prisma.service.js';
import type { DemoWorkspaceStatusDto } from './dto.js';

@Injectable()
export class DemoService {
  private initializing: Promise<void> | null = null;

  constructor(private readonly clients: PrismaClients) {}

  assertEnabled(): void {
    if (readEnv().DEMO_WORKSPACE_ENABLED) return;
    throw new ForbiddenException({
      code: 'DEMO_WORKSPACE_DISABLED',
      message: 'L’espace de démonstration est fermé sur ce serveur.',
    });
  }

  ensureSeeded(): Promise<void> {
    this.initializing ??= this.seedIfMissing().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  // Le marqueur vit dans `app_settings`, que la purge ne touche pas : une purge
  // en démo laissait un marqueur à jour sur un schéma vide, et plus rien ne
  // réamorçait. Les lignes font foi, pas le marqueur.
  private async seedIfMissing(): Promise<void> {
    const demo = this.clients.get('demo');
    const [marker, representants] = await Promise.all([
      demo.appSetting.findUnique({ where: { key: DEMO_SEED_SETTING } }),
      demo.representant.count(),
    ]);
    if (marker?.value !== DEMO_SEED_VERSION || representants === 0) {
      await new DemoWorkspaceFactory(demo).reset();
    }
  }

  async status(): Promise<DemoWorkspaceStatusDto> {
    this.assertEnabled();
    const demo = this.clients.get('demo');
    const [users, representants, prospects, bankCases] = await Promise.all([
      demo.user.count({ where: { isActive: true, deletedAt: null } }),
      demo.representant.count({ where: { deletedAt: null } }),
      demo.prospect.count({ where: { deletedAt: null } }),
      demo.bankCase.count({ where: { deletedAt: null } }),
    ]);
    return { workspace: 'demo', counts: { users, representants, prospects, bankCases } };
  }

  async reset(): Promise<DemoWorkspaceStatusDto> {
    this.assertEnabled();
    await new DemoWorkspaceFactory(this.clients.get('demo')).reset();
    return this.status();
  }
}
