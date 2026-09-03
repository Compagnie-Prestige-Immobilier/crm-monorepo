import { Module } from '@nestjs/common';

import { HeartbeatService } from './heartbeat.service.js';
import { PresenceSocketService } from './presence-socket.service.js';

@Module({
  providers: [HeartbeatService, PresenceSocketService],
  exports: [HeartbeatService, PresenceSocketService],
})
export class HeartbeatModule {}
