import { render } from '@testing-library/react';
import { flexRender, type CellContext } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { prospectColumns, type ProspectRowActions } from '@/components/prospects/columns';
import type { Projet, ProspectRow } from '@/lib/types';

const actions = (over: Partial<ProspectRowActions>): ProspectRowActions => ({
  projet: 'CHUES',
  canAdminister: false,
  readOnly: false,
  onEdit: vi.fn(),
  onMerge: vi.fn(),
  onReassign: vi.fn(),
  onDelete: vi.fn(),
  ...over,
});

const ids = (over: Partial<ProspectRowActions>): (string | undefined)[] =>
  prospectColumns(actions(over)).map((column) => column.id);

describe('colonne d’actions de la liste des prospects', () => {
  it('un SUPERVISEUR n’a AUCUNE action : chacune finirait en 403', () => {
    expect(ids({ readOnly: true })).not.toContain('actions');
  });

  it('un téléconseiller garde la sienne', () => {
    expect(ids({})).toContain('actions');
  });
});

/**
 * Une fiche entrée par CHUES, restée « Nouveau » en premier niveau, mais
 * convertie dans son parcours Grand Public.
 */
const prospect = {
  id: 'p-1',
  nom: 'Diop',
  prenom: 'Awa',
  statut: 'NOUVEAU',
  journeys: [
    { id: 'j-1', projet: 'CHUES', statut: 'CONTACTE' },
    { id: 'j-2', projet: 'GRAND_PUBLIC', statut: 'CONVERTI' },
  ],
} as unknown as ProspectRow;

function statutRendu(projet: Projet | null): string {
  const column = prospectColumns(actions({ projet })).find((entry) => entry.id === 'statut');
  if (column?.cell === undefined || typeof column.cell !== 'function') {
    throw new Error('La colonne « Statut » n’a pas de rendu.');
  }
  const context = { row: { original: prospect } } as CellContext<ProspectRow, unknown>;
  return render(<>{flexRender(column.cell, context)}</>).container.textContent ?? '';
}

describe('nom des colonnes du parcours CHUES', () => {
  it('la colonne du statut d’appel dit ce qu’elle contient, sans numéro de phase', () => {
    const column = prospectColumns(actions({})).find((entry) => entry.id === 'phase2Status');

    expect(column?.header).toBe('Résultat de l’appel');
  });
});

describe('colonne « Statut »', () => {
  it('montre le statut du PARCOURS filtré, pas celui du point d’entrée', () => {
    expect(statutRendu('GRAND_PUBLIC')).toBe('Converti');
    expect(statutRendu('CHUES')).toBe('Contacté');
  });

  it('retombe sur le premier niveau quand l’écran ne vise aucun projet', () => {
    expect(statutRendu(null)).toBe('Nouveau');
  });
});
