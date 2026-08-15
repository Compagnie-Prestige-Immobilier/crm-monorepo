import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';
import { RepresentantsExportService } from './representants-export.service.js';

/**
 * Exports Excel.
 *
 * `RepresentantsExportService` est déclaré ICI et non dans le module des
 * représentants : il produit un classeur, et tout ce qui produit un classeur
 * partage le marquage du mode démonstration, la couleur d'en-tête et la
 * conversion des dates à l'heure de Dakar. Le placer côté métier ferait exister
 * une seconde façon d'écrire un fichier Excel dans ce dépôt.
 */
@Module({
  imports: [AnalyticsModule],
  controllers: [ExportController],
  providers: [ExportService, RepresentantsExportService],
})
export class ExportModule {}
