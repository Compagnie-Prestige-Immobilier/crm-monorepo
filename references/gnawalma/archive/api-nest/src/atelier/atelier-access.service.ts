import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthClaims } from '../auth/auth.types';

@Injectable()
export class AtelierAccessService {
  constructor(private readonly db: DatabaseService) {}

  async requireWriteAccess(user: AuthClaims, atelierId: string): Promise<void> {
    if (user.role === 'platform_admin') return;
    const membership = await this.db.one<{ atelier_id: string }>(
      `SELECT a.id AS atelier_id FROM ateliers a WHERE a.id=$1 AND a.owner_account_id=$2
       UNION ALL SELECT atelier_id FROM atelier_memberships WHERE atelier_id=$1 AND account_id=$2 LIMIT 1`,
      [atelierId, user.sub],
    );
    if (!membership) throw new ForbiddenException('No access to atelier');
  }

  async requireAtelier(atelierId: string): Promise<void> {
    if (!(await this.db.one('SELECT id FROM ateliers WHERE id=$1', [atelierId]))) throw new NotFoundException('Atelier not found');
  }
}
