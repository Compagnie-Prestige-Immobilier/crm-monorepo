'use client';

import { useQuery } from '@tanstack/react-query';

import { DemoBanner } from '@/components/layout/demo-banner';
import { useLive } from '@/components/live/use-live';
import { demoBannerState, fetchDemoStatus, type DemoBannerState } from '@/lib/data/demo';
import { LIVE_SLOW_INTERVAL_MS } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

/**
 * Le bandeau du mode démonstration, tenu à jour SANS rechargement de page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le défaut corrigé : le bandeau prévenait tout le monde, sauf ceux qui
 * travaillaient déjà.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le bandeau était posé par le layout SERVEUR à partir de l'état lu au rendu.
 * Quand un administrateur bascule le mode, sa propre page se rafraîchit
 * (`DemoModeCard.afterToggle()` appelle `router.refresh()`) : lui voit le
 * bandeau. Tous les AUTRES restent sur l'écran qu'ils avaient déjà ouvert, sans
 * navigation ni rechargement, donc sans bandeau : ils apprennent la lecture
 * seule par le 409 `DEMO_MODE_READ_ONLY`, c'est-à-dire APRÈS avoir rempli un
 * formulaire et cliqué. Un avertissement qui n'arrive qu'après le geste qu'il
 * devait prévenir n'est plus un avertissement : c'est un constat d'échec.
 *
 * Le sens de la transition inverse compte autant : le mode éteint, un bandeau
 * resté affiché ferait douter des chiffres justes, et une page qu'on n'a pas
 * rechargée le garderait indéfiniment.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le rendu serveur reste le PREMIER, le sondage ne fait que le corriger.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `initial` vient du layout serveur et devient l'`initialData` de la requête :
 * au chargement complet d'une page, le bandeau est donc dans le premier HTML,
 * sans requête ni clignotement. Le remplacer par un simple `useQuery` aurait
 * échangé un défaut contre un autre : le bandeau serait apparu après coup, une
 * fois les chiffres déjà lus.
 *
 * `staleTime` égal au rythme de sondage pour la même raison : sans lui, chaque
 * chargement de page relancerait aussitôt un appel pour redemander ce que le
 * serveur venait de rendre.
 *
 * Un SEUL bandeau existe, et c'est celui-ci : `DemoBanner` reste un composant
 * de présentation, monté ou démonté selon l'état. La hauteur utile du panel est
 * courte, et deux bandes horizontales mangeraient la première ligne de chaque
 * tableau.
 *
 * Le composant est monté MÊME quand le mode est éteint : c'est la seule façon
 * de sonder la transition éteint → allumé, celle qui prévient. Il ne rend alors
 * rien.
 */
export function DemoBannerLive({ initial, role }: { initial: DemoBannerState; role: Role }) {
  // Sondage LENT : l'interrupteur bascule quelques fois par jour, et le panel
  // est consulté depuis des connexions facturées au volume. Voir
  // `LIVE_SLOW_INTERVAL_MS` pour l'arbitrage. `useLive` apporte le reste, qui
  // n'est pas propre au bandeau : plus aucune requête quand l'onglet passe en
  // arrière-plan, et ralentissement après un échec.
  const live = useLive({ intervalMs: LIVE_SLOW_INTERVAL_MS });

  const { data } = useQuery({
    queryKey: queryKeys.demoBanner,
    queryFn: async (): Promise<DemoBannerState> => demoBannerState(await fetchDemoStatus()),
    initialData: initial,
    staleTime: LIVE_SLOW_INTERVAL_MS,
    refetchInterval: live.refetchInterval,
    /**
     * L'exception au réglage global (`refetchOnWindowFocus: false`), et elle
     * est la conséquence directe de l'arrêt en arrière-plan : un onglet laissé
     * de côté ne sonde plus, donc son bandeau vieillit sans limite. Sans cette
     * ligne, quelqu'un qui revient à son panel après une heure attendrait
     * encore une minute avant d'être averti, exactement pendant la minute où il
     * reprend sa saisie. Le `staleTime` ci-dessus empêche l'abus : revenir deux
     * fois en dix secondes ne déclenche rien.
     */
    refetchOnWindowFocus: true,
  });

  // Un cycle en échec ne remet RIEN en cause : TanStack conserve la dernière
  // valeur connue, et c'est celle du serveur tant que rien n'a abouti. Un
  // bandeau qui disparaîtrait sur une erreur réseau serait le pire des états :
  // les écritures resteraient refusées, sans rien pour l'expliquer.
  if (!data.enabled) return null;

  return <DemoBanner seededAt={data.seededAt} role={role} />;
}
