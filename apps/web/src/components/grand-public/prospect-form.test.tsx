import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GrandPublicProspectForm } from '@/components/grand-public/prospect-form';
import type * as GrandPublicModule from '@/lib/data/grand-public';
import type * as ReferenceModule from '@/lib/data/reference';
import { renderWithQuery } from '@/test/render-query';
import { routerMock } from '@/test/router-mock';
import type { ProspectRow } from '@/lib/types';

const create = vi.hoisted(() => vi.fn());
const canaux = vi.hoisted(() => vi.fn());
const reference = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/grand-public', async () => {
  const actual = await vi.importActual<typeof GrandPublicModule>('@/lib/data/grand-public');
  return { ...actual, createGrandPublicProspect: create, fetchCanauxProvenance: canaux };
});

vi.mock('@/lib/data/reference', async () => {
  const actual = await vi.importActual<typeof ReferenceModule>('@/lib/data/reference');
  return { ...actual, fetchReferenceData: reference };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  create.mockReset();
  canaux.mockReset();
  reference.mockReset();
  canaux.mockResolvedValue([
    { id: 'c-tiktok', code: 'TIKTOK', label: 'TikTok', position: 1, isActive: true, updatedAt: '' },
    {
      id: 'c-vieux',
      code: 'FAX',
      label: 'Fax',
      position: 2,
      isActive: false,
      updatedAt: '',
    },
  ]);
  reference.mockResolvedValue({
    departements: [],
    iefs: [],
    regions: [],
    commerciaux: [],
    representants: [],
    professions: [
      {
        id: 'pro-chauffeur',
        code: 'CHAUFFEUR',
        label: 'Chauffeur',
        isTeaching: false,
        position: 1,
        isActive: true,
        updatedAt: '',
      },
    ],
    incomeBands: [],
    offers: [],
    banques: [
      { id: 'bnq-cbao', name: 'CBAO Sénégal', shortName: 'CBAO', isActive: true, sortOrder: 1 },
    ],
    syndicats: [{ id: 'snd-saes', name: 'SAES', sigle: 'SAES', isActive: true, sortOrder: 1 }],
    employeurs: [
      {
        id: 'emp-sante',
        code: 'MIN_SANTE',
        label: 'Ministère de la Santé',
        type: 'MINISTERE',
        position: 1,
        isActive: true,
        updatedAt: '',
      },
      {
        id: 'emp-sonatel',
        code: 'SONATEL',
        label: 'Sonatel',
        type: 'ENTREPRISE',
        position: 2,
        isActive: true,
        updatedAt: '',
      },
    ],
    pays: [
      {
        id: 'pay-it',
        code: 'IT',
        label: 'Italie',
        indicatif: '39',
        position: 1,
        isActive: true,
        updatedAt: '',
      },
    ],
  });
});

const created = (over: Partial<ProspectRow> = {}): ProspectRow =>
  ({
    id: 'p-9',
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: '+221771234567',
    ...over,
  }) as ProspectRow;

function mount() {
  return renderWithQuery(<GrandPublicProspectForm />);
}

async function fillIdentity(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Prénom/u), 'Moussa');
  await user.type(screen.getByLabelText(/^Nom/u), 'Fall');
  await user.type(screen.getByLabelText(/Téléphone/u), '77 123 45 67');
}

async function choose(field: string, option: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: new RegExp(field, 'u') }));
  await user.click(await screen.findByRole('option', { name: new RegExp(option, 'u') }));
}

describe('ce que la saisie exige', () => {
  it('enregistre une fiche qui n’a que le nom, le prénom et le téléphone', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
      });
    });
  });

  it('ne réclame ni banque, ni syndicat, ni canal, ni durée, ni profession', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    expect(await screen.findByText('Le prénom est obligatoire.')).toBeTruthy();
    expect(screen.getByText('Le nom est obligatoire.')).toBeTruthy();
    expect(screen.getByText('Le numéro est obligatoire.')).toBeTruthy();
    expect(screen.queryByText(/Choisissez une banque/u)).toBeNull();
    expect(screen.queryByText(/Choisissez un syndicat/u)).toBeNull();
    expect(screen.queryByText(/Choisissez un canal/u)).toBeNull();
  });

  it('refuse un numéro qui n’a pas neuf chiffres', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await user.type(screen.getByLabelText(/Prénom/u), 'Moussa');
    await user.type(screen.getByLabelText(/^Nom/u), 'Fall');
    await user.type(screen.getByLabelText(/Téléphone/u), '77 123');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    expect(await screen.findByText('Numéro invalide pour le pays choisi.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('les champs facultatifs', () => {
  it('adapte les renseignements à la situation choisie', async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Informel' }));

    expect(screen.getByRole('combobox', { name: 'Activité' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /Banque de domiciliation/u })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Syndicat' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Fonctionnaire' }));

    expect(screen.getByRole('combobox', { name: /Banque de domiciliation/u })).toBeTruthy();
  });

  it('joint ceux qui ont été renseignés, et eux seuls', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await choose('Profession', 'Chauffeur');
    await user.click(screen.getByRole('button', { name: 'Secteur privé' }));
    await choose('Banque de domiciliation', 'CBAO');
    await choose('Canal de provenance', 'TikTok');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        professionId: 'pro-chauffeur',
        type: 'SECTEUR_PRIVE',
        banqueId: 'bnq-cbao',
        canalProvenanceId: 'c-tiktok',
      });
    });
  });

  it('n’offre pas un canal retiré du référentiel', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await user.click(screen.getByRole('combobox', { name: /Canal de provenance/u }));

    expect(await screen.findByRole('option', { name: /TikTok/u })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Fax/u })).toBeNull();
  });
});

