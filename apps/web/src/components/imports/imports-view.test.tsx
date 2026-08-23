import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ImportsModule from '@/lib/data/imports';
import { renderWithQuery } from '@/test/render-query';

const createImportJob = vi.fn();
const fetchImportJob = vi.fn();
const fetchImportJobs = vi.fn();
const applyImportJob = vi.fn();

vi.mock('@/lib/data/imports', async () => {
  const actual = await vi.importActual<typeof ImportsModule>('@/lib/data/imports');
  return {
    ...actual,
    createImportJob: (kind: unknown, file: unknown) => createImportJob(kind, file) as unknown,
    fetchImportJob: (id: unknown) => fetchImportJob(id) as unknown,
    fetchImportJobs: (page: unknown) => fetchImportJobs(page) as unknown,
    applyImportJob: (id: unknown) => applyImportJob(id) as unknown,
  };
});

const { ImportsView } = await import('@/components/imports/imports-view');

const HOUR_AHEAD = new Date(Date.now() + 3_600_000).toISOString();
const NOW = '2026-08-17T09:00:00.000Z';

const SIMULATED_REPORT: NonNullable<ImportsModule.ImportJob['report']> = {
  kind: 'PROSPECTS',
  mode: 'DRY_RUN',
  totalRows: 900,
  processedRows: 900,
  createdRows: 800,
  skippedRows: 180,
  errorRows: 20,
  truncated: false,
  maxReportedErrors: 200,
  errors: [
    {
      rowNumber: 12,
      column: 'Banque',
      code: 'BANQUE_UNKNOWN',
      message: 'Banque inconnue : « CBAO Attijari ».',
    },
    {
      rowNumber: 41,
      column: 'Téléphone',
      code: 'PHONE_INVALID',
      message: 'Numéro de téléphone inexploitable.',
    },
  ],
};

/** Une simulation aboutie : 800 à créer, 180 déjà en base, 20 refusées. */
const SIMULATED: ImportsModule.ImportJob = {
  id: 'job-1',
  kind: 'PROSPECTS',
  status: 'succeeded',
  mode: 'DRY_RUN',
  requestedById: 'admin-1',
  fileName: 'prospects.xlsx',
  fileBytes: 4096,
  totalRows: 900,
  processedRows: 900,
  createdRows: 800,
  skippedRows: 180,
  errorRows: 20,
  report: SIMULATED_REPORT,
  failureCode: null,
  failureMsg: null,
  startedAt: NOW,
  finishedAt: NOW,
  expiresAt: HOUR_AHEAD,
  createdAt: NOW,
  updatedAt: NOW,
};

const job = (patch: Partial<ImportsModule.ImportJob>): ImportsModule.ImportJob => ({
  ...SIMULATED,
  ...patch,
});

