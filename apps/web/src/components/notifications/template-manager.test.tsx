import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type * as NotificationsModule from '@/lib/data/notifications';
import { makeTestQueryClient, renderWithQuery } from '@/test/render-query';

const fetchTemplates = vi.hoisted(() => vi.fn());
const updateTemplate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/notifications', async () => {
  const actual = await vi.importActual<typeof NotificationsModule>('@/lib/data/notifications');
  return {
    ...actual,
    fetchTemplates: (includeInactive?: boolean) => fetchTemplates(includeInactive) as unknown,
    updateTemplate: (id: string, body: unknown) => updateTemplate(id, body) as unknown,
  };
});

const { TemplateManager } = await import('@/components/notifications/template-manager');
const { NotificationComposer } = await import('@/components/notifications/notification-composer');

const template = {
  id: 'tpl-1',
  name: 'Relance',
  category: 'RAPPEL',
  titleTemplate: 'Bonjour',
  bodyTemplate: 'Vous avez un rappel.',
  route: '/rappels',
  variables: [],
  isActive: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const retire = { ...template, id: 'tpl-2', name: 'Gabarit retiré', isActive: false };

describe('TemplateManager', () => {
  it('efface réellement le lien profond', async () => {
    fetchTemplates.mockResolvedValue({ items: [template] });
    updateTemplate.mockResolvedValue({ ...template, route: null });
    const user = userEvent.setup();
    renderWithQuery(<TemplateManager />);

    await user.click(await screen.findByRole('button', { name: 'Modifier' }));
    await user.clear(screen.getByRole('textbox', { name: 'Lien profond' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateTemplate).toHaveBeenCalledWith('tpl-1', expect.objectContaining({ route: '' }));
    });
  });
});

/**
 * Les deux écrans demandent DEUX listes différentes. Sous une clé commune, le
 * composeur proposait un gabarit désactivé, ou l'onglet Gabarits perdait les
 * désactivés — qui devenaient irréactivables.
 */
describe('gabarits, onglet et composeur sous le même cache', () => {
  it('ne se servent pas la réponse l’un de l’autre', async () => {
    fetchTemplates.mockReset();
    fetchTemplates.mockImplementation((includeInactive?: boolean) =>
      Promise.resolve({ items: includeInactive === true ? [template, retire] : [template] }),
    );

    const client = makeTestQueryClient();
    renderWithQuery(<TemplateManager />, client);
    expect(await screen.findByText('Gabarit retiré')).toBeTruthy();

    renderWithQuery(<NotificationComposer open onOpenChange={vi.fn()} />, client);

    await screen.findByRole('combobox', { name: /Gabarit/ });
    expect(fetchTemplates.mock.calls.map(([flag]) => flag)).toEqual([true, false]);

    const composeur = screen.getByRole('dialog');
    expect(composeur.textContent).not.toContain('Gabarit retiré');
  });
});
