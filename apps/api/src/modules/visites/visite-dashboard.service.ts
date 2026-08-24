import { Injectable } from '@nestjs/common';
import type { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  DISPOSITION_USINE,
  resolveLayout,
  sanitize,
  type DispositionLayout,
  type DispositionPresentation,
  type DispositionWidget,
} from './dashboard-layout.js';
import type {
  DispositionPresentationDto,
  DispositionResponseDto,
  DispositionWidgetDto,
  UpdateDispositionDto,
} from './dto.js';

const DEFAULT_SETTING_KEY = 'visites.tableau-de-bord.disposition-par-defaut';

const toResponse = (
  layout: DispositionLayout,
  source: DispositionResponseDto['source'],
  updatedAt: string | null,
): DispositionResponseDto => ({
  widgets: layout.widgets,
  preset: layout.preset,
  source,
  updatedAt,
});

const parseSettingValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** Les DTO valident déjà chaque champ contre les mêmes énumérations : la conversion ne fait que resserrer les types. */
const toPlainPresentation = (raw: DispositionPresentationDto): DispositionPresentation => ({
  ...(raw.palette === undefined
    ? {}
    : { palette: raw.palette as 'neutre' | 'serie' | 'categorielle' }),
  ...(raw.valeurs === undefined ? {} : { valeurs: raw.valeurs }),
  ...(raw.legende === undefined ? {} : { legende: raw.legende }),
  ...(raw.tri === undefined
    ? {}
    : { tri: raw.tri as 'valeur-desc' | 'valeur-asc' | 'alphabetique' }),
  ...(raw.autresApres === undefined ? {} : { autresApres: raw.autresApres }),
});

const toPlainWidgets = (widgets: readonly DispositionWidgetDto[]): DispositionWidget[] =>
  widgets.map((widget) => ({
    source: widget.source,
    ...(widget.marque === undefined ? {} : { marque: widget.marque }),
    ...(widget.taille === undefined ? {} : { taille: widget.taille }),
    ...(widget.presentation === undefined
      ? {}
      : { presentation: toPlainPresentation(widget.presentation) }),
  }));

const toStoredLayout = (body: UpdateDispositionDto): DispositionLayout => ({
  version: 1,
  preset: body.preset ?? 'essentiel',
  widgets: sanitize(toPlainWidgets(body.widgets)),
});

/**
 * La disposition d'un tableau de bord : la sienne, sinon celle fixée par
 * l'administrateur dans `AppSetting`, sinon celle d'usine. Chaque niveau passe
 * par `resolveLayout`, qui rejette une version inconnue ou une liste devenue
 * vide une fois nettoyée plutôt que de rendre un écran cassé.
 */
@Injectable()
export class VisiteDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<DispositionResponseDto> {
    const own = await this.prisma.visiteDashboardLayout.findUnique({ where: { userId } });
    if (own !== null) {
      const userLayout = resolveLayout(own.layout);
      if (userLayout !== null)
        return toResponse(userLayout, 'utilisateur', own.updatedAt.toISOString());
    }

    const setting = await this.prisma.appSetting.findUnique({
      where: { key: DEFAULT_SETTING_KEY },
    });
    if (setting !== null) {
      const defaultLayout = resolveLayout(parseSettingValue(setting.value));
      if (defaultLayout !== null)
        return toResponse(defaultLayout, 'defaut', setting.updatedAt.toISOString());
    }

    return toResponse(DISPOSITION_USINE, 'usine', null);
  }

  async put(userId: string, body: UpdateDispositionDto): Promise<DispositionResponseDto> {
    const layout = toStoredLayout(body);
    const stored = layout as unknown as Prisma.InputJsonValue;
    const row = await this.prisma.visiteDashboardLayout.upsert({
      where: { userId },
      create: { userId, layout: stored },
      update: { layout: stored },
    });
    return toResponse(layout, 'utilisateur', row.updatedAt.toISOString());
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.visiteDashboardLayout.deleteMany({ where: { userId } });
  }

  async putDefault(actorId: string, body: UpdateDispositionDto): Promise<DispositionResponseDto> {
    const layout = toStoredLayout(body);
    const value = JSON.stringify(layout);
    const row = await this.prisma.appSetting.upsert({
      where: { key: DEFAULT_SETTING_KEY },
      create: { key: DEFAULT_SETTING_KEY, value, updatedById: actorId },
      update: { value, updatedById: actorId },
    });
    return toResponse(layout, 'defaut', row.updatedAt.toISOString());
  }
}
