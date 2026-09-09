import { Module } from '@nestjs/common';

import { ChampsConversionModule } from '../champs-conversion/champs-conversion.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ParametresChuesModule } from '../parametres-chues/parametres-chues.module.js';
import { FormulairePublicController } from './formulaire-public.controller.js';
import { FormulairePublicService } from './formulaire-public.service.js';

@Module({
  imports: [ChampsConversionModule, NotificationsModule, ParametresChuesModule],
  controllers: [FormulairePublicController],
  providers: [FormulairePublicService],
})
export class FormulairePublicModule {}
