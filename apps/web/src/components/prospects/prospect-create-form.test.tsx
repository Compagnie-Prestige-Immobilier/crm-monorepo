import { ApiError } from '@crm/api-client/query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProspectCreateForm } from '@/components/prospects/prospect-create-form';
import type * as ProspectsModule from '@/lib/data/prospects';
import type * as ReferenceModule from '@/lib/data/reference';
import { renderWithQuery } from '@/test/render-query';
import { routerMock } from '@/test/router-mock';
import type { ProspectRow } from '@/lib/types';

const create = vi.hoisted(() => vi.fn());
const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/prospects', async () => {
  const actual = await vi.importActual<typeof ProspectsModule>('@/lib/data/prospects');
  return { ...actual, createProspect: create };
});

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  create.mockReset();
  reference.mockReset();
});

const created = (over: Partial<ProspectRow> = {}): ProspectRow =>
  ({
    id: 'p-1',
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: '+221771234567',
    ...over,
  }) as ProspectRow;

function mount(representantId: string | null = 'rep-1') {
  reference.mockResolvedValue({
    departements: [],
    iefs: [],
    regions: [],
    commerciaux: [],
    campagnes: [],
    banques: [
      { id: 'bnq-cbao', name: 'CBAO Sénégal', shortName: 'CBAO', isActive: true, sortOrder: 1 },
      { id: 'bnq-old', name: 'Banque fermée', shortName: 'BF', isActive: false, sortOrder: 2 },
    ],
    syndicats: [{ id: 'snd-saes', name: 'SAES', sigle: 'SAES', isActive: true, sortOrder: 1 }],
    representants: [{ value: 'rep-1', label: 'Cheikh Ba' }],
  });
  return renderWithQuery(<ProspectCreateForm representantId={representantId} />);
}

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: new RegExp(field, 'u') }));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

async function fillIdentity(prenom: string, nom: string, phone: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Prénom/u), prenom);
  await user.type(screen.getByLabelText(/^Nom/u), nom);
  await user.type(screen.getByLabelText(/Téléphone/u), phone);
}

async function fillComplete(): Promise<void> {
  await fillIdentity('Moussa', 'Fall', '77 123 45 67');
  await choose('Banque', 'CBAO');
  await choose('Syndicat', 'SAES');
  await screen.findByRole('combobox', { name: /Banque/u });
}

describe('les champs obligatoires', () => {
  it('refuse d’envoyer un formulaire vide et nomme chaque manque', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    expect(await screen.findByText('Le prénom est obligatoire.')).toBeTruthy();
    expect(screen.getByText('Le nom est obligatoire.')).toBeTruthy();
    expect(screen.getByText('Le numéro est obligatoire.')).toBeTruthy();
    expect(screen.getByText('Choisissez une banque.')).toBeTruthy();
    expect(screen.getByText('Choisissez un syndicat.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('refuse un numéro qui n’a pas neuf chiffres', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillIdentity('Moussa', 'Fall', '77 123');
    await choose('Banque', 'CBAO');
    await choose('Syndicat', 'SAES');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    expect(await screen.findByText('Numéro invalide : 9 chiffres attendus.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('réclame un représentant quand l’URL n’en porte aucun', async () => {
    const user = userEvent.setup();
    mount(null);
    await screen.findByRole('combobox', { name: /Représentant/u });

    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    expect(await screen.findByText('Choisissez un représentant.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('n’offre pas une banque retirée du référentiel', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await user.click(screen.getByRole('combobox', { name: /Banque/u }));

    expect(await screen.findByRole('option', { name: /CBAO/u })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Banque fermée/u })).toBeNull();
  });
});

describe('la saisie en rafale', () => {
  it('normalise le numéro et envoie le représentant de l’URL', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillComplete();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        banqueId: 'bnq-cbao',
        syndicatId: 'snd-saes',
        representantId: 'rep-1',
      });
    });
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('vide l’identité et CONSERVE la banque et le syndicat', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillComplete();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    const value = (label: RegExp): string => screen.getByLabelText<HTMLInputElement>(label).value;

    await waitFor(() => {
      expect(value(/Prénom/u)).toBe('');
    });
    expect(value(/^Nom/u)).toBe('');
    expect(value(/Téléphone/u)).toBe('');
    expect(screen.getByRole('combobox', { name: /Banque/u }).textContent).toContain('CBAO');
    expect(screen.getByRole('combobox', { name: /Syndicat/u }).textContent).toContain('SAES');
    expect(screen.getByText(/1 prospect enregistré/u)).toBeTruthy();
  });

  it('enchaîne au clavier avec Ctrl + Entrée', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillComplete();
    await user.click(screen.getByLabelText(/Téléphone/u));
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('quitte l’écran sur « Enregistrer et terminer »', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillComplete();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et terminer' }));

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith('/chues/prospects?search=%2B221771234567');
    });
  });
});

describe('le numéro déjà pris', () => {
  function conflict(): ApiError {
    return new ApiError(
      {
        statusCode: 409,
        code: 'PROSPECT_PHONE_CONFLICT',
        message: 'Ce numéro a déjà été enregistré par Alice Diop.',
        existing: {
          id: 'p-old',
          nom: 'Ndiaye',
          prenom: 'Fatou',
          representantId: 'rep-2',
          representantName: 'Ousmane Sow',
          ownedByCommercialId: 'com-alice',
          ownedByCommercialName: 'Alice Diop',
          createdAt: '2026-07-14T09:30:00.000Z',
        },
      },
      { status: 409 } as Response,
    );
  }

  it('nomme la fiche, son représentant et son téléconseiller', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(conflict());
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillComplete();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    expect(await screen.findByText(/Ce numéro est déjà celui de Fatou Ndiaye/u)).toBeTruthy();
    expect(screen.getByText(/Rattaché à Ousmane Sow/u)).toBeTruthy();
    expect(screen.getByText(/téléconseiller Alice Diop/u)).toBeTruthy();
  });

  it('propose d’ouvrir la fiche existante sur ce numéro', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(conflict());
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillComplete();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    const link = await screen.findByRole('link', { name: 'Ouvrir la fiche existante' });
    expect(link.getAttribute('href')).toBe('/chues/prospects?search=%2B221771234567');
  });

  it('efface le conflit dès que le numéro change', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(conflict());
    mount();
    await screen.findByRole('combobox', { name: /Banque/u });

    await fillComplete();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));
    await screen.findByText(/Ce numéro est déjà celui de Fatou Ndiaye/u);

    await user.type(screen.getByLabelText(/Téléphone/u), '8');

    await waitFor(() => {
      expect(screen.queryByText(/Ce numéro est déjà celui de Fatou Ndiaye/u)).toBeNull();
    });
  });
});
