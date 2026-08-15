import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DemoModule from '@/lib/data/demo';
import { LIVE_INTERVAL_MS, LIVE_SLOW_INTERVAL_MS } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import { renderWithQuery } from '@/test/render-query';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Le bandeau doit atteindre ceux qui NE NAVIGUENT PAS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le bandeau est rendu par le layout serveur. Quand un administrateur bascule le
 * mode démonstration, sa page à lui se rafraîchit ; celles de tous les autres,
 * non. Ils restent sur l'écran déjà ouvert, sans bandeau, et découvrent la
 * lecture seule au 409 `DEMO_MODE_READ_ONLY` : après avoir rempli un formulaire.
 * Le bandeau existe pour prévenir AVANT le geste, pas pour expliquer l'échec
 * après.
 *
 * Les deux sens comptent. Éteindre le mode doit faire disparaître le bandeau
 * partout, sinon des chiffres redevenus justes restent marqués comme faux.
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

/** Ce que rend `GET /admin/demo`, au complet : `demoBannerState` en dérive. */
function apiStatus(enabled: boolean) {
  return { enabled, canToggle: true, reason: null, seededAt: '', counts: COUNTS };
}

const fetchDemoStatus = vi.fn();

vi.mock('@/lib/data/demo', async () => {
  const actual = await vi.importActual<typeof DemoModule>('@/lib/data/demo');
  return { ...actual, fetchDemoStatus: () => fetchDemoStatus() as unknown };
});

const { DemoBannerLive } = await import('@/components/layout/demo-banner-live');

/** Un cycle de sondage entier, marge comprise. */
async function passerUnCycle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LIVE_SLOW_INTERVAL_MS + 1_000);
  });
}

/**
 * `visibilityState` est en lecture seule dans jsdom : on redéfinit l'accesseur,
 * et on le remet à « visible » après chaque test pour ne pas éteindre le
 * sondage des suivants.
 */
function masquerOnglet(): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchDemoStatus.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

