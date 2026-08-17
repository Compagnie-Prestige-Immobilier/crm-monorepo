import { relayXlsx, toSearchParams } from '@/app/api/export/relay';
import { parseBankFilters, toBankFilterQuery } from '@/lib/bank-filters';
import { bankExportFileName } from '@/lib/data/export';

export async function GET(request: Request): Promise<Response> {
  const filters = parseBankFilters(new URL(request.url).searchParams);

  return relayXlsx({
    upstreamPath: 'export/bank-cases.xlsx',
    search: toSearchParams(toBankFilterQuery(filters)),
    filename: bankExportFileName(),
    allowedRoles: ['ADMIN', 'BANQUE_FINANCE'],
  });
}
