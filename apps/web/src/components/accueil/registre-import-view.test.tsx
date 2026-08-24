import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as VisitesImportModule from '@/lib/data/visites-import';
import { renderWithQuery } from '@/test/render-query';

const createVisitesImportJob = vi.fn();
const fetchVisitesImportJob = vi.fn();
const fetchVisitesImportRevue = vi.fn();
const setVisitesImportSelection = vi.fn();
const applyVisitesImportJob = vi.fn();

vi.mock('@/lib/data/visites-import', async () => {
  const actual = await vi.importActual<typeof VisitesImportModule>('@/lib/data/visites-import');
  return {
    ...actual,
    createVisitesImportJob: (file: unknown) => createVisitesImportJob(file) as unknown,
    fetchVisitesImportJob: (id: unknown) => fetchVisitesImportJob(id) as unknown,
    fetchVisitesImportRevue: (id: unknown, page: unknown, client: unknown, pageSize: unknown) =>
      fetchVisitesImportRevue(id, page, client, pageSize) as unknown,
    setVisitesImportSelection: (id: unknown, ids: unknown, selected: unknown) =>
      setVisitesImportSelection(id, ids, selected) as unknown,
    applyVisitesImportJob: (id: unknown) => applyVisitesImportJob(id) as unknown,
  };
});

vi.mock('@/lib/data/visites', async () => {
  const actual = await vi.importActual('@/lib/data/visites');
  return {
    ...actual,
    fetchVisiteReferentiels: () =>
      Promise.resolve({ entreprises: [], directions: [], destinataires: [], objets: [] }),
  };
});

const { RegistreImportView } = await import('@/components/accueil/registre-import-view');

const NOW = '2026-08-17T09:00:00.000Z';
const HOUR_AHEAD = new Date(Date.now() + 3_600_000).toISOString();

const job = (
  patch: Partial<VisitesImportModule.VisitesImportJob>,
): VisitesImportModule.VisitesImportJob => ({
  id: 'job-1',
  kind: 'VISITES_REGISTRE',
  status: 'succeeded',
  mode: 'DRY_RUN',
  requestedById: 'direction-1',
  fileName: 'registre.xlsx',
  fileBytes: 2048,
  totalRows: 20,
  processedRows: 20,
  createdRows: 1,
  updatedRows: 1,
  skippedRows: 18,
  errorRows: 0,
  report: {
    kind: 'VISITES_REGISTRE',
    mode: 'DRY_RUN',
    totalRows: 20,
    processedRows: 20,
    createdRows: 1,
    updatedRows: 1,
    skippedRows: 18,
    errorRows: 0,
    truncated: false,
    maxReportedErrors: 200,
    errors: [],
  },
  failureCode: null,
  failureMsg: null,
  startedAt: NOW,
  finishedAt: NOW,
  expiresAt: HOUR_AHEAD,
  createdAt: NOW,
  updatedAt: NOW,
  ...patch,
});

const CREATE_CHANGE: VisitesImportModule.VisitesImportChange = {
  id: 'diff-create',
  sheet: 'Registre',
  rowNumber: 34,
  kind: 'CREATE',
  reference: null,
  visiteId: null,
  label: 'AMADOU BA, 12/08 09:15',
  fields: [],
  selected: true,
};

const UPDATE_CHANGE: VisitesImportModule.VisitesImportChange = {
  id: 'diff-update',
  sheet: 'Registre',
  rowNumber: 12,
  kind: 'UPDATE',
  reference: 'REG-12',
  visiteId: 'visite-1',
  label: 'MME LY SEYNABOU, 12/08 14:30',
  fields: [
    {
      field: 'comment',
      label: 'COMMENTAIRES / NOTES',
      before: 'RAS',
      after: 'Reçue par Mme Ndoye',
    },
  ],
  selected: true,
};

