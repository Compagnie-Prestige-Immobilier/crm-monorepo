import { Global, Module } from '@nestjs/common';

import { DemoVisibilityService } from './demo-visibility.service.js';
import { PrismaService } from './prisma.service.js';

/**
 * `DemoVisibilityService` est fourni ICI, dans le module global, et non dans
 * `DemoModule` : il est lu par presque tous les services métier (prospects,
 * représentants, agrégats, export, synchronisation). Le placer dans le module
 * démonstration obligerait chacun d'eux à l'importer, et fabriquerait un cycle
 * dès que le module démonstration voudrait lire un prospect.
 */
@Global()
@Module({
  providers: [PrismaService, DemoVisibilityService],
  exports: [PrismaService, DemoVisibilityService],
})
export class PrismaModule {}
