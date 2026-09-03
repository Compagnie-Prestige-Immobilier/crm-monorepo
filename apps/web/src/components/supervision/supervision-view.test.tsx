import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SupervisionView } from '@/components/supervision/supervision-view';
import type * as AdminModule from '@/lib/data/admin';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/admin', async () => {
  const actual = await vi.importActual<typeof AdminModule>('@/lib/data/admin');
  return { ...actual, fetchSupervision: fetchMock };
});

const fetchMock = vi.hoisted(() => vi.fn());

const OBSERVED_AT = '2026-08-17T12:00:00.000Z';

const PARTS = [
  { key: 'assiduite', label: 'Assiduité', ratio: 0.9, weight: 0.2 },
  { key: 'regularite', label: 'Régularité', ratio: 0.8, weight: 0.15 },
  { key: 'rythme', label: 'Rythme', ratio: 0.68, weight: 0.25 },
  { key: 'contact', label: 'Contact', ratio: 0.5, weight: 0.2 },
  { key: 'qualification', label: 'Qualification', ratio: 0.4, weight: 0.15 },
  { key: 'efficience', label: 'Efficience', ratio: 1, weight: 0.05 },
] as const;

function user(
  fullName: string,
  overrides: Partial<AdminModule.SupervisedUser> = {},
): AdminModule.SupervisedUser {
  return {
    id: fullName,
    fullName,
    username: fullName.toLowerCase().replace(/\s/gu, '.'),
    email: `${fullName.toLowerCase().replace(/\s/gu, '.')}@cpi.sn`,
    role: 'COMMERCIAL',
    isActive: true,
    presence: 'ONLINE',
    hasLiveSession: true,
    sessionCount: 1,
    lastSeenAt: '2026-08-17T11:55:00.000Z',
    lastLoginAt: '2026-08-17T09:00:00.000Z',
    lastSyncAt: '2026-08-17T11:55:00.000Z',
    lastPullAt: '2026-08-17T11:55:00.000Z',
    pendingOps: 0,
    appVersion: '1.0.0',
    lastWriteAt: '2026-08-17T11:40:00.000Z',
    activeSecondsToday: 12_600,
    activeSecondsInShifts: 10_800,
    firstSeenToday: '2026-08-17T09:05:00.000Z',
    callsToday: 24,
    medianGapSeconds: 300,
    medianUploadLagSeconds: 45,
    firstCallAt: '2026-08-17T09:12:00.000Z',
    lastCallAt: '2026-08-17T11:48:00.000Z',
    reachedToday: 12,
    qualifiedToday: 6,
    repeatCalls: 3,
    deadSeconds: 2520,
    deadGaps: 3,
    score: { value: 74, reason: null, parts: [...PARTS] },
    ...overrides,
  };
}

function payload(teleconseillers: AdminModule.SupervisedUser[]): AdminModule.Supervision {
  return {
    observedAt: OBSERVED_AT,
    onlineWindowMinutes: 20,
    shiftSecondsElapsed: 10_800,
    shifts: [
      { key: 'morning', label: 'Matin', start: '09:00', end: '14:00' },
      { key: 'afternoon', label: 'Après-midi', start: '15:00', end: '18:00' },
    ],
    teleconseillers,
    finances: [],
    counts: { online: teleconseillers.length, recent: 0, away: 0 },
  };
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole('rowheader', { name: new RegExp(name, 'u') }).closest('tr');
  if (row === null) throw new Error(`Ligne introuvable pour ${name}`);
  return row;
}

function rendementOf(name: string): string {
  const cells = within(rowOf(name)).getAllByRole('cell');
  return cells[1]?.textContent ?? '';
}

async function renderSupervision(users: AdminModule.SupervisedUser[]): Promise<void> {
  fetchMock.mockResolvedValue(payload(users));
  renderWithQuery(<SupervisionView />);
  await waitFor(() => {
    expect(
      screen.getByRole('rowheader', { name: new RegExp(users[0]?.fullName ?? '', 'u') }),
    ).toBeTruthy();
  });
}

describe('volet Comptes de la supervision', () => {
  it('affiche le motif au lieu d’une note quand elle ne peut pas être calculée', async () => {
    await renderSupervision([
      user('Alice Diop', {
        callsToday: 0,
        score: { value: null, reason: 'aucun_appel', parts: [] },
      }),
      user('Bineta Fall', {
        score: { value: null, reason: 'journee_non_commencee', parts: [] },
      }),
      user('Cheikh Sarr', {
        score: { value: null, reason: 'presence_non_mesuree', parts: [] },
      }),
    ]);

    expect(rendementOf('Alice Diop')).toBe('Aucun appel');
    expect(rendementOf('Bineta Fall')).toBe('Journée pas commencée');
    expect(rendementOf('Cheikh Sarr')).toBe('Présence non mesurée');
  });

  it('classe les notes par ordre décroissant et rejette les comptes sans note à la fin', async () => {
    await renderSupervision([
      user('Bineta Fall', { score: { value: null, reason: 'aucun_appel', parts: [] } }),
      user('Cheikh Sarr', { score: { value: 12, reason: null, parts: [...PARTS] } }),
      user('Alice Diop', { score: { value: 82, reason: null, parts: [...PARTS] } }),
      user('Daba Ndoye', { score: { value: 0, reason: null, parts: [...PARTS] } }),
    ]);

    const names = screen.getAllByRole('rowheader').map((cell) => cell.textContent ?? '');
    expect(names).toEqual([
      expect.stringContaining('Alice Diop'),
      expect.stringContaining('Cheikh Sarr'),
      expect.stringContaining('Daba Ndoye'),
      expect.stringContaining('Bineta Fall'),
    ]);
  });

  it('déplie les six parts de la note et les mesures du jour', async () => {
    await renderSupervision([user('Alice Diop')]);

    const toggle = screen.getByRole('button', { name: /Alice Diop/u });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const detail = screen.getByRole('cell', { name: /Détail de la note/u });
    for (const part of PARTS) {
      expect(within(detail).getByText(part.label)).toBeTruthy();
    }
    expect(within(detail).getByText('68 %')).toBeTruthy();
    expect(within(detail).getByText('poids 25 %')).toBeTruthy();
    expect(within(detail).getByText('42 min sur 3 trous')).toBeTruthy();
    expect(within(detail).getByText('8,0')).toBeTruthy();

    await userEvent.click(toggle);
    expect(screen.queryByText('Détail de la note')).toBeNull();
  });

  it('rappelle les créneaux sur lesquels la note est calculée', async () => {
    await renderSupervision([user('Alice Diop')]);

    expect(screen.getByText(/Matin 09:00-14:00 et Après-midi 15:00-18:00/u)).toBeTruthy();
  });
});