const classeur = (): File =>
  new File(['contenu'], 'registre.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

async function deposer(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('Aucun champ de fichier sur l’écran d’import.');
  await userEvent.upload(input, classeur());
}

describe('RegistreImportView', () => {
  beforeEach(() => {
    for (const spy of [
      createVisitesImportJob,
      fetchVisitesImportJob,
      fetchVisitesImportRevue,
      setVisitesImportSelection,
      applyVisitesImportJob,
    ]) {
      spy.mockReset();
    }
    setVisitesImportSelection.mockResolvedValue(undefined);
  });

  it('rend la liste des différences détectées', async () => {
    const simulated = job({});
    createVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportRevue.mockResolvedValue({
      items: [CREATE_CHANGE, UPDATE_CHANGE],
      total: 2,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });

    renderWithQuery(<RegistreImportView />);
    await deposer();

    expect(await screen.findByText('AMADOU BA, 12/08 09:15')).toBeTruthy();
    expect(screen.getByText('MME LY SEYNABOU, 12/08 14:30')).toBeTruthy();
    expect(screen.getByText(/RAS/)).toBeTruthy();
    expect(screen.getByText('ligne 34')).toBeTruthy();
  });

  it('coche ou décoche tout, en un geste', async () => {
    const simulated = job({});
    createVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportRevue.mockResolvedValue({
      items: [CREATE_CHANGE, UPDATE_CHANGE],
      total: 2,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });

    renderWithQuery(<RegistreImportView />);
    await deposer();
    await screen.findByText('AMADOU BA, 12/08 09:15');

    await userEvent.click(screen.getByRole('button', { name: 'Tout décocher' }));

    await waitFor(() => {
      expect(setVisitesImportSelection).toHaveBeenCalledWith(
        'job-1',
        expect.arrayContaining(['diff-create', 'diff-update']),
        false,
      );
    });
    expect(await screen.findByText('Rien à appliquer')).toBeTruthy();

    setVisitesImportSelection.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Tout cocher' }));

    await waitFor(() => {
      expect(setVisitesImportSelection).toHaveBeenCalledWith(
        'job-1',
        expect.arrayContaining(['diff-create', 'diff-update']),
        true,
      );
    });
  });

  it('porte le chiffre sur le bouton d’application', async () => {
    const simulated = job({});
    createVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportRevue.mockResolvedValue({
      items: [CREATE_CHANGE, UPDATE_CHANGE],
      total: 2,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });

    renderWithQuery(<RegistreImportView />);
    await deposer();

    expect(
      await screen.findByRole('button', { name: 'Appliquer 1 correction et 1 création' }),
    ).toBeTruthy();
  });

  it('dit que le classeur est identique au registre, sans le traiter comme un vide', async () => {
    const identical = job({ createdRows: 0, updatedRows: 0, skippedRows: 20 });
    createVisitesImportJob.mockResolvedValue(identical);
    fetchVisitesImportJob.mockResolvedValue(identical);

    renderWithQuery(<RegistreImportView />);
    await deposer();

    expect(
      await screen.findByText('Votre classeur est identique au registre. Rien à appliquer.'),
    ).toBeTruthy();
    expect(fetchVisitesImportRevue).not.toHaveBeenCalled();
  });

  it('affiche les lignes refusées, ligne, colonne et motif', async () => {
    const withErrors = job({
      errorRows: 2,
      report: {
        kind: 'VISITES_REGISTRE',
        mode: 'DRY_RUN',
        totalRows: 20,
        processedRows: 20,
        createdRows: 1,
        updatedRows: 1,
        skippedRows: 16,
        errorRows: 2,
        truncated: false,
        maxReportedErrors: 200,
        errors: [
          {
            rowNumber: 41,
            column: 'N° REGISTRE',
            code: 'REF_UNKNOWN',
            message: 'Registre inconnu.',
          },
        ],
      },
    });
    createVisitesImportJob.mockResolvedValue(withErrors);
    fetchVisitesImportJob.mockResolvedValue(withErrors);
    fetchVisitesImportRevue.mockResolvedValue({
      items: [CREATE_CHANGE, UPDATE_CHANGE],
      total: 2,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });

    renderWithQuery(<RegistreImportView />);
    await deposer();

    const motif = await screen.findByRole('columnheader', { name: 'Motif' });
    const table = motif.closest('table');
    if (table === null) throw new Error('Aucun tableau ne porte la colonne « Motif ».');
    expect(within(table).getByText('41')).toBeTruthy();
    expect(within(table).getByText('Registre inconnu.')).toBeTruthy();
  });

  it('décocher une ligne envoie son identifiant seul, avec `selected: false`', async () => {
    const simulated = job({});
    createVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportRevue.mockResolvedValue({
      items: [CREATE_CHANGE, UPDATE_CHANGE],
      total: 2,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });

    renderWithQuery(<RegistreImportView />);
    await deposer();
    await screen.findByText('AMADOU BA, 12/08 09:15');

    const checkbox = screen
      .getByText('AMADOU BA, 12/08 09:15')
      .closest('label')?.previousElementSibling;
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('Case à cocher introuvable.');
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(setVisitesImportSelection).toHaveBeenCalledWith('job-1', ['diff-create'], false);
    });
  });

  it('ne propose pas d’appliquer quand rien n’est coché', async () => {
    const simulated = job({});
    createVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportJob.mockResolvedValue(simulated);
    fetchVisitesImportRevue.mockResolvedValue({
      items: [CREATE_CHANGE, UPDATE_CHANGE],
      total: 2,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });

    renderWithQuery(<RegistreImportView />);
    await deposer();
    await screen.findByText('AMADOU BA, 12/08 09:15');

    await userEvent.click(screen.getByRole('button', { name: 'Tout décocher' }));

    const bouton = await screen.findByRole('button', { name: 'Rien à appliquer' });
    expect(bouton.hasAttribute('disabled')).toBe(true);
  });
});
