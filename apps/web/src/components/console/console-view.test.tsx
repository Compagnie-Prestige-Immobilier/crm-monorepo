import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleView } from '@/components/console/console-view';
import { AttemptRefused, type AttemptInput } from '@/lib/data/console';
import type * as ConsoleData from '@/lib/data/console';
import type { CallOutcome, ProspectRow } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';
import { routerMock } from '@/test/router-mock';

const fetchConsoleQueue = vi.fn();
const fetchConsoleCampaigns = vi.fn();
const pushCallAttempt = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    fetchConsoleQueue: (...args: unknown[]) => fetchConsoleQueue(...args) as unknown,
    fetchConsoleCampaigns: (...args: unknown[]) => fetchConsoleCampaigns(...args) as unknown,
    pushCallAttempt: (...args: unknown[]) => pushCallAttempt(...args) as unknown,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => {
      toastError(message);
    },
    success: vi.fn(),
  },
}));

function prospect(over: Partial<ProspectRow> & { id: string }): ProspectRow {
  return {
    nom: 'Diallo',
    prenom: 'Mamadou',
    phoneE164: '+221771234567',
    rev: 1,
    statut: 'NOUVEAU',
    banqueId: 'b-1',
    banqueName: 'CBAO',
    syndicatId: 's-1',
    syndicatSigle: 'SUDES',
    representantId: 'r-9',
    representantName: 'Aminata Ndiaye',
    representantPhoneE164: '+221770000000',
    departementId: 'd-1',
    departementName: 'Dakar',
    ownedByCommercialId: 'u-1',
    ownedByCommercialName: 'Fatou Sow',
    segment: 'BDD1',
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
    clientCreatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

const NEUVE = prospect({ id: 'p-1', nom: 'Neuve', prenom: 'Fiche' });
const RAPPEL = prospect({
  id: 'p-2',
  nom: 'Rappel',
  prenom: 'Fiche',
  lastOutcome: 'CALLBACK',
  lastAttemptAt: '2026-07-01T00:00:00.000Z',
  lastComment: 'rappeler lundi',
});

function serve(items: readonly ProspectRow[]): void {
  fetchConsoleQueue.mockResolvedValue({ items: [...items], total: items.length });
}

async function renderConsole(items: readonly ProspectRow[] = [NEUVE, RAPPEL]) {
  serve(items);
  const view = renderWithQuery(<ConsoleView />);
  await screen.findByRole('heading', { level: 2 });
  return view;
}

const lastDraft = (): { outcome: CallOutcome; method: string | null; comment: string } =>
  (pushCallAttempt.mock.calls.at(-1)?.[0] as AttemptInput).draft;

beforeEach(() => {
  fetchConsoleQueue.mockClear();
  fetchConsoleCampaigns.mockReset();
  fetchConsoleCampaigns.mockResolvedValue([]);
  pushCallAttempt.mockReset();
  pushCallAttempt.mockResolvedValue(undefined);
  toastError.mockClear();
});

describe('ConsoleView : file', () => {
  it('ouvre d’abord la fiche jamais appelée, avant un rappel plus ancien', async () => {
    await renderConsole([RAPPEL, NEUVE]);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Neuve Fiche');
  });

  it('affiche l’ancienneté du rappel, jamais une échéance', async () => {
    await renderConsole();

    expect(screen.getByText(/^rappel · \d+ j$/)).toBeTruthy();
    expect(screen.queryByText(/rappel du/i)).toBeNull();
  });

  it('montre le numéro en grand, sans lien d’appel', async () => {
    const { container } = await renderConsole();

    expect(screen.getByText('+221 77 123 45 67')).toBeTruthy();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });
});

describe('ConsoleView : une touche, une issue', () => {
  const immediate: readonly [string, CallOutcome, string | null][] = [
    ['1', 'METHOD_OBTAINED', 'PLATFORM'],
    ['2', 'METHOD_OBTAINED', 'PHYSICAL'],
    ['3', 'METHOD_OBTAINED', 'VOICE_OR_ELECTRONIC_MESSAGING'],
    ['4', 'UNREACHABLE', null],
    ['5', 'CALLBACK', null],
    ['6', 'REFUSED', null],
    ['7', 'WRONG_NUMBER', null],
  ];

  for (const [key, outcome, method] of immediate) {
    it(`consigne ${outcome} sans confirmation sur la touche ${key}`, async () => {
      await renderConsole();

      await userEvent.keyboard(key);

      await waitFor(() => {
        expect(pushCallAttempt).toHaveBeenCalledTimes(1);
      });
      expect(lastDraft()).toMatchObject({ outcome, method });
    });
  }

  it('enchaîne seule sur la fiche suivante après consignation', async () => {
    await renderConsole();

    await userEvent.keyboard('4');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
    });
    expect(screen.queryByRole('button', { name: /suivant/i })).toBeNull();
  });

  it('compte la session au fil des envois', async () => {
    await renderConsole();

    await userEvent.keyboard('1');
    await waitFor(() => {
      expect(screen.getByText(/1 appel consigné · 1 méthode/)).toBeTruthy();
    });
  });

  it('chaque touche est doublée d’un bouton qui porte son chiffre', async () => {
    await renderConsole();

    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8']) {
      expect(screen.getByText(key, { selector: 'kbd' })).toBeTruthy();
    }
  });

  it('le bouton visible consigne la même issue que la touche', async () => {
    await renderConsole();

    await userEvent.click(screen.getByRole('button', { name: /Injoignable/ }));

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft().outcome).toBe('UNREACHABLE');
  });
});

