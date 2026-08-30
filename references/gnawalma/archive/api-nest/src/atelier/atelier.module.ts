import { Global, Module } from '@nestjs/common';
import { AtelierAccessService } from './atelier-access.service';

@Global()
@Module({ providers: [AtelierAccessService], exports: [AtelierAccessService] })
export class AtelierModule {}
