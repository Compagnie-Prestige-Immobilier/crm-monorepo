import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/test/render-query';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Les trois écrans de détail doivent offrir une SORTIE sur leur branche d'erreur.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le défaut corrigé : chacun sortait en `return` dès `isError`, donc avant le
 * lien de retour. Un identifiant périmé (signet, lien collé, campagne purgée)
 * donnait un écran sans issue, puisque `QueryErrorState` ne propose pas de
 * rejouer un 404.
 *
 * La régression est facile à réintroduire : il suffit qu'une relecture « range »
 * le `<DetailBackLink>` sous le bloc d'erreur. Ce test la rattrape sur les trois
 * écrans à la fois, et vérifie surtout que chacun pointe vers SA liste : un
 * copier-coller entre les deux détails de campagne renverrait l'un vers la liste
 * de l'autre, ce qu'aucun rendu ne signalerait.
 */

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
    // Une requête qui échoue journalise par défaut ; le bruit masquerait un vrai
    // échec dans la sortie de la suite.
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
