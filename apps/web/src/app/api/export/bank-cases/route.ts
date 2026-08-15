import { relayXlsx, toSearchParams } from '@/app/api/export/relay';
import { parseBankFilters, toBankFilterQuery } from '@/lib/bank-filters';
import { bankExportFileName } from '@/lib/data/export';

/**
 * `GET /api/export/bank-cases`
 *
 * Relais vers `GET {API_URL}/api/v1/export/bank-cases.xlsx` : trois feuilles :
 * Dossiers, Historique, Synthèse.
 *
 * Le rôle est vérifié ICI en plus de l'API. L'API l'exigerait de toute façon,
 * mais un COMMERCIAL recevrait alors un 403 relayé en 502 « L'export a
 * échoué », message qui accuse le serveur là où la vraie réponse est « ce n'est
 * pas votre écran ».
 */
export async function GET(request: Request): Promise<Response> {
  const filters = parseBankFilters(new URL(request.url).searchParams);

  return relayXlsx({
    upstreamPath: 'export/bank-cases.xlsx',
    search: toSearchParams(toBankFilterQuery(filters)),
    filename: bankExportFileName(),
    allowedRoles: ['ADMIN', 'BANQUE_FINANCE'],
  });
}
