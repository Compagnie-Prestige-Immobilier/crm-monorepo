import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/test/render-query';

const fetchTemplates = vi.fn();
const updateTemplate = vi.fn();

vi.mock('@/lib/data/notifications', () => ({
  createTemplate: vi.fn(),
  fetchTemplates: () => fetchTemplates() as unknown,
  notificationKeys: { templates: ['notifications', 'templates'] },
  updateTemplate: (id: string, body: unknown) => updateTemplate(id, body) as unknown,
}));

const { TemplateManager } = await import('@/components/notifications/template-manager');

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
      expect(updateTemplate).toHaveBeenCalledWith(
        'tpl-1',
        expect.objectContaining({ route: '' }),
      );
    });
  });
});
