import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/test/render-query';

const failing = () => Promise.reject(new Error('404'));

vi.mock('@/lib/data/rep-campaigns', () => ({
  fetchRepCampaign: failing,
  closeRepCampaign: failing,
  repProgrammePdfUrl: () => '/pdf',
  repProgrammePdfFileName: () => 'programme.pdf',
}));

vi.mock('@/lib/data/phase2', () => ({
  fetchCampaign: failing,
  closeCampaign: failing,
  programmePdfUrl: () => '/pdf',
  programmePdfFileName: () => 'programme.pdf',
}));

vi.mock('@/lib/data/bank-cases', () => ({
  fetchBankCase: failing,
  fetchBankStages: failing,
  advanceBankCase: failing,
  rejectBankCase: failing,
  correctBankCase: failing,
  fetchRejectionReasons: failing,
}));

const { RepCampaignDetailView } = await import('@/components/phase2/rep-campaign-detail-view');
const { CampaignDetailView } = await import('@/components/phase2/campaign-detail-view');
const { BankCaseDetailView } = await import('@/components/bank/bank-case-detail-view');

describe('sortie de secours des écrans de détail', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('campagne prospects : le retour vers /campagnes survit à l’erreur', async () => {
    renderWithQuery(<CampaignDetailView campaignId="inconnue" />);

    const back = await screen.findByRole('link', { name: /Toutes les campagnes/ });
    expect(back.getAttribute('href')).toBe('/campagnes');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('campagne représentants : le retour vers /campagnes/representants survit à l’erreur', async () => {
    renderWithQuery(<RepCampaignDetailView campaignId="inconnue" />);

    const back = await screen.findByRole('link', { name: /Toutes les campagnes/ });
    expect(back.getAttribute('href')).toBe('/campagnes/representants');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('dossier bancaire : le retour vers /dossiers survit à l’erreur', async () => {
    renderWithQuery(<BankCaseDetailView caseId="inconnu" role="BANQUE_FINANCE" />);

    const back = await screen.findByRole('link', { name: /Tous les dossiers/ });
    expect(back.getAttribute('href')).toBe('/dossiers');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
