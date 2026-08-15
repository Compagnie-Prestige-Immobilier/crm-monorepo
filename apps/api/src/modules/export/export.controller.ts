import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator.js';
import { Role } from '@crm/database';
import type { FastifyReply } from 'fastify';

import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ExportService } from './export.service.js';
import { ExportMode, ExportQueryDto } from './dto.js';
import { formatDakarDate } from './dakar.js';
import { DEMO_MODE_HEADER, demoFilenameSuffix, setDemoHeader } from './demo-marking.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { RepresentantsExportService } from './representants-export.service.js';
import { RepresentantExportQueryDto } from '../representants/dto.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Exports Excel, et POURQUOI LES RÔLES SONT POSÉS ROUTE PAR ROUTE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE CONTRÔLEUR N'AVAIT PAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ses trois routes ne portaient AUCUN `@Roles`, et `RolesGuard` laisse passer
 * toute identité authentifiée en l'absence de décorateur : les trois classeurs
 * étaient donc téléchargeables par les trois rôles. Rien n'a fuité, parce que
 * chaque service cloisonne sa lecture par `ownerScope`, mais c'était une
 * propriété de CHAQUE requête et non une règle du contrôleur, exactement la
 * situation qu'`analytics.controller.ts` a quittée en posant son `@Roles` de
 * classe. La première colonne ajoutée sans passer par `buildProspectWhere`
 * ouvrait les trois routes d'un coup.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAS DE `@Roles` DE CLASSE ICI, ET C'EST DÉLIBÉRÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les trois routes ne servent pas la même population. Un `@Roles` de classe
 * devrait alors prendre l'UNION des trois, c'est-à-dire la plus large, et
 * chaque route devrait la resserrer : la règle apparente serait la plus
 * permissive, et une quatrième route écrite demain hériterait de cette union
 * sans que personne l'ait décidé pour elle. Chaque route porte donc son propre
 * décorateur, avec le motif écrit au-dessus.
 */
