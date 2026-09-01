import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import type * as ReferenceModule from '@/lib/data/reference';
import type * as RepresentantsModule from '@/lib/data/representants';
import type { RepresentantRow } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';

const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

const updateRepresentant = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/representants', async () => {
  const actual = await vi.importActual<typeof RepresentantsModule>('@/lib/data/representants');
  return {
    ...actual,
    updateRepresentant: (id: string, patch: unknown) => updateRepresentant(id, patch) as unknown,
    lookupRepresentantByPhone: () =>
      Promise.resolve({
        found: false,
        phoneE164: '+221771234567',
        representant: null,
        ownedByCommercialName: null,
        ownedByCommercialId: null,
      }),
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const departement = (id: string, name: string, regionId: string, regionName: string) => ({
  id,
  code: id,
  name,
  regionId,
  regionName,
  isActive: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const FICHE = {
  id: 'rep-1',
  fullName: 'Ndeye Fall',
  phoneE164: '+221771234567',
  departementId: 'd-tamba',
  departementName: 'Tambacounda',
  iefId: 'i-tamba',
  iefName: 'IEF Tambacounda',
  notes: null,
  relationStatus: 'CONTACTE',
  // Le contrat rend TOUJOURS ces quatre champs, `whatsappStatus` n'etant pas
  // nullable: une fiche de test qui les omet ne represente aucune reponse
  // reelle du serveur.
  whatsappStatus: 'NON_DEMANDE',
  whatsappE164: null,
  whatsappNumber: null,
  profession: null,
  prenom: null,
  etablissement: null,
  syndicat: null,
  connaitUES: null,
  contacte: null,
} as RepresentantRow;

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
    commerciaux: [],
    representants: [],
  });
});

const trigger = (field: string): HTMLElement =>
  screen.getByRole('combobox', { name: new RegExp(field, 'u') });

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(trigger(field));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('RepresentantFormDialog, cascade région → département', () => {
  it('une fiche enregistrée sans région affiche celle de son département', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Région').textContent).toContain('Tambacounda');
    });

    await userEvent.setup().click(trigger('Département'));
    expect(screen.queryByRole('option', { name: /Pikine/u })).toBeNull();
  });

  it('changer de région vide le département ET l’IEF de la fiche', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Région').textContent).toContain('Tambacounda');
    });

    await choose('Région', 'Dakar');

    expect(trigger('Département').textContent).toContain('Choisir un département');
    expect(trigger('IEF').textContent).toContain('Aucune');
  });
});

describe('RepresentantFormDialog, état de la relation', () => {
  beforeEach(() => {
    updateRepresentant.mockReset();
    updateRepresentant.mockResolvedValue({ ...FICHE, relationStatus: 'AMBASSADEUR' });
  });

  it('n’envoie AUCUN statut quand l’utilisateur n’y a pas touché', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Région').textContent).toContain('Tambacounda');
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).not.toHaveProperty('relationStatus');
  });

  it('envoie le statut dès qu’il change', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Relation').textContent).toContain('Contacté');
    });
    await choose('Relation', 'A accepté');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).toMatchObject({
      relationStatus: 'AMBASSADEUR',
    });
  });

  it('ne demande le motif que sur une bascule vers le refus', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Relation').textContent).toContain('Contacté');
    });
    expect(screen.queryByLabelText('Motif du refus')).toBeNull();

    await choose('Relation', 'A accepté');
    expect(screen.queryByLabelText('Motif du refus')).toBeNull();

    await choose('Relation', 'Refus');
    expect(screen.getByLabelText('Motif du refus')).toBeTruthy();
  });

  it('ne redemande pas le motif d’un refus déjà posé', async () => {
    renderWithQuery(
      <RepresentantFormDialog
        open
        onOpenChange={vi.fn()}
        representant={{ ...FICHE, relationStatus: 'REFUS' }}
      />,
    );

    await waitFor(() => {
      expect(trigger('Relation').textContent).toContain('Refus');
    });
    expect(screen.queryByLabelText('Motif du refus')).toBeNull();
  });

  it('envoie le motif saisi avec la bascule', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Relation').textContent).toContain('Contacté');
    });
    await choose('Relation', 'Refus');
    await user.type(screen.getByLabelText('Motif du refus'), 'Deja engage ailleurs');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).toMatchObject({
      relationStatus: 'REFUS',
      relationReason: 'Deja engage ailleurs',
    });
  });

  it('enregistre le refus sans motif : le champ ne bloque rien', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('Relation').textContent).toContain('Contacté');
    });
    await choose('Relation', 'Refus');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).toMatchObject({ relationStatus: 'REFUS' });
    expect(updateRepresentant.mock.calls[0]?.[1]).not.toHaveProperty('relationReason');
  });

  it('ne propose pas d’état à la création : une fiche neuve n’a pas d’histoire', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Créer la fiche' })).toBeTruthy();
    });
    expect(screen.queryByRole('combobox', { name: /Relation/u })).toBeNull();
  });
});

