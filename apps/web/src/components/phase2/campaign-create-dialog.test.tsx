import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignCreateDialog } from '@/components/phase2/campaign-create-dialog';
import type * as ReferenceModule from '@/lib/data/reference';
import { renderWithQuery } from '@/test/render-query';
import { setUrl } from '@/test/router-mock';

const reference = vi.hoisted(() => vi.fn<() => Promise<unknown>>());

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn<() => void>(), error: vi.fn<() => void>() },
}));

beforeEach(() => {
  reference.mockReset();
  reference.mockResolvedValue({
    regions: [],
    departements: [],
    iefs: [],
    banques: [],
    syndicats: [],
    commerciaux: [{ value: 'u-1', label: 'Awa Ndiaye' }],
    representants: [],
    campagnes: [],
  });
});

describe('CampaignCreateDialog, choix de la cible', () => {
  it('propose les représentants à côté des bases de prospects', () => {
    setUrl('/chues/campagnes');
    renderWithQuery(<CampaignCreateDialog open onOpenChange={vi.fn<() => void>()} />);

    expect(screen.getByRole('radio', { name: /^BDD1/u })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Représentants/u })).toBeTruthy();
  });

  it('choisir les représentants remplace les bases par les critères de tirage des relais', async () => {
    setUrl('/chues/campagnes');
    const user = userEvent.setup();
    renderWithQuery(<CampaignCreateDialog open onOpenChange={vi.fn<() => void>()} />);

    await user.click(screen.getByRole('radio', { name: /^Représentants/u }));

    expect(await screen.findByRole('combobox', { name: /IEF/u })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Tous les représentants/u })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /dormants/u })).toBeTruthy();
  });

  it('le grand public n’a pas de représentants à appeler', () => {
    setUrl('/grand-public/campagnes');
    renderWithQuery(<CampaignCreateDialog open onOpenChange={vi.fn<() => void>()} />);

    expect(screen.getByRole('radio', { name: /^GP1/u })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /^Représentants/u })).toBeNull();
  });
});