const classeur = (): File =>
  new File(['contenu'], 'prospects.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

/** Le dépôt est le seul chemin qui suit le vrai parcours : il lance la simulation. */
async function deposer(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('Aucun champ de fichier sur l’écran d’import.');
  await userEvent.upload(input, classeur());
}

/** Le chiffre d'un compteur, avec la classe de teinte qui le porte. */
function figure(label: string): HTMLElement {
  const term = screen.getByText(label);
  const value = term.parentElement?.querySelector('dd > span');
  if (!(value instanceof HTMLElement)) throw new Error(`Compteur « ${label} » introuvable.`);
  return value;
}

describe('ImportsView', () => {
  beforeEach(() => {
    // `restoreMocks` ne remet pas à zéro les `vi.fn()` de portée module.
    for (const spy of [createImportJob, fetchImportJob, fetchImportJobs, applyImportJob]) {
      spy.mockReset();
    }
    fetchImportJobs.mockResolvedValue({ items: [], total: 0, page: 1, pageCount: 1 });
    createImportJob.mockResolvedValue(SIMULATED);
    fetchImportJob.mockResolvedValue(SIMULATED);
    applyImportJob.mockResolvedValue(job({ status: 'queued', mode: 'APPLY' }));
  });

  it('affiche l’avancement en lignes, jamais en pourcentage', async () => {
    const running = job({ status: 'running', processedRows: 250, totalRows: 900, report: null });
    createImportJob.mockResolvedValue(running);
    fetchImportJob.mockResolvedValue(running);

    renderWithQuery(<ImportsView />);
    await deposer();

    expect(await screen.findByText(/250 \/ 900 lignes traitées/)).toBeTruthy();
    // Une barre pilotée par une minuterie afficherait un pourcentage inventé.
    expect(document.body.textContent).not.toContain('%');
  });

  it('dit « Lecture du fichier… » tant que le total est inconnu', async () => {
    const reading = job({ status: 'running', processedRows: 0, totalRows: null, report: null });
    createImportJob.mockResolvedValue(reading);
    fetchImportJob.mockResolvedValue(reading);

    renderWithQuery(<ImportsView />);
    await deposer();

    expect(await screen.findByText(/Lecture du fichier/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('0 %');
    expect(screen.queryByText(/lignes traitées/)).toBeNull();
  });

  it('ne présente pas les lignes ignorées comme des erreurs', async () => {
    renderWithQuery(<ImportsView />);
    await deposer();

    await screen.findByText('Ignorées');

    const ignorees = figure('Ignorées');
    const erreurs = figure('Erreurs');

    expect(ignorees.textContent).toBe('180');
    expect(erreurs.textContent).toBe('20');
    // La teinte porte le sens : 180 doublons attendus ne sont pas 180 échecs.
    expect(ignorees.className).toContain('text-muted-foreground');
    expect(ignorees.className).not.toContain('text-destructive');
    expect(erreurs.className).toContain('text-destructive');

    expect(screen.getByText(/Ce n’est pas une erreur/)).toBeTruthy();
  });

  it('ne compte que les lignes refusées dans le tableau des refus', async () => {
    renderWithQuery(<ImportsView />);
    await deposer();

    const motif = await screen.findByRole('columnheader', { name: 'Motif' });
    const table = motif.closest('table');
    if (table === null) throw new Error('Aucun tableau ne porte la colonne « Motif ».');

    expect(within(table).getByText('12')).toBeTruthy();
    expect(within(table).getByText(/Banque inconnue/)).toBeTruthy();
    // Les 180 ignorées n'ont aucune ligne : elles n'ont rien à corriger.
    expect(within(table).queryByText('180')).toBeNull();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('n’offre pas d’appliquer avant une simulation aboutie', async () => {
    const running = job({ status: 'running', processedRows: 250, report: null, createdRows: 0 });
    createImportJob.mockResolvedValue(running);
    fetchImportJob.mockResolvedValue(running);

    renderWithQuery(<ImportsView />);
    await deposer();

    await screen.findByText(/250 \/ 900 lignes traitées/);
    expect(screen.queryByRole('button', { name: /^Créer/ })).toBeNull();
  });

  it('nomme le nombre de fiches qu’il va créer, une fois la simulation aboutie', async () => {
    renderWithQuery(<ImportsView />);
    await deposer();

    expect(await screen.findByRole('button', { name: 'Créer 800 prospects' })).toBeTruthy();
  });

  it('n’applique rien au premier clic : il demande confirmation', async () => {
    renderWithQuery(<ImportsView />);
    await deposer();

    await userEvent.click(await screen.findByRole('button', { name: 'Créer 800 prospects' }));

    expect(applyImportJob).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Créer 800 prospects');
    expect(dialog.textContent).toMatch(/écrit en base/u);
  });

  it('applique une fois la confirmation validée', async () => {
    renderWithQuery(<ImportsView />);
    await deposer();

    await userEvent.click(await screen.findByRole('button', { name: 'Créer 800 prospects' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer 800 prospects' }));

    await waitFor(() => {
      expect(applyImportJob).toHaveBeenCalledWith('job-1');
    });
  });

  it('dit que la liste d’erreurs est tronquée, et sur combien', async () => {
    const truncated = job({
      errorRows: 940,
      report: {
        ...SIMULATED_REPORT,
        errorRows: 940,
        truncated: true,
        maxReportedErrors: 200,
      },
    });
    createImportJob.mockResolvedValue(truncated);
    fetchImportJob.mockResolvedValue(truncated);

    renderWithQuery(<ImportsView />);
    await deposer();

    expect(await screen.findByText(/200 premières erreurs sur 940/)).toBeTruthy();
  });

  it('annonce le nombre exact de refus quand la liste est complète', async () => {
    renderWithQuery(<ImportsView />);
    await deposer();

    expect(await screen.findByText(/20 lignes refusées/)).toBeTruthy();
    expect(screen.queryByText(/premières erreurs sur/)).toBeNull();
  });

  it('dépose toujours en simulation : la création part sans mode', async () => {
    renderWithQuery(<ImportsView />);
    await deposer();

    await waitFor(() => {
      expect(createImportJob).toHaveBeenCalledTimes(1);
    });
    expect(createImportJob.mock.calls[0]?.[0]).toBe('PROSPECTS');
  });

  it('propose le classeur historique des visites sans modèle artificiel', async () => {
    const user = userEvent.setup();
    const visites = job({
      kind: 'VISITES',
      report: { ...SIMULATED_REPORT, kind: 'VISITES' },
    });
    const visitesAppliquees = job({ kind: 'VISITES', status: 'succeeded', mode: 'APPLY' });
    createImportJob.mockResolvedValue(visites);
    fetchImportJob.mockImplementation(() =>
      Promise.resolve(applyImportJob.mock.calls.length === 0 ? visites : visitesAppliquees),
    );
    applyImportJob.mockResolvedValue(visitesAppliquees);
    renderWithQuery(<ImportsView />);

    await user.click(screen.getByRole('combobox', { name: 'Entité à importer' }));
    await user.click(await screen.findByRole('option', { name: 'Visites' }));

    expect(screen.queryByRole('button', { name: 'Télécharger le modèle' })).toBeNull();
    expect(screen.getByText(/20 000 lignes au maximum/u)).toBeTruthy();
    await deposer();
    await waitFor(() => {
      expect(createImportJob).toHaveBeenCalledWith('VISITES', expect.any(File));
    });
    await user.click(await screen.findByRole('button', { name: 'Créer 800 visites' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('écrit les visites en base');
    expect(dialog.textContent).not.toContain('index d’unicité');
    expect(dialog.textContent).not.toContain('lignes sera');
    await user.click(within(dialog).getByRole('button', { name: 'Créer 800 visites' }));
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('status')
          .some((status) => status.textContent.startsWith('800 visites créées.')),
      ).toBe(true);
    });
  });

  // Le Grand Public compte des prospects, pas des « fiches », et « Grand Public »
  // ne prend pas la marque du pluriel.
  it('dépose un classeur Grand Public sur sa propre route, avec son propre modèle', async () => {
    const user = userEvent.setup();
    const grandPublic = job({
      kind: 'PROSPECTS_GRAND_PUBLIC',
      report: { ...SIMULATED_REPORT, kind: 'PROSPECTS_GRAND_PUBLIC' },
    });
    const grandPublicApplique = job({
      kind: 'PROSPECTS_GRAND_PUBLIC',
      status: 'succeeded',
      mode: 'APPLY',
    });
    createImportJob.mockResolvedValue(grandPublic);
    fetchImportJob.mockImplementation(() =>
      Promise.resolve(applyImportJob.mock.calls.length === 0 ? grandPublic : grandPublicApplique),
    );
    applyImportJob.mockResolvedValue(grandPublicApplique);
    renderWithQuery(<ImportsView />);

    await user.click(screen.getByRole('combobox', { name: 'Entité à importer' }));
    await user.click(await screen.findByRole('option', { name: 'Prospects Grand Public' }));

    expect(screen.getByRole('button', { name: 'Télécharger le modèle' })).toBeTruthy();
    expect(screen.getByText(/50 000 lignes au maximum/u)).toBeTruthy();
    expect(screen.getByText(/Seuls le nom et le téléphone sont exigés/u)).toBeTruthy();

    await deposer();
    await waitFor(() => {
      expect(createImportJob).toHaveBeenCalledWith('PROSPECTS_GRAND_PUBLIC', expect.any(File));
    });

    await user.click(
      await screen.findByRole('button', { name: 'Créer 800 prospects Grand Public' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('800 prospects Grand Public seront créés');
    await user.click(
      within(dialog).getByRole('button', { name: 'Créer 800 prospects Grand Public' }),
    );
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('status')
          .some((status) => status.textContent.startsWith('800 prospects Grand Public créés.')),
      ).toBe(true);
    });
  });

  it('présente un travail échu sans le traiter comme une panne', async () => {
    const expired = job({ status: 'expired', report: null });
    createImportJob.mockResolvedValue(expired);
    fetchImportJob.mockResolvedValue(expired);

    renderWithQuery(<ImportsView />);
    await deposer();

    expect(await screen.findByText(/Échéance passée/)).toBeTruthy();
    expect(screen.getAllByText('Échu').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Créer/ })).toBeNull();
  });
});
