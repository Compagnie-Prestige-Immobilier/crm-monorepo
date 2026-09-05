import { DEMO_SEED_SETTING, DEMO_SEED_VERSION, DemoWorkspaceFactory } from '@crm/database';
import { beforeEach, expect, it, vi } from 'vitest';

import { DemoService } from './demo.service.js';

const findMarker = vi.fn();
const countRepresentants = vi.fn();
const demoDb = {
  appSetting: { findUnique: findMarker },
  representant: { count: countRepresentants },
};
const service = new DemoService({ get: () => demoDb } as never);

beforeEach(() => {
  findMarker.mockReset();
  countRepresentants.mockReset();
  countRepresentants.mockResolvedValue(14_908);
  vi.restoreAllMocks();
});

// Le marqueur vient des CONSTANTES, pas d'un littéral : figé à '2', ce test
// tombait au rouge dès que la factory passait en version 3, en accusant le
// service alors que seul le décor était périmé.
it('garde le schéma existant quand la factory a déjà posé son marqueur', async () => {
  findMarker.mockResolvedValue({ key: DEMO_SEED_SETTING, value: DEMO_SEED_VERSION });
  const reset = vi.spyOn(DemoWorkspaceFactory.prototype, 'reset').mockResolvedValue(undefined);

  await service.ensureSeeded();

  expect(reset).not.toHaveBeenCalled();
});

// Une purge lancée depuis l'espace démo vide les tables métier et laisse
// `app_settings` intact : le marqueur restait à jour sur un schéma sans données.
it('réamorce quand le marqueur survit à un schéma vidé', async () => {
  findMarker.mockResolvedValue({ key: DEMO_SEED_SETTING, value: DEMO_SEED_VERSION });
  countRepresentants.mockResolvedValue(0);
  const reset = vi.spyOn(DemoWorkspaceFactory.prototype, 'reset').mockResolvedValue(undefined);

  await service.ensureSeeded();

  expect(reset).toHaveBeenCalledTimes(1);
});

it('ne lance qu’une factory pour deux premiers accès simultanés', async () => {
  findMarker.mockResolvedValue(null);
  const reset = vi.spyOn(DemoWorkspaceFactory.prototype, 'reset').mockResolvedValue(undefined);

  await Promise.all([service.ensureSeeded(), service.ensureSeeded()]);

  expect(reset).toHaveBeenCalledTimes(1);
});