describe('ConsoleView : Autre et commentaire', () => {
  it('place le curseur dans le commentaire sans rien envoyer', async () => {
    await renderConsole();

    await userEvent.keyboard('8');

    expect(document.activeElement).toBe(screen.getByLabelText(/Commentaire/));
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('refuse un commentaire vide, comme le fera le serveur', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('{Enter}');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Autre/));
  });

  it('valide sur Entrée une fois le commentaire saisi', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('ligne coupée{Enter}');

    await waitFor(() => {
      expect(pushCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastDraft()).toMatchObject({ outcome: 'OTHER', comment: 'ligne coupée' });
  });

  it('ne consigne rien quand un chiffre est tapé DANS le commentaire', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('4');

    expect(pushCallAttempt).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Commentaire/)).toHaveProperty('value', '4');
  });

  it('Échap vide la saisie en cours', async () => {
    await renderConsole();

    await userEvent.keyboard('8');
    await userEvent.keyboard('brouillon');
    await userEvent.keyboard('{Escape}');

    expect(screen.getByLabelText(/Commentaire/)).toHaveProperty('value', '');
    expect(pushCallAttempt).not.toHaveBeenCalled();
  });
});

describe('ConsoleView : fiche déjà close', () => {
  const CLOSE = prospect({
    id: 'p-9',
    nom: 'Close',
    prenom: 'Fiche',
    phase2Status: 'REFUSED',
    lastOutcome: 'REFUSED',
    lastAttemptAt: '2026-07-01T00:00:00.000Z',
  });

  it('passe en lecture seule, sans boutons d’issue', async () => {
    await renderConsole([CLOSE]);

    expect(screen.getByRole('status').textContent).toMatch(/déjà close/);
    expect(screen.queryByRole('button', { name: /Injoignable/ })).toBeNull();
  });

  it('ignore les touches d’issue sur une fiche close', async () => {
    await renderConsole([CLOSE]);

    await userEvent.keyboard('4');

    expect(pushCallAttempt).not.toHaveBeenCalled();
  });

  it('bascule en lecture seule quand le serveur annonce la clôture', async () => {
    pushCallAttempt.mockRejectedValue(
      new AttemptRefused('PHASE2_ALREADY_COMPLETED', 'La fiche est déjà close.'),
    );
    await renderConsole([NEUVE]);

    await userEvent.keyboard('4');

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/déjà close/);
    });
    expect(toastError).toHaveBeenCalledWith('La fiche est déjà close.');
  });
});

describe('ConsoleView : navigation et raccourcis annexes', () => {
  it('parcourt la file sans ouvrir la fiche, jusqu’à Espace', async () => {
    await renderConsole();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Neuve Fiche');

    await userEvent.keyboard(' ');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rappel Fiche');
  });

  it('ne remonte pas au-delà de la première fiche', async () => {
    await renderConsole();

    await userEvent.keyboard('{ArrowUp}{ArrowUp} ');

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Neuve Fiche');
  });

  it('copie le numéro sur C, sans le faire retaper', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderConsole();

    await userEvent.keyboard('c');

    expect(writeText).toHaveBeenCalledWith('+221771234567');
  });

  it('ouvre la création de prospect sur le représentant courant', async () => {
    await renderConsole();

    await userEvent.keyboard('n');

    expect(routerMock.push).toHaveBeenCalledWith('/prospects/nouveau?rep=r-9');
  });

  it('ouvre la fiche du représentant', async () => {
    await renderConsole();

    await userEvent.keyboard('r');

    expect(routerMock.push).toHaveBeenCalledWith('/representants/r-9');
  });

  it('affiche la carte clavier sur ?', async () => {
    await renderConsole();

    expect(screen.queryByText('Copier le numéro')).toBeNull();

    await userEvent.keyboard('?');

    expect(screen.getByText('Copier le numéro')).toBeTruthy();
  });
});
