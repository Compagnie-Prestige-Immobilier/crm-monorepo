import { describe, expect, it } from 'vitest';

import {
  canSubmitDisable,
  canSubmitEnable,
  demoBreakdown,
  demoControl,
  seededAtOrNull,
  totalDemoRows,
} from '@/lib/data/demo';
import type { DemoCounts, DemoStatus } from '@/lib/types';

/**
 * Garde-fous du mode démonstration.
 *
 * La désactivation supprime des milliers de lignes. Ce n'est pas une action
 * qu'on protège par une intention : on la protège par une fonction, et on
 * l'éprouve. Chaque `expect(false)` de ce fichier correspond à un clic qui ne
 * doit PAS partir.
 */

const COUNTS: DemoCounts = {
  users: 4,
  representants: 12,
  prospects: 4210,
  campaigns: 2,
  campaignCommerciaux: 0,
  callTasks: 800,
  callAttempts: 350,
  bankCases: 40,
  bankCaseTransitions: 96,
};

function status(overrides: Partial<DemoStatus> = {}): DemoStatus {
  return {
    enabled: true,
    seededAt: '2026-08-12T09:00:00.000Z',
    canToggle: true,
    reason: null,
    counts: COUNTS,
    ...overrides,
  };
}

describe('la désactivation ne part JAMAIS par accident', () => {
  it('exige la confirmation explicite de la boîte de dialogue', () => {
    expect(canSubmitDisable({ status: status(), confirmed: false, pending: false })).toBe(false);
    expect(canSubmitDisable({ status: status(), confirmed: true, pending: false })).toBe(true);
  });

  it('bloque le second clic pendant que le premier court', () => {
    // Sans ce verrou, un double-clic envoie deux suppressions : la seconde ne
    // détruit rien de plus — l'API ne supprime que ce qu'elle a enregistré —
    // mais affiche une erreur au moment où la première vient de réussir.
    expect(canSubmitDisable({ status: status(), confirmed: true, pending: true })).toBe(false);
  });

  it('refuse quand l’environnement interdit la bascule', () => {
    expect(
      canSubmitDisable({
        status: status({ canToggle: false, reason: 'Interdit en production.' }),
        confirmed: true,
        pending: false,
      }),
    ).toBe(false);
  });

  it('refuse quand le mode n’est même pas actif', () => {
    expect(
      canSubmitDisable({ status: status({ enabled: false }), confirmed: true, pending: false }),
    ).toBe(false);
  });
});

describe('l’activation obéit aux mêmes verrous', () => {
  it('n’est proposée que si le mode est inactif et la bascule autorisée', () => {
    expect(canSubmitEnable({ status: status({ enabled: false }), pending: false })).toBe(true);
    expect(canSubmitEnable({ status: status({ enabled: true }), pending: false })).toBe(false);
    expect(
      canSubmitEnable({ status: status({ enabled: false, canToggle: false }), pending: false }),
    ).toBe(false);
    expect(canSubmitEnable({ status: status({ enabled: false }), pending: true })).toBe(false);
  });
});

describe('demoControl', () => {
  it('rend la RAISON quand la bascule est interdite, jamais un bouton muet', () => {
    // Un bouton grisé sans explication envoie ouvrir un ticket. La phrase du
    // contrat dit quoi faire.
    const control = demoControl(
      status({ canToggle: false, reason: 'DEMO_MODE_ALLOWED ne vaut pas true.' }),
    );
    expect(control).toEqual({ kind: 'blocked', reason: 'DEMO_MODE_ALLOWED ne vaut pas true.' });
  });

  it('fournit une phrase de repli si l’API oublie la raison', () => {
    const control = demoControl(status({ canToggle: false, reason: null }));
    expect(control.kind).toBe('blocked');
    expect(control.kind === 'blocked' ? control.reason : '').not.toBe('');
  });

  it('propose la bonne action selon l’état', () => {
    expect(demoControl(status({ enabled: false })).kind).toBe('enable');
    expect(demoControl(status({ enabled: true })).kind).toBe('disable');
  });
});

describe('ce que la confirmation annonce', () => {
  it('somme tous les compteurs', () => {
    expect(totalDemoRows(COUNTS)).toBe(4 + 12 + 4210 + 2 + 800 + 350 + 40 + 96);
  });

  it('écarte les catégories à zéro du détail', () => {
    // « 0 dossier bancaire » à côté de « 4 210 prospects » dilue le seul
    // chiffre qui compte et allonge une boîte qu'il faut lire d'un coup d'œil.
    const rows = demoBreakdown({ ...COUNTS, bankCases: 0, campaigns: 0 });
    const labels = rows.map((row) => row.label);
    expect(labels).not.toContain('dossiers bancaires');
    expect(labels).not.toContain('campagnes d’appels');
    expect(labels).toContain('prospects');
  });

  it('rend un détail vide quand rien n’a été créé', () => {
    const empty = Object.fromEntries(
      Object.keys(COUNTS).map((key) => [key, 0]),
    ) as unknown as DemoCounts;
    expect(demoBreakdown(empty)).toEqual([]);
    expect(totalDemoRows(empty)).toBe(0);
  });
});

describe('seededAtOrNull', () => {
  it('traite la chaîne vide comme une absence de date', () => {
    // Constaté sur la pile de développement : l'API renvoie `seededAt: ""` —
    // et non `null` — quand le mode n'a jamais été activé. Passée à `parseISO`,
    // cette chaîne produit `Invalid Date`, puis un plantage de rendu dans
    // `date-fns/format`.
    expect(seededAtOrNull({ seededAt: '' })).toBeNull();
    expect(seededAtOrNull({ seededAt: '   ' })).toBeNull();
    expect(seededAtOrNull({ seededAt: null })).toBeNull();
  });

  it('rend la date telle quelle quand elle existe', () => {
    expect(seededAtOrNull({ seededAt: '2026-08-12T09:00:00.000Z' })).toBe(
      '2026-08-12T09:00:00.000Z',
    );
  });
});
