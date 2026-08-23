import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { setUrl } from '@/test/router-mock';

vi.mock('@/components/stats/teleconseil-panel', () => ({
  TeleconseilPanel: () => <p>volet téléconseil</p>,
}));
vi.mock('@/components/stats/banks-panel', () => ({ BanksPanel: () => <p>volet banques</p> }));
vi.mock('@/components/stats/campaigns-panel', () => ({
  CampaignsPanel: () => <p>volet campagnes</p>,
}));

const { StatisticsView } = await import('@/components/stats/statistics-view');

describe('volets des statistiques', () => {
  it('offre les banques là où les dossiers existent', () => {
    setUrl('/chues/statistiques');
    render(<StatisticsView />);

    expect(screen.getByRole('tab', { name: /Banques/u })).toBeTruthy();
  });

  // `GET /api/v1/bank-cases/analytics` n'accepte aucun filtre de projet :
  // l'onglet montrait les encaissements CHUES sous l'étiquette Grand Public.
  it('ne les offre pas là où elles ne sauraient pas être filtrées', () => {
    setUrl('/grand-public/statistiques');
    render(<StatisticsView showBanks={false} />);

    expect(screen.queryByRole('tab', { name: /Banques/u })).toBeNull();
    expect(screen.getByRole('tab', { name: /Campagnes/u })).toBeTruthy();
  });

  it('et ne les affiche pas non plus quand l’adresse les réclame', () => {
    setUrl('/grand-public/statistiques?volet=banques');
    render(<StatisticsView showBanks={false} />);

    expect(screen.queryByText('volet banques')).toBeNull();
    expect(screen.getByText('volet téléconseil')).toBeTruthy();
  });
});
