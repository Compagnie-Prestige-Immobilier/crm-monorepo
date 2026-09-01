import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ProspectsModule from '@/lib/data/prospects';
import type * as RepresentantsModule from '@/lib/data/representants';
import { renderWithQuery } from '@/test/render-query';

const fetchRepresentant = vi.hoisted(() => vi.fn());
const fetchRelationHistory = vi.hoisted(() => vi.fn());
const fetchProspects = vi.hoisted(() => vi.fn());
const fetchComments = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/representants', async () => {
  const actual = await vi.importActual<typeof RepresentantsModule>('@/lib/data/representants');
  return {
    ...actual,
    fetchRepresentant: () => fetchRepresentant() as unknown,
    fetchRepresentantRelationHistory: () => fetchRelationHistory() as unknown,
    fetchRepresentantComments: () => fetchComments() as unknown,
  };
});

vi.mock('@/lib/data/prospects', async () => {
  const actual = await vi.importActual<typeof ProspectsModule>('@/lib/data/prospects');
  return { ...actual, fetchProspects: () => fetchProspects() as unknown };
});

const { RepresentantDetailView } =
  await import('@/components/representants/representant-detail-view');

const FICHE = {
  id: 'rep-1',
  rev: 3,
  fullName: 'Ndeye Fall',
  phoneE164: '+221771234567',
  departementId: 'd-1',
  departementName: 'Tambacounda',
  iefId: null,
  iefName: null,
  createdById: 'u-1',
  createdByName: 'Aminata Diallo',
  prospectCount: 2,
  relationStatus: 'AMBASSADEUR',
  // Le serveur rend TOUJOURS ces quatre champs: `whatsappStatus` n'est pas
  // nullable au contrat. La fiche par defaut reproduit une fiche jamais
  // interrogee, pas une fiche incomplete.
  whatsappStatus: 'NON_DEMANDE',
  whatsappE164: null,
  whatsappNumber: null,
  profession: null,
  prenom: null,
  etablissement: null,
  syndicat: null,
  connaitUES: null,
  contacte: null,
  notes: null,
  clientCreatedAt: '2026-03-01T09:00:00.000Z',
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-04T09:00:00.000Z',
};

const AUTHOR = { id: 'u-1', fullName: 'Aminata Diallo' };

const change = (
  id: string,
  fromStatus: string,
  toStatus: string,
  changedAt: string,
  reason: string | null = null,
) => ({
  id,
  representantId: 'rep-1',
  fromStatus,
  toStatus,
  reason,
  changedById: 'u-1',
  changedByName: 'Aminata Diallo',
  source: 'WEB',
  changedAt,
});

beforeEach(() => {
  fetchRepresentant.mockResolvedValue(FICHE);
  fetchRelationHistory.mockResolvedValue([]);
  fetchProspects.mockResolvedValue({ items: [], total: 0, page: 1, pageCount: 0 });
  fetchComments.mockResolvedValue([]);
});

describe('RepresentantDetailView', () => {
  it('porte le nom et l’état courant de la relation', async () => {
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText('Ndeye Fall')).toBeTruthy();
    expect(screen.getByText('A accepté')).toBeTruthy();
  });

  it('rend la chronologie dans l’ordre servi par l’API, du plus récent au plus ancien', async () => {
    fetchRelationHistory.mockResolvedValue([
      change('c-3', 'CONTACTE', 'AMBASSADEUR', '2026-03-04T09:00:00.000Z'),
      change('c-2', 'INCONNU', 'CONTACTE', '2026-03-02T09:00:00.000Z'),
      change('c-1', 'REFUS', 'INCONNU', '2026-03-01T09:00:00.000Z'),
    ]);
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    const chronologie = await screen.findByRole('list', { name: /Histoire de la relation/u });
    const bascules = within(chronologie)
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(bascules).toHaveLength(3);
    expect(bascules[0]).toContain('A accepté');
    expect(bascules[1]).toContain('Contacté');
    expect(bascules[2]).toContain('Pas encore contacté');
  });

  it('montre le motif quand la bascule en porte un', async () => {
    fetchRelationHistory.mockResolvedValue([
      change('c-1', 'AMBASSADEUR', 'REFUS', '2026-03-04T09:00:00.000Z', 'Ne veut plus être appelé'),
    ]);
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText(/Ne veut plus être appelé/u)).toBeTruthy();
  });

  it('dit quoi faire quand aucune bascule n’a encore été enregistrée', async () => {
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText(/Aucune bascule enregistrée/u)).toBeTruthy();
  });

  it('garde la note de fiche DANS la fiche, hors du fil', async () => {
    fetchRepresentant.mockResolvedValue({ ...FICHE, notes: 'Préfère le samedi matin.' });
    fetchComments.mockResolvedValue([]);
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText('Note de la fiche')).toBeTruthy();
    const note = screen.getByText('Préfère le samedi matin.');
    expect(screen.getByText('Fil de la fiche').contains(note)).toBe(false);
  });

  it('liste les prospects apportés', async () => {
    fetchProspects.mockResolvedValue({
      items: [
        {
          id: 'p-1',
          nom: 'Sow',
          prenom: 'Moussa',
          phoneE164: '+221770000001',
          statut: 'CONVERTI',
          banqueName: 'CBAO',
          syndicatSigle: 'SAES',
          clientCreatedAt: '2026-03-02T09:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText('Moussa Sow')).toBeTruthy();
    expect(screen.getByText('Converti')).toBeTruthy();
  });
});

describe('RepresentantDetailView, ce que l’appel a appris', () => {
  it('dit que le WhatsApp n’a pas été demandé, plutôt que de le laisser vide', async () => {
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText('Non demandé')).toBeTruthy();
    expect(screen.getByText('Non demandée')).toBeTruthy();
  });

  it('montre le numéro WhatsApp joignable quand il diffère du téléphone', async () => {
    fetchRepresentant.mockResolvedValue({
      ...FICHE,
      whatsappStatus: 'AUTRE_NUMERO',
      whatsappE164: '+221779876543',
      whatsappNumber: '+221779876543',
      profession: 'Proviseur',
    });
    renderWithQuery(<RepresentantDetailView representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText('+221779876543')).toBeTruthy();
    expect(screen.getByText('Proviseur')).toBeTruthy();
  });
});
