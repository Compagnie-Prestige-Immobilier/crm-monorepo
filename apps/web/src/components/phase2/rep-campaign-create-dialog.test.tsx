import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignCreateDialog } from '@/components/phase2/campaign-create-dialog';
import type * as RepCampaignsModule from '@/lib/data/rep-campaigns';
import type * as ReferenceModule from '@/lib/data/reference';
import { renderWithQuery } from '@/test/render-query';

const reference = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const preview = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>());

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

vi.mock('@/lib/data/rep-campaigns', async () => {
  const actual = await vi.importActual<typeof RepCampaignsModule>('@/lib/data/rep-campaigns');
  return { ...actual, fetchRepCampaignPreview: preview };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn<() => void>(), error: vi.fn<() => void>() },
}));

const departement = (id: string, name: string, regionId: string, regionName: string) => ({
  id,
  code: id,
  name,
  regionId,
  regionName,
  isActive: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

beforeEach(() => {
  reference.mockReset();
  reference.mockResolvedValue({
    regions: [
      { id: 'r-dk', code: 'DK', name: 'Dakar' },
      { id: 'r-tc', code: 'TC', name: 'Tambacounda' },
    ],
    departements: [
      departement('d-dakar', 'Dakar', 'r-dk', 'Dakar'),
      departement('d-pikine', 'Pikine', 'r-dk', 'Dakar'),
      departement('d-tamba', 'Tambacounda', 'r-tc', 'Tambacounda'),
      departement('d-bakel', 'Bakel', 'r-tc', 'Tambacounda'),
    ],
    iefs: [
      {
        id: 'i-tamba',
        code: 'I-TC',
        name: 'IEF Tambacounda',
        departementId: 'd-tamba',
        departementName: 'Tambacounda',
        regionName: 'Tambacounda',
        isActive: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    banques: [],
    syndicats: [],
    commerciaux: [{ value: 'u-1', label: 'Awa Ndiaye' }],
    representants: [],
    campagnes: [],
  });

  preview.mockReset();
  preview.mockResolvedValue({
    eligible: 40,
    perCommercial: 40,
    perDay: [40],
    scopeLabel: 'Représentants non qualifiés',
  });
});

const renderDialog = () =>
  renderWithQuery(
    <CampaignCreateDialog open defaultTarget="REPRESENTANTS" onOpenChange={vi.fn<() => void>()} />,
  );

const trigger = (field: string): HTMLElement =>
  screen.getByRole('combobox', { name: new RegExp(field, 'u') });

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: new RegExp(field, 'u') }));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('RepCampaignCreateDialog, cascade région → département', () => {
  it('une région choisie réduit les départements à ceux de cette région', async () => {
    renderDialog();

    await choose('Région', 'Tambacounda');
    await userEvent.setup().click(trigger('Département'));

    expect(screen.getByRole('option', { name: /Bakel/u })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Pikine/u })).toBeNull();
  });

  it('changer de région efface le département ET l’IEF du périmètre', async () => {
    renderDialog();

    await choose('Département', '^Tambacounda');
    await choose('IEF', 'IEF Tambacounda');
    await choose('Région', 'Dakar');

    expect(trigger('Département').textContent).toContain('Tous les départements');
    expect(trigger('IEF').textContent).toContain('Toutes les IEF');
  });
});

describe('RepCampaignCreateDialog, qualification', () => {
  it('ne filtre sur rien tant que l’utilisateur n’a pas choisi', () => {
    renderDialog();

    const tous = screen.getByRole('radio', {
      name: /^Tous les représentants/u,
    }) as HTMLInputElement;
    expect(tous.checked).toBe(true);
  });

  it('« Non qualifiés » demande l’aperçu sans les acceptations ni les refus', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole('radio', { name: /Non qualifiés/u }));
    await user.type(screen.getByRole('textbox', { name: /Nom de la campagne/u }), 'Qualification');
    await user.click(await screen.findByRole('checkbox', { name: /Awa Ndiaye/u }));
    await user.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));

    await screen.findByText('Représentants non qualifiés');
    expect(preview.mock.calls.at(-1)?.[0]).toMatchObject({
      relationStatuses: ['INCONNU', 'CONTACTE'],
    });
  });

  it('« Qualifiés » ne retient que ceux qui ont accepté', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole('radio', { name: /Qualifiés/u }));
    await user.type(screen.getByRole('textbox', { name: /Nom de la campagne/u }), 'Relance relais');
    await user.click(await screen.findByRole('checkbox', { name: /Awa Ndiaye/u }));
    await user.click(screen.getByRole('button', { name: 'Voir l’aperçu' }));

    await screen.findByText('Représentants non qualifiés');
    expect(preview.mock.calls.at(-1)?.[0]).toMatchObject({ relationStatuses: ['AMBASSADEUR'] });
  });
});
