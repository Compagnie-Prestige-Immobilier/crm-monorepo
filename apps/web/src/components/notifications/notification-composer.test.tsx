import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as NotificationsModule from '@/lib/data/notifications';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/notifications', async () => {
  const actual = await vi.importActual<typeof NotificationsModule>('@/lib/data/notifications');
  return { ...actual, fetchTemplates: () => Promise.resolve({ items: [] }) };
});

const { NotificationComposer } = await import('@/components/notifications/notification-composer');

function rediger(title: string, body: string) {
  renderWithQuery(<NotificationComposer open onOpenChange={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: /Titre/u }), { target: { value: title } });
  fireEvent.change(screen.getByRole('textbox', { name: /Message/u }), { target: { value: body } });
  return screen.getByRole('button', { name: /Voir les destinataires/u });
}

describe('rédaction d’une notification', () => {
  // L'avertissement s'affichait sans rien retenir : le destinataire recevait
  // « Bonjour {{prenom}} ».
  it('bloque tant qu’une variable n’est pas renseignée', () => {
    const suivant = rediger('Bonjour {{prenom}}', 'Votre dossier avance.');

    expect(suivant).toHaveProperty('disabled', true);
    expect(suivant.getAttribute('title')).toContain('prenom');
    expect(screen.getByRole('alert').textContent).toContain('prenom');
  });

  // Le compteur bornait le gabarit BRUT ; c'est le texte RENDU qui part.
  it('borne le titre sur le texte rendu, variables substituées', () => {
    const suivant = rediger(`Bonjour ${'x'.repeat(121)}`, 'Court.');

    expect(suivant).toHaveProperty('disabled', true);
    expect(suivant.getAttribute('title')).toContain('Le titre rendu fait');
  });

  it('borne le message de la même façon', () => {
    const suivant = rediger('Titre', 'y'.repeat(501));

    expect(suivant).toHaveProperty('disabled', true);
    expect(suivant.getAttribute('title')).toContain('Le message rendu fait');
  });

  it('ne se plaint de rien quand le texte tient dans les bornes', () => {
    const suivant = rediger('Titre court', 'Message court.');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(suivant.getAttribute('title') ?? '').not.toContain('caractères');
  });
});
