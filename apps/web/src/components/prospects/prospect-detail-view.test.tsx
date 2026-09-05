import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ProspectsModule from '@/lib/data/prospects';
import type { Role } from '@/lib/types';
import { prospectFixture } from '@/test/prospect-fixture';
import { renderWithQuery } from '@/test/render-query';

const fetchProspect = vi.hoisted(() => vi.fn());
const fetchCallAttempts = vi.hoisted(() => vi.fn());
const fetchDeviceCalls = vi.hoisted(() => vi.fn());
const fetchSegmentHistory = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/prospects', async () => {
  const actual = await vi.importActual<typeof ProspectsModule>('@/lib/data/prospects');
  return {
    ...actual,
    fetchProspect: () => fetchProspect() as unknown,
    fetchProspectCallAttempts: () => fetchCallAttempts() as unknown,
    fetchProspectDeviceCalls: () => fetchDeviceCalls() as unknown,
    fetchProspectSegmentHistory: () => fetchSegmentHistory() as unknown,
  };
});

const { ProspectDetailView } = await import('@/components/prospects/prospect-detail-view');

const ADMIN: Role = 'ADMIN';

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
  fetchDeviceCalls.mockResolvedValue([]);
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
        deviceCallType: null,
        deviceCallDurationSeconds: null,
        deviceCallAt: null,
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
    expect(texte).toContain('Téléphone : non confirmé');
    expect(screen.getAllByText('Segment')).toHaveLength(2);
  });

  it('montre la preuve du journal Android quand le téléphone a confirmé l’appel', async () => {
    fetchCallAttempts.mockResolvedValue([
      {
        id: 'att-2',
        outcome: 'UNREACHABLE',
        reasonLabel: null,
        method: null,
        comment: null,
        email: null,
        fonctionnaire: null,
        engagementEnCours: null,
        dureeEtablissementMois: null,
        rendezVousAt: null,
        performedById: 'u-2',
        performedByName: 'Awa Sy',
        deviceCallType: 'sortant',
        deviceCallDurationSeconds: 92,
        deviceCallAt: '2026-03-04T14:02:00.000Z',
        clientCreatedAt: '2026-03-04T14:03:00.000Z',
      },
    ]);
    renderWithQuery(<ProspectDetailView prospectId="p-1" role={ADMIN} />);

    const appels = await screen.findByRole('list', { name: 'Appels' });
    const texte = within(appels).getAllByRole('listitem')[0]?.textContent ?? '';
    expect(texte).toContain('Téléphone : Sortant · 1 min 32 · 14:02');
  });

  // « Mes contacts » ouvre la fiche sur cette ancre. La retirer laisserait le
  // lien valide et l'écran ouvert ailleurs, sans que rien ne le signale.
  it('porte l’ancre « appels » que « Mes contacts » vise', async () => {
    const { container } = renderWithQuery(<ProspectDetailView prospectId="p-1" role={ADMIN} />);

    await screen.findByText('Appels');
    const ancre = container.querySelector('#appels');
    expect(ancre?.textContent).toContain('Appels');
  });

  it('sort les relevés non consignés, et replie ceux qu’une tentative couvre déjà', async () => {
    fetchDeviceCalls.mockResolvedValue([
      {
        id: 'd-1',
        performedById: 'u-2',
        performedByName: 'Awa Sy',
        deviceCallType: 'sortant',
        deviceCallDurationSeconds: 92,
        deviceCallAt: '2026-03-04T14:02:00.000Z',
        detectedAt: '2026-03-04T14:05:00.000Z',
        attemptId: null,
      },
      {
        id: 'd-2',
        performedById: 'u-2',
        performedByName: 'Awa Sy',
        deviceCallType: 'manque',
        deviceCallDurationSeconds: 0,
        deviceCallAt: '2026-03-04T11:30:00.000Z',
        detectedAt: '2026-03-04T11:31:00.000Z',
        attemptId: 'att-9',
      },
    ]);
    renderWithQuery(<ProspectDetailView prospectId="p-1" role={ADMIN} />);

    const releves = await screen.findByRole('list', { name: 'Relevés par le téléphone' });
    const lignes = within(releves).getAllByRole('listitem');
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.textContent).toContain('Non consigné');
    expect(lignes[0]?.textContent).toContain('Sortant · 1 min 32 · 14:02');
    expect(lignes[0]?.textContent).toContain('Awa Sy');
    expect(screen.getByText(/1 appel consigné/u)).toBeTruthy();
  });
});
