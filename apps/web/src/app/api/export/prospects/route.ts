import { relayXlsx, toSearchParams } from '@/app/api/export/relay';
import { toFilterQuery } from '@/lib/api/query-params';
import { exportFileName, type ProspectExportMode } from '@/lib/data/export';
import { parseGrandPublicFilters } from '@/lib/data/grand-public';
import { parseProspectFilters } from '@/lib/filters';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode: ProspectExportMode =
    url.searchParams.get('mode') === 'consolidated' ? 'consolidated' : 'filtered';

  const filters = parseProspectFilters(url.searchParams);
  const query = toFilterQuery(mode === 'consolidated' ? { ...filters, segment: null } : filters);

  const search = toSearchParams(query);
  if (mode === 'consolidated') search.set('mode', 'consolidated');

  // Les deux critères que seul le Grand Public pose : `ProspectFilters` ne les
  // porte pas, et sans eux l'export rendrait plus de fiches que la liste.
  const grandPublic = parseGrandPublicFilters(url.searchParams);
  if (grandPublic.type !== null) search.set('type', grandPublic.type);
  if (grandPublic.canalProvenanceId !== null && UUID.test(grandPublic.canalProvenanceId)) {
    search.set('canalProvenanceId', grandPublic.canalProvenanceId);
  }

  return relayXlsx({
    upstreamPath: 'export/prospects.xlsx',
    search,
    filename: exportFileName(new Date(), mode),
  });
}
