import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeactivateReferentielDialog } from '@/components/referentiels/deactivate-dialog';

type Kind = Parameters<typeof DeactivateReferentielDialog>[0]['kind'];
type Subject = Parameters<typeof DeactivateReferentielDialog>[0]['subject'];

function monter(
  usageCount: number | null,
  over: { onConfirm?: () => void; kind?: Kind; subject?: Subject } = {},
) {
  const onRetryUsage = vi.fn();
  const onConfirm = over.onConfirm ?? vi.fn();
  render(
    <DeactivateReferentielDialog
      open
      onOpenChange={vi.fn()}
      label="CBAO"
      kind={over.kind ?? 'banque'}
      {...(over.subject === undefined ? {} : { subject: over.subject })}
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

  it('compte des visites, pas des prospects, pour un référentiel du registre des visites', () => {
    monter(2, { kind: 'entreprise', subject: 'visite' });
    const text = screen.getByRole('dialog').textContent;
    expect(text).toContain('2 visites référencent cette entreprise.');
    expect(text).toContain('Aucune visite n’est supprimée.');
  });

  it('accorde l’article de chaque liste, y compris devant une voyelle', () => {
    monter(1, { kind: 'objet de visite', subject: 'visite' });
    expect(screen.getByRole('dialog').textContent).toContain('cet objet de visite');
  });
});
