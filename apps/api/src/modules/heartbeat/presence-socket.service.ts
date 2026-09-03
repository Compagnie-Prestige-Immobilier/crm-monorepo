import type { IncomingHttpHeaders } from 'node:http';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { WebSocket } from 'ws';

import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard.js';
import { readEnv } from '../../env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { HeartbeatService } from './heartbeat.service.js';

const MIN_BEAT_MS = 10_000;

@Injectable()
export class PresenceSocketService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly heartbeat: HeartbeatService,
  ) {}

  connect(socket: WebSocket, headers: IncomingHttpHeaders): void {
    const user = this.authenticate(headers);
    let lastBeat = 0;
    const expiry = setTimeout(() => socket.close(1000, 'Renouvellement'), 15 * 60_000);
    socket.once('close', () => clearTimeout(expiry));

    socket.on('message', async (message: Buffer) => {
      if (message.toString() !== 'beat') return;
      const now = Date.now();
      if (now - lastBeat < MIN_BEAT_MS) return;
      lastBeat = now;
      const userId = await user;
      if (userId !== null) await this.heartbeat.recordActivity(userId, new Date(now));
    });

    void user.then(async (userId) => {
      if (userId === null) {
        socket.close(1008, 'Session invalide');
        return;
      }
      lastBeat = Date.now();
      await this.heartbeat.recordActivity(userId, new Date(lastBeat));
      socket.send('ready');
    });
  }

  private async authenticate(headers: IncomingHttpHeaders): Promise<string | null> {
    const raw = headers.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;
    if (!authorization?.startsWith('Bearer ')) return null;

    try {
      const payload = this.jwt.verify<AccessTokenPayload>(authorization.slice(7).trim(), {
        secret: readEnv().JWT_ACCESS_SECRET,
      });
      if (payload.typ !== 'access' || payload.workspace === 'demo') return null;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isActive: true, deletedAt: true },
      });
      return user?.isActive === true && user.deletedAt === null ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
