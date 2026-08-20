import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as RepresentantsModule from '@/lib/data/representants';
import { renderWithQuery } from '@/test/render-query';

const fetchComments = vi.hoisted(() => vi.fn());
const createComment = vi.hoisted(() => vi.fn());
const deleteComment = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/representants', async () => {
  const actual = await vi.importActual<typeof RepresentantsModule>('@/lib/data/representants');
  return {
    ...actual,
    fetchRepresentantComments: () => fetchComments() as unknown,
    createRepresentantComment: (representantId: unknown, comment: unknown) =>
      createComment(representantId, comment) as unknown,
    deleteRepresentantComment: (representantId: unknown, commentId: unknown) =>
      deleteComment(representantId, commentId) as unknown,
  };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { RepresentantComments } = await import('@/components/representants/representant-comments');

const AUTHOR = { id: 'u-1', fullName: 'Aminata Diallo' };

const comment = (id: string, body: string, clientCreatedAt: string) => ({
  id,
  body,
  authorId: 'u-2',
  authorName: 'Moussa Sow',
  clientCreatedAt,
  createdAt: clientCreatedAt,
});

beforeEach(() => {
  fetchComments.mockResolvedValue([]);
  createComment.mockResolvedValue(comment('c-9', 'Publié', '2026-05-10T09:00:00.000Z'));
  deleteComment.mockReset();
  deleteComment.mockResolvedValue(undefined);
});

describe('RepresentantComments', () => {
  it('rend le fil dans l’ordre servi, du plus récent au plus ancien', async () => {
    fetchComments.mockResolvedValue([
      comment('c-3', 'Troisième passage', '2026-05-03T09:00:00.000Z'),
      comment('c-2', 'Deuxième passage', '2026-05-02T09:00:00.000Z'),
      comment('c-1', 'Premier passage', '2026-05-01T09:00:00.000Z'),
    ]);
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} />);

    const fil = await screen.findByRole('list', { name: /Fil de la fiche/u });
    const lignes = within(fil)
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(lignes).toHaveLength(3);
    expect(lignes[0]).toContain('Troisième passage');
    expect(lignes[1]).toContain('Deuxième passage');
    expect(lignes[2]).toContain('Premier passage');
  });

  it('affiche l’envoi avant la réponse du serveur, en tête du fil', async () => {
    const user = userEvent.setup();
    fetchComments.mockResolvedValue([comment('c-1', 'Ancien', '2026-05-01T09:00:00.000Z')]);
    let release: (() => void) | undefined;
    createComment.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve(comment('c-9', 'Rappeler lundi', '2026-05-10T09:00:00.000Z'));
          };
        }),
    );
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} />);
    await screen.findByText('Ancien');

    await user.type(screen.getByLabelText('Ajouter au fil'), 'Rappeler lundi');
    await user.click(screen.getByRole('button', { name: /Publier/u }));

    const fil = screen.getByRole('list', { name: /Fil de la fiche/u });
    const lignes = within(fil)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(lignes[0]).toContain('Rappeler lundi');
    expect(lignes[0]).toContain('Aminata Diallo');
    release?.();
  });

  it('envoie un identifiant posé par le client, qui sert de clé d’idempotence', async () => {
    const user = userEvent.setup();
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} />);
    await screen.findByText(/Rien dans le fil/u);

    await user.type(screen.getByLabelText('Ajouter au fil'), 'Rappeler lundi');
    await user.click(screen.getByRole('button', { name: /Publier/u }));

    await waitFor(() => {
      expect(createComment).toHaveBeenCalled();
    });
    const [representantId, sent] = createComment.mock.calls[0] as [string, { id: string }];
    expect(representantId).toBe('rep-1');
    expect(sent.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it('rend la saisie à l’utilisateur quand l’envoi échoue', async () => {
    const user = userEvent.setup();
    createComment.mockRejectedValue(new Error('réseau'));
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} />);
    await screen.findByText(/Rien dans le fil/u);

    const champ = screen.getByLabelText('Ajouter au fil');
    await user.type(champ, 'Rappeler lundi');
    await user.click(screen.getByRole('button', { name: /Publier/u }));

    await waitFor(() => {
      expect((champ as HTMLTextAreaElement).value).toBe('Rappeler lundi');
    });
    expect(screen.queryByRole('list', { name: /Fil de la fiche/u })).toBeNull();
  });

  it('refuse de publier un commentaire vide', async () => {
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} />);
    await screen.findByText(/Rien dans le fil/u);

    expect(screen.getByRole('button', { name: /Publier/u }).hasAttribute('disabled')).toBe(true);
  });

  it('n’offre pas la suppression à un téléconseiller', async () => {
    fetchComments.mockResolvedValue([
      comment('c-1', 'Premier passage', '2026-05-01T09:00:00.000Z'),
    ]);
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} />);
    await screen.findByText('Premier passage');

    expect(screen.queryByRole('button', { name: 'Supprimer ce commentaire' })).toBeNull();
  });

  it('demande confirmation avant de supprimer, et n’appelle rien avant', async () => {
    const user = userEvent.setup();
    fetchComments.mockResolvedValue([
      comment('c-1', 'Premier passage', '2026-05-01T09:00:00.000Z'),
    ]);
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} canAdminister />);
    await screen.findByText('Premier passage');

    await user.click(screen.getByRole('button', { name: 'Supprimer ce commentaire' }));

    expect(await screen.findByRole('heading', { name: /Supprimer ce commentaire/u })).toBeTruthy();
    expect(deleteComment).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(deleteComment).toHaveBeenCalledWith('rep-1', 'c-1');
    });
  });

  it('ne supprime rien quand la confirmation est refusée', async () => {
    const user = userEvent.setup();
    fetchComments.mockResolvedValue([
      comment('c-1', 'Premier passage', '2026-05-01T09:00:00.000Z'),
    ]);
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} canAdminister />);
    await screen.findByText('Premier passage');

    await user.click(screen.getByRole('button', { name: 'Supprimer ce commentaire' }));
    await user.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(deleteComment).not.toHaveBeenCalled();
  });

  it('dit quoi faire quand le fil est vide', async () => {
    renderWithQuery(<RepresentantComments representantId="rep-1" author={AUTHOR} />);

    expect(await screen.findByText(/Rien dans le fil/u)).toBeTruthy();
  });
});
