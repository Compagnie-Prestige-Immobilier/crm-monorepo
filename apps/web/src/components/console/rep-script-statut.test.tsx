import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { outcomeDuStatut, RepScript } from '@/components/console/rep-script';
import type * as ConsoleData from '@/lib/data/console';
import type * as ReferenceData from '@/lib/data/reference';
import type * as RepresentantsData from '@/lib/data/representants';
import type { ScriptedRepresentant } from '@/lib/data/representants';
import type * as StatutsData from '@/lib/data/statuts-qualification';
import type { StatutQualification } from '@/lib/data/statuts-qualification';
import { renderWithQuery } from '@/test/render-query';

const pushRepCallAttempt = vi.fn();
const fetchRepresentants = vi.fn();
const fetchReferenceData = vi.fn();
const fetchStatutsQualification = vi.fn();

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    pushRepCallAttempt: (...args: unknown[]) => pushRepCallAttempt(...args) as unknown,
  };
});

vi.mock('@/lib/data/reference', async (importOriginal) => {
  const actual = await importOriginal<typeof ReferenceData>();
  return { ...actual, fetchReferenceData: (...args: unknown[]) => fetchReferenceData(...args) };
});

vi.mock('@/lib/data/representants', async (importOriginal) => {
  const actual = await importOriginal<typeof RepresentantsData>();
  return { ...actual, fetchRepresentants: (...args: unknown[]) => fetchRepresentants(...args) };
});

vi.mock('@/lib/data/statuts-qualification', async (importOriginal) => {
  const actual = await importOriginal<typeof StatutsData>();
  return { ...actual, fetchStatutsQualification: () => fetchStatutsQualification() as unknown };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function statut(over: Partial<StatutQualification> & { id: string }): StatutQualification {
  return {
    code: 'INTERESSE',
    label: 'Intéressé',
    effect: 'REACHED',
    requiresCallback: false,
    priorite: 'NORMALE',
    isActive: true,
    isSystem: true,
    minPayloadVersion: 6,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

const STATUTS: StatutQualification[] = [
  statut({ id: 's-1' }),
  statut({ id: 's-2', code: 'NON_INTERESSE', label: 'Non intéressé', effect: 'REFUSED' }),
  statut({
    id: 's-3',
    code: 'A_RAPPELER',
    label: 'À rappeler',
    effect: 'SCHEDULE_CALLBACK',
    requiresCallback: true,
  }),
  statut({ id: 's-4', code: 'PAS_DE_REPONSE', label: 'Pas de réponse', effect: 'UNREACHABLE' }),
  statut({ id: 's-5', code: 'FAUX_NUMERO', label: 'Faux numéro', effect: 'WRONG_NUMBER' }),
];

const REPRESENTANT: ScriptedRepresentant = {
  id: 'r-1',
  fullName: 'Aminata Ndiaye',
  phoneE164: '+221771234567',
  notes: null,
  rev: 1,
  departementId: 'd-1',
  departementName: 'Dakar',
  iefId: null,
  iefName: null,
  createdById: 'u-1',
  createdByName: 'Fatou Sow',
  clientCreatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  prospectCount: 0,
  relationStatus: 'INCONNU',
  whatsappStatus: 'NON_DEMANDE',
  whatsappE164: null,
  whatsappNumber: null,
  profession: null,
  prenom: null,
  etablissement: null,
  syndicat: null,
  connaitUES: null,
  contacte: null,
  lastCallOutcome: null,
  lastCallAt: null,
  lastCallById: null,
  lastCallByName: null,
  nextCallbackAt: null,
};

async function ouvrirQualification(): Promise<void> {
  renderWithQuery(<RepScript />);
  await userEvent.type(await screen.findByLabelText('Qui avez-vous appelé ?'), 'a');
  await userEvent.click(await screen.findByRole('button', { name: /Aminata Ndiaye/u }));
}

const repondre = async (label: string): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: label }));
};

/** Répond à UNE question, désignée par sa légende, quand plusieurs Oui/Non coexistent. */
const repondreA = async (legende: string, label: string): Promise<void> => {
  const fieldset = screen.getByText(legende).closest('fieldset') as HTMLElement;
  await userEvent.click(within(fieldset).getByRole('button', { name: label }));
};

