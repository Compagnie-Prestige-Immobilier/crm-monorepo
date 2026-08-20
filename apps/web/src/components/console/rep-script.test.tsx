import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RepScript } from '@/components/console/rep-script';
import type * as ConsoleData from '@/lib/data/console';
import type { ScriptedRepresentant } from '@/lib/data/representants';
import { renderWithQuery } from '@/test/render-query';
import { routerMock } from '@/test/router-mock';

const fetchRepScriptQueue = vi.fn();
const pushRepCallAttempt = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    fetchRepScriptQueue: (...args: unknown[]) => fetchRepScriptQueue(...args) as unknown,
    pushRepCallAttempt: (...args: unknown[]) => pushRepCallAttempt(...args) as unknown,
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

function rep(over: Partial<ScriptedRepresentant> & { id: string }): ScriptedRepresentant {
  return {
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
    ...over,
  };
}

const PREMIER = rep({ id: 'r-1', fullName: 'Aminata Ndiaye' });
const SECOND = rep({
  id: 'r-2',
  fullName: 'Ousmane Fall',
  phoneE164: '+221770000002',
  clientCreatedAt: '2026-02-01T00:00:00.000Z',
});

async function renderScript(items: readonly ScriptedRepresentant[] = [PREMIER, SECOND]) {
  fetchRepScriptQueue.mockResolvedValue({ items: [...items], total: items.length });
  const view = renderWithQuery(<RepScript />);
  await screen.findByRole('heading', { level: 2 });
  return view;
}

const bodies = (): Record<string, unknown>[] =>
  pushRepCallAttempt.mock.calls.map((call) => call[0] as Record<string, unknown>);

const lastBody = (): Record<string, unknown> => {
  const body = bodies().at(-1);
  if (body === undefined) throw new Error('Aucune tentative envoyée.');
  return body;
};

beforeEach(() => {
  fetchRepScriptQueue.mockReset();
  pushRepCallAttempt.mockReset();
  pushRepCallAttempt.mockResolvedValue({
    status: 'applied',
    attemptId: 'a-1',
    taskId: null,
    taskClosed: true,
    suggestion: null,
  });
  toastError.mockClear();
  routerMock.push.mockClear();
});

describe('RepScript : un appel coupé ne perd rien', () => {
  it('enregistre le refus dès qu’il est prononcé, avant toute question de suggestion', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('2');

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastBody()).toMatchObject({
      representantId: 'r-1',
      outcome: 'REFUSED',
      relationStatus: 'REFUS',
    });
  });

  it('le refus est déjà parti quand la fiche est quittée sans répondre à la suggestion', async () => {
    const { unmount } = await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('2');
    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    unmount();

    expect(bodies()[0]).toMatchObject({ outcome: 'REFUSED', relationStatus: 'REFUS' });
  });

  it('« pas maintenant » part avant que l’échéance soit choisie', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('3');

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastBody()).toMatchObject({ outcome: 'CALLBACK', relationStatus: 'CONTACTE' });
    expect(screen.getByText('Demain 9 h')).toBeTruthy();
  });

  it('le numéro WhatsApp tapé mais non validé part au changement de fiche', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    await userEvent.keyboard('2');
    await userEvent.type(screen.getByLabelText(/Numéro WhatsApp/), '77 987 65 43');
    await userEvent.click(screen.getByRole('button', { name: /Ousmane Fall/ }));

    await waitFor(() => {
      expect(bodies().some((body) => body.whatsappStatus === 'AUTRE_NUMERO')).toBe(true);
    });
    const sent = bodies().find((body) => body.whatsappStatus === 'AUTRE_NUMERO');
    expect(sent?.whatsappE164).toBe('77 987 65 43');
    expect(sent?.representantId).toBe('r-1');
  });

  it('la suggestion saisie part au changement de fiche, sans bouton final', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('2');
    await userEvent.keyboard('1');
    await userEvent.type(screen.getByLabelText(/Numéro du contact/), '77 111 22 33');
    await userEvent.type(screen.getByLabelText(/Nom du contact/), 'Modou Sarr');
    await userEvent.click(screen.getByRole('button', { name: /Ousmane Fall/ }));

    await waitFor(() => {
      expect(bodies().some((body) => body.suggestedPhone === '77 111 22 33')).toBe(true);
    });
    const sent = bodies().find((body) => body.suggestedPhone === '77 111 22 33');
    expect(sent?.suggestedName).toBe('Modou Sarr');
  });
});

describe('RepScript : l’ordre des questions', () => {
  it('ne pose qu’une question à la fois, l’identité d’abord', async () => {
    await renderScript();

    expect(screen.getByText(/C’est bien Aminata Ndiaye/)).toBeTruthy();
    expect(screen.queryByText(/ambassadeur CPI/)).toBeNull();
    expect(screen.queryByText(/Son WhatsApp/)).toBeNull();
  });

  it('pose l’engagement AVANT de demander le WhatsApp', async () => {
    await renderScript();

    await userEvent.keyboard('1');

    expect(screen.getByText(/Souhaitez-vous être ambassadeur CPI/)).toBeTruthy();
    expect(screen.queryByText(/Son WhatsApp/)).toBeNull();

    await userEvent.keyboard('1');

    expect(screen.getByText(/Son WhatsApp/)).toBeTruthy();
  });

  it('ne demande ni WhatsApp ni profession après un refus', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('2');

    expect(screen.queryByText(/Son WhatsApp/)).toBeNull();
    expect(screen.queryByText(/Sa profession/)).toBeNull();
    expect(screen.getByText(/Connaissez-vous quelqu’un/)).toBeTruthy();
  });

  it('la profession vient après le WhatsApp, jamais avant', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    expect(screen.queryByText(/Sa profession/)).toBeNull();

    await userEvent.keyboard('1');
    expect(screen.getByText(/Sa profession/)).toBeTruthy();
  });

  it('Échap revient à la question précédente', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('{Escape}');

    expect(screen.getByText(/C’est bien Aminata Ndiaye/)).toBeTruthy();
  });
});

