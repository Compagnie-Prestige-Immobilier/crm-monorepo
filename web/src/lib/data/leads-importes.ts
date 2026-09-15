import { apiQuery } from '@crm/api-client/query';

import { getServeurClient, type components } from '@/api/compat/serveur';

export type ImportDeLeads = components['schemas']['ImportDeLeads'];
export type LeadTresInteresse = components['schemas']['LeadTresInteresse'];

const CHEMIN = '/api/v1/supervision/leads-importes';

export function leadsImportesQuery() {
  return apiQuery(CHEMIN, {}, () => getServeurClient().GET(CHEMIN));
}
