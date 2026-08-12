import { Module } from '@nestjs/common';

import { Phase2Controller } from './phase2.controller.js';
import { Phase2CampaignsService } from './campaigns.service.js';
import { Phase2DirectoryService } from './directory.service.js';
import { Phase2SyncService } from './phase2-sync.service.js';

/**
 * Phase 2 — campagnes d'appels et collecte des méthodes d'enrôlement.
 *
 * `Phase2SyncService` est EXPORTÉ sans route ni contrôleur : c'est le point
 * d'entrée que le module de synchronisation appelle pour appliquer une
 * opération `call_attempt` dans SA transaction. Le contrat est documenté en
 * tête de `phase2-sync.service.ts`. Le faire vivre ici plutôt que dans le
 * module de synchronisation garde en un seul endroit tout ce qui décide de
 * l'état de phase 2 d'un prospect.
 */
@Module({
  controllers: [Phase2Controller],
  providers: [Phase2CampaignsService, Phase2DirectoryService, Phase2SyncService],
  exports: [Phase2SyncService, Phase2CampaignsService, Phase2DirectoryService],
})
export class Phase2Module {}
