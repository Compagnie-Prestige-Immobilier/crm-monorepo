import { Module, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

import { AppUpdatesController } from './app-updates.controller.js';
import { AppUpdatesService } from './app-updates.service.js';

const registerApkFileSending = async (instance: FastifyInstance): Promise<void> => {
  if (instance.hasReplyDecorator('sendFile')) return;
  await instance.register(fastifyStatic, { serve: false });
};

@Module({
  controllers: [AppUpdatesController],
  providers: [AppUpdatesService],
})
export class AppUpdatesModule implements OnModuleInit {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  async onModuleInit(): Promise<void> {
    const adapter: unknown = this.adapterHost.httpAdapter;
    if (!adapter) return;
    await registerApkFileSending(this.adapterHost.httpAdapter.getInstance<FastifyInstance>());
  }
}
