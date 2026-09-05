import { Global, Module } from '@nestjs/common';

import { ParametresController } from './parametres.controller.js';
import { ParametresService } from './parametres.service.js';

/**
 * Global : le connecteur d'enrolement lit la meme source que l'ecran
 * d'administration, et un second fournisseur les aurait laisses diverger.
 */
@Global()
@Module({
  controllers: [ParametresController],
  providers: [ParametresService],
  exports: [ParametresService],
})
export class ParametresModule {}
