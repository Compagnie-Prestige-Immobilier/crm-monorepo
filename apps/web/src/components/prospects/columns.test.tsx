import { describe, expect, it, vi } from 'vitest';

import { prospectColumns, type ProspectRowActions } from '@/components/prospects/columns';

const actions = (over: Partial<ProspectRowActions>): ProspectRowActions => ({
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
