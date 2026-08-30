import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readiness')
  async readiness(): Promise<{ status: 'ready' }> {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      throw new HttpException({ status: 'not_ready' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
