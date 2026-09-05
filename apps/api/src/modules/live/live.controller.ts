import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ANY_AUTHENTICATED, Roles } from '../../common/decorators/roles.decorator.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';
import { LiveService, type LiveTopic } from './live.service.js';

const PING_MS = 25_000;
/** Sous la durée du jeton d'accès (15 min) : `EventSource` rouvre avec un jeton frais. */
const RENEW_MS = 14 * 60_000;

/**
 * Flux SSE `GET /api/v1/live` : un événement nommé par sujet, sans corps. Le
 * panel invalide la requête correspondante et relit l'API ; rien de métier ne
 * transite ici. Hors OpenAPI : `EventSource` n'a pas de client généré.
 */
@ApiExcludeController()
@Roles(...ANY_AUTHENTICATED)
@Controller({ path: 'live', version: '1' })
export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly workspace: WorkspaceContext,
  ) {}

  @Get()
  stream(@Req() request: FastifyRequest, @Res() reply: FastifyReply): void {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    raw.write(': ouvert\n\n');

    const send = (topic: LiveTopic): void => {
      raw.write(`event: ${topic}\ndata: {}\n\n`);
    };
    const unsubscribe = this.live.subscribe(this.workspace.current(), send);
    const ping = setInterval(() => raw.write(': ping\n\n'), PING_MS);
    const renew = setTimeout(() => raw.end(), RENEW_MS);

    request.raw.once('close', () => {
      clearInterval(ping);
      clearTimeout(renew);
      unsubscribe();
    });
  }
}
