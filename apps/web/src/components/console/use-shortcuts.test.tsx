import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useShortcuts, type ShortcutMap } from '@/components/console/use-shortcuts';

function Harness({ map, enabled = true }: { map: ShortcutMap; enabled?: boolean }) {
  useShortcuts(map, enabled);
  return <textarea aria-label="commentaire" />;
}

describe('useShortcuts', () => {
  it('déclenche la touche depuis n’importe où dans la page', async () => {
    const hit = vi.fn();
    render(<Harness map={{ '4': hit }} />);

    await userEvent.keyboard('4');

    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('se tait dès qu’un champ texte a le focus', async () => {
    const hit = vi.fn();
    render(<Harness map={{ '4': hit }} />);

    await userEvent.click(screen.getByLabelText('commentaire'));
    await userEvent.keyboard('4');

    expect(hit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('commentaire')).toHaveProperty('value', '4');
  });

  it('laisse passer Échap même depuis un champ texte', async () => {
    const escape = vi.fn();
    render(<Harness map={{ Escape: escape }} />);

    await userEvent.click(screen.getByLabelText('commentaire'));
    await userEvent.keyboard('{Escape}');

    expect(escape).toHaveBeenCalledTimes(1);
  });

  it('reconnaît Ctrl et Cmd sur la même entrée', async () => {
    const palette = vi.fn();
    render(<Harness map={{ 'mod+k': palette }} />);

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.keyboard('{Meta>}k{/Meta}');

    expect(palette).toHaveBeenCalledTimes(2);
  });

  it('ignore une touche accompagnée d’Alt, réservée au système', async () => {
    const hit = vi.fn();
    render(<Harness map={{ c: hit }} />);

    await userEvent.keyboard('{Alt>}c{/Alt}');

    expect(hit).not.toHaveBeenCalled();
  });

  it('ne monte rien tant que la carte est désactivée', async () => {
    const hit = vi.fn();
    render(<Harness map={{ '4': hit }} enabled={false} />);

    await userEvent.keyboard('4');

    expect(hit).not.toHaveBeenCalled();
  });
});
