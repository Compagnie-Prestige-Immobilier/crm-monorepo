import { Module } from '@nestjs/common';

import { RepCampaignsController } from './rep-campaigns.controller.js';
import { RepCampaignsService } from './rep-campaigns.service.js';

/**
 * Campagnes d'appels aux représentants.
 *
 * `PrismaModule` est global : il n'a pas à figurer dans les imports. Le module
 * n'importe RIEN de `Phase2Module` : il en réemploie deux fichiers purs
 * (`distribution.ts`, `programme-pdf.ts`), qui ne portent aucune injection et
 * ne créent donc aucune dépendance entre les deux modules. C'est précisément ce
 * qui rend la séparation tenable dans le temps.
 */
@Module({
  controllers: [RepCampaignsController],
  providers: [RepCampaignsService],
  exports: [RepCampaignsService],
})
export class RepCampaignsModule {}
