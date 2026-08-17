import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProspectEditDialog } from '@/components/prospects/prospect-edit-dialog';
import type * as ProspectsModule from '@/lib/data/prospects';
import type * as ReferenceModule from '@/lib/data/reference';
import { renderWithQuery } from '@/test/render-query';
import type { ProspectRow } from '@/lib/types';

const changeSegment = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const history = vi.hoisted(() => vi.fn());
const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/prospects', async () => {
  const actual = await vi.importActual<typeof ProspectsModule>('@/lib/data/prospects');
  return {
    ...actual,
    changeProspectSegment: changeSegment,
    updateProspect: update,
    fetchProspectSegmentHistory: history,
  };
});

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

const BANQUES = [
  { id: 'bnq-cbao', name: 'CBAO Sénégal', shortName: 'CBAO', isActive: true, sortOrder: 1 },
  { id: 'bnq-bhs', name: 'Banque de l’Habitat', shortName: 'BHS', isActive: true, sortOrder: 2 },
];
const SYNDICATS = [
  { id: 'snd-chues', name: 'CHUES', sigle: 'CHUES', isActive: true, sortOrder: 1 },
  { id: 'snd-saes', name: 'SAES', sigle: 'SAES', isActive: true, sortOrder: 2 },
];

const prospect = (over: Partial<ProspectRow> = {}): ProspectRow => ({
  id: 'p-1',
  nom: 'Fall',
  prenom: 'Moussa',
  phoneE164: '+221771234567',
  rev: 3,
  statut: 'NOUVEAU',
  banqueId: 'bnq-bhs',
  banqueName: 'Banque de l’Habitat',
  syndicatId: 'snd-saes',
  syndicatSigle: 'SAES',
  representantId: 'rep-1',
  representantName: 'Cheikh Ba',
  representantPhoneE164: '+221770000000',
  departementId: 'dep-1',
  departementName: 'Dakar',
  ownedByCommercialId: 'com-alice',
  ownedByCommercialName: 'Alice Diop',
  segment: 'BDD4',
  phase2Status: 'PENDING',
  enrollmentMethod: null,
  enrollmentCapturedById: null,
  enrollmentCapturedByName: null,
  enrollmentCapturedAt: null,
  lastOutcome: null,
  lastComment: null,
  lastAttemptAt: null,
  origin: null,
  originLabel: null,
  clientCreatedAt: '2026-08-01T09:00:00.000Z',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  deletedAt: null,
  ...over,
});

function mount(over: Partial<ProspectRow> = {}) {
  reference.mockResolvedValue({
    departements: [],
    iefs: [],
    banques: BANQUES,
    syndicats: SYNDICATS,
    regions: [],
    commerciaux: [],
    representants: [{ value: 'rep-1', label: 'Cheikh Ba' }],
    campagnes: [],
  });
  history.mockResolvedValue([]);
  return renderWithQuery(<ProspectEditDialog prospect={prospect(over)} onOpenChange={vi.fn()} />);
}

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: new RegExp(field, 'u') }));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('le segment, avant et après', () => {
  it('écrit le segment COURANT en clair, sans qu’on ait rien touché', async () => {
    mount();

    expect(await screen.findByText(/Segment actuel/u)).toBeTruthy();
    expect(screen.getAllByText(/BDD4 : autre syndicat \/ autre banque/u).length).toBeGreaterThan(0);
  });

  it('ne réclame aucun motif tant qu’aucune clé de segment ne bouge', async () => {
    mount();

    await screen.findByText(/Segment actuel/u);
    expect(screen.queryByLabelText(/Motif de la bascule/u)).toBeNull();
  });

  it('annonce le segment RÉSULTANT avant la confirmation, et réclame un motif', async () => {
    mount();
    await screen.findByText(/Segment actuel/u);

    await choose('Banque', 'CBAO');

    await waitFor(() => {
      expect(screen.getByText(/BDD3 : autre syndicat \/ CBAO/u)).toBeTruthy();
    });
    expect(screen.getByText(/Ce n’est pas une correction de faute de frappe/u)).toBeTruthy();
    expect(screen.getByLabelText(/Motif de la bascule/u)).toBeTruthy();
  });

  it('n’envoie RIEN sans motif : ni la bascule, ni la correction', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText(/Segment actuel/u);

    await choose('Banque', 'CBAO');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(screen.getByText(/Expliquez la bascule/u)).toBeTruthy();
    });
    expect(changeSegment).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('envoie la bascule avec son motif et la révision lue, et rien d’autre', async () => {
    const user = userEvent.setup();
    changeSegment.mockResolvedValue(prospect({ segment: 'BDD3', banqueId: 'bnq-cbao', rev: 4 }));
    mount();
    await screen.findByText(/Segment actuel/u);

    await choose('Banque', 'CBAO');
    await user.type(
      screen.getByLabelText(/Motif de la bascule/u),
      'Salaire domicilié à la CBAO le 12 août.',
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(changeSegment).toHaveBeenCalledWith('p-1', {
        banqueId: 'bnq-cbao',
        reason: 'Salaire domicilié à la CBAO le 12 août.',
        expectedRev: 3,
      });
    });
    expect(update).not.toHaveBeenCalled();
  });
});
