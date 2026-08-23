import { Injectable } from '@nestjs/common';
import { DEMO_SEED_SETTING, DEMO_SEED_VERSION, DemoWorkspaceFactory } from '@crm/database';

import { PrismaClients } from '../../prisma/prisma.service.js';
import type { DemoWorkspaceStatusDto } from './dto.js';

@Injectable()
export class DemoService {
  private initializing: Promise<void> | null = null;

  constructor(private readonly clients: PrismaClients) {}

  ensureSeeded(): Promise<void> {
    this.initializing ??= this.seedIfMissing().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  private async seedIfMissing(): Promise<void> {
    const demo = this.clients.get('demo');
    const marker = await demo.appSetting.findUnique({ where: { key: DEMO_SEED_SETTING } });
    if (marker?.value !== DEMO_SEED_VERSION) await new DemoWorkspaceFactory(demo).reset();
  }

  async status(): Promise<DemoWorkspaceStatusDto> {
    const demo = this.clients.get('demo');
    const [users, representants, prospects, campaigns, bankCases] = await Promise.all([
      demo.user.count({ where: { isActive: true, deletedAt: null } }),
      demo.representant.count({ where: { deletedAt: null } }),
      demo.prospect.count({ where: { deletedAt: null } }),
      demo.callCampaign.count(),
      demo.bankCase.count({ where: { deletedAt: null } }),
    ]);
    return { workspace: 'demo', counts: { users, representants, prospects, campaigns, bankCases } };
  }

  async reset(): Promise<DemoWorkspaceStatusDto> {
    await new DemoWorkspaceFactory(this.clients.get('demo')).reset();
    return this.status();
  }
}
