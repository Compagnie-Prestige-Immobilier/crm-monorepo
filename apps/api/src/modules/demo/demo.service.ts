import { Injectable } from '@nestjs/common';
import { DemoWorkspaceFactory } from '@crm/database';

import { PrismaClients } from '../../prisma/prisma.service.js';
import type { DemoWorkspaceStatusDto } from './dto.js';

@Injectable()
export class DemoService {
  constructor(private readonly clients: PrismaClients) {}

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
