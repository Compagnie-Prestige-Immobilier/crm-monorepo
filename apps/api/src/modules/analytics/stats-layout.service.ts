import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  StatsLayoutDto,
  StatsLayoutScreen,
  type StatsLayoutWidgetDto,
  type UpdateStatsLayoutDto,
} from './dto.js';

const LAYOUT_VERSION = 1;

const DEFAULTS: Record<StatsLayoutScreen, readonly string[]> = {
  dashboard: [
    'prospects-over-time',
    'top-teleconseillers',
    'top-representants',
    'by-departement',
    'by-bank',
    'by-syndicat',
  ],
  teleconseil: [
    'prospects-over-time',
    'top-teleconseillers',
    'conversion-teleconseillers',
    'phase2-status',
    'enrollment-methods',
    'segments',
  ],
};

type StoredLayout = {
  version: 1;
  widgets: StatsLayoutWidgetDto[];
};

function keyFor(userId: string, screen: StatsLayoutScreen): string {
  return `analytics.layout.${screen}.${userId}`;
}

function fallback(screen: StatsLayoutScreen): StatsLayoutWidgetDto[] {
  return DEFAULTS[screen].map((id) => ({ id, visible: true }));
}

function parse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitize(
  screen: StatsLayoutScreen,
  widgets: readonly StatsLayoutWidgetDto[],
): StatsLayoutWidgetDto[] {
  const allowed = DEFAULTS[screen];
  const seen = new Set<string>();
  const kept: StatsLayoutWidgetDto[] = [];

  for (const widget of widgets) {
    if (!allowed.includes(widget.id)) continue;
    if (seen.has(widget.id)) continue;
    seen.add(widget.id);
    kept.push({ id: widget.id, visible: widget.visible !== false });
  }

  for (const id of allowed) {
    if (seen.has(id)) continue;
    kept.push({ id, visible: true });
  }

  return kept;
}

function resolve(screen: StatsLayoutScreen, value: unknown): StoredLayout | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== LAYOUT_VERSION) return null;
  if (!Array.isArray(raw.widgets)) return null;

  const widgets = sanitize(
    screen,
    raw.widgets
      .filter(
        (widget): widget is { id: string; visible?: boolean } =>
          typeof widget === 'object' && widget !== null && typeof widget.id === 'string',
      )
      .map((widget) => ({ id: widget.id, visible: widget.visible !== false })),
  );

  return { version: 1, widgets };
}

@Injectable()
export class StatsLayoutService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, screen: StatsLayoutScreen): Promise<StatsLayoutDto> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: keyFor(userId, screen) } });
    const layout = row === null ? null : resolve(screen, parse(row.value));
    return {
      screen,
      widgets: layout?.widgets ?? fallback(screen),
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async put(
    userId: string,
    screen: StatsLayoutScreen,
    body: UpdateStatsLayoutDto,
  ): Promise<StatsLayoutDto> {
    const layout: StoredLayout = { version: 1, widgets: sanitize(screen, body.widgets) };
    const row = await this.prisma.appSetting.upsert({
      where: { key: keyFor(userId, screen) },
      create: { key: keyFor(userId, screen), value: JSON.stringify(layout), updatedById: userId },
      update: { value: JSON.stringify(layout), updatedById: userId },
    });
    return { screen, widgets: layout.widgets, updatedAt: row.updatedAt.toISOString() };
  }

  async remove(userId: string, screen: StatsLayoutScreen): Promise<void> {
    await this.prisma.appSetting.deleteMany({ where: { key: keyFor(userId, screen) } });
  }
}
