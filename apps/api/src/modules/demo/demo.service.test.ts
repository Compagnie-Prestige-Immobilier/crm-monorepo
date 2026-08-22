import { DemoWorkspaceFactory } from '@crm/database';
import { beforeEach, expect, it, vi } from 'vitest';

import { DemoService } from './demo.service.js';

const findMarker = vi.fn();
const demoDb = { appSetting: { findUnique: findMarker } };
const service = new DemoService({ get: () => demoDb } as never);

beforeEach(() => {
  findMarker.mockReset();
  vi.restoreAllMocks();
});

it('garde le schéma existant quand la factory a déjà posé son marqueur', async () => {
  findMarker.mockResolvedValue({ key: 'demo.seed.version', value: '2' });
  const reset = vi.spyOn(DemoWorkspaceFactory.prototype, 'reset').mockResolvedValue(undefined);

  await service.ensureSeeded();

  expect(reset).not.toHaveBeenCalled();
});

it('ne lance qu’une factory pour deux premiers accès simultanés', async () => {
  findMarker.mockResolvedValue(null);
  const reset = vi.spyOn(DemoWorkspaceFactory.prototype, 'reset').mockResolvedValue(undefined);

  await Promise.all([service.ensureSeeded(), service.ensureSeeded()]);

  expect(reset).toHaveBeenCalledTimes(1);
});
