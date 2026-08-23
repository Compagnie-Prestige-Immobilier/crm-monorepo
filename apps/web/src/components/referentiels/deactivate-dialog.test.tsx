import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeactivateReferentielDialog } from '@/components/referentiels/deactivate-dialog';

function monter(usageCount: number | null, over: { onConfirm?: () => void } = {}) {
  const onRetryUsage = vi.fn();
  const onConfirm = over.onConfirm ?? vi.fn();
  render(
    <DeactivateReferentielDialog
      open
      onOpenChange={vi.fn()}
      label="CBAO"
      kind="banque"
      usageCount={usageCount}
      onRetryUsage={onRetryUsage}
      pending={false}
      onConfirm={onConfirm}
    />,
  );
  return { onRetryUsage, onConfirm };
}

describe('désactivation d’un référentiel', () => {
  it('annonce le nombre de fiches quand il est connu', () => {
    monter(3000);

    expect(screen.getByRole('dialog').textContent).toContain('prospects référencent');
    expect(screen.getByRole('button', { name: 'Désactiver' })).toBeTruthy();
  });

  // Un décompte manquant valait « 0 » : l'admin retirait d'un clic une banque
  // portée par des milliers de fiches, en lisant qu'elle n'en portait aucune.
  it('ne propose PAS la désactivation tant que le décompte manque', async () => {
    const { onRetryUsage } = monter(null);

    expect(screen.queryByRole('button', { name: 'Désactiver' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('n’a pas pu être lu');
    expect(screen.getByRole('dialog').textContent).not.toContain('0 prospect');

    await userEvent.click(screen.getByRole('button', { name: /Réessayer le décompte/u }));
    expect(onRetryUsage).toHaveBeenCalledTimes(1);
  });

  it('distingue zéro d’inconnu', () => {
    monter(0);
    expect(screen.getByRole('dialog').textContent).toContain('0 prospects référencent');
    expect(screen.getByRole('button', { name: 'Désactiver' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
