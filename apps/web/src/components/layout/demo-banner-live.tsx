'use client';

import { useQuery } from '@tanstack/react-query';

import { DemoBanner } from '@/components/layout/demo-banner';
import { useLive } from '@/components/live/use-live';
import { demoBannerState, fetchDemoStatus, type DemoBannerState } from '@/lib/data/demo';
import { LIVE_SLOW_INTERVAL_MS } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

export function DemoBannerLive({ initial, role }: { initial: DemoBannerState; role: Role }) {
  const live = useLive({ intervalMs: LIVE_SLOW_INTERVAL_MS });

  const { data } = useQuery({
    queryKey: queryKeys.demoBanner,
    queryFn: async (): Promise<DemoBannerState> => demoBannerState(await fetchDemoStatus()),
    initialData: initial,
    staleTime: LIVE_SLOW_INTERVAL_MS,
    refetchInterval: live.refetchInterval,
    refetchOnWindowFocus: true,
  });

  if (!data.enabled) return null;

  return <DemoBanner seededAt={data.seededAt} role={role} />;
}