@ApiTags('export')
@ApiBearerAuth()
// Toute route de ce contrôleur peut refuser pour ces trois raisons :
// jeton absent ou expiré, rôle insuffisant, et entrée refusée par la
// validation globale (`forbidNonWhitelisted` transforme un paramètre mal
// orthographié en 400). Les déclarer ici évite de les oublier route par
// route, ce qui était le cas sur 116 opérations sur 119.
@ApiErrors({ 400: true, 401: true, 403: true })
@Controller({ path: 'export', version: '1' })
export class ExportController {
  constructor(
    private readonly exports: ExportService,
    private readonly representants: RepresentantsExportService,
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * ADMIN et COMMERCIAL, LES MÊMES QUE LE TABLEAU DE BORD.
   *
   * Le classeur ne contient pas que des lignes de prospects. Sa feuille
   * Synthèse est composée à partir d'`AnalyticsService` : `totals`, `byBanque`,
   * `bySyndicat`, `byDepartement`, `bySegment`, `byPhase2Status` et
   * `byEnrollmentMethod`. Ce sont EXACTEMENT les agrégats qu'`AnalyticsController`
   * ferme à BANQUE_FINANCE par un `@Roles` de classe, et il les ferme
   * précisément parce que le cloisonnement de chaque requête ne suffisait pas à
   * en faire une règle. Sans décorateur ici, cette route était une seconde
   * porte sur les mêmes chiffres, et elle n'avait pas de serrure.
   *
   * BANQUE_FINANCE a son propre export, `bank-cases.xlsx`, qui porte les
   * dossiers dont il répond. La prospection terrain ne le regarde pas.
   *
   * Le cloisonnement par commercial reste où il doit être, dans
   * `buildProspectWhere` : un COMMERCIAL n'exporte que ses fiches, un ADMIN
   * tout. Le décorateur ne remplace pas ce filtre, il dit qui a le droit de
   * demander le fichier.
   */
  @Get('prospects.xlsx')
  @Roles(Role.ADMIN, Role.COMMERCIAL)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'exportProspectsXlsx',
    summary: 'Export Excel des prospects, avec le même filtre que la liste.',
    description:
      'Deux modes. `filtered` (défaut) : une feuille Prospects correspondant exactement aux filtres, plus Représentants et Synthèse. `consolidated` : exactement cinq feuilles, Consolidé, BDD1, BDD2, BDD3, BDD4.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Classeur Excel. En mode `filtered` : feuilles Prospects, Représentants et Synthèse. En mode `consolidated` : Consolidé, BDD1, BDD2, BDD3, BDD4.',
    headers: {
      [DEMO_MODE_HEADER]: {
        description:
          'Vrai si le classeur a été produit en mode démonstration, donc s’il mêle des lignes fictives à des lignes réelles.',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
    },
    // Déclaré en binaire explicite : sans cela, le générateur Dart produit une
    // méthode qui tente de désérialiser le classeur en JSON.
    content: {
      [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } },
    },
  })
  async prospects(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExportQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const mode = query.mode ?? ExportMode.FILTERED;
    const demoEnabled = await this.demo.enabled();
    // Le nom de fichier porte la date de Dakar : un export lancé en soirée ne
    // doit pas s'appeler du lendemain parce que le serveur tourne en UTC+2. Il
    // porte aussi, le cas échéant, la marque du mode démonstration : c'est la
    // seule des trois marques qui reste visible dans une liste de pièces
    // jointes, sans ouvrir le fichier.
    const prefix = mode === ExportMode.CONSOLIDATED ? 'prospects-cpi-consolide' : 'prospects-cpi';
    const filename = `${prefix}-${formatDakarDate(new Date())}${demoFilenameSuffix(demoEnabled)}.xlsx`;

    // On écrit dans le flux Node brut : exceljs pousse le XML au fil de l'eau,
    // et passer par la sérialisation de Fastify obligerait à tamponner tout le
    // classeur avant le premier octet.
    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    setDemoHeader(reply.raw, demoEnabled);

    try {
      await this.exports.writeProspects(user, query, reply.raw, mode);
    } catch (error) {
      // Les en-têtes sont déjà partis : impossible de renvoyer un code
      // d'erreur. On coupe la connexion, ce que le client interprète comme un
      // téléchargement incomplet, bien préférable à un fichier tronqué qui
      // s'ouvrirait comme s'il était complet.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Représentants
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * ADMIN SEUL, comme l'import qu'il sert.
   *
   * Ce classeur est vide de données métier : des en-têtes, une ligne d'exemple
   * et des listes déroulantes alimentées par les référentiels, eux-mêmes
   * ouverts à tout utilisateur authentifié. Il ne fuit donc rien, et ce n'est
   * pas pour cela qu'il est fermé.
   *
   * Il est fermé parce qu'il n'a qu'un seul usage : remplir
   * `POST /v1/representants/import`, qui porte `@Roles(Role.ADMIN)`. Un
   * formulaire que son destinataire ne pourra pas déposer n'a pas à lui être
   * proposé : le laisser ouvert promet une manœuvre qui finira en 403, ce que
   * l'écran d'import du panneau, réservé à l'ADMIN lui aussi, prend déjà soin
   * de ne pas faire.
   */
  @Get('representants-modele.xlsx')
  @Roles(Role.ADMIN)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'downloadRepresentantsTemplateXlsx',
    summary: 'Modèle vide pour l’import de représentants.',
    description:
      'En-têtes figés, une ligne d’exemple grisée, un onglet Instructions, et des listes déroulantes alimentées depuis les référentiels VIVANTS : un département désactivé ce matin ne figure pas dans le modèle téléchargé cet après-midi.',
  })
  @ApiResponse({
    status: 200,
    description: 'Classeur Excel à trois feuilles : Représentants, Instructions, Listes (masquée).',
    // Binaire explicite : sans cela, le générateur Dart produit une méthode qui
    // tente de désérialiser le classeur en JSON.
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async representantsTemplate(@Res() reply: FastifyReply): Promise<void> {
    const filename = `modele-import-representants-${formatDakarDate(new Date())}.xlsx`;

    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');

    try {
      await this.representants.writeTemplate(reply.raw);
    } catch (error) {
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * LES RÔLES DE LA LISTE QU'IL RECOPIE, ni plus ni moins.
   *
   * Sa description annonce « mêmes critères que `GET /representants` : ce qui
   * est exporté est exactement ce qui est affiché ». Or ce contrôleur-là porte
   * `@Roles(Role.COMMERCIAL, Role.ADMIN)`, et celui-ci ne portait rien : le
   * classeur était donc atteignable par un rôle à qui la liste elle-même est
   * refusée. Un export plus large que son écran est un contournement, pas une
   * fonctionnalité.
   *
   * C'est la convention que suit déjà `bank-cases-export.controller.ts`, qui
   * répète mot pour mot le `@Roles` de `bank-cases.controller.ts` plutôt que de
   * s'en remettre au cloisonnement de son service.
   */
  @Get('representants.xlsx')
  @Roles(Role.COMMERCIAL, Role.ADMIN)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({
    operationId: 'exportRepresentantsXlsx',
    summary: 'Export Excel des représentants, avec le même filtre que la liste.',
    description:
      'Mêmes critères que `GET /representants` : ce qui est exporté est exactement ce qui est affiché, cloisonnement par commercial compris.',
  })
  @ApiResponse({
    status: 200,
    description: 'Classeur Excel à une feuille.',
    headers: {
      [DEMO_MODE_HEADER]: {
        description:
          'Vrai si le classeur a été produit en mode démonstration, donc s’il mêle des lignes fictives à des lignes réelles.',
        schema: { type: 'string', enum: ['true', 'false'] },
      },
    },
    content: { [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async representantsExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RepresentantExportQueryDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const demoEnabled = await this.demo.enabled();
    const filename = `representants-cpi-${formatDakarDate(new Date())}${demoFilenameSuffix(demoEnabled)}.xlsx`;

    reply.hijack();
    reply.raw.setHeader('Content-Type', XLSX_MIME);
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    reply.raw.setHeader('Cache-Control', 'no-store');
    setDemoHeader(reply.raw, demoEnabled);

    try {
      await this.representants.writeRepresentants(user, query, reply.raw);
    } catch (error) {
      // Les en-têtes sont partis : on coupe plutôt que de livrer un classeur
      // tronqué qui s'ouvrirait comme s'il était complet.
      reply.raw.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
