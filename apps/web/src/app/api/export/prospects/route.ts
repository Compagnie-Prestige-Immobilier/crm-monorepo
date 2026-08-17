import { relayXlsx, toSearchParams } from '@/app/api/export/relay';
import { toFilterQuery } from '@/lib/api/query-params';
import { exportFileName, type ProspectExportMode } from '@/lib/data/export';
import { parseProspectFilters } from '@/lib/filters';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode: ProspectExportMode =
    url.searchParams.get('mode') === 'consolidated' ? 'consolidated' : 'filtered';

  const filters = parseProspectFilters(url.searchParams);
  const query = toFilterQuery(mode === 'consolidated' ? { ...filters, segment: null } : filters);

  const search = toSearchParams(query);
  if (mode === 'consolidated') search.set('mode', 'consolidated');

  return relayXlsx({
    upstreamPath: 'export/prospects.xlsx',
    search,
    filename: exportFileName(new Date(), mode),
  });
}