describe('RepresentantFormDialog, correction à froid du script', () => {
  beforeEach(() => {
    updateRepresentant.mockReset();
    updateRepresentant.mockResolvedValue(FICHE);
  });

  it('affiche « Non demandé » plutôt qu’un WhatsApp vide', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('WhatsApp').textContent).toContain('Non demandé');
    });
    expect(screen.queryByLabelText('Numéro WhatsApp')).toBeNull();
  });

  it('n’ouvre le champ du numéro que sur « un autre numéro »', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('WhatsApp').textContent).toContain('Non demandé');
    });

    await choose('WhatsApp', 'Le même que son téléphone');
    expect(screen.queryByLabelText('Numéro WhatsApp')).toBeNull();

    await choose('WhatsApp', 'Un autre numéro');
    expect(screen.getByLabelText('Numéro WhatsApp')).toBeTruthy();
  });

  it('« le même que son téléphone » n’écrit aucun numéro', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('WhatsApp').textContent).toContain('Non demandé');
    });
    await choose('WhatsApp', 'Le même que son téléphone');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).toMatchObject({
      whatsappStatus: 'MEME_NUMERO',
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).not.toHaveProperty('whatsappE164');
  });

  it('envoie le numéro distinct avec son statut', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('WhatsApp').textContent).toContain('Non demandé');
    });
    await choose('WhatsApp', 'Un autre numéro');
    await user.type(screen.getByLabelText('Numéro WhatsApp'), '77 987 65 43');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).toMatchObject({
      whatsappStatus: 'AUTRE_NUMERO',
      whatsappE164: '77 987 65 43',
    });
  });

  it('n’envoie rien sur les champs du script quand ils n’ont pas bougé', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(trigger('WhatsApp').textContent).toContain('Non demandé');
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).not.toHaveProperty('whatsappStatus');
    expect(updateRepresentant.mock.calls[0]?.[1]).not.toHaveProperty('profession');
  });

  it('envoie la profession corrigée', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Profession')).toBeTruthy();
    });
    await user.type(screen.getByLabelText('Profession'), 'Proviseur');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateRepresentant).toHaveBeenCalled();
    });
    expect(updateRepresentant.mock.calls[0]?.[1]).toMatchObject({ profession: 'Proviseur' });
  });

  it('ne demande ni WhatsApp ni profession à la création', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={null} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Créer la fiche' })).toBeTruthy();
    });
    expect(screen.queryByRole('combobox', { name: /WhatsApp/u })).toBeNull();
    expect(screen.queryByLabelText('Profession')).toBeNull();
  });
});

/**
 * Ouverte depuis l'écran d'appel, la boîte ne propose que ce que le mobile
 * corrige : la relation et le canal WhatsApp sont ce que l'appel décide.
 */
describe('RepresentantFormDialog, ouverte pendant un appel', () => {
  it('retire la relation, son motif et le WhatsApp', async () => {
    renderWithQuery(
      <RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} pendantAppel />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Nom complet/u)).toBeTruthy();
    });
    expect(screen.queryByRole('combobox', { name: /Relation/u })).toBeNull();
    expect(screen.queryByLabelText('Motif du refus')).toBeNull();
    expect(screen.queryByRole('combobox', { name: /WhatsApp/u })).toBeNull();
    expect(screen.queryByLabelText('Numéro WhatsApp')).toBeNull();
  });

  it('garde le nom, le téléphone, le lieu, la profession et les notes', async () => {
    renderWithQuery(
      <RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} pendantAppel />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Nom complet/u)).toBeTruthy();
    });
    expect(screen.getByLabelText(/Téléphone/u)).toBeTruthy();
    expect(trigger('Département')).toBeTruthy();
    expect(screen.getByLabelText('Profession')).toBeTruthy();
    expect(screen.getByLabelText('Notes')).toBeTruthy();
  });

  it('laisse la relation à sa place hors de l’appel', async () => {
    renderWithQuery(<RepresentantFormDialog open onOpenChange={vi.fn()} representant={FICHE} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Nom complet/u)).toBeTruthy();
    });
    expect(trigger('Relation')).toBeTruthy();
  });
});