describe('DemoBannerLive', () => {
  /**
   * Le rendu serveur reste le PREMIER : un bandeau qui attendrait sa propre
   * requête apparaîtrait après que l'utilisateur a commencé à lire les chiffres,
   * et clignoterait à chaque chargement de page.
   */
  it('affiche le bandeau dès le premier rendu, sans attendre le réseau', () => {
    // Une promesse qui ne se résout JAMAIS : rien ne peut venir du réseau.
    fetchDemoStatus.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<DemoBannerLive initial={{ enabled: true, seededAt: null }} role="ADMIN" />);

    // Volontairement synchrone, sans `findBy` : le bandeau est là ou il ne l'est
    // pas, et « il arrive plus tard » est précisément le défaut refusé ici.
    expect(screen.getByRole('status').textContent).toMatch(/Mode démonstration actif/u);
  });

  it('ne rend rien quand le mode est éteint', () => {
    fetchDemoStatus.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  /**
   * LE défaut corrigé. L'écran est ouvert, le mode est éteint, personne ne
   * navigue : le bandeau doit apparaître de lui-même.
   */
  it('fait apparaître le bandeau quand un autre poste allume le mode', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(
      <DemoBannerLive initial={{ enabled: false, seededAt: null }} role="COMMERCIAL" />,
    );
    expect(screen.queryByRole('status')).toBeNull();

    await passerUnCycle();

    expect(screen.getByRole('status').textContent).toMatch(/écritures suspendues/u);
  });

  /**
   * La transition INVERSE, tout aussi indispensable : un bandeau resté affiché
   * après l'extinction ferait douter de chiffres redevenus justes, et
   * l'utilisateur n'a aucune raison de recharger sa page pour s'en assurer.
   */
  it('fait disparaître le bandeau quand le mode est éteint ailleurs', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(false));

    renderWithQuery(
      <DemoBannerLive
        initial={{ enabled: true, seededAt: '2026-03-04T10:00:00.000Z' }}
        role="ADMIN"
      />,
    );
    expect(screen.getByRole('status')).toBeTruthy();

    await passerUnCycle();

    expect(screen.queryByRole('status')).toBeNull();
  });

  /**
   * UN seul bandeau, jamais deux empilés : la hauteur utile du panel est déjà
   * courte, et une seconde bande horizontale mangerait la première ligne de
   * chaque tableau. Le sondage CORRIGE le rendu serveur, il ne s'ajoute pas à
   * lui.
   */
  it('n’empile pas un second bandeau sur celui du serveur', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(<DemoBannerLive initial={{ enabled: true, seededAt: null }} role="ADMIN" />);

    await passerUnCycle();
    await passerUnCycle();

    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * L'opérateur, lui, n'attend pas le cycle suivant.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `DemoModeCard.afterToggle()` invalide `queryKeys.demoStatus` après une
   * bascule. La clé du bandeau est un ENFANT de celle-là (`['demo-status',
   * 'banner']`) précisément pour tomber dans le même appel : rebaptiser la clé
   * en quelque chose d'indépendant laisserait l'administrateur qui vient de
   * cliquer devant un bandeau qui met une minute à le suivre, sur le seul écran
   * où le contraste entre le réglage et le bandeau saute aux yeux.
   */
  it('suit une bascule faite depuis ce poste, sans attendre le cycle', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    const { client } = renderWithQuery(
      <DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />,
    );

    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.demoStatus });
      // Le rendu que TanStack planifie après le cycle : sans ce tour de boucle,
      // l'assertion lirait le DOM d'avant, et le test échouerait pour une
      // raison sans rapport avec ce qu'il éprouve.
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole('status').textContent).toMatch(/Mode démonstration actif/u);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Le rythme est LENT, et c'est une exigence, pas un réglage.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Ce bandeau est monté sur TOUS les écrans du panel et pour TOUS les
   * utilisateurs. Au rythme nominal des tableaux de bord (dix secondes), il
   * coûterait six requêtes par minute et par onglet pour surveiller un
   * interrupteur basculé quelques fois par jour, sur des connexions facturées au
   * volume. Le test éprouve donc les deux bornes : rien n'est parti au bout de
   * dix secondes, quelque chose est parti au bout d'une minute.
   */
  it('sonde au rythme lent, et non à celui des tableaux de bord', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(<DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_INTERVAL_MS + 1_000);
    });
    expect(fetchDemoStatus).not.toHaveBeenCalled();

    await passerUnCycle();
    expect(fetchDemoStatus).toHaveBeenCalledTimes(1);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Un onglet en arrière-plan ne sonde PAS.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Un onglet laissé ouvert toute la nuit émettrait sinon des centaines de
   * requêtes pour un écran que personne ne regarde, sur une connexion facturée
   * au volume.
   *
   * La garantie est ici DOUBLE : `useLive` ne planifie rien quand la page est
   * cachée, et TanStack ne déclenche de toute façon pas un cycle hors premier
   * plan tant que `refetchIntervalInBackground` reste à son défaut. Ce test
   * éprouve donc le comportement observable, pas l'une des deux mises en œuvre :
   * il passe au rouge dès que l'une ou l'autre est contournée, ce qui est la
   * seule chose qui compte pour la facture de l'utilisateur.
   */
  it('ne sonde pas tant que l’onglet est en arrière-plan', async () => {
    masquerOnglet();
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(<DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />);

    await passerUnCycle();
    await passerUnCycle();
    await passerUnCycle();

    expect(fetchDemoStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  /**
   * Un cycle qui échoue ne doit RIEN effacer : les écritures restent refusées
   * par l'API, donc l'avertissement doit rester à l'écran. Effacer le bandeau
   * sur une panne réseau produirait l'état le plus trompeur possible.
   */
  it('garde le bandeau quand un cycle de sondage échoue', async () => {
    fetchDemoStatus.mockRejectedValue(new Error('réseau'));

    renderWithQuery(<DemoBannerLive initial={{ enabled: true, seededAt: null }} role="ADMIN" />);

    await passerUnCycle();

    expect(screen.getByRole('status')).toBeTruthy();
  });
});
