import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignDetailView } from '@/components/phase2/campaign-detail-view';
import type * as Phase2Data from '@/lib/data/phase2';
import { renderWithQuery } from '@/test/render-query';
import type { CampaignAttempt, CampaignDetail } from '@/lib/types';

const fetchCampaign = vi.fn();

vi.mock('@/lib/data/phase2', async (importOriginal) => {
  const actual = await importOriginal<typeof Phase2Data>();
  return {
    ...actual,
    fetchCampaign: (...args: unknown[]) => fetchCampaign(...args) as unknown,
    fetchCallRecording: vi.fn().mockResolvedValue(null),
  };
});

function attempt(over: Partial<CampaignAttempt> = {}): CampaignAttempt {
  return {
    id: 'a-1',
    prospectId: 'p-1',
    shortCode: 'AB12CD',
    phoneE164: '+221771234567',
    outcome: 'METHOD_OBTAINED',
    method: 'APPOINTMENT',
    comment: null,
    email: null,
    fonctionnaire: null,
    engagementEnCours: null,
    dureeEtablissementMois: null,
    rendezVousAt: null,
    performedById: 'u-1',
    performedByName: 'Fatou Sow',
    assignedToId: 'u-1',
    createdAt: '2026-08-16T12:00:00.000Z',
    ...over,
  };
}

function serve(attempts: readonly CampaignAttempt[]): void {
  const detail: CampaignDetail = {
    id: 'c-1',
    name: 'Campagne d’août',
    projet: 'CHUES',
    scope: 'ALL',
    scopeLabel: 'Tous les groupes',
    status: 'ACTIVE',
    offerLabel: null,
    seed: 'graine',
    createdById: 'u-1',
    createdByName: 'Fatou Sow',
    commercialCount: 0,
    spreadDays: 1,
    progress: { total: 1, open: 1, done: 0, cancelled: 0 },
    createdAt: '2026-08-01T09:00:00.000Z',
    closedAt: null,
    perDay: [1],
    commerciaux: [],
    recentAttempts: [...attempts],
  };
  fetchCampaign.mockResolvedValue(detail);
}

beforeEach(() => {
  fetchCampaign.mockReset();
});

async function mount(attempts: readonly CampaignAttempt[]) {
  serve(attempts);
  const view = renderWithQuery(<CampaignDetailView campaignId="c-1" canManage={false} />);
  await screen.findByText('Tentatives récentes');
  return view;
}

describe('tentatives récentes : renseignements de conversion', () => {
  it('nomme la prise de rendez-vous et donne sa date', async () => {
    await mount([attempt({ rendezVousAt: '2026-09-01T10:30:00.000Z' })]);

    expect(screen.getByText('Prise de rendez-vous')).toBeTruthy();
    expect(screen.getByText('Rendez-vous')).toBeTruthy();
    expect(screen.getByText(/01 sept\. 2026/)).toBeTruthy();
  });

  it('écrit Oui ou Non pour les questions posées', async () => {
    await mount([
      attempt({
        email: 'awa@example.sn',
        fonctionnaire: true,
        engagementEnCours: false,
        dureeEtablissementMois: 36,
      }),
    ]);

    expect(screen.getByText('awa@example.sn')).toBeTruthy();
    expect(screen.getByText('Fonctionnaire').nextElementSibling?.textContent).toBe('Oui');
    expect(screen.getByText('Engagement en cours').nextElementSibling?.textContent).toBe('Non');
    expect(screen.getByText('36 mois')).toBeTruthy();
  });

  it('n’affiche aucune ligne pour une question non posée', async () => {
    await mount([attempt()]);

    for (const label of ['Rendez-vous', 'E-mail', 'Fonctionnaire', 'Engagement en cours']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
});