describe('les questions propres à chaque situation', () => {
  it('demande au fonctionnaire son ministère, sa banque et son ancienneté, sans les exiger', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Fonctionnaire' }));

    expect(screen.getByRole('combobox', { name: /Ministère ou structure/u })).toBeTruthy();
    expect(screen.getByLabelText(/Ancienneté/u)).toBeTruthy();
    expect(screen.queryByLabelText(/Lieu d’activité/u)).toBeNull();
    expect(screen.queryByLabelText(/Type de contrat/u)).toBeNull();

    await choose('Ministère ou structure', 'Ministère de la Santé');
    await user.type(screen.getByLabelText(/Ancienneté/u), '30');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        type: 'FONCTIONNAIRE',
        employeurId: 'emp-sante',
        ancienneteMois: 30,
      });
    });
  });

  it('propose au privé son entreprise et son type de contrat', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Secteur privé' }));

    expect(screen.getByRole('combobox', { name: /^Employeur/u })).toBeTruthy();
    await choose('Employeur', 'Sonatel');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        type: 'SECTEUR_PRIVE',
        employeurId: 'emp-sonatel',
      });
    });
  });

  it('retient l’employeur tapé à la main quand il n’est pas dans la liste', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Secteur privé' }));
    await user.click(screen.getByRole('combobox', { name: /^Employeur/u }));
    await user.type(screen.getByPlaceholderText('Chercher…'), 'Garage Diop');
    await user.click(await screen.findByRole('option', { name: /Créer « Garage Diop »/u }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        type: 'SECTEUR_PRIVE',
        employeur: 'Garage Diop',
      });
    });
  });

  it('demande à l’informel son lieu et son épargne, jamais sa banque', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Informel' }));

    expect(screen.getByRole('combobox', { name: 'Activité' })).toBeTruthy();
    expect(screen.getByLabelText(/Lieu d’activité/u)).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /Banque/u })).toBeNull();

    await user.type(screen.getByLabelText(/Lieu d’activité/u), 'Marché Sandaga');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        type: 'INFORMEL',
        lieuActivite: 'Marché Sandaga',
      });
    });
  });

  it('demande à la diaspora son pays, sa ville, son WhatsApp et son relais', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Diaspora' }));

    await choose('Pays de résidence', 'Italie');
    await user.type(screen.getByLabelText(/Ville de résidence/u), 'Turin');
    await user.type(screen.getByLabelText(/^WhatsApp/u), '3331234567');
    await user.type(screen.getByLabelText(/Personne relais/u), 'Awa Fall');
    await user.type(screen.getByLabelText(/Téléphone du relais/u), '77 555 44 33');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        // Le pays de résidence a repris l'indicatif du numéro principal.
        phone: '+39771234567',
        type: 'DIASPORA',
        paysResidenceId: 'pay-it',
        villeResidence: 'Turin',
        whatsappE164: '+393331234567',
        relaisNom: 'Awa Fall',
        relaisPhoneE164: '+221775554433',
      });
    });
  });

  it('vide ce que la situation quittée demandait, et rien d’autre', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Informel' }));
    await user.type(screen.getByLabelText(/Lieu d’activité/u), 'Marché Sandaga');
    await user.click(screen.getByRole('button', { name: 'Fonctionnaire' }));
    await choose('Banque de domiciliation', 'CBAO');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        type: 'FONCTIONNAIRE',
        banqueId: 'bnq-cbao',
      });
    });
  });

  it('n’exige pas la banque d’un fonctionnaire', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Fonctionnaire' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        prenom: 'Moussa',
        nom: 'Fall',
        phone: '+221771234567',
        type: 'FONCTIONNAIRE',
      });
    });
    expect(screen.queryByText(/Choisissez la banque/u)).toBeNull();
  });
});

describe('la rafale', () => {
  it('vide l’identité et CONSERVE le canal', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await choose('Canal de provenance', 'TikTok');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>(/Prénom/u).value).toBe('');
    });
    expect(screen.getByLabelText<HTMLInputElement>(/Téléphone/u).value).toBe('');
    expect(screen.getByRole('combobox', { name: /Canal de provenance/u }).textContent).toContain(
      'TikTok',
    );
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('ouvre la fiche créée sur « Enregistrer et ouvrir la fiche »', async () => {
    const user = userEvent.setup();
    create.mockResolvedValue(created());
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et ouvrir la fiche' }));

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith('/grand-public/p-9');
    });
  });
});

describe('le numéro déjà pris', () => {
  it('relâche le bouton et nomme la fiche existante', async () => {
    const { ApiError } = await import('@crm/api-client/query');
    const user = userEvent.setup();
    create.mockRejectedValue(
      new ApiError(
        {
          statusCode: 409,
          code: 'PROSPECT_PHONE_CONFLICT',
          message: 'Déjà pris.',
          existing: {
            id: 'p-old',
            nom: 'Ndiaye',
            prenom: 'Fatou',
            representantId: null,
            representantName: null,
            ownedByCommercialId: 'com-1',
            ownedByCommercialName: 'Alice Diop',
            createdAt: '2026-07-14T09:30:00.000Z',
          },
        },
        { status: 409 } as Response,
      ),
    );
    mount();
    await screen.findByRole('combobox', { name: /Canal de provenance/u });

    await fillIdentity();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et suivant' }));

    expect(await screen.findByText(/Ce numéro est déjà celui de Fatou Ndiaye/u)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Enregistrer et suivant' }).hasAttribute('disabled'),
    ).toBe(false);
  });
});
