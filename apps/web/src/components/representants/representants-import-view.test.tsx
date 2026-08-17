import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ImportModule from '@/lib/data/representants-import';
import { renderWithQuery } from '@/test/render-query';

const importRepresentants = vi.fn();

vi.mock('@/lib/data/representants-import', async () => {
  const actual = await vi.importActual<typeof ImportModule>('@/lib/data/representants-import');
  return {
    ...actual,
    importRepresentants: (file: File, dryRun: boolean) =>
      importRepresentants(file, dryRun) as unknown,
  };
});

const { RepresentantsImportView } =
  await import('@/components/representants/representants-import-view');

const DRY_RUN_REPORT = {
  dryRun: true,
  totalRows: 5,
  valid: 2,
  rejected: 2,
  duplicates: 1,
  created: 0,
  errors: [
    {
      line: 4,
      code: 'PHONE_INVALID',
      message: 'Numéro de téléphone invalide.',
      value: '77 12',
    },
    {
      line: 7,
      code: 'DEPARTEMENT_UNKNOWN',
      message: 'Département inconnu.',
      value: 'Dakr',
    },
  ],
  preview: [
    {
      line: 2,
      fullName: 'Ndeye Fall',
      phoneE164: '+221771234567',
      departementName: 'Dakar',
      iefName: 'IEF Dakar Plateau',
      notes: null,
    },
    {
      line: 3,
      fullName: 'Ousmane Sow',
      phoneE164: '+221781234567',
      departementName: 'Thiès',
      iefName: null,
      notes: 'Remis en tournée',
    },
  ],
};

const classeur = (): File =>
  new File(['contenu'], 'representants.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

const deposer = async (): Promise<void> => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('Aucun champ de fichier sur l’écran d’import.');
  await userEvent.upload(input, classeur());
};

describe('RepresentantsImportView', () => {
  beforeEach(() => {
    importRepresentants.mockReset();
    importRepresentants.mockResolvedValue(DRY_RUN_REPORT);
  });

  it('SIMULE d’abord : le premier dépôt n’écrit rien', async () => {
    renderWithQuery(<RepresentantsImportView />);
    await deposer();

    await waitFor(() => {
      expect(importRepresentants).toHaveBeenCalledTimes(1);
    });
    expect(importRepresentants.mock.calls[0]?.[1]).toBe(true);
  });

  it('chiffre les trois populations séparément', async () => {
    renderWithQuery(<RepresentantsImportView />);
    await deposer();

    for (const [label, value] of [
      ['Lignes lues', '5'],
      ['Valides', '2'],
      ['En erreur', '2'],
      ['Doublons', '1'],
    ] as const) {
      const term = await screen.findByText(label);
      expect(term.parentElement?.textContent).toContain(value);
    }
  });

  const tableAvecColonne = async (header: string): Promise<HTMLElement> => {
    const cell = await screen.findByRole('columnheader', { name: header });
    const table = cell.closest('table');
    if (table === null) throw new Error(`Aucun tableau ne porte la colonne « ${header} ».`);
    return table;
  };

  it('rend les lignes rejetées avec leur numéro DANS le classeur et le motif', async () => {
    renderWithQuery(<RepresentantsImportView />);
    await deposer();

    const rejets = await tableAvecColonne('Motif');

    expect(within(rejets).getByText('4')).toBeTruthy();
    expect(within(rejets).getByText('Numéro de téléphone invalide.')).toBeTruthy();
    expect(within(rejets).getByText('7')).toBeTruthy();
    expect(within(rejets).getByText('Département inconnu.')).toBeTruthy();
    expect(within(rejets).getByText('Dakr')).toBeTruthy();
  });

  it('rend l’aperçu des lignes valides SÉPARÉMENT des rejets', async () => {
    renderWithQuery(<RepresentantsImportView />);
    await deposer();

    expect(await screen.findByText('Aperçu des lignes valides')).toBeTruthy();
    const valides = await tableAvecColonne('Représentant');

    expect(within(valides).getByText('Ndeye Fall')).toBeTruthy();
    expect(within(valides).getByText('Ousmane Sow')).toBeTruthy();
    expect(within(valides).queryByText('Dakr')).toBeNull();
    expect(within(valides).queryByText('Département inconnu.')).toBeNull();
  });

  it('n’applique QUE sur un second geste, explicite', async () => {
    renderWithQuery(<RepresentantsImportView />);
    await deposer();

    const apply = await screen.findByRole('button', { name: /Créer 2 représentants/ });
    importRepresentants.mockResolvedValue({ ...DRY_RUN_REPORT, dryRun: false, created: 2 });
    await userEvent.click(apply);

    await waitFor(() => {
      expect(importRepresentants).toHaveBeenCalledTimes(2);
    });
    expect(importRepresentants.mock.calls[1]?.[1]).toBe(false);
  });

  it('ne propose pas d’appliquer un classeur sans aucune ligne valide', async () => {
    importRepresentants.mockResolvedValue({
      ...DRY_RUN_REPORT,
      valid: 0,
      preview: [],
    });
    renderWithQuery(<RepresentantsImportView />);
    await deposer();

    const apply = await screen.findByRole('button', { name: /Créer 0 représentant/ });
    expect(apply.hasAttribute('disabled')).toBe(true);
  });
});
