import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ProspectsModule from '@/lib/data/prospects';
import { prospectFixture } from '@/test/prospect-fixture';
import { renderWithQuery } from '@/test/render-query';

const fetchProspect = vi.hoisted(() => vi.fn());
const fetchCallAttempts = vi.hoisted(() => vi.fn());
const fetchSegmentHistory = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/prospects', async () => {
  const actual = await vi.importActual<typeof ProspectsModule>('@/lib/data/prospects');
  return {
    ...actual,
    fetchProspect: () => fetchProspect() as unknown,
    fetchProspectCallAttempts: () => fetchCallAttempts() as unknown,
    fetchProspectSegmentHistory: () => fetchSegmentHistory() as unknown,
  };
});

const { ProspectDetailView } = await import('@/components/prospects/prospect-detail-view');

beforeEach(() => {
  fetchProspect.mockResolvedValue(
    prospectFixture({
      id: 'p-1',
      whatsappE164: '+221779876543',
      profession: 'Enseignant',
      banqueName: 'CBAO',
      syndicatSigle: 'SAES',
      lastCallOutcome: 'CALLBACK',
      lastCallAt: '2026-03-04T09:15:00.000Z',
      callAttemptCount: 3,
    }),
  );
  fetchCallAttempts.mockResolvedValue([]);
  fetchSegmentHistory.mockResolvedValue([]);
});

describe('ProspectDetailView', () => {
  it('montre la fiche telle qu’elle a été saisie, et le compte des tentatives', async () => {
    renderWithQuery(<ProspectDetailView prospectId="p-1" role="SUPERVISEUR" />);

    expect(await screen.findByText('Mamadou Diallo')).toBeTruthy();
    expect(screen.getByText(/77 987 65 43/u)).toBeTruthy();
    expect(screen.getByText('Enseignant')).toBeTruthy();
    expect(screen.getByText('CBAO')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('À rappeler')).toBeTruthy();
    // Le champ « Segment » de la fiche reste ; la carte d'historique, réservée
    // à qui peut migrer un segment, n'est pas là.
    expect(screen.getAllByText('Segment')).toHaveLength(1);
  });

  it('liste les appels avec leur motif, leur auteur et ce qu’ils ont appris', async () => {
    fetchCallAttempts.mockResolvedValue([
      {
        id: 'att-1',
        outcome: 'METHOD_OBTAINED',
        reasonLabel: 'Méthode obtenue',
        method: 'PLATFORM',
        comment: 'Préfère la plateforme',
        email: 'a@b.sn',
        fonctionnaire: true,
        engagementEnCours: false,
        dureeEtablissementMois: 24,
        rendezVousAt: null,
        performedById: 'u-2',
        performedByName: 'Awa Sy',
        clientCreatedAt: '2026-03-04T09:15:00.000Z',
      },
    ]);
    renderWithQuery(<ProspectDetailView prospectId="p-1" role="ADMIN" />);

    const appels = await screen.findByRole('list', { name: 'Appels' });
    const texte = within(appels).getAllByRole('listitem')[0]?.textContent ?? '';
    expect(texte).toContain('Méthode obtenue');
    expect(texte).toContain('Plateforme');
    expect(texte).toContain('Awa Sy');
    expect(texte).toContain('Fonctionnaire : Oui');
    expect(texte).toContain('24 mois');
    expect(texte).toContain('Préfère la plateforme');
    expect(screen.getAllByText('Segment')).toHaveLength(2);
  });
});
