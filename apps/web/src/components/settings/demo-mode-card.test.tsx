import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DemoModule from '@/lib/data/demo';
import { renderWithQuery } from '@/test/render-query';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * L'ACTIVATION doit se confirmer, elle aussi.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'asymétrie corrigée était à l'envers : retirer le jeu de démonstration
 * exigeait une case à cocher, l'installer partait au PREMIER CLIC. C'est
 * pourtant l'activation qui pollue les chiffres de tout le monde, puisqu'elle
 * ensemence des milliers de lignes crédibles qui apparaissent aussitôt dans les
 * tableaux de bord, les statistiques et les exports de chaque rôle.
 *
 * Le test le plus important est donc le premier : cliquer « Activer » ne doit
 * RIEN ensemencer. Une régression ici est invisible à la relecture (le bouton a
 * exactement la même allure) et coûteuse en production.
 */

/**
 * Les compteurs sont donnés AU COMPLET, même si aucun test ne les lit :
 * `totalDemoRows` les additionne pour le message de succès, et un champ absent
 * produirait un « NaN lignes créées » qu'un objet vide laisserait passer en
 * silence.
 */
const COUNTS = {
  users: 0,
  representants: 0,
  prospects: 0,
  campaigns: 0,
  campaignCommerciaux: 0,
  callTasks: 0,
  callAttempts: 0,
  bankCases: 0,
  bankCaseTransitions: 0,
};

const enableDemoMode = vi.fn(() =>
  Promise.resolve({ enabled: true, seededAt: null, counts: { ...COUNTS, prospects: 1200 } }),
);
const fetchDemoStatus = vi.fn();

vi.mock('@/lib/data/demo', async () => {
  const actual = await vi.importActual<typeof DemoModule>('@/lib/data/demo');
  return {
    ...actual,
    fetchDemoStatus: () => fetchDemoStatus() as unknown,
    enableDemoMode: () => enableDemoMode(),
    disableDemoMode: () => Promise.resolve({}),
  };
});

const { DemoModeCard } = await import('@/components/settings/demo-mode-card');

const IDLE_STATUS = {
  enabled: false,
  canToggle: true,
  reason: null,
  seededAt: null,
  counts: COUNTS,
};

describe('DemoModeCard, activation', () => {
  beforeEach(() => {
    enableDemoMode.mockClear();
    fetchDemoStatus.mockReturnValue(Promise.resolve(IDLE_STATUS));
  });

  it('n’ensemence RIEN au premier clic : elle demande confirmation', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    expect(enableDemoMode).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: /Créer le jeu de démonstration/ }),
    ).toBeTruthy();
  });

  it('nomme ce qui va être créé, plutôt que de promettre « un jeu »', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    // La conséquence qui décide du clic : les chiffres cessent d'être réels.
    expect(await screen.findByText(/ne seront plus des chiffres réels/)).toBeTruthy();
    // Et la contrepartie, sans laquelle personne n'ose : c'est réversible.
    expect(screen.getByText(/Réversible/)).toBeTruthy();
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * La LECTURE SEULE doit être annoncée AVANT le clic, pas découverte après.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Activer la démonstration ne fait pas que salir des chiffres : l'API passe
   * TOUTE la plateforme en lecture seule et refuse chaque écriture par un 409
   * `DEMO_MODE_READ_ONLY`, pour tous les utilisateurs à la fois. L'opérateur qui
   * bascule ne le subit pas lui-même le premier : ce sont ses collègues qui
   * découvrent une saisie refusée, la lisent comme une panne, et ouvrent un
   * ticket au lieu d'éteindre l'interrupteur.
   *
   * La confirmation d'activation est le SEUL moment où l'information sert
   * encore à quelque chose.
   */
  it('annonce que TOUTE la plateforme passe en lecture seule, pour tous', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    const dialog = await screen.findByRole('dialog');
    // « lecture seule » seul ne suffit pas : la portée est ce qui change la
    // décision, donc « tous les utilisateurs » doit y être aussi.
    expect(dialog.textContent).toMatch(/lecture seule/u);
    expect(dialog.textContent).toMatch(/tous les utilisateurs/u);
  });

  /**
   * « Lecture seule » sans exceptions se lit « plus rien ne marche ».
   *
   * Un administrateur qui le croit n'ose plus lancer une démonstration en
   * journée. Les quatre chemins qui restent ouverts sont donc nommés, et c'est
   * une liste courte parce qu'elle doit être lue d'un coup d'œil.
   */
  it('nomme ce qui continue de fonctionner malgré la lecture seule', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    const text = (await screen.findByRole('dialog')).textContent;
    expect(text).toMatch(/se connecter/u);
    expect(text).toMatch(/rebasculer ce réglage/u);
    expect(text).toMatch(/synchronisation mobile/u);
    expect(text).toMatch(/notification comme lue/u);
  });

  /**
   * LA phrase qui décide si la bascule part.
   *
   * La crainte qu'elle lève est celle qui a dicté toute la conception côté
   * serveur : « et les saisies du terrain pendant ce temps, je les perds ? ».
   * La remontée hors ligne n'est JAMAIS refusée, et ce qui arrive par ce chemin
   * est écrit comme du travail réel, qui survit à l'extinction du mode. Sans
   * cette phrase, la démonstration ne se lance qu'après 20 h.
   */
  it('affirme que les saisies du terrain sont réelles et survivent', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    const text = (await screen.findByRole('dialog')).textContent;
    // Deux affirmations, et il faut les deux : ce qui remonte est écrit comme
    // réel, et cela reste après extinction. Une troisième assertion portait sur
    // « ne perdent rien », une redite de ces deux-là que la copie a perdue.
    expect(text).toMatch(/données réelles/u);
    expect(text).toMatch(/restent en place une fois le mode désactivé/u);
  });

  it('annuler la confirmation n’ensemence pas', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(enableDemoMode).not.toHaveBeenCalled();
  });

  it('n’ensemence qu’une fois la confirmation validée', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Créer le jeu de démonstration/ }),
    );

    await waitFor(() => {
      expect(enableDemoMode).toHaveBeenCalledTimes(1);
    });
  });
});
