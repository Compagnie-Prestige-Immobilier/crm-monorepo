import { Injectable } from '@nestjs/common';
import { NotificationCategory, Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
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

@Injectable()
export class NotificationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive: boolean): Promise<NotificationTemplateListDto> {
    const rows = await this.prisma.notificationTemplate.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return { items: rows.map(toDto) };
  }

  async get(id: string): Promise<NotificationTemplateDto> {
    const row = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!row) throw templateNotFound();
    return toDto(row);
  }

  /**
   * `variables` n'est JAMAIS saisi par l'auteur : il est recalculé depuis le
   * texte à chaque écriture.
   *
   * Une liste tenue à la main diverge du gabarit à la première correction —
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

    const current = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!current) throw templateNotFound();

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
    const row = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!row) throw templateNotFound();

    const rendered = renderNotification(row.titleTemplate, row.bodyTemplate, variables);
    return { title: rendered.title, body: rendered.body, missing: [...rendered.missing] };
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
