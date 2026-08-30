import { Injectable } from '@nestjs/common';
import type { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { dispositionUsine, resolveLayout, sanitize } from './dashboard-layout.js';
import type {
  DispositionLayout,
  DispositionPresentation,
  DispositionWidget,
} from './dashboard-layout.js';
import type {
  DashboardEcran,
  DispositionPresentationDto,
  DispositionResponseDto,
  DispositionWidgetDto,
  UpdateDispositionDto,
} from './dto.js';

const defaultSettingKey = (ecran: DashboardEcran): string =>
  `tableau-de-bord.${ecran}.disposition-par-defaut`;

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

const toStoredLayout = (ecran: DashboardEcran, body: UpdateDispositionDto): DispositionLayout => ({
  version: 1,
  preset: body.preset ?? 'essentiel',
  widgets: sanitize(ecran, toPlainWidgets(body.widgets)),
});

/**
 * La disposition d'un écran de chiffres : la sienne, sinon celle fixée par
 * l'administrateur dans `AppSetting`, sinon celle d'usine. Chaque niveau passe
 * par `resolveLayout`, qui rejette une version inconnue ou une liste devenue
 * vide une fois nettoyée plutôt que de rendre un écran cassé.
 */
@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    userId: string,
    ecran: DashboardEcran,
    voitLesMontants = false,
  ): Promise<DispositionResponseDto> {
    const own = await this.prisma.dashboardLayout.findUnique({
      where: { userId_ecran: { userId, ecran } },
    });
    if (own !== null) {
      const userLayout = resolveLayout(ecran, own.layout, { videAutorise: true });
      if (userLayout !== null)
        return toResponse(userLayout, 'utilisateur', own.updatedAt.toISOString());
    }

    const setting = await this.prisma.appSetting.findUnique({
      where: { key: defaultSettingKey(ecran) },
    });
    if (setting !== null) {
      const defaultLayout = resolveLayout(ecran, parseSettingValue(setting.value));
      if (defaultLayout !== null)
        return toResponse(defaultLayout, 'defaut', setting.updatedAt.toISOString());
    }

    return toResponse(dispositionUsine(ecran, voitLesMontants), 'usine', null);
  }

  async put(
    userId: string,
    ecran: DashboardEcran,
    body: UpdateDispositionDto,
  ): Promise<DispositionResponseDto> {
    const layout = toStoredLayout(ecran, body);
    const stored = layout as unknown as Prisma.InputJsonValue;
    const row = await this.prisma.dashboardLayout.upsert({
      where: { userId_ecran: { userId, ecran } },
      create: { userId, ecran, layout: stored },
      update: { layout: stored },
    });
    return toResponse(layout, 'utilisateur', row.updatedAt.toISOString());
  }

  async remove(userId: string, ecran: DashboardEcran): Promise<void> {
    await this.prisma.dashboardLayout.deleteMany({ where: { userId, ecran } });
  }

  async putDefault(
    actorId: string,
    ecran: DashboardEcran,
    body: UpdateDispositionDto,
  ): Promise<DispositionResponseDto> {
    const layout = toStoredLayout(ecran, body);
    const value = JSON.stringify(layout);
    const row = await this.prisma.appSetting.upsert({
      where: { key: defaultSettingKey(ecran) },
      create: { key: defaultSettingKey(ecran), value, updatedById: actorId },
      update: { value, updatedById: actorId },
    });
    return toResponse(layout, 'defaut', row.updatedAt.toISOString());
  }
}