const choisirStatut = async (label: string): Promise<void> => {
  await userEvent.click(screen.getByRole('combobox', { name: /Statut de qualification/u }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
};

beforeEach(() => {
  pushRepCallAttempt.mockReset();
  pushRepCallAttempt.mockResolvedValue({ status: 'applied', attemptId: 'a-1', suggestion: null });
  fetchRepresentants.mockReset();
  fetchRepresentants.mockResolvedValue({
    items: [REPRESENTANT],
    total: 1,
    page: 1,
    pageSize: 20,
    pageCount: 1,
  });
  fetchReferenceData.mockReset();
  fetchReferenceData.mockResolvedValue({ syndicats: [] });
  fetchStatutsQualification.mockReset();
  fetchStatutsQualification.mockResolvedValue(STATUTS);
});

describe('l’issue se dérive de l’effet du statut', () => {
  it('couvre les cinq effets du référentiel', () => {
    expect(outcomeDuStatut('REACHED')).toBe('REACHED');
    expect(outcomeDuStatut('REFUSED')).toBe('REFUSED');
    expect(outcomeDuStatut('SCHEDULE_CALLBACK')).toBe('CALLBACK');
    expect(outcomeDuStatut('UNREACHABLE')).toBe('UNREACHABLE');
    expect(outcomeDuStatut('WRONG_NUMBER')).toBe('WRONG_NUMBER');
  });
});

describe('le sélecteur de statut', () => {
  it('n’apparaît qu’une fois le résultat choisi', async () => {
    await ouvrirQualification();

    expect(screen.queryByRole('combobox', { name: /Statut de qualification/u })).toBeNull();

    await repondre('Injoignable');

    expect(await screen.findByRole('combobox', { name: /Statut de qualification/u })).toBeTruthy();
  });

  it('ne propose que les statuts de la branche jointe', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await userEvent.click(
      await screen.findByRole('combobox', { name: /Statut de qualification/u }),
    );

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Intéressé',
      'Non intéressé',
      'À rappeler',
    ]);
  });

  it('ne propose que les statuts de la branche non aboutie', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await userEvent.click(
      await screen.findByRole('combobox', { name: /Statut de qualification/u }),
    );

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Pas de réponse',
      'Faux numéro',
    ]);
  });
});

describe('ce que le déclencheur affiche', () => {
  it('montre le LIBELLÉ du statut retenu, jamais son identifiant', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Intéressé');

    const declencheur = screen.getByRole('combobox', { name: /Statut de qualification/u });

    expect(declencheur.textContent).toContain('Intéressé');
    // L'identifiant est un UUID : le lire à l'écran ne dit rien à personne.
    expect(declencheur.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/u);
  });
});

describe('la date de rappel suit le statut, pas le résultat', () => {
  it('n’est exigée que par le statut qui la réclame', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('Intéressé');

    expect(screen.queryByText('Quand rappeler ?')).toBeNull();

    await choisirStatut('À rappeler');

    expect(screen.getByText('Quand rappeler ?')).toBeTruthy();
  });

  it('retient l’enregistrement tant que la date manque, et le dit', async () => {
    await ouvrirQualification();
    await repondre('Joignable');
    await choisirStatut('À rappeler');
    await repondreA('L’établissement de la fiche est-il confirmé ?', 'Oui');
    await repondreA('A-t-il déjà été contacté ?', 'Oui');
    await repondreA('Connaît-il l’UES ?', 'Oui');
    await repondreA('Est-il représentant CPI CHUES ?', 'Non');

    expect(screen.getByText('Choisissez quand rappeler')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  it('ne s’ouvre sur aucun statut d’appel non abouti', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Faux numéro');

    expect(screen.queryByText('Quand rappeler ?')).toBeNull();
    expect(screen.queryByText(/Le rappeler plus tard/u)).toBeNull();
  });
});

describe('l’enregistrement attend le statut', () => {
  it('bloque et le dit tant qu’aucun statut n’est retenu', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');

    expect(await screen.findByText('Choisissez un statut de qualification')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuer' }).hasAttribute('disabled')).toBe(true);
  });

  it('envoie le statut retenu et l’issue qu’il dérive', async () => {
    await ouvrirQualification();
    await repondre('Injoignable');
    await choisirStatut('Faux numéro');
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(pushRepCallAttempt.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'WRONG_NUMBER',
      statutQualificationId: 's-5',
    });
  });
});
