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
      where: {
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
    return { items: rows.map(toDto) };
  }

  async get(id: string): Promise<NotificationTemplateDto> {
    return toDto(await this.findVisible(id));
  }

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

  async render(id: string, variables: Record<string, string>): Promise<RenderedTemplateDto> {
    const row = await this.findVisible(id);

    const rendered = renderNotification(row.titleTemplate, row.bodyTemplate, variables);
    return { title: rendered.title, body: rendered.body, missing: [...rendered.missing] };
  }

  private async findVisible(id: string): Promise<TemplateRow> {
    const row = await this.prisma.notificationTemplate.findFirst({
      where: { id },
    });
    if (!row) throw templateNotFound();
    return row;
  }
}

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
