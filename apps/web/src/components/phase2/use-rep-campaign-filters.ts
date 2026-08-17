'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_REP_CAMPAIGN_FILTERS,
  parseRepCampaignFilters,
  serializeRepCampaignFilters,
  type RepCampaignFilters,
} from '@/lib/rep-campaign-filters';

const ADAPTER: UrlFilterAdapter<RepCampaignFilters> = {
  parse: parseRepCampaignFilters,
  serialize: serializeRepCampaignFilters,
  cleared: (current) => ({ ...EMPTY_REP_CAMPAIGN_FILTERS, pageSize: current.pageSize }),
};

export function useRepCampaignFilters(): {
  filters: RepCampaignFilters;
  setFilters: (patch: Partial<RepCampaignFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
