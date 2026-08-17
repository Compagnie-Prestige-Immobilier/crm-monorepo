'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_CAMPAIGN_FILTERS,
  parseCampaignFilters,
  serializeCampaignFilters,
  type CampaignFilters,
} from '@/lib/campaign-filters';

const ADAPTER: UrlFilterAdapter<CampaignFilters> = {
  parse: parseCampaignFilters,
  serialize: serializeCampaignFilters,
  cleared: (current) => ({ ...EMPTY_CAMPAIGN_FILTERS, pageSize: current.pageSize }),
};

export function useCampaignFilters(): {
  filters: CampaignFilters;
  setFilters: (patch: Partial<CampaignFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