describe('RepScript : le WhatsApp ne se ressaisit pas', () => {
  it('« le même que son téléphone » n’écrit aucun numéro', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    await userEvent.keyboard('1');

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(2);
    });
    expect(lastBody()).toMatchObject({ whatsappStatus: 'MEME_NUMERO' });
    expect(lastBody()).not.toHaveProperty('whatsappE164');
  });

  it('« pas de WhatsApp » n’écrit aucun numéro non plus', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    await userEvent.keyboard('3');

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(2);
    });
    expect(lastBody()).toMatchObject({ whatsappStatus: 'AUCUN' });
    expect(lastBody()).not.toHaveProperty('whatsappE164');
  });

  it('seul un autre numéro ouvre une saisie', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    expect(screen.queryByLabelText(/Numéro WhatsApp/)).toBeNull();

    await userEvent.keyboard('2');
    expect(screen.getByLabelText(/Numéro WhatsApp/)).toBeTruthy();
    expect(pushRepCallAttempt).not.toHaveBeenCalledWith(
      expect.objectContaining({ whatsappStatus: 'AUTRE_NUMERO' }),
    );
  });
});

describe('RepScript : le clavier suffit', () => {
  it('traite un appel entier sans souris', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    await userEvent.keyboard('1');

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(3);
    });
    expect(bodies()[0]).toMatchObject({ outcome: 'REACHED', relationStatus: 'AMBASSADEUR' });
    expect(bodies()[1]).toMatchObject({ whatsappStatus: 'MEME_NUMERO' });
    expect(bodies()[2]).toMatchObject({ profession: 'Instituteur' });

    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Ousmane Fall');
  });

  it('chaque réponse porte son chiffre à l’écran', async () => {
    await renderScript();

    for (const key of ['1', '2', '3', '4']) {
      expect(screen.getByText(key, { selector: 'kbd' })).toBeTruthy();
    }
  });

  it('le bouton cliqué consigne la même chose que la touche', async () => {
    await renderScript();

    await userEvent.click(screen.getByRole('button', { name: /Injoignable/ }));

    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(1);
    });
    expect(lastBody()).toMatchObject({ outcome: 'UNREACHABLE' });
  });

  it('ouvre la fiche du représentant sur R', async () => {
    await renderScript();

    await userEvent.keyboard('r');

    expect(routerMock.push).toHaveBeenCalledWith('/representants/r-1');
  });

  it('affiche la carte clavier sur ?', async () => {
    await renderScript();

    expect(screen.queryByText('Copier le numéro')).toBeNull();

    await userEvent.keyboard('?');

    expect(screen.getByText('Copier le numéro')).toBeTruthy();
  });
});

describe('RepScript : ce que la fiche sait', () => {
  it('distingue « non demandé » de « pas de WhatsApp »', async () => {
    await renderScript([PREMIER]);

    expect(screen.getByText('Non demandé')).toBeTruthy();
    expect(screen.queryByText('Pas de WhatsApp')).toBeNull();
  });

  it('affiche « pas de WhatsApp » quand la question a été posée', async () => {
    await renderScript([rep({ id: 'r-3', whatsappStatus: 'AUCUN' })]);

    expect(screen.getByText('Pas de WhatsApp')).toBeTruthy();
    expect(screen.queryByText('Non demandé')).toBeNull();
  });

  it('n’invente pas de profession quand elle n’a pas été demandée', async () => {
    await renderScript([PREMIER]);

    expect(screen.getByText('Non demandée')).toBeTruthy();
  });

  it('montre le numéro WhatsApp quand il diffère du téléphone', async () => {
    await renderScript([
      rep({ id: 'r-4', whatsappStatus: 'AUTRE_NUMERO', whatsappNumber: '+221779876543' }),
    ]);

    expect(screen.getByText('+221779876543')).toBeTruthy();
  });

  it('passer la profession n’envoie rien', async () => {
    await renderScript();

    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    await userEvent.keyboard('1');
    await waitFor(() => {
      expect(pushRepCallAttempt).toHaveBeenCalledTimes(2);
    });

    await userEvent.keyboard('{Enter}');

    expect(pushRepCallAttempt).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Appel consigné/)).toBeTruthy();
  });
});

describe('RepScript : la file', () => {
  it('met les relations déjà tranchées en fin de file', async () => {
    const tranche = rep({
      id: 'r-5',
      fullName: 'Bineta Diop',
      relationStatus: 'AMBASSADEUR',
      clientCreatedAt: '2025-01-01T00:00:00.000Z',
    });
    await renderScript([tranche, PREMIER]);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Aminata Ndiaye');
  });

  it('passe en lecture seule sur une relation déjà tranchée', async () => {
    await renderScript([rep({ id: 'r-6', relationStatus: 'REFUS' })]);

    expect(screen.getByRole('status').textContent).toMatch(/déjà tranchée/);
    await userEvent.keyboard('1');
    expect(pushRepCallAttempt).not.toHaveBeenCalled();
  });
});
