import { describe, expect, it } from 'vitest';

import {
  LIVE_ERROR_INTERVAL_MS,
  LIVE_INTERVAL_MS,
  LIVE_SLOW_INTERVAL_MS,
  liveInterval,
  liveLabel,
  shouldShowError,
  shouldShowSkeleton,
} from '@/lib/live';

const RUNNING = { hidden: false, failing: false, paused: false };

describe('rythme de sondage', () => {
  it('sonde au rythme nominal quand l’écran est regardé', () => {
    expect(liveInterval(RUNNING)).toBe(LIVE_INTERVAL_MS);
  });

  it('s’arrête quand l’onglet passe en arrière-plan', () => {
    expect(liveInterval({ ...RUNNING, hidden: true })).toBe(false);
  });

  it('s’arrête sur pause manuelle, même onglet visible', () => {
    expect(liveInterval({ ...RUNNING, paused: true })).toBe(false);
  });

  it('ralentit après un échec plutôt que d’insister', () => {
    expect(liveInterval({ ...RUNNING, failing: true })).toBe(LIVE_ERROR_INTERVAL_MS);
  });

  it('fait primer la pause sur l’échec', () => {
    expect(liveInterval({ hidden: false, failing: true, paused: true })).toBe(false);
  });

  it('rend false et jamais zéro à l’arrêt', () => {
    // `0` signifierait « aussi vite que possible » pour TanStack Query.
    expect(liveInterval({ ...RUNNING, hidden: true })).not.toBe(0);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sonder plus LENTEMENT, sans rien perdre des précautions.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le bandeau du mode démonstration suit un interrupteur basculé quelques fois
 * par jour, et il est monté sur TOUS les écrans du panel : le rythme des
 * tableaux de bord y coûterait six requêtes par minute et par onglet pour ne
 * rien voir changer. Le rythme se choisit donc à l'appel ; l'arrêt en
 * arrière-plan, la pause et le ralentissement après échec, non : les redéfinir
 * ailleurs les ferait diverger, et c'est eux qui rendent le sondage supportable.
 */
describe('rythme choisi par l’appelant', () => {
  it('sonde au rythme demandé plutôt qu’au rythme nominal', () => {
    expect(liveInterval(RUNNING, LIVE_SLOW_INTERVAL_MS)).toBe(LIVE_SLOW_INTERVAL_MS);
    expect(LIVE_SLOW_INTERVAL_MS).toBeGreaterThan(LIVE_INTERVAL_MS);
  });

  it('garde le rythme nominal quand rien n’est demandé', () => {
    expect(liveInterval(RUNNING, undefined)).toBe(LIVE_INTERVAL_MS);
  });

  it('s’arrête toujours en arrière-plan, quel que soit le rythme', () => {
    expect(liveInterval({ ...RUNNING, hidden: true }, LIVE_SLOW_INTERVAL_MS)).toBe(false);
    expect(liveInterval({ ...RUNNING, paused: true }, LIVE_SLOW_INTERVAL_MS)).toBe(false);
  });

  /**
   * Le ralentissement après échec est un PLANCHER, jamais une valeur fixe :
   * appliqué tel quel à un sondage plus lent que lui, il l'ACCÉLÉRERAIT, et une
   * API en peine se verrait interrogée plus souvent parce qu'elle a échoué.
   */
  it('n’accélère jamais un sondage lent après un échec', () => {
    const slow = 5 * 60_000;
    expect(liveInterval({ ...RUNNING, failing: true }, slow)).toBe(slow);
    expect(liveInterval({ ...RUNNING, failing: true }, 1_000)).toBe(LIVE_ERROR_INTERVAL_MS);
  });
});

describe('squelette et erreur', () => {
  it('ne montre le squelette qu’au tout premier chargement', () => {
    expect(shouldShowSkeleton({ isPending: true, hasData: false })).toBe(true);
    expect(shouldShowSkeleton({ isPending: true, hasData: true })).toBe(false);
    expect(shouldShowSkeleton({ isPending: false, hasData: true })).toBe(false);
  });

  it('n’efface pas un écran correct parce qu’un cycle a échoué', () => {
    expect(shouldShowError({ isError: true, hasData: true })).toBe(false);
    expect(shouldShowError({ isError: true, hasData: false })).toBe(true);
  });
});

describe('libellé de l’indicateur', () => {
  it('nomme l’état sans décrire le réseau', () => {
    expect(liveLabel(RUNNING)).toBe('En direct');
    expect(liveLabel({ ...RUNNING, paused: true })).toBe('En pause');
    expect(liveLabel({ ...RUNNING, hidden: true })).toBe('En pause');
    expect(liveLabel({ ...RUNNING, failing: true })).toBe('Interrompu');
  });
});
