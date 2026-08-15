import { Injectable } from '@nestjs/common';
import { NotificationCategory, Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { extractVariables, renderNotification } from './template.js';
import { routeInvalid, templateNameConflict, templateNotFound } from './errors.js';
import {
  ROUTE_PATTERN,
  type CreateNotificationTemplateDto,
  type NotificationTemplateDto,
  type NotificationTemplateListDto,
  type RenderedTemplateDto,
  type UpdateNotificationTemplateDto,
} from './dto.js';

/**
 * Gabarits de notification.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN GABARIT PORTE `isDemo` COMME LE RESTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un gabarit rédigé pendant une démonstration n'a rien à faire dans le
 * compositeur d'une plateforme en service : il y traîne un texte d'exemple que
 * quelqu'un finira par envoyer pour de bon. La colonne existe en base depuis le
 * début ; ce service était le seul à l'ignorer, aussi bien en écriture qu'en
 * lecture.
 *
 * TOUTES les résolutions passent donc par `findVisible`, y compris celles qui
 * portent déjà la clé primaire : un gabarit masqué ne doit pas non plus être
 * relisible, modifiable ni rendu par son identifiant, sans quoi le masquage ne
 * couvrirait que la liste.
 */
@Injectable()
export class NotificationTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async list(includeInactive: boolean): Promise<NotificationTemplateListDto> {
    const rows = await this.prisma.notificationTemplate.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...demoScope(await this.demo.enabled()),
      },
      orderBy: { name: 'asc' },
    });
    return { items: rows.map(toDto) };
  }

  async get(id: string): Promise<NotificationTemplateDto> {
    return toDto(await this.findVisible(id));
  }

  /**
   * `variables` n'est JAMAIS saisi par l'auteur : il est recalculé depuis le
   * texte à chaque écriture.
   *
   * Une liste tenue à la main diverge du gabarit à la première correction,
   * l'auteur ajoute `{{campagne}}` dans le corps, oublie de l'ajouter à la
   * liste, et le compositeur cesse de proposer le champ. La variable reste
   * alors éternellement non substituée.
   */
  async create(
    user: AuthenticatedUser,
    body: CreateNotificationTemplateDto,
  ): Promise<NotificationTemplateDto> {
    if (body.route !== undefined && !ROUTE_PATTERN.test(body.route)) throw routeInvalid();

    try {
      const row = await this.prisma.notificationTemplate.create({
        data: {
          name: body.name.trim(),
          category: body.category ?? NotificationCategory.ANNONCE,
          titleTemplate: body.titleTemplate,
          bodyTemplate: body.bodyTemplate,
          route: body.route ?? null,
          variables: mergedVariables(body.titleTemplate, body.bodyTemplate),
          createdById: user.id,
          // Aucune ligne source dont hériter : l'interrupteur décide seul.
          isDemo: await this.demo.enabledForWrite(),
        },
      });
      return toDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw templateNameConflict(body.name.trim());
      throw error;
    }
  }

  async update(id: string, body: UpdateNotificationTemplateDto): Promise<NotificationTemplateDto> {
    if (body.route !== undefined && !ROUTE_PATTERN.test(body.route)) throw routeInvalid();

    const current = await this.findVisible(id);

    const titleTemplate = body.titleTemplate ?? current.titleTemplate;
    const bodyTemplate = body.bodyTemplate ?? current.bodyTemplate;

    try {
      const row = await this.prisma.notificationTemplate.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.route !== undefined ? { route: body.route } : {}),
          titleTemplate,
          bodyTemplate,
          variables: mergedVariables(titleTemplate, bodyTemplate),
        },
      });
      return toDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw templateNameConflict(body.name?.trim() ?? current.name);
      throw error;
    }
  }

  /**
   * Rend le gabarit pour l'aperçu du compositeur.
   *
   * Une variable manquante n'est PAS une erreur : le marqueur reste visible et
   * son nom remonte dans `missing`, ce qui laisse l'interface avertir avant
   * l'envoi plutôt que refuser un aperçu à moitié rempli pendant la frappe.
   */
  async render(id: string, variables: Record<string, string>): Promise<RenderedTemplateDto> {
    const row = await this.findVisible(id);

    const rendered = renderNotification(row.titleTemplate, row.bodyTemplate, variables);
    return { title: rendered.title, body: rendered.body, missing: [...rendered.missing] };
  }

  /**
   * Le gabarit, s'il est visible dans le mode courant.
   *
   * `findFirst` et non `findUnique` : `findUnique` n'accepte qu'une clé
   * unique, on ne peut donc pas y composer la visibilité. Un gabarit masqué
   * répond « introuvable », le même refus que s'il n'existait pas, ce qui est
   * exactement l'effet recherché.
   */
  private async findVisible(id: string): Promise<TemplateRow> {
    const row = await this.prisma.notificationTemplate.findFirst({
      where: { id, ...demoScope(await this.demo.enabled()) },
    });
    if (!row) throw templateNotFound();
    return row;
  }
}

/** Union ordonnée des variables du titre puis du corps, sans doublon. */
export const mergedVariables = (titleTemplate: string, bodyTemplate: string): string[] => {
  const names = extractVariables(titleTemplate);
  for (const name of extractVariables(bodyTemplate)) {
    if (!names.includes(name)) names.push(name);
  }
  return names;
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

interface TemplateRow {
  id: string;
  name: string;
  category: NotificationCategory;
  titleTemplate: string;
  bodyTemplate: string;
  route: string | null;
  variables: string[];
  isActive: boolean;
  updatedAt: Date;
}

const toDto = (row: TemplateRow): NotificationTemplateDto => ({
  id: row.id,
  name: row.name,
  category: row.category,
  titleTemplate: row.titleTemplate,
  bodyTemplate: row.bodyTemplate,
  route: row.route,
  variables: row.variables,
  isActive: row.isActive,
  updatedAt: row.updatedAt.toISOString(),
});
